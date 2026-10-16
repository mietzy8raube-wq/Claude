"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserPlus, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { initials, formatDate, cn } from "@/lib/utils";

const ROLE_LABEL: Record<string, string> = {
  GESCHAEFTSFUEHRER: "Geschäftsführer",
  ADMINISTRATOR: "Administrator",
  MITARBEITER: "Mitarbeiter",
};

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

export function UsersTable({ users, currentUserId }: { users: UserRow[]; currentUserId: string }) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);

  async function updateUser(userId: string, data: { role?: string; isActive?: boolean }, success: string) {
    const res = await fetch(`/api/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      toast.success(success);
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? "Änderung fehlgeschlagen");
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Benutzerverwaltung</CardTitle>
          <CardDescription>
            Team-Mitglieder anlegen, Rollen vergeben und Zugänge deaktivieren (nur für Administratoren sichtbar).
          </CardDescription>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <UserPlus /> Benutzer anlegen
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {users.map((u) => {
          const isSelf = u.id === currentUserId;
          return (
            <div
              key={u.id}
              className={cn(
                "flex flex-col gap-3 rounded-md border border-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between",
                !u.isActive && "opacity-60"
              )}
            >
              <div className="flex items-center gap-3">
                <Avatar className="size-8"><AvatarFallback>{initials(u.name)}</AvatarFallback></Avatar>
                <div>
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {u.name}
                    {!u.isActive && <Badge variant="outline" className="font-normal">Deaktiviert</Badge>}
                  </p>
                  <p className="text-xs text-muted-foreground">{u.email} · seit {formatDate(u.createdAt)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Switch
                    checked={u.isActive}
                    disabled={isSelf}
                    onCheckedChange={(v) =>
                      updateUser(u.id, { isActive: v }, v ? `${u.name} aktiviert` : `${u.name} deaktiviert`)
                    }
                    aria-label="Aktiv"
                  />
                  Aktiv
                </label>
                <Select
                  value={u.role}
                  onValueChange={(v) => updateUser(u.id, { role: v }, "Rolle aktualisiert")}
                  disabled={isSelf}
                >
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROLE_LABEL).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          );
        })}
      </CardContent>
      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={() => router.refresh()} />
    </Card>
  );
}

function CreateUserDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("MITARBEITER");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setName("");
    setEmail("");
    setRole("MITARBEITER");
    setPassword("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, role, password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const fieldError = body.details?.fieldErrors && Object.values(body.details.fieldErrors).flat()[0];
        throw new Error((fieldError as string) ?? body.error ?? "Benutzer konnte nicht angelegt werden");
      }
      toast.success(`${name} wurde angelegt`);
      reset();
      onOpenChange(false);
      onCreated();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Benutzer anlegen</DialogTitle>
          <DialogDescription>
            Das Team-Mitglied kann sich anschließend mit E-Mail und Start-Passwort anmelden und es unter
            „Einstellungen“ selbst ändern.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-user-name">Name</Label>
            <Input id="new-user-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-user-email">E-Mail</Label>
            <Input id="new-user-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Rolle</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(ROLE_LABEL).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-user-password">Start-Passwort</Label>
            <Input
              id="new-user-password"
              type="password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
            <p className="text-xs text-muted-foreground">Mindestens 8 Zeichen.</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="animate-spin" />} Anlegen
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
