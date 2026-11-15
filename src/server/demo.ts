import { sql } from "drizzle-orm";
import { db } from "./db";
import { services, settings, leads } from "./schema";

export const demoMode = () => process.env.DEMO_MODE === "true";
export const initialSettings = {
  id: 1,
  name: "Точка колеса",
  city: "Тула",
  address: "Демонстрационный адрес — улица вашей мастерской",
  phone: "",
  hours: "Ежедневно, 09:00–21:00",
  included:
    "Снятие и установка колёс, демонтаж и монтаж шин, балансировка. Ремонт повреждений и расходные материалы оплачиваются отдельно.",
};
export const initialServices = [
  {
    id: 1,
    name: "R13–R14",
    description: "Комплект из 4 колёс",
    price: 180000,
    category: "package",
    position: 1,
  },
  {
    id: 2,
    name: "R15–R16",
    description: "Комплект из 4 колёс",
    price: 240000,
    category: "package",
    position: 2,
  },
  {
    id: 3,
    name: "R17–R18",
    description: "Комплект из 4 колёс",
    price: 320000,
    category: "package",
    position: 3,
  },
  {
    id: 4,
    name: "R19–R20",
    description: "Комплект из 4 колёс",
    price: 400000,
    category: "package",
    position: 4,
  },
  {
    id: 5,
    name: "Ремонт прокола",
    description: "Стоимость после осмотра повреждения",
    price: 60000,
    category: "extra",
    position: 5,
  },
  {
    id: 6,
    name: "Балансировка",
    description: "За одно колесо",
    price: 25000,
    category: "extra",
    position: 6,
  },
  {
    id: 7,
    name: "Замена вентиля",
    description: "За один вентиль, без снятия колеса",
    price: 15000,
    category: "extra",
    position: 7,
  },
];

export async function resetDemoIfDue() {
  if (!demoMode()) return;
  await db.transaction(async (tx) => {
    // Same lock as public writes: a daily reset cannot race a new submission.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(743201)`);
    const [current] = await tx.select().from(settings);
    if (!current || Date.now() - current.resetAt.getTime() < 86400000) return;
    await tx.delete(leads);
    await tx.delete(services);
    await tx.insert(services).values(initialServices);
    await tx.update(settings).set({ ...initialSettings, resetAt: new Date() });
    await tx.insert(leads).values({
      id: "00000000-0000-4000-8000-000000000001",
      name: "Тестовый клиент",
      phone: "+7 000 000-00-00",
      serviceId: 2,
      serviceName: "R15–R16",
      comment: "Демонстрационное обращение. Хочу заменить комплект шин.",
      notificationStatus: "disabled",
    });
  });
}
