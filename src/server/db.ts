import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

// Connection is lazy so a production build does not need database access.
export const client = postgres(
  process.env.DATABASE_URL || "postgres://localhost/workshop",
  {
    max: 5,
    connect_timeout: 5,
    idle_timeout: 20,
  },
);
export const db = drizzle(client);
