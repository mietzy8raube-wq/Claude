"use client";

import { useState } from "react";
import { toast } from "sonner";
import { BellRing, Loader2, Send } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

export function NotificationPrefsCard({ notifyByEmail, email, mailAvailable }: { notifyByEmail: boolean; email: string; mailAvailable: boolean }) {
  const [enabled, setEnabled] = useState(notifyByEmail);
  const [testing, setTesting] = useState(false);

  async function toggle(value: boolean) {
    setEnabled(value);
    const res = await fetch("/api/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notifyByEmail: value }),
    });
    if (res.ok) {
      toast.success(value ? "E-Mail-Benachrichtigungen aktiviert" : "E-Mail-Benachrichtigungen deaktiviert");
    } else {
      setEnabled(!value);
      toast.error("Einstellung konnte nicht gespeichert werden");
    }
  }

  async function sendTest() {
    setTesting(true);
    try {
      const res = await fetch("/api/integrations/mail/test", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Versand fehlgeschlagen");
      toast.success(`Test-E-Mail an ${email} gesendet`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setTesting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellRing className="size-4" /> Benachrichtigungen
        </CardTitle>
        <CardDescription>
          Zuweisungen, Kommentare, Statuswechsel, Fristwarnungen und Vertretungsbedarf erscheinen immer in der Glocke oben
          rechts – auf Wunsch zusätzlich per E-Mail.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex items-center justify-between gap-4 rounded-md border border-border px-3 py-2.5">
          <span>
            <span className="block text-sm font-medium">Per E-Mail benachrichtigen</span>
            <span className="block text-xs text-muted-foreground">an {email}</span>
          </span>
          <Switch checked={enabled} onCheckedChange={toggle} aria-label="Per E-Mail benachrichtigen" />
        </label>
        {mailAvailable ? (
          <Button variant="outline" size="sm" onClick={sendTest} disabled={testing}>
            {testing ? <Loader2 className="animate-spin" /> : <Send />} Test-E-Mail senden
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">
            Der E-Mail-Versand wird aktiv, sobald Microsoft 365 eingerichtet ist (siehe „Integrationen“).
          </p>
        )}
      </CardContent>
    </Card>
  );
}
