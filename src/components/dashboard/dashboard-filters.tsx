"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { PRIORITY_LABEL, STATUS_LABEL } from "@/components/tasks/badges";
import type { SelectOption, SelectUser } from "@/types/task";

const ALL = "__all__";

interface DashboardFiltersProps {
  users: SelectUser[];
  projects: SelectOption[];
  departments: SelectOption[];
}

const PERIODS = [
  { value: "7", label: "Letzte 7 Tage" },
  { value: "30", label: "Letzte 30 Tage" },
  { value: "90", label: "Letzte 90 Tage" },
];

export function DashboardFilters({ users, projects, departments }: DashboardFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === ALL || !value) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  const hasFilters = ["assigneeId", "projectId", "departmentId", "priority", "status", "period"].some((k) =>
    searchParams.get(k)
  );

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <Select value={searchParams.get("assigneeId") ?? ALL} onValueChange={(v) => setParam("assigneeId", v)}>
        <SelectTrigger className="w-44"><SelectValue placeholder="Geschäftsführer" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Alle Geschäftsführer</SelectItem>
          {users.map((u) => (
            <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={searchParams.get("projectId") ?? ALL} onValueChange={(v) => setParam("projectId", v)}>
        <SelectTrigger className="w-40"><SelectValue placeholder="Projekt" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Alle Projekte</SelectItem>
          {projects.map((p) => (
            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={searchParams.get("departmentId") ?? ALL} onValueChange={(v) => setParam("departmentId", v)}>
        <SelectTrigger className="w-40"><SelectValue placeholder="Abteilung" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Alle Abteilungen</SelectItem>
          {departments.map((d) => (
            <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={searchParams.get("priority") ?? ALL} onValueChange={(v) => setParam("priority", v)}>
        <SelectTrigger className="w-36"><SelectValue placeholder="Priorität" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Alle Prioritäten</SelectItem>
          {Object.entries(PRIORITY_LABEL).map(([value, label]) => (
            <SelectItem key={value} value={value}>{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={searchParams.get("status") ?? ALL} onValueChange={(v) => setParam("status", v)}>
        <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Alle Status</SelectItem>
          {Object.entries(STATUS_LABEL).map(([value, label]) => (
            <SelectItem key={value} value={value}>{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={searchParams.get("period") ?? ALL} onValueChange={(v) => setParam("period", v)}>
        <SelectTrigger className="w-40"><SelectValue placeholder="Zeitraum" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Alle Zeiträume</SelectItem>
          {PERIODS.map((p) => (
            <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={() => router.push(pathname)}>
          <X className="size-3.5" /> Zurücksetzen
        </Button>
      )}
    </div>
  );
}
