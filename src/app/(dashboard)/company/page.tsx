import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { CompanyAreasGrid } from "@/components/company/company-areas-grid";
import { ExcelExportButton } from "@/components/excel/excel-export-button";

export default async function CompanyPage() {
  const areas = await prisma.companyArea.findMany({
    include: {
      responsible: { select: { id: true, name: true } },
      _count: { select: { metrics: true, notes: true, documents: true, tasks: true, contacts: true } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <PageHeader
        title="Unternehmen"
        description="Finanzen, Vertrieb, Marketing, Personal und weitere Unternehmensbereiche."
        actions={<ExcelExportButton entity="companyMetrics" label="Kennzahlen exportieren" />}
      />
      <CompanyAreasGrid areas={areas} />
    </div>
  );
}
