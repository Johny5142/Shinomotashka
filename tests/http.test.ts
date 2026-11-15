import assert from "node:assert/strict";
import { test } from "node:test";
import { hashPassword, verifyPassword } from "../src/server/password";
import { field, uuid, body, HttpError } from "../src/server/http";

test("password hashes are salted and verify correctly", () => {
  const first = hashPassword("a strong test password");
  assert.notEqual(first, hashPassword("a strong test password"));
  assert.equal(verifyPassword("a strong test password", first), true);
  assert.equal(verifyPassword("incorrect", first), false);
  assert.equal(verifyPassword("incorrect", "invalid"), false);
});
test("validation rejects empty, oversized, and invalid values", () => {
  assert.equal(field("  Иван  ", "Имя", 80), "Иван");
  assert.throws(() => field("  ", "Имя", 80), HttpError);
  assert.throws(() => field("abc", "Имя", 2), HttpError);
  assert.throws(() => uuid("invalid"), HttpError);
});
test("body parser enforces actual streamed size", async () => {
  const request = new Request("http://localhost/api/leads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ comment: "x".repeat(17000) }),
  });
  await assert.rejects(
    body(request),
    (error: HttpError) => error.status === 413,
  );
});
