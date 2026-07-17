"use client";

import { useState } from "react";
import { Plus, CalendarPlus, Scale, Presentation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { CalendarEventFormDialog } from "@/components/calendar/calendar-event-form-dialog";
import { DecisionFormDialog } from "@/components/decisions/decision-form-dialog";
import { MeetingFormDialog } from "@/components/meetings/meeting-form-dialog";
import { ExcelImportDialog } from "@/components/excel/excel-import-dialog";
import { ExcelExportButton } from "@/components/excel/excel-export-button";
import type { SelectOption, SelectUser } from "@/types/task";

interface QuickActionsProps {
  users: SelectUser[];
  projects: SelectOption[];
  departments: SelectOption[];
  companyAreas: SelectOption[];
  hasMicrosoftConnection: boolean;
}

export function QuickActions({ users, projects, departments, companyAreas, hasMicrosoftConnection }: QuickActionsProps) {
  const [taskOpen, setTaskOpen] = useState(false);
  const [eventOpen, setEventOpen] = useState(false);
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [meetingOpen, setMeetingOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" onClick={() => setTaskOpen(true)}>
        <Plus /> Aufgabe erstellen
      </Button>
      <Button size="sm" variant="outline" onClick={() => setEventOpen(true)}>
        <CalendarPlus /> Outlook-Termin erstellen
      </Button>
      <Button size="sm" variant="outline" onClick={() => setDecisionOpen(true)}>
        <Scale /> Entscheidung erfassen
      </Button>
      <Button size="sm" variant="outline" onClick={() => setMeetingOpen(true)}>
        <Presentation /> Meetingnotiz erstellen
      </Button>
      <ExcelImportDialog entity="tasks" trigger={<Button size="sm" variant="outline" type="button">Excel importieren</Button>} />
      <ExcelExportButton entity="tasks" label="Excel exportieren" variant="outline" />

      <TaskFormDialog
        open={taskOpen}
        onOpenChange={setTaskOpen}
        users={users}
        projects={projects}
        departments={departments}
        companyAreas={companyAreas}
      />
      <CalendarEventFormDialog open={eventOpen} onOpenChange={setEventOpen} hasMicrosoftConnection={hasMicrosoftConnection} />
      <DecisionFormDialog open={decisionOpen} onOpenChange={setDecisionOpen} users={users} projects={projects} />
      <MeetingFormDialog open={meetingOpen} onOpenChange={setMeetingOpen} users={users} />
    </div>
  );
}
