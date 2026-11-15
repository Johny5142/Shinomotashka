async function api(path: string, method: string, data?: unknown) {
  const response = await fetch(`/api/admin/${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: data ? JSON.stringify(data) : undefined,
  });
  const result = await response.json();
  if (response.status === 401 && path !== "login") {
    window.location.href = "/admin";
    throw new Error("Сессия истекла. Войдите снова.");
  }
  if (!response.ok) throw new Error(result.error || "Ошибка сохранения.");
  return result;
}

function bindForm(
  selector: string,
  path: string,
  method: string,
  transform?: (
    data: Record<string, FormDataEntryValue>,
    form: HTMLFormElement,
  ) => unknown,
  reload = false,
) {
  document.querySelectorAll<HTMLFormElement>(selector).forEach((form) =>
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const feedback = form.querySelector<HTMLElement>(".feedback")!;
      const button = form.querySelector<HTMLButtonElement>(
        "button[type=submit]",
      )!;
      button.disabled = true;
      feedback.textContent = "Сохраняем…";
      feedback.className = "feedback";
      try {
        const data = Object.fromEntries(new FormData(form));
        await api(path, method, transform ? transform(data, form) : data);
        feedback.textContent = "Сохранено";
        feedback.className = "feedback success";
        if (reload) window.location.reload();
      } catch (error) {
        feedback.textContent =
          error instanceof Error
            ? error.message
            : "Нет соединения. Повторите попытку.";
        feedback.className = "feedback error";
      } finally {
        button.disabled = false;
      }
    }),
  );
}
bindForm("#login-form", "login", "POST", undefined, true);
bindForm(
  ".status-form",
  "leads",
  "PATCH",
  (data, form) => ({ ...data, id: form.dataset.id }),
  true,
);
bindForm(".service-form", "services", "PUT", (data, form) => ({
  ...data,
  id: Number(form.dataset.id),
  price: Math.round(Number(data.price) * 100),
}));
bindForm("#settings-form", "settings", "PUT");
document
  .querySelector("#refresh")
  ?.addEventListener("click", () => window.location.reload());
document.querySelector("#logout")?.addEventListener("click", async () => {
  try {
    await api("logout", "POST");
    window.location.reload();
  } catch {
    document.querySelector("#admin-feedback")!.textContent =
      "Не удалось выйти. Повторите попытку.";
  }
});
document
  .querySelectorAll<HTMLButtonElement>(".retry-button")
  .forEach((button) =>
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        await api("notify", "POST", { id: button.dataset.id });
        window.location.reload();
      } catch (error) {
        document.querySelector("#admin-feedback")!.textContent =
          error instanceof Error ? error.message : "Ошибка отправки.";
        button.disabled = false;
      }
    }),
  );
