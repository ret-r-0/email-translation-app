const client = ZAFClient.init();

const elStatus = document.getElementById("status");
const elDetected = document.getElementById("detected");
const elTarget = document.getElementById("target");
const elPreview = document.getElementById("preview");
const btn = document.getElementById("translateBtn");

/**
 * ВАЖНО:
 * сюда вставь ДОМЕН ИМЕННО backend-сервиса из Railway → Domains
 * без слеша на конце
 */
const BACKEND_URL = "https://email-translation-app-production.up.railway.app";

function recommendTarget(detected) {
  const d = (detected || "").toLowerCase();
  // если не English → переводим в English
  if (d && d !== "en" && d !== "english") return "en";
  // если English → в Ukrainian (MVP-дефолт)
  return "uk";
}

async function loadTicketContext() {
  elStatus.textContent = "Reading ticket…";

  try {
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
    const { "ticket.comment.text": text } = await client.get(
      "ticket.comment.text",
    );

    const detected =
      (await client.get("ticket.locale"))["ticket.locale"] || "en";

    const target = recommendTarget(detected);

    const response = await fetch(`${BACKEND_URL}/translate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        sourceLang: detected,
        targetLang: target,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error || "Translation failed");
    }

    const translated = data.translatedText || "";
    const delimiter = "\n\n---\n\n";

    // не дублируем перевод при повторном клике
    const base = (text || "").includes("\n\n---\n\n")
      ? (text || "").split("\n\n---\n\n")[0].trim()
      : (text || "").trim();

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
