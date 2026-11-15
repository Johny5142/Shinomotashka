import { and, eq, lt, or, isNull, sql } from "drizzle-orm";
import { db } from "./db";
import { leads } from "./schema";
import { demoMode } from "./demo";

export async function notifyLead(id: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = demoMode()
    ? process.env.TELEGRAM_DEMO_CHAT_ID
    : process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) {
    await db
      .update(leads)
      .set({ notificationStatus: "disabled", notificationError: null })
      .where(and(eq(leads.id, id), sql`${leads.notificationStatus} <> 'sent'`));
    return;
  }
  // Claim a delivery before contacting Telegram. Stale attempts can be retried.
  const [lead] = await db
    .update(leads)
    .set({ notificationStatus: "sending", notificationAttemptAt: new Date() })
    .where(
      and(
        eq(leads.id, id),
        sql`${leads.notificationStatus} <> 'sent'`,
        or(
          sql`${leads.notificationStatus} <> 'sending'`,
          isNull(leads.notificationAttemptAt),
          lt(leads.notificationAttemptAt, new Date(Date.now() - 60000)),
        ),
      ),
    )
    .returning();
  if (!lead) return;
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(7000),
        body: JSON.stringify({
          chat_id: chat,
          text: `${demoMode() ? "[ДЕМО] " : ""}Новая заявка\n${lead.name}\n${lead.phone}\n${lead.serviceName}\n${lead.comment}\nID: ${lead.id}`,
        }),
      },
    );
    const result = (await response.json()) as { ok?: boolean };
    if (!response.ok || !result.ok)
      throw new Error("Telegram rejected delivery");
    await db
      .update(leads)
      .set({ notificationStatus: "sent", notificationError: null })
      .where(eq(leads.id, id));
  } catch {
    // Never persist a fetch error containing the bot token URL.
    await db
      .update(leads)
      .set({
        notificationStatus: "error",
        notificationError:
          "Не удалось отправить уведомление. Повторите отправку.",
      })
      .where(eq(leads.id, id));
  }
}
