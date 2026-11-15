// End-to-end checks against a dedicated, running local demo instance.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db, client } from "../src/server/db";
import { leads } from "../src/server/schema";
import { eq } from "drizzle-orm";

const origin = process.env.APP_ORIGIN || "http://localhost:8080";
let cookie = "";
async function request(
  path: string,
  method = "GET",
  data?: unknown,
  authenticated = false,
  customOrigin = origin,
) {
  return fetch(`${origin}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Origin: customOrigin,
      ...(authenticated ? { Cookie: cookie } : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
  });
}
const id = randomUUID();
const concurrentId = randomUUID();
try {
  assert.equal(
    process.env.DEMO_MODE,
    "true",
    "Run checks only against a dedicated demo.",
  );
  assert.equal((await request("/")).status, 200);
  assert.equal((await request("/api/health")).status, 200);
  assert.equal((await request("/api/admin/leads")).status, 401);
  assert.equal(
    (
      await request("/api/admin/login", "POST", {
        username: "owner",
        password: "wrong",
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await request(
        "/api/admin/login",
        "POST",
        {
          username: process.env.ADMIN_USERNAME,
          password: process.env.ADMIN_PASSWORD,
        },
        false,
        "https://untrusted.example",
      )
    ).status,
    403,
  );
  const login = await request("/api/admin/login", "POST", {
    username: process.env.ADMIN_USERNAME,
    password: process.env.ADMIN_PASSWORD,
  });
  assert.equal(login.status, 200);
  cookie = login.headers.get("set-cookie")!.split(";")[0]!;
  const input = {
    id,
    name: "Проверка интеграции",
    phone: "+7 000 000-00-00",
    serviceId: 2,
    comment: "Тест. Можно удалить.",
  };
  assert.equal(
    (await request("/api/leads", "POST", { ...input, phone: "bad" })).status,
    400,
  );
  assert.equal((await request("/api/leads", "POST", input)).status, 201);
  assert.equal((await request("/api/leads", "POST", input)).status, 201);
  assert.equal(
    (await request("/api/leads", "POST", { ...input, comment: "Changed" }))
      .status,
    409,
  );
  const concurrent = await Promise.all(
    [1, 2, 3].map(() =>
      request("/api/leads", "POST", { ...input, id: concurrentId }),
    ),
  );
  assert.deepEqual(
    concurrent.map((r) => r.status),
    [201, 201, 201],
  );
  const list = await (
    await request("/api/admin/leads", "GET", undefined, true)
  ).json();
  assert.equal(list.filter((item: { id: string }) => item.id === id).length, 1);
  assert.equal(
    list.filter((item: { id: string }) => item.id === concurrentId).length,
    1,
  );
  assert.equal(
    (
      await request(
        "/api/admin/leads",
        "PATCH",
        { id, status: "progress" },
        true,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await request(
        "/api/admin/leads",
        "PATCH",
        { id, status: "unknown" },
        true,
      )
    ).status,
    400,
  );
  const homepage = await (await request("/")).text();
  const { services } = await import("../src/server/schema");
  const [original] = await db.select().from(services).where(eq(services.id, 2));
  assert.ok(original);
  try {
    assert.equal(
      (
        await request(
          "/api/admin/services",
          "PUT",
          { ...original, name: "Проверка цены", price: 255000 },
          true,
        )
      ).status,
      200,
    );
    assert.match(await (await request("/")).text(), /Проверка цены/);
    assert.notEqual(homepage, await (await request("/")).text());
  } finally {
    await request("/api/admin/services", "PUT", original, true);
  }
  assert.equal(
    (await request("/api/admin/logout", "POST", undefined, true)).status,
    200,
  );
  assert.equal(
    (await request("/api/admin/leads", "GET", undefined, true)).status,
    401,
  );
  console.log(
    "PASS: login, authorization, CSRF, validation, idempotency, concurrency, status updates, live prices, logout.",
  );
} finally {
  await db.delete(leads).where(eq(leads.id, id));
  await db.delete(leads).where(eq(leads.id, concurrentId));
  await client.end();
}
