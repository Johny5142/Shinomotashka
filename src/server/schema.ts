import {
  pgTable,
  integer,
  serial,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const admins = pgTable("admins", {
  id: integer("id").primaryKey().default(1),
  username: text("username").notNull(),
  passwordHash: text("password_hash").notNull(),
});
export const services = pgTable("services", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  price: integer("price").notNull(),
  category: text("category").notNull(),
  position: integer("position").notNull().default(0),
});
export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  name: text("name").notNull(),
  city: text("city").notNull(),
  address: text("address").notNull(),
  phone: text("phone").notNull(),
  hours: text("hours").notNull(),
  included: text("included").notNull(),
  resetAt: timestamp("reset_at", { withTimezone: true }).notNull().defaultNow(),
});
export const leads = pgTable("leads", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  serviceId: integer("service_id").references(() => services.id, {
    onDelete: "set null",
  }),
  serviceName: text("service_name").notNull(),
  comment: text("comment").notNull().default(""),
  status: text("status").notNull().default("new"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  notificationStatus: text("notification_status").notNull().default("pending"),
  notificationError: text("notification_error"),
  notificationAttemptAt: timestamp("notification_attempt_at", {
    withTimezone: true,
  }),
});
export const sessions = pgTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  adminId: integer("admin_id")
    .notNull()
    .references(() => admins.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
