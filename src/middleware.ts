import { defineMiddleware } from "astro:middleware";
import { randomUUID } from "node:crypto";
import { isAuthenticated } from "./server/auth";
import { resetDemoIfDue } from "./server/demo";
import { HttpError, json } from "./server/http";

export const onRequest = defineMiddleware(async (context, next) => {
  const path = context.url.pathname;
  if (path.startsWith("/_astro/") || /\.(webp|png|jpg|ico|woff2)$/.test(path))
    return next();
  try {
    if (!["GET", "HEAD", "OPTIONS"].includes(context.request.method)) {
      const expected = process.env.APP_ORIGIN || context.url.origin;
      if (context.request.headers.get("origin") !== expected)
        throw new HttpError(403, "Недопустимый источник запроса.");
    }
    if (path.startsWith("/api/admin/") && path !== "/api/admin/login") {
      if (!(await isAuthenticated(context)))
        throw new HttpError(401, "Войдите в кабинет.");
    }
    await resetDemoIfDue();
    const response = await next();
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    response.headers.set(
      "Content-Security-Policy",
      "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
    );
    return response;
  } catch (error) {
    const known = error instanceof HttpError;
    const status = known ? error.status : 503;
    const message = known
      ? error.message
      : "Сервис временно недоступен. Попробуйте ещё раз.";
    if (!known) console.error(`Request failed ${randomUUID()} ${path}`);
    if (path.startsWith("/api/")) return json({ error: message }, status);
    return new Response(
      `<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Сервис временно недоступен</title><body style="font:18px system-ui;max-width:600px;margin:15vh auto;padding:24px"><h1>Нужно немного времени</h1><p>${message}</p><a href="/">Попробовать снова</a></body></html>`,
      {
        status,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        },
      },
    );
  }
});
