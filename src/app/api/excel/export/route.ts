import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, handleApiError, ApiError } from "@/lib/api-utils";
import { ENTITY_FIELDS, ENTITY_LABELS, type ExcelEntity } from "@/lib/excel/fields";
import { buildExportWorkbook } from "@/lib/excel/export";
import { logAudit } from "@/lib/audit";
import type { Prisma, TaskStatus, Priority } from "@prisma/client";

async function fetchRows(entity: ExcelEntity, searchParams: URLSearchParams): Promise<Record<string, unknown>[]> {
  switch (entity) {
    case "tasks": {
      const status = searchParams.get("status");
      const priority = searchParams.get("priority");
      const projectId = searchParams.get("projectId");
      const departmentId = searchParams.get("departmentId");
      const assigneeId = searchParams.get("assigneeId");
      const dueFrom = searchParams.get("dueFrom");
      const dueTo = searchParams.get("dueTo");

      const where: Prisma.TaskWhereInput = {};
      if (status) where.status = status as TaskStatus;
      if (priority) where.priority = priority as Priority;
      if (projectId) where.projectId = projectId;
      if (departmentId) where.departmentId = departmentId;
      if (assigneeId) where.assigneeId = assigneeId;
      if (dueFrom || dueTo) {
        where.dueDate = {
          ...(dueFrom ? { gte: new Date(dueFrom) } : {}),
          ...(dueTo ? { lte: new Date(dueTo) } : {}),
        };
      }

      const tasks = await prisma.task.findMany({
        where,
        include: { assignee: true, project: true, department: true },
        orderBy: { createdAt: "desc" },
      });

      return tasks.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        assigneeEmail: t.assignee?.email ?? "",
        priority: t.priority,
        status: t.status,
        dueDate: t.dueDate,
        project: t.project?.name ?? "",
        department: t.department?.name ?? "",
        category: t.category,
      }));
    }
    case "projects": {
      const projects = await prisma.project.findMany({ include: { owner: true }, orderBy: { createdAt: "desc" } });
      return projects.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        status: p.status,
        progress: p.progress,
        startDate: p.startDate,
        targetDate: p.targetDate,
        ownerEmail: p.owner.email,
        budget: p.budget ? Number(p.budget) : null,
        budgetSpent: p.budgetSpent ? Number(p.budgetSpent) : null,
      }));
    }
    case "contacts": {
      const contacts = await prisma.contact.findMany({ orderBy: { name: "asc" } });
      return contacts.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        company: c.company,
        email: c.email,
        phone: c.phone,
        notes: c.notes,
      }));
    }
    case "companyMetrics": {
      const metrics = await prisma.companyMetric.findMany({
        include: { companyArea: true },
        orderBy: { createdAt: "desc" },
      });
      return metrics.map((m) => ({
        id: m.id,
        area: m.companyArea.name,
        name: m.name,
        value: Number(m.value),
        unit: m.unit,
        target: m.target ? Number(m.target) : null,
        period: m.period,
      }));
    }
    case "decisions": {
      const decisions = await prisma.decision.findMany({ include: { responsible: true }, orderBy: { createdAt: "desc" } });
      return decisions.map((d) => ({
        id: d.id,
        title: d.title,
        description: d.description,
        background: d.background,
        responsibleEmail: d.responsible.email,
        status: d.status,
        decisionDeadline: d.decisionDeadline,
        finalDecision: d.finalDecision,
        decisionDate: d.decisionDate,
      }));
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(request.url);
    const entity = searchParams.get("entity") as ExcelEntity | null;

    if (!entity || !(entity in ENTITY_FIELDS)) {
      throw new ApiError(400, "Unbekannter Entitätstyp.");
    }

    const rows = await fetchRows(entity, searchParams);

    const filters: Record<string, string | undefined> = {
      Status: searchParams.get("status") ?? undefined,
      Priorität: searchParams.get("priority") ?? undefined,
      Zeitraum:
        searchParams.get("dueFrom") || searchParams.get("dueTo")
          ? `${searchParams.get("dueFrom") ?? "…"} – ${searchParams.get("dueTo") ?? "…"}`
          : undefined,
    };

    const buffer = await buildExportWorkbook({
      sheetName: ENTITY_LABELS[entity],
      fields: [...ENTITY_FIELDS[entity]],
      rows,
      exportedBy: session.user.name,
      filters,
    });

    await logAudit({
      userId: session.user.id,
      action: "EXPORT",
      entityType: entity,
      description: `${ENTITY_LABELS[entity]} als Excel exportiert (${rows.length} Datensätze)`,
    });

    await prisma.excelOperationLog.create({
      data: {
        userId: session.user.id,
        type: "EXPORT",
        entity: entityToImportExportEnum(entity),
        fileName: `${ENTITY_LABELS[entity]}.xlsx`,
        totalRows: rows.length,
        successCount: rows.length,
        filtersUsed: filters,
      },
    });

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${ENTITY_LABELS[entity]}_${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
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
