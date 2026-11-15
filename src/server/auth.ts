import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import type { APIContext } from "astro";
import { db } from "./db";
import { sessions } from "./schema";
import { HttpError } from "./http";

export const tokenHash = (value: string) =>
  createHash("sha256").update(value).digest("hex");

export async function isAuthenticated(context: APIContext) {
  const token = context.cookies.get("workshop_session")?.value;
  if (!token) return false;
  const [session] = await db
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.tokenHash, tokenHash(token)),
        gt(sessions.expiresAt, new Date()),
      ),
    );
  return Boolean(session);
}

export async function createSession(context: APIContext) {
  const token = randomBytes(32).toString("hex");
  await db
    .insert(sessions)
    .values({
      tokenHash: tokenHash(token),
      adminId: 1,
      expiresAt: new Date(Date.now() + 8 * 3600000),
    });
  context.cookies.set("workshop_session", token, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE !== "false",
    sameSite: "strict",
    path: "/",
    maxAge: 8 * 3600,
  });
}

export async function rateLimit(key: string, limit: number, seconds: number) {
  // Atomic shared counters survive restarts and work across instances.
  const result = await db.execute(sql`
    INSERT INTO rate_limits(key, hits, expires_at) VALUES (${key}, 1, now() + ${seconds} * interval '1 second')
    ON CONFLICT(key) DO UPDATE SET
      hits = CASE WHEN rate_limits.expires_at <= now() THEN 1 ELSE rate_limits.hits + 1 END,
      expires_at = CASE WHEN rate_limits.expires_at <= now() THEN now() + ${seconds} * interval '1 second' ELSE rate_limits.expires_at END
    RETURNING hits`);
  if (Number(result[0]?.hits) > limit)
    throw new HttpError(429, "Слишком много попыток. Попробуйте позже.");
}
