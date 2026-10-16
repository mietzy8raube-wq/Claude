/** Formatiert die fortlaufende Ticketnummer, z. B. 42 -> "T-0042". */
export function formatTicketNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return "";
  return `T-${String(n).padStart(4, "0")}`;
}

/** Erkennt Suchbegriffe wie "T-42", "t42" oder "#42" und liefert die Nummer. */
export function parseTicketNumber(query: string): number | null {
  const match = query.trim().match(/^(?:#|t-?)?(\d{1,9})$/i);
  if (!match) return null;
  // Reine Zahlen nur mit Präfix als Ticketnummer werten, damit die Volltextsuche nach Zahlen erhalten bleibt
  if (!/^(#|t)/i.test(query.trim())) return null;
  return Number(match[1]);
}
