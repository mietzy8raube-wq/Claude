export type FieldType = "string" | "number" | "date" | "enum" | "boolean";

export interface ExcelFieldDef {
  key: string;
  label: string;
  required?: boolean;
  type: FieldType;
  enumValues?: string[];
  enumLabels?: Record<string, string>;
  width?: number;
  example?: string | number;
}

export const TASK_FIELDS: ExcelFieldDef[] = [
  { key: "id", label: "ID", type: "string", width: 26, example: "" },
  { key: "title", label: "Titel", required: true, type: "string", width: 32, example: "Angebot finalisieren" },
  { key: "description", label: "Beschreibung", type: "string", width: 40, example: "Details zur Aufgabe" },
  { key: "assigneeEmail", label: "Verantwortlich (E-Mail)", type: "string", width: 28, example: "anna.mueller@druckluft-chemnitz.de" },
  {
    key: "priority",
    label: "Priorität",
    type: "enum",
    enumValues: ["NIEDRIG", "MITTEL", "HOCH", "KRITISCH"],
    enumLabels: { NIEDRIG: "Niedrig", MITTEL: "Mittel", HOCH: "Hoch", KRITISCH: "Kritisch" },
    width: 14,
    example: "Mittel",
  },
  {
    key: "status",
    label: "Status",
    type: "enum",
    enumValues: ["OFFEN", "IN_BEARBEITUNG", "BLOCKIERT", "ZUR_PRUEFUNG", "ERLEDIGT"],
    enumLabels: {
      OFFEN: "Offen",
      IN_BEARBEITUNG: "In Bearbeitung",
      BLOCKIERT: "Blockiert",
      ZUR_PRUEFUNG: "Zur Prüfung",
      ERLEDIGT: "Erledigt",
    },
    width: 16,
    example: "Offen",
  },
  { key: "dueDate", label: "Fälligkeitsdatum", type: "date", width: 18, example: "2026-08-15" },
  { key: "project", label: "Projekt", type: "string", width: 26, example: "" },
  { key: "department", label: "Abteilung", type: "string", width: 20, example: "Vertrieb" },
  { key: "category", label: "Kategorie", type: "string", width: 18, example: "Vertrieb" },
];

export const PROJECT_FIELDS: ExcelFieldDef[] = [
  { key: "id", label: "ID", type: "string", width: 26 },
  { key: "name", label: "Projektname", required: true, type: "string", width: 32, example: "Digitalisierung Auftragsabwicklung" },
  { key: "description", label: "Beschreibung", type: "string", width: 40 },
  {
    key: "status",
    label: "Status",
    type: "enum",
    enumValues: ["GEPLANT", "LAUFEND", "PAUSIERT", "ABGESCHLOSSEN", "ABGEBROCHEN"],
    enumLabels: {
      GEPLANT: "Geplant",
      LAUFEND: "Laufend",
      PAUSIERT: "Pausiert",
      ABGESCHLOSSEN: "Abgeschlossen",
      ABGEBROCHEN: "Abgebrochen",
    },
    width: 16,
    example: "Geplant",
  },
  { key: "progress", label: "Fortschritt (%)", type: "number", width: 14, example: 0 },
  { key: "startDate", label: "Startdatum", type: "date", width: 16 },
  { key: "targetDate", label: "Zieldatum", type: "date", width: 16 },
  { key: "ownerEmail", label: "Verantwortlicher (E-Mail)", required: true, type: "string", width: 28 },
  { key: "budget", label: "Budget (EUR)", type: "number", width: 16 },
  { key: "budgetSpent", label: "Verbraucht (EUR)", type: "number", width: 16 },
];

export const CONTACT_FIELDS: ExcelFieldDef[] = [
  { key: "id", label: "ID", type: "string", width: 26 },
  { key: "name", label: "Name", required: true, type: "string", width: 28, example: "Max Mustermann" },
  {
    key: "type",
    label: "Typ",
    type: "enum",
    enumValues: ["KUNDE", "LIEFERANT", "PARTNER", "SONSTIGE"],
    enumLabels: { KUNDE: "Kunde", LIEFERANT: "Lieferant", PARTNER: "Partner", SONSTIGE: "Sonstige" },
    width: 14,
    example: "Kunde",
  },
  { key: "company", label: "Firma", type: "string", width: 28 },
  { key: "email", label: "E-Mail", type: "string", width: 28 },
  { key: "phone", label: "Telefon", type: "string", width: 20 },
  { key: "notes", label: "Notizen", type: "string", width: 40 },
];

export const COMPANY_METRIC_FIELDS: ExcelFieldDef[] = [
  { key: "id", label: "ID", type: "string", width: 26 },
  { key: "area", label: "Unternehmensbereich", required: true, type: "string", width: 22, example: "Finanzen" },
  { key: "name", label: "Kennzahl", required: true, type: "string", width: 24, example: "Umsatz" },
  { key: "value", label: "Wert", required: true, type: "number", width: 14, example: 100000 },
  { key: "unit", label: "Einheit", type: "string", width: 12, example: "EUR" },
  { key: "target", label: "Ziel", type: "number", width: 14 },
  { key: "period", label: "Periode", required: true, type: "string", width: 14, example: "2026-07" },
];

export const DECISION_FIELDS: ExcelFieldDef[] = [
  { key: "id", label: "ID", type: "string", width: 26 },
  { key: "title", label: "Titel", required: true, type: "string", width: 32 },
  { key: "description", label: "Beschreibung", type: "string", width: 40 },
  { key: "background", label: "Hintergrund", type: "string", width: 40 },
  { key: "responsibleEmail", label: "Verantwortlich (E-Mail)", required: true, type: "string", width: 28 },
  {
    key: "status",
    label: "Status",
    type: "enum",
    enumValues: ["VORBEREITUNG", "DISKUSSION", "ENTSCHEIDUNG_ERFORDERLICH", "ENTSCHIEDEN", "ZURUECKGESTELLT"],
    enumLabels: {
      VORBEREITUNG: "Vorbereitung",
      DISKUSSION: "Diskussion",
      ENTSCHEIDUNG_ERFORDERLICH: "Entscheidung erforderlich",
      ENTSCHIEDEN: "Entschieden",
      ZURUECKGESTELLT: "Zurückgestellt",
    },
    width: 22,
    example: "Vorbereitung",
  },
  { key: "decisionDeadline", label: "Entscheidungsfrist", type: "date", width: 18 },
  { key: "finalDecision", label: "Finale Entscheidung", type: "string", width: 40 },
  { key: "decisionDate", label: "Entscheidungsdatum", type: "date", width: 18 },
];

export const ENTITY_FIELDS = {
  tasks: TASK_FIELDS,
  projects: PROJECT_FIELDS,
  contacts: CONTACT_FIELDS,
  companyMetrics: COMPANY_METRIC_FIELDS,
  decisions: DECISION_FIELDS,
} as const;

export type ExcelEntity = keyof typeof ENTITY_FIELDS;

export const ENTITY_LABELS: Record<ExcelEntity, string> = {
  tasks: "Aufgaben",
  projects: "Projekte",
  contacts: "Kontakte",
  companyMetrics: "Unternehmenskennzahlen",
  decisions: "Entscheidungen",
};
