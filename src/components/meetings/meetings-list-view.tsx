"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Presentation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { MeetingFormDialog } from "./meeting-form-dialog";
import { formatDateTime } from "@/lib/utils";
import type { SelectUser } from "@/types/task";
import type { MeetingWithRelations } from "@/types/meeting";

export function MeetingsListView({ meetings, users }: { meetings: MeetingWithRelations[]; users: SelectUser[] }) {
  const [formOpen, setFormOpen] = useState(false);

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setFormOpen(true)}>
          <Plus /> Meeting erstellen
        </Button>
      </div>

      {meetings.length === 0 ? (
        <EmptyState
          icon={Presentation}
          title="Noch keine Meetings"
          description="Erfassen Sie Tagesordnung, Notizen und Beschlüsse Ihrer Geschäftsführungsmeetings."
          action={<Button onClick={() => setFormOpen(true)}><Plus /> Meeting erstellen</Button>}
        />
      ) : (
        <div className="space-y-3">
          {meetings.map((meeting) => (
            <Link key={meeting.id} href={`/meetings/${meeting.id}`}>
              <Card className="p-4 transition-shadow hover:shadow-md">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{meeting.title}</p>
                  <p className="text-sm text-muted-foreground">{formatDateTime(meeting.meetingDate)}</p>
                </div>
                <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                  {meeting.location && <span>{meeting.location}</span>}
                  <span>{meeting.attendees.length} Teilnehmer</span>
                  <span>{meeting.agendaItems.length} TOPs</span>
                  <span>{meeting.resolutions.length} Beschlüsse</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <MeetingFormDialog open={formOpen} onOpenChange={setFormOpen} users={users} />
    </div>
  );
}
