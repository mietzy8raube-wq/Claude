"use client";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { PRIORITY_LABEL, STATUS_LABEL } from "./badges";
import type { SelectOption, SelectUser } from "@/types/task";

export interface TaskFilters {
  q: string;
  assigneeId: string;
  projectId: string;
  departmentId: string;
  priority: string;
  status: string;
  visibility: string;
}

export const EMPTY_FILTERS: TaskFilters = {
  q: "",
  assigneeId: "",
  projectId: "",
  departmentId: "",
  priority: "",
  status: "",
  visibility: "",
};

const ALL = "__all__";

interface TaskFiltersBarProps {
  filters: TaskFilters;
  onChange: (filters: TaskFilters) => void;
  users: SelectUser[];
  projects: SelectOption[];
  departments: SelectOption[];
  showVisibility?: boolean;
}

export function TaskFiltersBar({
  filters,
  onChange,
  users,
  projects,
  departments,
  showVisibility,
}: TaskFiltersBarProps) {
  const hasActiveFilters = Object.values(filters).some(Boolean);

  function set<K extends keyof TaskFilters>(key: K, value: string) {
    onChange({ ...filters, [key]: value === ALL ? "" : value });
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <Input
        placeholder="Suchen…"
        value={filters.q}
        onChange={(e) => set("q", e.target.value)}
        className="w-48"
      />
      <Select value={filters.assigneeId || ALL} onValueChange={(v) => set("assigneeId", v)}>
        <SelectTrigger className="w-44"><SelectValue placeholder="Geschäftsführer" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Alle Verantwortlichen</SelectItem>
          {users.map((u) => (
            <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={filters.projectId || ALL} onValueChange={(v) => set("projectId", v)}>
        <SelectTrigger className="w-40"><SelectValue placeholder="Projekt" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Alle Projekte</SelectItem>
          {projects.map((p) => (
            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={filters.departmentId || ALL} onValueChange={(v) => set("departmentId", v)}>
        <SelectTrigger className="w-40"><SelectValue placeholder="Abteilung" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Alle Abteilungen</SelectItem>
          {departments.map((d) => (
            <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={filters.priority || ALL} onValueChange={(v) => set("priority", v)}>
        <SelectTrigger className="w-36"><SelectValue placeholder="Priorität" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Alle Prioritäten</SelectItem>
          {Object.entries(PRIORITY_LABEL).map(([value, label]) => (
            <SelectItem key={value} value={value}>{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={filters.status || ALL} onValueChange={(v) => set("status", v)}>
        <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Alle Status</SelectItem>
          {Object.entries(STATUS_LABEL).map(([value, label]) => (
            <SelectItem key={value} value={value}>{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {showVisibility && (
        <Select value={filters.visibility || ALL} onValueChange={(v) => set("visibility", v)}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Sichtbarkeit" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Alle</SelectItem>
            <SelectItem value="GEMEINSAM">Gemeinsam</SelectItem>
            <SelectItem value="PERSOENLICH">Persönlich</SelectItem>
          </SelectContent>
        </Select>
      )}
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={() => onChange(EMPTY_FILTERS)}>
          <X className="size-3.5" /> Zurücksetzen
        </Button>
      )}
    </div>
  );
}
