import { PageHeader } from "@/components/shared/page-header";

export default function Page() {
  return (
    <div>
      <PageHeader title="Alle Aufgaben" />
      <p className="text-sm text-muted-foreground">Wird geladen…</p>
    </div>
  );
}
