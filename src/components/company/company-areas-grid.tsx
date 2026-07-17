import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { AREA_ICON } from "./area-meta";
import { ClipboardList, FileText, LineChart, MessageSquare } from "lucide-react";
import type { AreaListItem } from "@/types/company";

export function CompanyAreasGrid({ areas }: { areas: AreaListItem[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {areas.map((area) => {
        const Icon = AREA_ICON[area.type];
        return (
          <Link key={area.id} href={`/company/${area.id}`}>
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardHeader className="flex-row items-center gap-3 space-y-0">
                <div className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <Icon className="size-4.5" />
                </div>
                <div>
                  <p className="font-semibold">{area.name}</p>
                  {area.responsible && <p className="text-xs text-muted-foreground">{area.responsible.name}</p>}
                </div>
              </CardHeader>
              <CardContent>
                {area.description && (
                  <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">{area.description}</p>
                )}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <LineChart className="size-3.5" /> {area._count.metrics}
                  </span>
                  <span className="flex items-center gap-1">
                    <ClipboardList className="size-3.5" /> {area._count.tasks}
                  </span>
                  <span className="flex items-center gap-1">
                    <FileText className="size-3.5" /> {area._count.documents}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageSquare className="size-3.5" /> {area._count.notes}
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
