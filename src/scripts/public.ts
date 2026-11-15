const toggle = document.querySelector<HTMLButtonElement>(".menu-toggle");
const nav = document.querySelector<HTMLElement>("#navigation");
toggle?.addEventListener("click", () => {
  const open = toggle.getAttribute("aria-expanded") !== "true";
  toggle.setAttribute("aria-expanded", String(open));
  nav?.classList.toggle("open", open);
});
nav?.querySelectorAll("a").forEach((link) =>
  link.addEventListener("click", () => {
    toggle?.setAttribute("aria-expanded", "false");
    nav.classList.remove("open");
  }),
);
const form = document.querySelector<HTMLFormElement>("#lead-form");
document.querySelectorAll<HTMLElement>("[data-service]").forEach((link) =>
  link.addEventListener("click", () => {
    const select = form?.elements.namedItem("serviceId") as HTMLSelectElement;
    if (select) select.value = link.dataset.service || "";
  }),
);
let requestId = crypto.randomUUID();
let submittedBody: string | null = null;
form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const feedback = document.querySelector<HTMLElement>("#lead-feedback")!;
  const button = form.querySelector<HTMLButtonElement>("button[type=submit]")!;
  const fields = Object.fromEntries(new FormData(form));
  const payload = JSON.stringify(fields);
  if (submittedBody !== null && payload !== submittedBody)
    requestId = crypto.randomUUID();
  submittedBody = payload;
  button.disabled = true;
  feedback.textContent = "Сохраняем заявку…";
  feedback.className = "";
  try {
    const response = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...fields, id: requestId }),
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.error || "Не удалось отправить заявку.");
    feedback.textContent =
      "Заявка сохранена. Номер обращения: " + data.id.slice(0, 8) + ".";
    feedback.className = "success";
    form.reset();
    requestId = crypto.randomUUID();
    submittedBody = null;
  } catch (error) {
    feedback.textContent =
      error instanceof Error
        ? error.message
        : "Ошибка соединения. Повторите отправку.";
    feedback.className = "error";
  } finally {
    button.disabled = false;
  }
});
