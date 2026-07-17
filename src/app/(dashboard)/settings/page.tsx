import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { ProfileForm } from "@/components/settings/profile-form";
import { PasswordForm } from "@/components/settings/password-form";
import { SecurityCard } from "@/components/settings/security-card";
import { UsersTable } from "@/components/settings/users-table";

export default async function SettingsPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [auditEntries, users] = await Promise.all([
    prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, action: true, description: true, createdAt: true },
    }),
    session!.user.role === "ADMINISTRATOR"
      ? prisma.user.findMany({
          orderBy: { name: "asc" },
          select: { id: true, name: true, email: true, role: true, createdAt: true },
        })
      : Promise.resolve([]),
  ]);

  return (
    <div>
      <PageHeader title="Einstellungen" description="Profil, Sicherheit und Kontoeinstellungen verwalten." />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ProfileForm name={session!.user.name} email={session!.user.email} role={session!.user.role} />
        <PasswordForm />
        <SecurityCard entries={auditEntries} />
        {session!.user.role === "ADMINISTRATOR" && (
          <div className="lg:col-span-2">
            <UsersTable
              users={users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }))}
              currentUserId={userId}
            />
          </div>
        )}
      </div>
    </div>
  );
}
