import type { APIRoute } from "astro";
import { eq, sql } from "drizzle-orm";
import { db } from "../../server/db";
import { leads, services } from "../../server/schema";
import { body, field, HttpError, json, uuid } from "../../server/http";
import { rateLimit, tokenHash } from "../../server/auth";
import { notifyLead } from "../../server/telegram";

export const POST: APIRoute = async (context) => {
  const input = await body(context.request);
  const id = uuid(input.id);
  const name = field(input.name, "Имя", 80);
  const phone = field(input.phone, "Телефон", 32);
  if (
    !/^[+\d\s()\-]+$/.test(phone) ||
    !/^\d{10,15}$/.test(phone.replace(/\D/g, ""))
  )
    throw new HttpError(400, "Проверьте номер телефона.");
  const comment = field(input.comment ?? "", "Комментарий", 1000, false);
  const serviceId = Number(input.serviceId);
  if (!Number.isSafeInteger(serviceId) || serviceId < 1)
    throw new HttpError(400, "Выберите услугу.");
  await rateLimit(`lead:${tokenHash(context.clientAddress)}`, 15, 600);
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(743201)`);
    const [existing] = await tx.select().from(leads).where(eq(leads.id, id));
    if (existing) {
      if (
        existing.name !== name ||
        existing.phone !== phone ||
        existing.comment !== comment ||
        existing.serviceId !== serviceId
      ) {
        throw new HttpError(
          409,
          "Запрос уже сохранён с другими данными. Обновите страницу.",
        );
      }
      return;
    }
    const [service] = await tx
      .select()
      .from(services)
      .where(eq(services.id, serviceId));
    if (!service)
      throw new HttpError(400, "Услуга больше недоступна. Обновите страницу.");
    await tx
      .insert(leads)
      .values({
        id,
        name,
        phone,
        comment,
        serviceId,
        serviceName: service.name,
      });
  });
  await notifyLead(id);
  return json({ ok: true, id }, 201);
};
