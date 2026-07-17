"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials, formatDate } from "@/lib/utils";

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
  createdAt: string;
}

export function UsersTable({ users, currentUserId }: { users: UserRow[]; currentUserId: string }) {
  const router = useRouter();

  async function updateRole(userId: string, role: string) {
    const res = await fetch(`/api/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (res.ok) {
      toast.success("Rolle aktualisiert");
      router.refresh();
    } else {
      toast.error("Rolle konnte nicht aktualisiert werden");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Benutzerverwaltung</CardTitle>
        <CardDescription>Rollen- und Rechteverwaltung (nur für Administratoren sichtbar).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {users.map((u) => (
          <div key={u.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
            <div className="flex items-center gap-3">
              <Avatar className="size-8"><AvatarFallback>{initials(u.name)}</AvatarFallback></Avatar>
              <div>
                <p className="text-sm font-medium">{u.name}</p>
                <p className="text-xs text-muted-foreground">{u.email} · seit {formatDate(u.createdAt)}</p>
              </div>
            </div>
            <Select
              value={u.role}
              onValueChange={(v) => updateRole(u.id, v)}
              disabled={u.id === currentUserId}
            >
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(ROLE_LABEL).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
