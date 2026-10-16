import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { listEmployees, listLeaves, type FactorialEmployee } from "./client";
import type { Prisma } from "@prisma/client";

/** Abwesenheiten werden 30 Tage rückwirkend bis 180 Tage im Voraus abgeglichen. */
const PAST_DAYS = 30;
const FUTURE_DAYS = 180;

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function employeeEmails(e: FactorialEmployee) {
  return [e.email, e.login_email, e.communications_email]
    .filter((x): x is string => !!x)
    .map((x) => x.trim().toLowerCase());
}

export interface FactorialSyncOptions {
  /** Für Factorial-Mitarbeiter ohne passendes Konto automatisch Mitarbeiter-Konten anlegen. */
  createMissingUsers?: boolean;
}

export interface FactorialSyncResult {
  employeesMatched: number;
  usersCreated: number;
  absencesSynced: number;
  absencesRemoved: number;
  unmatched: { id: string; name: string; email: string | null }[];
}

/**
 * Gleicht Factorial-Mitarbeiter (per E-Mail) mit Benutzern ab und übernimmt
 * deren Abwesenheiten. Idempotent: Abwesenheiten werden per Factorial-ID
 * aktualisiert; im Zeitfenster nicht mehr gelieferte (gelöscht/abgelehnt)
 * werden entfernt.
 */
export async function runFactorialSync(options: FactorialSyncOptions = {}): Promise<FactorialSyncResult> {
  const started = Date.now();
  try {
    const result = await sync(options);
    await prisma.factorialSyncLog.create({
      data: {
        status: "ERFOLGREICH",
        message: `${result.employeesMatched} Mitarbeiter verknüpft, ${result.absencesSynced} Abwesenheiten übernommen${
          result.absencesRemoved ? `, ${result.absencesRemoved} entfernt` : ""
        }${result.usersCreated ? `, ${result.usersCreated} Konten angelegt` : ""}.`,
        employeesMatched: result.employeesMatched,
        usersCreated: result.usersCreated,
        absencesSynced: result.absencesSynced,
        unmatched: result.unmatched as Prisma.InputJsonValue,
        durationMs: Date.now() - started,
      },
    });
    return result;
  } catch (error) {
    await prisma.factorialSyncLog.create({
      data: {
        status: "FEHLER",
        message: error instanceof Error ? error.message : "Unbekannter Fehler",
        durationMs: Date.now() - started,
      },
    });
    throw error;
  }
}

async function sync({ createMissingUsers = false }: FactorialSyncOptions): Promise<FactorialSyncResult> {
  const employees = (await listEmployees()).filter((e) => e.active !== false);
  const users = await prisma.user.findMany({ select: { id: true, email: true, factorialEmployeeId: true } });
  const byEmail = new Map(users.map((u) => [u.email.toLowerCase(), u]));
  const byFactorialId = new Map(users.filter((u) => u.factorialEmployeeId).map((u) => [u.factorialEmployeeId!, u]));

  const employeeToUser = new Map<string, string>();
  const unmatched: FactorialSyncResult["unmatched"] = [];
  let usersCreated = 0;

  for (const e of employees) {
    const fid = String(e.id);
    const emails = employeeEmails(e);
    let user = byFactorialId.get(fid) ?? emails.map((m) => byEmail.get(m)).find(Boolean);

    if (!user && createMissingUsers && emails[0]) {
      // Zufälliges Passwort: Login erst nach Passwortvergabe durch einen Administrator
      const created = await prisma.user.create({
        data: {
          name: e.preferred_name ? `${e.preferred_name} ${e.last_name}` : e.full_name,
          email: emails[0],
          role: "MITARBEITER",
          passwordHash: await bcrypt.hash(randomBytes(24).toString("base64url"), 12),
          factorialEmployeeId: fid,
        },
        select: { id: true, email: true, factorialEmployeeId: true },
      });
      user = created;
      usersCreated++;
    }

    if (!user) {
      unmatched.push({ id: fid, name: e.full_name, email: emails[0] ?? null });
      continue;
    }
    if (user.factorialEmployeeId !== fid) {
      // Verknüpfung von einem evtl. vorherigen Konto lösen, dann setzen
      await prisma.user.updateMany({ where: { factorialEmployeeId: fid, NOT: { id: user.id } }, data: { factorialEmployeeId: null } });
      await prisma.user.update({ where: { id: user.id }, data: { factorialEmployeeId: fid } });
    }
    employeeToUser.set(fid, user.id);
  }

  const from = new Date();
  from.setUTCDate(from.getUTCDate() - PAST_DAYS);
  const to = new Date();
  to.setUTCDate(to.getUTCDate() + FUTURE_DAYS);

  const leaves = (await listLeaves(isoDate(from), isoDate(to))).filter((l) => !l.deleted_at && l.approved !== false);
  const seen: string[] = [];
  for (const leave of leaves) {
    const leaveId = String(leave.id);
    const employeeId = String(leave.employee_id);
    seen.push(leaveId);
    const data = {
      source: "FACTORIAL" as const,
      userId: employeeToUser.get(employeeId) ?? null,
      factorialEmployeeId: employeeId,
      employeeName: leave.employee_full_name ?? null,
      startOn: new Date(`${leave.start_on}T00:00:00Z`),
      finishOn: leave.finish_on ? new Date(`${leave.finish_on}T00:00:00Z`) : null,
      halfDay: leave.half_day ?? null,
      leaveTypeName: leave.leave_type_name ?? null,
      description: leave.description ?? null,
      approved: leave.approved ?? null,
    };
    await prisma.absence.upsert({ where: { factorialLeaveId: leaveId }, create: { ...data, factorialLeaveId: leaveId }, update: data });
  }

  // Im Zeitfenster nicht mehr vorhandene Factorial-Abwesenheiten entfernen
  const removed = await prisma.absence.deleteMany({
    where: {
      source: "FACTORIAL",
      factorialLeaveId: { notIn: seen.length ? seen : ["__none__"] },
      startOn: { lte: to },
      OR: [{ finishOn: null }, { finishOn: { gte: from } }],
    },
  });

  return {
    employeesMatched: employeeToUser.size - usersCreated,
    usersCreated,
    absencesSynced: leaves.length,
    absencesRemoved: removed.count,
    unmatched,
  };
}
