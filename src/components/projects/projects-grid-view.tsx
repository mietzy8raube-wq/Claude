"use client";

import { useState } from "react";
import { Plus, FolderKanban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { ProjectCard } from "./project-card";
import { ProjectFormDialog } from "./project-form-dialog";
import type { SelectUser } from "@/types/task";
import type { ProjectWithRelations } from "@/types/project";

interface ProjectsGridViewProps {
  projects: ProjectWithRelations[];
  users: SelectUser[];
}

export function ProjectsGridView({ projects, users }: ProjectsGridViewProps) {
  const [formOpen, setFormOpen] = useState(false);

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setFormOpen(true)}>
          <Plus /> Projekt erstellen
        </Button>
      </div>

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="Noch keine Projekte"
          description="Erstellen Sie Ihr erstes Projekt, um Aufgaben, Meilensteine und Risiken zu verwalten."
          action={<Button onClick={() => setFormOpen(true)}><Plus /> Projekt erstellen</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}

      <ProjectFormDialog open={formOpen} onOpenChange={setFormOpen} users={users} />
    </div>
  );
}
