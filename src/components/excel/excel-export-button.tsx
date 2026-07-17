"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ExcelEntity } from "@/lib/excel/fields";

interface ExcelExportButtonProps {
  entity: ExcelEntity;
  filters?: Record<string, string | undefined>;
  label?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
}

export function ExcelExportButton({ entity, filters, label = "Exportieren", variant = "outline" }: ExcelExportButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ entity });
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value) params.set(key, value);
        });
      }
      const res = await fetch(`/api/excel/export?${params.toString()}`);
      if (!res.ok) throw new Error("Export fehlgeschlagen");
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition");
      const fileName = disposition?.match(/filename="(.+)"/)?.[1] ?? `${entity}.xlsx`;

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success("Export erstellt");
    } catch {
      toast.error("Export fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button type="button" variant={variant} onClick={handleExport} disabled={loading}>
      {loading ? <Loader2 className="animate-spin" /> : <Download />}
      {label}
    </Button>
  );
}
