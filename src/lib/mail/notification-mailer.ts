import { prisma } from "@/lib/prisma";
import { getMailSender, hasScopes, isSystemMailConfigured, isMicrosoftGraphConfigured } from "@/lib/graph/config";
import { getAppOnlyAccessToken } from "@/lib/graph/oauth";
import { getValidAccessToken } from "@/lib/graph/tokenStore";
import { sendMailAsMe, sendMailAsUser, type OutgoingMail } from "@/lib/graph/client";

/** Nur Benachrichtigungen der letzten 24 h werden nachträglich noch per E-Mail versendet. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const BATCH_SIZE = 50;

export function getAppUrl() {
  return (process.env.APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "");
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function renderNotificationEmail(n: { title: string; message: string | null; link: string | null }, recipientName: string) {
  const appUrl = getAppUrl();
  const url = n.link ? `${appUrl}${n.link.startsWith("/") ? "" : "/"}${n.link}` : appUrl;
  const html = `<!doctype html>
<html lang="de"><body style="margin:0;padding:24px;background:#f4f5f7;font-family:Segoe UI,Arial,sans-serif;color:#1f2430">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:10px;border:1px solid #e3e5ea">
    <tr><td style="padding:24px 28px 8px;font-size:13px;color:#6b7280">GF-Suite · Ticketsystem</td></tr>
    <tr><td style="padding:0 28px 8px;font-size:15px">Hallo ${escapeHtml(recipientName)},</td></tr>
    <tr><td style="padding:4px 28px 0;font-size:17px;font-weight:600;line-height:1.4">${escapeHtml(n.title)}</td></tr>
    ${n.message ? `<tr><td style="padding:8px 28px 0;font-size:14px;line-height:1.55;color:#374151">${escapeHtml(n.message)}</td></tr>` : ""}
    <tr><td style="padding:22px 28px 26px">
      <a href="${escapeHtml(url)}" style="display:inline-block;background:#1e2a5a;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600">Ticket öffnen</a>
    </td></tr>
    <tr><td style="padding:14px 28px;border-top:1px solid #e3e5ea;font-size:12px;color:#9ca3af">
      Sie erhalten diese E-Mail, weil E-Mail-Benachrichtigungen in Ihrem Profil aktiviert sind.
      Abbestellen unter <a href="${escapeHtml(appUrl)}/settings" style="color:#6b7280">Einstellungen</a>.
    </td></tr>
  </table>
</body></html>`;
  return { subject: `[GF-Suite] ${n.title}`, html };
}

/** Sammelmail, wenn für eine Person mehrere Benachrichtigungen gleichzeitig anstehen. */
export function renderDigestEmail(items: { title: string; message: string | null; link: string | null }[], recipientName: string) {
  const appUrl = getAppUrl();
  const rows = items
    .map((n) => {
      const url = n.link ? `${appUrl}${n.link.startsWith("/") ? "" : "/"}${n.link}` : appUrl;
      return `<tr><td style="padding:10px 0;border-bottom:1px solid #eef0f3">
        <a href="${escapeHtml(url)}" style="color:#1e2a5a;font-weight:600;text-decoration:none;font-size:14px">${escapeHtml(n.title)}</a>
        ${n.message ? `<div style="font-size:13px;color:#6b7280;margin-top:2px">${escapeHtml(n.message)}</div>` : ""}
      </td></tr>`;
    })
    .join("");
  const html = `<!doctype html>
<html lang="de"><body style="margin:0;padding:24px;background:#f4f5f7;font-family:Segoe UI,Arial,sans-serif;color:#1f2430">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:10px;border:1px solid #e3e5ea">
    <tr><td style="padding:24px 28px 8px;font-size:13px;color:#6b7280">GF-Suite · Ticketsystem</td></tr>
    <tr><td style="padding:0 28px 4px;font-size:15px">Hallo ${escapeHtml(recipientName)},</td></tr>
    <tr><td style="padding:4px 28px 6px;font-size:17px;font-weight:600">${items.length} neue Benachrichtigungen</td></tr>
    <tr><td style="padding:0 28px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${rows}</table></td></tr>
    <tr><td style="padding:20px 28px 26px">
      <a href="${escapeHtml(appUrl)}/deadlines" style="display:inline-block;background:#1e2a5a;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600">Fristen ansehen</a>
    </td></tr>
    <tr><td style="padding:14px 28px;border-top:1px solid #e3e5ea;font-size:12px;color:#9ca3af">
      Abbestellen unter <a href="${escapeHtml(appUrl)}/settings" style="color:#6b7280">Einstellungen</a>.
    </td></tr>
  </table>
</body></html>`;
  return { subject: `[GF-Suite] ${items.length} neue Benachrichtigungen`, html };
}

/** Prüft, ob überhaupt ein Versandweg zur Verfügung steht. */
export function isNotificationMailAvailable() {
  return isSystemMailConfigured() || isMicrosoftGraphConfigured();
}

async function sendOne(
  recipient: { id: string; name: string; email: string; microsoftConnection: { scopes: string } | null },
  mail: OutgoingMail
): Promise<"sent" | "no-transport"> {
  const sender = getMailSender();
  if (sender && isSystemMailConfigured()) {
    await sendMailAsUser(await getAppOnlyAccessToken(), sender, mail);
    return "sent";
  }
  // Ohne zentrales Postfach: Versand aus dem eigenen, verbundenen Postfach an sich selbst
  if (recipient.microsoftConnection && hasScopes(recipient.microsoftConnection.scopes, ["Mail.Send"])) {
    await sendMailAsMe(await getValidAccessToken(recipient.id), mail);
    return "sent";
  }
  return "no-transport";
}

let running = false;

/**
 * Versendet alle noch nicht gemailten Benachrichtigungen an Benutzer mit
 * aktivierter E-Mail-Option (mehrere je Person als eine Sammelmail). Jede Benachrichtigung wird vor dem Versand per
 * bedingtem Update "beansprucht", sodass parallele Läufe nichts doppelt senden.
 */
export async function dispatchNotificationEmails() {
  if (running || !isNotificationMailAvailable()) return { sent: 0, skipped: 0, failed: 0 };
  running = true;
  const result = { sent: 0, skipped: 0, failed: 0 };
  try {
    const pending = await prisma.notification.findMany({
      where: {
        emailedAt: null,
        createdAt: { gte: new Date(Date.now() - MAX_AGE_MS) },
        user: { notifyByEmail: true, isActive: true },
      },
      orderBy: { createdAt: "asc" },
      take: BATCH_SIZE,
      include: {
        user: { select: { id: true, name: true, email: true, microsoftConnection: { select: { scopes: true } } } },
      },
    });

    // Pro Empfänger bündeln: eine Benachrichtigung = Einzelmail, mehrere = Sammelmail
    const byUser = new Map<string, typeof pending>();
    for (const n of pending) byUser.set(n.userId, [...(byUser.get(n.userId) ?? []), n]);

    for (const items of byUser.values()) {
      const claimedItems: typeof items = [];
      for (const n of items) {
        const claimed = await prisma.notification.updateMany({
          where: { id: n.id, emailedAt: null },
          data: { emailedAt: new Date() },
        });
        if (claimed.count === 1) claimedItems.push(n);
      }
      if (claimedItems.length === 0) continue;

      const user = claimedItems[0].user;
      const { subject, html } =
        claimedItems.length === 1
          ? renderNotificationEmail(claimedItems[0], user.name)
          : renderDigestEmail(claimedItems, user.name);
      try {
        const outcome = await sendOne(user, { to: [{ name: user.name, email: user.email }], subject, html });
        if (outcome === "sent") result.sent++;
        else result.skipped++;
      } catch (error) {
        result.failed++;
        console.error(`E-Mail-Benachrichtigung an ${user.email} fehlgeschlagen:`, error);
      }
    }
  } finally {
    running = false;
  }
  return result;
}

/**
 * Startet den Versand nach Abschluss der aktuellen Anfrage (Next.js `after`),
 * damit API-Antworten nicht auf den Mailversand warten.
 */
export async function scheduleNotificationEmails() {
  if (!isNotificationMailAvailable()) return;
  const run = () => dispatchNotificationEmails().catch((e) => console.error("Mailversand fehlgeschlagen:", e));
  try {
    const { after } = await import("next/server");
    after(run);
  } catch {
    void run();
  }
}
