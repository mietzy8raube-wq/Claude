import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError, ApiError } from "@/lib/api-utils";
import { ENTITY_FIELDS, type ExcelEntity } from "@/lib/excel/fields";
import { parseSpreadsheet, mapAndValidateRows, type ColumnMapping, type RowValidationError } from "@/lib/excel/import";
import { logAudit } from "@/lib/audit";
import type { TaskStatus, Priority, ProjectStatus, ContactType, DecisionStatus } from "@prisma/client";

interface CommitOutcome {
  created: number;
  updated: number;
  skipped: number;
  errors: RowValidationError[];
}

async function importTasks(rows: { row: number; data: Record<string, unknown> }[], userId: string): Promise<CommitOutcome> {
  const outcome: CommitOutcome = { created: 0, updated: 0, skipped: 0, errors: [] };

  for (const { row, data } of rows) {
    const assignee = data.assigneeEmail
      ? await prisma.user.findUnique({ where: { email: String(data.assigneeEmail) } })
      : null;
    const project = data.project
      ? await prisma.project.findFirst({ where: { name: String(data.project) } })
      : null;
    let department = data.department
      ? await prisma.department.findUnique({ where: { name: String(data.department) } })
      : null;
    if (!department && data.department) {
      department = await prisma.department.create({ data: { name: String(data.department) } });
    }

    const payload = {
      title: String(data.title),
      description: data.description ? String(data.description) : null,
      assigneeId: assignee?.id ?? null,
      priority: (data.priority as Priority) ?? "MITTEL",
      status: (data.status as TaskStatus) ?? "OFFEN",
      dueDate: data.dueDate ? new Date(data.dueDate as string) : null,
      projectId: project?.id ?? null,
      departmentId: department?.id ?? null,
      category: data.category ? String(data.category) : null,
    };

    try {
      if (data.id) {
        const existing = await prisma.task.findUnique({ where: { id: String(data.id) } });
        if (!existing) {
          outcome.errors.push({ row, field: "ID", message: `Keine Aufgabe mit ID "${data.id}" gefunden` });
          continue;
        }
        await prisma.task.update({ where: { id: existing.id }, data: payload });
        outcome.updated++;
      } else {
        const duplicate = await prisma.task.findFirst({ where: { title: payload.title } });
        if (duplicate) {
          outcome.errors.push({ row, field: "Titel", message: `Duplikat übersprungen: "${payload.title}" existiert bereits` });
          outcome.skipped++;
          continue;
        }
        await prisma.task.create({ data: { ...payload, createdById: userId } });
        outcome.created++;
      }
    } catch (error) {
      outcome.errors.push({ row, field: "-", message: error instanceof Error ? error.message : "Unbekannter Fehler" });
    }
  }

  return outcome;
}

async function importProjects(rows: { row: number; data: Record<string, unknown> }[]): Promise<CommitOutcome> {
  const outcome: CommitOutcome = { created: 0, updated: 0, skipped: 0, errors: [] };

  for (const { row, data } of rows) {
    const owner = await prisma.user.findUnique({ where: { email: String(data.ownerEmail) } });
    if (!owner) {
      outcome.errors.push({ row, field: "Verantwortlicher", message: `Kein Benutzer mit E-Mail "${data.ownerEmail}" gefunden` });
      continue;
    }

    const payload = {
      name: String(data.name),
      description: data.description ? String(data.description) : null,
      status: (data.status as ProjectStatus) ?? "GEPLANT",
      progress: typeof data.progress === "number" ? data.progress : 0,
      startDate: data.startDate ? new Date(data.startDate as string) : null,
      targetDate: data.targetDate ? new Date(data.targetDate as string) : null,
      ownerId: owner.id,
      budget: typeof data.budget === "number" ? data.budget : null,
      budgetSpent: typeof data.budgetSpent === "number" ? data.budgetSpent : null,
    };

    try {
      if (data.id) {
        const existing = await prisma.project.findUnique({ where: { id: String(data.id) } });
        if (!existing) {
          outcome.errors.push({ row, field: "ID", message: `Kein Projekt mit ID "${data.id}" gefunden` });
          continue;
        }
        await prisma.project.update({ where: { id: existing.id }, data: payload });
        outcome.updated++;
      } else {
        const duplicate = await prisma.project.findFirst({ where: { name: payload.name } });
        if (duplicate) {
          outcome.errors.push({ row, field: "Name", message: `Duplikat übersprungen: "${payload.name}" existiert bereits` });
          outcome.skipped++;
          continue;
        }
        await prisma.project.create({ data: payload });
        outcome.created++;
      }
    } catch (error) {
      outcome.errors.push({ row, field: "-", message: error instanceof Error ? error.message : "Unbekannter Fehler" });
    }
  }

  return outcome;
}

async function importContacts(rows: { row: number; data: Record<string, unknown> }[]): Promise<CommitOutcome> {
  const outcome: CommitOutcome = { created: 0, updated: 0, skipped: 0, errors: [] };

  for (const { row, data } of rows) {
    const payload = {
      name: String(data.name),
      type: (data.type as ContactType) ?? "KUNDE",
      company: data.company ? String(data.company) : null,
      email: data.email ? String(data.email) : null,
      phone: data.phone ? String(data.phone) : null,
      notes: data.notes ? String(data.notes) : null,
    };

    try {
      if (data.id) {
        const existing = await prisma.contact.findUnique({ where: { id: String(data.id) } });
        if (!existing) {
          outcome.errors.push({ row, field: "ID", message: `Kein Kontakt mit ID "${data.id}" gefunden` });
          continue;
        }
        await prisma.contact.update({ where: { id: existing.id }, data: payload });
        outcome.updated++;
      } else {
        const duplicate = payload.email
          ? await prisma.contact.findFirst({ where: { email: payload.email } })
          : await prisma.contact.findFirst({ where: { name: payload.name } });
        if (duplicate) {
          outcome.errors.push({ row, field: "Name/E-Mail", message: `Duplikat übersprungen: "${payload.name}" existiert bereits` });
          outcome.skipped++;
          continue;
        }
        await prisma.contact.create({ data: payload });
        outcome.created++;
      }
    } catch (error) {
      outcome.errors.push({ row, field: "-", message: error instanceof Error ? error.message : "Unbekannter Fehler" });
    }
  }

  return outcome;
}

async function importCompanyMetrics(rows: { row: number; data: Record<string, unknown> }[]): Promise<CommitOutcome> {
  const outcome: CommitOutcome = { created: 0, updated: 0, skipped: 0, errors: [] };
  const areas = await prisma.companyArea.findMany();

  for (const { row, data } of rows) {
    const area = areas.find((a) => a.name.toLowerCase() === String(data.area).toLowerCase());
    if (!area) {
      outcome.errors.push({ row, field: "Unternehmensbereich", message: `Unbekannter Bereich "${data.area}"` });
      continue;
    }

    const payload = {
      companyAreaId: area.id,
      name: String(data.name),
      value: Number(data.value),
      unit: data.unit ? String(data.unit) : null,
      target: typeof data.target === "number" ? data.target : null,
      period: String(data.period),
    };

    try {
      if (data.id) {
        const existing = await prisma.companyMetric.findUnique({ where: { id: String(data.id) } });
        if (!existing) {
          outcome.errors.push({ row, field: "ID", message: `Keine Kennzahl mit ID "${data.id}" gefunden` });
          continue;
        }
        await prisma.companyMetric.update({ where: { id: existing.id }, data: payload });
        outcome.updated++;
      } else {
        const duplicate = await prisma.companyMetric.findFirst({
          where: { companyAreaId: area.id, name: payload.name, period: payload.period },
        });
        if (duplicate) {
          await prisma.companyMetric.update({ where: { id: duplicate.id }, data: payload });
          outcome.updated++;
        } else {
          await prisma.companyMetric.create({ data: payload });
          outcome.created++;
        }
      }
    } catch (error) {
      outcome.errors.push({ row, field: "-", message: error instanceof Error ? error.message : "Unbekannter Fehler" });
    }
  }

  return outcome;
}

async function importDecisions(rows: { row: number; data: Record<string, unknown> }[]): Promise<CommitOutcome> {
  const outcome: CommitOutcome = { created: 0, updated: 0, skipped: 0, errors: [] };

  for (const { row, data } of rows) {
    const responsible = await prisma.user.findUnique({ where: { email: String(data.responsibleEmail) } });
    if (!responsible) {
      outcome.errors.push({ row, field: "Verantwortlich", message: `Kein Benutzer mit E-Mail "${data.responsibleEmail}" gefunden` });
      continue;
    }

    const payload = {
      title: String(data.title),
      description: data.description ? String(data.description) : null,
      background: data.background ? String(data.background) : null,
      responsibleId: responsible.id,
      status: (data.status as DecisionStatus) ?? "VORBEREITUNG",
      decisionDeadline: data.decisionDeadline ? new Date(data.decisionDeadline as string) : null,
      finalDecision: data.finalDecision ? String(data.finalDecision) : null,
      decisionDate: data.decisionDate ? new Date(data.decisionDate as string) : null,
    };

    try {
      if (data.id) {
        const existing = await prisma.decision.findUnique({ where: { id: String(data.id) } });
        if (!existing) {
          outcome.errors.push({ row, field: "ID", message: `Keine Entscheidung mit ID "${data.id}" gefunden` });
          continue;
        }
        await prisma.decision.update({ where: { id: existing.id }, data: payload });
        outcome.updated++;
      } else {
        const duplicate = await prisma.decision.findFirst({ where: { title: payload.title } });
        if (duplicate) {
          outcome.errors.push({ row, field: "Titel", message: `Duplikat übersprungen: "${payload.title}" existiert bereits` });
          outcome.skipped++;
          continue;
        }
        await prisma.decision.create({ data: payload });
        outcome.created++;
      }
    } catch (error) {
      outcome.errors.push({ row, field: "-", message: error instanceof Error ? error.message : "Unbekannter Fehler" });
    }
  }

  return outcome;
}

function entityToImportExportEnum(entity: ExcelEntity) {
  const map: Record<ExcelEntity, "TASK" | "PROJECT" | "CONTACT" | "COMPANY_METRIC" | "DECISION"> = {
    tasks: "TASK",
    projects: "PROJECT",
    contacts: "CONTACT",
    companyMetrics: "COMPANY_METRIC",
    decisions: "DECISION",
  };
  return map[entity];
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const entity = formData.get("entity") as ExcelEntity | null;
    const mappingRaw = formData.get("mapping") as string | null;

    if (!file || !entity || !(entity in ENTITY_FIELDS) || !mappingRaw) {
      throw new ApiError(400, "Datei, Entitätstyp und Spaltenzuordnung sind erforderlich.");
    }

    const fields = ENTITY_FIELDS[entity];
    const buffer = Buffer.from(await file.arrayBuffer());
    const { rows } = await parseSpreadsheet(buffer, file.name);
    const mapping: ColumnMapping = JSON.parse(mappingRaw);
    const { valid, errors: validationErrors } = mapAndValidateRows(rows, mapping, [...fields]);

    let outcome: CommitOutcome;
    switch (entity) {
      case "tasks":
        outcome = await importTasks(valid, session.user.id);
        break;
      case "projects":
        outcome = await importProjects(valid);
        break;
      case "contacts":
        outcome = await importContacts(valid);
        break;
      case "companyMetrics":
        outcome = await importCompanyMetrics(valid);
        break;
      case "decisions":
        outcome = await importDecisions(valid);
        break;
    }

    const allErrors = [...validationErrors, ...outcome.errors];

    await logAudit({
      userId: session.user.id,
      action: "IMPORT",
      entityType: entity,
      description: `Import ${file.name}: ${outcome.created} neu, ${outcome.updated} aktualisiert, ${allErrors.length} Fehler/Duplikate`,
    });

    await prisma.excelOperationLog.create({
      data: {
        userId: session.user.id,
        type: "IMPORT",
        entity: entityToImportExportEnum(entity),
        fileName: file.name,
        totalRows: rows.length,
        successCount: outcome.created + outcome.updated,
        errorCount: allErrors.length,
        errors: allErrors as unknown as object,
      },
    });

    return NextResponse.json({
      totalRows: rows.length,
      created: outcome.created,
      updated: outcome.updated,
      skipped: outcome.skipped,
      errors: allErrors,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
