import Link from "next/link";
import { Mail, CheckCircle2, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export interface MailStatus {
  graphConfigured: boolean;
  systemSender: string | null;
  connected: boolean;
  hasMailScopes: boolean;
}

function Row({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      {ok ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
      ) : (
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-foreground" />
      )}
      <span>{children}</span>
    </li>
  );
}

export function MailCard({ status }: { status: MailStatus }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="size-4" /> Outlook-Mail
        </CardTitle>
        <CardDescription>
          Postfach im Ticketsystem (lesen, antworten, Tickets aus E-Mails) und E-Mail-Versand der Ticket-Benachrichtigungen.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2 text-sm">
          <Row ok={status.graphConfigured}>
            {status.graphConfigured ? "Microsoft 365 ist eingerichtet." : "Microsoft 365 ist noch nicht eingerichtet (.env)."}
          </Row>
          <Row ok={status.connected && status.hasMailScopes}>
            {!status.connected
              ? "Ihr Microsoft-Konto ist nicht verbunden – Postfach nicht verfügbar."
              : status.hasMailScopes
                ? "Postfach-Zugriff erteilt (Mail.Read, Mail.Send)."
                : "Ihre Verbindung hat noch keine Postfach-Rechte: bitte trennen und neu verbinden."}
          </Row>
          <Row ok={!!status.systemSender}>
            {status.systemSender ? (
              <>
                Benachrichtigungen werden zentral von <span className="font-medium">{status.systemSender}</span> versendet.
              </>
            ) : (
              <>
                Kein zentrales Absender-Postfach (<code className="font-mono text-xs">MICROSOFT_MAIL_SENDER</code>). Ersatzweise
                erhält jeder Benutzer mit verbundenem Konto Benachrichtigungen aus dem eigenen Postfach.
              </>
            )}
          </Row>
        </ul>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/mail">Zum Postfach</Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link href="/settings">Benachrichtigungs-Einstellungen</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
