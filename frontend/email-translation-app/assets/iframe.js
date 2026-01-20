const client = ZAFClient.init();

const elStatus = document.getElementById("status");
const elDetected = document.getElementById("detected");
const elTarget = document.getElementById("target");
const elPreview = document.getElementById("preview");
const btn = document.getElementById("translateBtn");

// Вставь свой backend URL (тот, где /health = ok)
const BACKEND_URL = "https://email-translation-app-production.up.railway.app";

// ДЛИННАЯ линия в поле (вместо ---)
const delimiter = "\n\n" + "-".repeat(60) + "\n\n";
// если хочешь “жирнее” визуально — попробуй:
// const delimiter = "\n\n" + "—".repeat(60) + "\n\n";

function normalizeTargetFromAgentLocale(locale) {
  const l = (locale || "").toLowerCase();

  // Zendesk locales часто бывают вида "uk", "uk-UA", "ru", "ru-RU", "en-US" и т.д.
  if (l.startsWith("uk")) return "UK";
  if (l.startsWith("ru")) return "EN";

  // дефолт
  return "EN";
}

async function getAgentLocaleSafe() {
  const candidates = ["currentUser.locale", "currentUser.language"];

  for (const path of candidates) {
    try {
      const data = await client.get(path);
      const val = data?.[path];
      if (val) return val;
    } catch (_) {}
  }

  return "en";
}

async function loadTicketContext() {
  elStatus.textContent = "Reading ticket…";

  try {
    const { "ticket.comment.text": rawText } = await client.get(
      "ticket.comment.text",
    );
    const text = rawText || "";

    // показываем preview только оригинала (до delimiter), чтобы не путаться
    const base = text.includes(delimiter) ? text.split(delimiter)[0] : text;

    const agentLocale = await getAgentLocaleSafe();
    const target = normalizeTargetFromAgentLocale(agentLocale);

    elDetected.textContent = "(DeepL auto)";
    elTarget.textContent = target;

    elPreview.textContent = base ? base.slice(0, 1200) : "(no text)";
    btn.disabled = !base;

    elStatus.textContent = "Ready";
  } catch (err) {
    console.error(err);
    elStatus.textContent = "Error (see console)";
  }
}

client.on("app.registered", loadTicketContext);

btn.addEventListener("click", async () => {
  elStatus.textContent = "Translating…";
  btn.disabled = true;

  try {
    const { "ticket.comment.text": rawText } = await client.get(
      "ticket.comment.text",
    );
    const text = rawText || "";

    // 1) переводим только оригинал (до delimiter), без trim, чтобы сохранить форматирование
    const base = text.includes(delimiter) ? text.split(delimiter)[0] : text;

    // 2) target по локали агента
    const agentLocale = await getAgentLocaleSafe();
    const target = normalizeTargetFromAgentLocale(agentLocale);

    elDetected.textContent = "(DeepL auto)";
    elTarget.textContent = target;

    // 3) bulk перевод всего base
    const response = await fetch(`${BACKEND_URL}/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: base,
        targetLang: target,
        // sourceLang НЕ отправляем -> DeepL auto-detect
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || "Translation failed");

    const translated = data.translatedText || "";

    // 4) append mode: оригинал + линия + перевод
    const newText = `${base}${delimiter}${translated}`;

    await client.set("ticket.comment.text", newText);

    elStatus.textContent = "Done";
  } catch (err) {
    console.error(err);
    elStatus.textContent = "Error (see console)";
  } finally {
    btn.disabled = false;
  }
});
