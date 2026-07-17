import { PageHeader } from "@/components/shared/page-header";

export default function DashboardPage() {
  return (
    <div>
      <PageHeader title="Dashboard" description="Übersicht über Aufgaben, Projekte und Termine." />
      <p className="text-sm text-muted-foreground">Wird geladen…</p>
    </div>
  );
}
