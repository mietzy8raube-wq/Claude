import type { Prisma } from "@prisma/client";

type RawAreaListItem = Prisma.CompanyAreaGetPayload<{
  include: {
    responsible: { select: { id: true; name: true } };
    _count: { select: { metrics: true; notes: true; documents: true; tasks: true; contacts: true } };
  };
}>;

export type AreaListItem = RawAreaListItem;

type RawAreaDetail = Prisma.CompanyAreaGetPayload<{
  include: {
    responsible: { select: { id: true; name: true } };
    metrics: true;
    notes: { include: { author: { select: { id: true; name: true } } } };
    documents: { include: { uploadedBy: { select: { id: true; name: true } } } };
    contacts: true;
    tasks: { include: { assignee: { select: { id: true; name: true } } } };
  };
}>;

export type AreaDetail = Omit<RawAreaDetail, "metrics"> & {
  metrics: (Omit<RawAreaDetail["metrics"][number], "value" | "target"> & {
    value: number;
    target: number | null;
  })[];
};
