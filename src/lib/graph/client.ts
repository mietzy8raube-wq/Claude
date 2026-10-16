import { getGraphBaseUrl } from "./config";

interface GraphRequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  retries?: number;
  headers?: Record<string, string>;
}

/**
 * Minimaler Microsoft-Graph-Fetch-Wrapper mit Rate-Limit- (429) und
 * Wiederholungslogik für transiente Serverfehler (5xx).
 */
export async function graphRequest<T>(
  accessToken: string,
  path: string,
  options: GraphRequestOptions = {}
): Promise<T> {
  const { method = "GET", body, retries = 3, headers } = options;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(`${getGraphBaseUrl()}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Prefer: 'outlook.timezone="Europe/Berlin"',
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 429 || res.status >= 500) {
      const retryAfter = Number(res.headers.get("Retry-After")) || Math.pow(2, attempt);
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
        continue;
      }
    }

    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`Microsoft Graph Fehler (${res.status}): ${errorBody}`);
    }

    // sendMail/reply antworten mit 202 Accepted ohne Inhalt
    const text = res.status === 204 ? "" : await res.text();
    if (!text) {
      return undefined as T;
    }

    return JSON.parse(text) as T;
  }

  throw new Error("Microsoft Graph: Maximale Anzahl an Wiederholungen erreicht.");
}

export interface GraphUser {
  id: string;
  displayName: string;
  mail: string | null;
  userPrincipalName: string;
}

export function getMe(accessToken: string) {
  return graphRequest<GraphUser>(accessToken, "/me");
}

export interface GraphCalendar {
  id: string;
  name: string;
  isDefaultCalendar?: boolean;
}

export function listCalendars(accessToken: string) {
  return graphRequest<{ value: GraphCalendar[] }>(accessToken, "/me/calendars");
}

export interface GraphEvent {
  id: string;
  subject: string;
  bodyPreview?: string;
  body?: { contentType: string; content: string };
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  location?: { displayName: string };
  attendees?: { emailAddress: { name: string; address: string }; type?: string }[];
  organizer?: { emailAddress: { name: string; address: string } };
  onlineMeeting?: { joinUrl: string } | null;
  isOnlineMeeting?: boolean;
  lastModifiedDateTime?: string;
}

export function listEvents(accessToken: string, calendarId: string | null, fromIso: string, toIso: string) {
  const path = calendarId ? `/me/calendars/${calendarId}/calendarView` : "/me/calendarView";
  const params = new URLSearchParams({
    startDateTime: fromIso,
    endDateTime: toIso,
    $orderby: "start/dateTime",
    $top: "100",
  });
  return graphRequest<{ value: GraphEvent[] }>(accessToken, `${path}?${params.toString()}`);
}

export interface CreateEventInput {
  subject: string;
  body?: string;
  start: string;
  end: string;
  timeZone: string;
  location?: string;
  attendees?: { name: string; email: string }[];
  isOnlineMeeting?: boolean;
}

function toGraphEventPayload(input: CreateEventInput) {
  return {
    subject: input.subject,
    body: { contentType: "text", content: input.body ?? "" },
    start: { dateTime: input.start, timeZone: input.timeZone },
    end: { dateTime: input.end, timeZone: input.timeZone },
    location: input.location ? { displayName: input.location } : undefined,
    attendees: input.attendees?.map((a) => ({
      emailAddress: { name: a.name, address: a.email },
      type: "required",
    })),
    isOnlineMeeting: input.isOnlineMeeting ?? false,
  };
}

export function createEvent(accessToken: string, calendarId: string | null, input: CreateEventInput) {
  const path = calendarId ? `/me/calendars/${calendarId}/events` : "/me/events";
  return graphRequest<GraphEvent>(accessToken, path, { method: "POST", body: toGraphEventPayload(input) });
}

export function updateEvent(accessToken: string, eventId: string, input: Partial<CreateEventInput>) {
  const payload: Record<string, unknown> = {};
  if (input.subject) payload.subject = input.subject;
  if (input.body !== undefined) payload.body = { contentType: "text", content: input.body };
  if (input.start && input.timeZone) payload.start = { dateTime: input.start, timeZone: input.timeZone };
  if (input.end && input.timeZone) payload.end = { dateTime: input.end, timeZone: input.timeZone };
  if (input.location !== undefined) payload.location = { displayName: input.location };
  return graphRequest<GraphEvent>(accessToken, `/me/events/${eventId}`, { method: "PATCH", body: payload });
}

export function deleteEvent(accessToken: string, eventId: string) {
  return graphRequest<void>(accessToken, `/me/events/${eventId}`, { method: "DELETE" });
}

// ---------------------------------------------------------------------------
// E-Mail (Outlook)
// ---------------------------------------------------------------------------

export interface GraphEmailAddress {
  emailAddress: { name: string; address: string };
}

export interface GraphMessage {
  id: string;
  subject: string | null;
  bodyPreview: string;
  body?: { contentType: "html" | "text"; content: string };
  from?: GraphEmailAddress;
  toRecipients?: GraphEmailAddress[];
  ccRecipients?: GraphEmailAddress[];
  receivedDateTime: string;
  isRead: boolean;
  hasAttachments: boolean;
  importance?: "low" | "normal" | "high";
  webLink?: string;
  conversationId?: string;
}

const MESSAGE_LIST_FIELDS =
  "id,subject,bodyPreview,from,toRecipients,receivedDateTime,isRead,hasAttachments,importance,webLink,conversationId";

export function listMessages(
  accessToken: string,
  { folder = "inbox", top = 25, search, skip = 0 }: { folder?: string; top?: number; search?: string; skip?: number }
) {
  const params = new URLSearchParams({ $select: MESSAGE_LIST_FIELDS, $top: String(top) });
  if (search) {
    // $search ist nicht mit $orderby/$skip kombinierbar; Ergebnisse kommen nach Relevanz/Datum
    params.set("$search", `"${search.replace(/"/g, "")}"`);
  } else {
    params.set("$orderby", "receivedDateTime desc");
    if (skip) params.set("$skip", String(skip));
  }
  return graphRequest<{ value: GraphMessage[]; "@odata.nextLink"?: string }>(
    accessToken,
    `/me/mailFolders/${encodeURIComponent(folder)}/messages?${params.toString()}`
  );
}

export function getMessage(accessToken: string, id: string) {
  const params = new URLSearchParams({ $select: `${MESSAGE_LIST_FIELDS},body,ccRecipients` });
  return graphRequest<GraphMessage>(accessToken, `/me/messages/${encodeURIComponent(id)}?${params.toString()}`);
}

export function markMessageRead(accessToken: string, id: string, isRead = true) {
  return graphRequest<GraphMessage>(accessToken, `/me/messages/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: { isRead },
  });
}

export function replyToMessage(accessToken: string, id: string, comment: string, replyAll = false) {
  return graphRequest<void>(accessToken, `/me/messages/${encodeURIComponent(id)}/${replyAll ? "replyAll" : "reply"}`, {
    method: "POST",
    body: { comment },
  });
}

export interface OutgoingMail {
  to: { name?: string; email: string }[];
  subject: string;
  html: string;
}

function toGraphMessage(mail: OutgoingMail) {
  return {
    message: {
      subject: mail.subject,
      body: { contentType: "HTML", content: mail.html },
      toRecipients: mail.to.map((r) => ({ emailAddress: { address: r.email, name: r.name ?? r.email } })),
    },
    saveToSentItems: false,
  };
}

/** Versand im Namen des angemeldeten Benutzers (delegierte Berechtigung Mail.Send). */
export function sendMailAsMe(accessToken: string, mail: OutgoingMail) {
  return graphRequest<void>(accessToken, "/me/sendMail", { method: "POST", body: toGraphMessage(mail) });
}

/** Versand über ein zentrales Postfach (Anwendungsberechtigung Mail.Send). */
export function sendMailAsUser(accessToken: string, senderAddress: string, mail: OutgoingMail) {
  return graphRequest<void>(accessToken, `/users/${encodeURIComponent(senderAddress)}/sendMail`, {
    method: "POST",
    body: toGraphMessage(mail),
  });
}
