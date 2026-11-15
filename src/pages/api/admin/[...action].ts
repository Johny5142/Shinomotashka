import type { APIRoute } from "astro";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "../../../server/db";
import {
  admins,
  leads,
  services,
  sessions,
  settings,
} from "../../../server/schema";
import { body, field, HttpError, json, uuid } from "../../../server/http";
import { createSession, rateLimit, tokenHash } from "../../../server/auth";
import { verifyPassword } from "../../../server/password";
import { notifyLead } from "../../../server/telegram";

export const ALL: APIRoute = async (context) => {
  const action = context.params.action;
  const method = context.request.method;
  if (action === "login" && method === "POST") {
    await rateLimit(`login:${tokenHash(context.clientAddress)}`, 10, 900);
    const input = await body(context.request);
    const username = field(input.username, "Логин", 100);
    const password = field(input.password, "Пароль", 256);
    const [admin] = await db.select().from(admins).where(eq(admins.id, 1));
    // Always derive a hash, including for an unknown username.
    const valid = admin && verifyPassword(password, admin.passwordHash);
    if (!valid || admin.username !== username)
      throw new HttpError(401, "Неверный логин или пароль.");
    await createSession(context);
    return json({ ok: true });
  }
  if (action === "logout" && method === "POST") {
    const token = context.cookies.get("workshop_session")?.value;
    if (token)
      await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash(token)));
    context.cookies.delete("workshop_session", { path: "/" });
    return json({ ok: true });
  }
  if (action === "leads" && method === "GET")
    return json(
      await db.select().from(leads).orderBy(desc(leads.createdAt)).limit(200),
    );
  if (action === "leads" && method === "PATCH") {
    const input = await body(context.request);
    const id = uuid(input.id);
    const status = field(input.status, "Статус", 20);
    if (!["new", "progress", "closed"].includes(status))
      throw new HttpError(400, "Некорректный статус.");
    const rows = await db
      .update(leads)
      .set({ status })
      .where(eq(leads.id, id))
      .returning({ id: leads.id });
    if (!rows.length) throw new HttpError(404, "Заявка не найдена.");
    return json({ ok: true });
  }
  if (action === "notify" && method === "POST") {
    const input = await body(context.request);
    const id = uuid(input.id);
    await rateLimit(`notify:${id}`, 3, 60);
    await notifyLead(id);
    return json({ ok: true });
  }
  if (action === "services" && method === "PUT") {
    const input = await body(context.request);
    const id = Number(input.id);
    const price = Number(input.price);
    if (
      !Number.isSafeInteger(id) ||
      !Number.isSafeInteger(price) ||
      price < 0 ||
      price > 100000000
    )
      throw new HttpError(400, "Проверьте цену.");
    const name = field(input.name, "Услуга", 100);
    const description = field(input.description, "Описание", 500);
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(743201)`);
      const rows = await tx
        .update(services)
        .set({ name, description, price })
        .where(eq(services.id, id))
        .returning({ id: services.id });
      if (!rows.length) throw new HttpError(404, "Услуга не найдена.");
    });
    return json({ ok: true });
  }
  if (action === "settings" && method === "PUT") {
    const input = await body(context.request);
    const values = {
      name: field(input.name, "Название", 100),
      city: field(input.city, "Город", 100),
      address: field(input.address, "Адрес", 300),
      phone: field(input.phone, "Телефон", 32, false),
      hours: field(input.hours, "График", 150),
      included: field(input.included, "Состав работ", 1000),
    };
    if (
      values.phone &&
      (!/^[+\d\s()\-]+$/.test(values.phone) ||
        !/^\d{10,15}$/.test(values.phone.replace(/\D/g, "")))
    )
      throw new HttpError(400, "Проверьте номер телефона.");
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(743201)`);
      await tx.update(settings).set(values).where(eq(settings.id, 1));
    });
    return json({ ok: true });
  }
  throw new HttpError(404, "Маршрут не найден.");
};
