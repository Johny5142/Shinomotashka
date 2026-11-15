import type { APIRoute } from "astro";
import { sql } from "drizzle-orm";
import { db } from "../../server/db";
import { json } from "../../server/http";
export const GET: APIRoute = async () => {
  await db.execute(sql`SELECT 1`);
  return json({ ok: true });
};
