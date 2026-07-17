import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";

interface AuditRow {
  id: string;
  action: string;
  description: string;
  createdAt: Date;
}

export function SecurityCard({ entries }: { entries: AuditRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sicherheit &amp; Aktivität</CardTitle>
        <CardDescription>Letzte Anmeldungen und Änderungen an Ihrem Konto (Audit-Log).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {entries.map((e) => (
          <p key={e.id} className="text-sm text-muted-foreground">
            {formatDateTime(e.createdAt)} · {e.description}
          </p>
        ))}
        {entries.length === 0 && <p className="text-sm text-muted-foreground">Keine Einträge.</p>}
      </CardContent>
    </Card>
  );
}
