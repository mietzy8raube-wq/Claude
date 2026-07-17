import { z } from "zod";

export const updateCompanyAreaSchema = z.object({
  description: z.string().max(3000).optional().or(z.literal("")),
  responsibleId: z.string().optional().nullable(),
});

export const createMetricSchema = z.object({
  name: z.string().min(1).max(100),
  value: z.coerce.number(),
  unit: z.string().max(30).optional().or(z.literal("")),
  target: z.coerce.number().optional().nullable(),
  period: z.string().min(1).max(20),
});

export const createCompanyNoteSchema = z.object({
  content: z.string().min(1).max(4000),
});

export const createCompanyDocumentSchema = z.object({
  fileName: z.string().min(1).max(200),
  url: z.string().min(1).max(2000),
  mimeType: z.string().max(100).optional().default("application/octet-stream"),
  size: z.coerce.number().int().min(0).optional().default(0),
});

export const contactTypeEnum = z.enum(["KUNDE", "LIEFERANT", "PARTNER", "SONSTIGE"]);

export const createContactSchema = z.object({
  type: contactTypeEnum.default("KUNDE"),
  name: z.string().min(1).max(200),
  company: z.string().max(200).optional().or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(50).optional().or(z.literal("")),
  notes: z.string().max(3000).optional().or(z.literal("")),
  responsibleId: z.string().optional().nullable(),
  companyAreaId: z.string().optional().nullable(),
});
