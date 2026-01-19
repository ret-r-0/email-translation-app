const client = ZAFClient.init();

const elStatus = document.getElementById("status");
const elDetected = document.getElementById("detected");
const elTarget = document.getElementById("target");
const elPreview = document.getElementById("preview");
const btn = document.getElementById("translateBtn");

// Задаём URL для бэкенда
const BACKEND_URL =
  "https://email-translation-app-production.up.railway.app" ||
  "http://localhost:3000";

function recommendTarget(detected) {
  // MVP-логика: если не English -> target English, иначе -> Ukrainian
  const d = (detected || "").toLowerCase();
  if (d && d !== "en" && d !== "english") return "en";
  return "uk";
}

async function loadTicketContext() {
  elStatus.textContent = "Reading ticket…";

  const [{ "ticket.comment.text": text }, locales] = await Promise.all([
    client.get("ticket.comment.text"),
    client.get(["ticket.locale", "ticket.requester.locale"]),
  ]);

  const detected =
    locales["ticket.locale"] || locales["ticket.requester.locale"] || "";
  const target = recommendTarget(detected);

  elDetected.textContent = detected || "(unknown)";
  elTarget.textContent = target;

  const trimmed = (text || "").trim();
  elPreview.textContent = trimmed ? trimmed.slice(0, 1200) : "(no text)";

  btn.disabled = !trimmed;
  elStatus.textContent = "Ready";
}

client.on("app.registered", () => {
  loadTicketContext().catch((e) => {
    console.error(e);
    elStatus.textContent = "Error (see console)";
  });
});

btn.addEventListener("click", async () => {
  elStatus.textContent = "Translating…";

  try {
    // Получаем текст комментария и локаль
    const { "ticket.comment.text": text } = await client.get(
      "ticket.comment.text",
    );
    const detected =
      (await client.get("ticket.locale"))["ticket.locale"] || "en";
    const target = recommendTarget(detected);

    // Отправляем запрос на сервер для перевода
    const response = await fetch(
      `${"https://email-translation-app-production.up.railway.app"}/translate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          sourceLang: detected,
          targetLang: target,
        }),
      },
    );

    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || "Translation failed");

    // Получаем переведённый текст
    const translated = data.translatedText || "";
    const delimiter = "\n\n---\n\n";

    // Формируем новый текст с переводом
    const base = (text || "").includes("\n---\n")
      ? (text || "").split("\n---\n")[0].trim()
      : (text || "").trim();
    const newText = `${base}${delimiter}${translated}`;

    // Обновляем комментарий в тикете
    await client.set("ticket.comment.text", newText);

    elStatus.textContent = "Done";
  } catch (error) {
    console.error(error);
    elStatus.textContent = "Error (see console)";
  }
});
