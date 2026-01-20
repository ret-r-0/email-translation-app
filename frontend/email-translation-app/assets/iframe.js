const client = ZAFClient.init();

const elStatus = document.getElementById("status");
const elDetected = document.getElementById("detected");
const elTarget = document.getElementById("target");
const elPreview = document.getElementById("preview");
const btn = document.getElementById("translateBtn");

const BACKEND_URL = "https://email-translation-app-production.up.railway.app";

// ДЛИННАЯ линия как в поле (а не markdown-hr)
const delimiter = "\n\n" + "-".repeat(60) + "\n\n";

// Тексты, которые нужно вставлять на других языках
const messages = {
  es: "Para asegurar una comunicación más clara y rápida, este mensaje ha sido traducido utilizando herramientas de traducción automática. Si bien nos esforzamos por lograr la precisión, apreciamos su comprensión sobre las imperfecciones que puedan ocurrir debido a la traducción automatizada.",
  en: "To ensure clearer and faster communication, this message has been translated using machine translation tools. While we strive for accuracy, we appreciate your understanding regarding any imperfections that may occur due to automated translation.",
};

async function getAgentLocaleSafe() {
  const candidates = ["ticket.requester.language", "currentUser.language"];
  for (const path of candidates) {
    try {
      const data = await client.get(path);
      const val = data?.[path];
      if (val) return val;
    } catch (_) {}
  }
  return "en"; // fallback
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

    // 3) отправляем в DeepL только base (bulk, со всеми переносами)
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

    // 4) вставляем сообщение о переводе на нужном языке (в зависимости от языка клиента)
    const translationMessage = messages[agentLocale] || messages["en"];
    const newText = `${translationMessage}${delimiter}${translated}`;

    // 5) аппендим перевод обратно
    await client.set("ticket.comment.text", newText);

    elStatus.textContent = "Done";
  } catch (err) {
    console.error(err);
    elStatus.textContent = "Error (see console)";
  } finally {
    btn.disabled = false;
  }
});
