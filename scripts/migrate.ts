import { readFile } from "node:fs/promises";
import { client, db } from "../src/server/db";
import {
  admins,
  services,
  settings,
  leads,
  sessions,
} from "../src/server/schema";
import { hashPassword, verifyPassword } from "../src/server/password";
import { sql } from "drizzle-orm";
import { demoMode, initialSettings, initialServices } from "../src/server/demo";

try {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const password = process.env.ADMIN_PASSWORD || "";
  if (password.length < 12)
    throw new Error("ADMIN_PASSWORD must contain at least 12 characters");
  await client.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(743202)`;
    await tx`CREATE TABLE IF NOT EXISTS app_migrations (name text PRIMARY KEY, applied_at timestamptz DEFAULT now())`;
    const name = "001_initial.sql";
    const applied =
      await tx`SELECT name FROM app_migrations WHERE name = ${name}`;
    if (!applied.length) {
      await tx.unsafe(
        await readFile(
          new URL(`../migrations/${name}`, import.meta.url),
          "utf8",
        ),
      );
      await tx`INSERT INTO app_migrations(name) VALUES (${name})`;
    }
  });
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(743202)`);
    const username = process.env.ADMIN_USERNAME || "owner";
    const [existing] = await tx.select().from(admins);
    if (
      !existing ||
      existing.username !== username ||
      !verifyPassword(password, existing.passwordHash)
    ) {
      await tx.delete(sessions);
      const passwordHash = hashPassword(password);
      await tx
        .insert(admins)
        .values({ id: 1, username, passwordHash })
        .onConflictDoUpdate({
          target: admins.id,
          set: { username, passwordHash },
        });
    }
    await tx.execute(sql`DELETE FROM sessions WHERE expires_at <= now()`);
    await tx.execute(sql`DELETE FROM rate_limits WHERE expires_at <= now()`);
    const inserted = await tx
      .insert(settings)
      .values(initialSettings)
      .onConflictDoNothing()
      .returning();
    if (inserted.length) {
      await tx.insert(services).values(initialServices);
      if (demoMode())
        await tx.insert(leads).values({
          id: "00000000-0000-4000-8000-000000000001",
          name: "Тестовый клиент",
          phone: "+7 000 000-00-00",
          serviceId: 2,
          serviceName: "R15–R16",
          comment: "Демонстрационное обращение.",
          notificationStatus: "disabled",
        });
    }
  });
  console.log("Database migrations and initialization completed.");
} finally {
  await client.end();
}
