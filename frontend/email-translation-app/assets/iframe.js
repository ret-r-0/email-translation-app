const client = ZAFClient.init();

const elStatus = document.getElementById("status");
const elDetected = document.getElementById("detected");
const elTarget = document.getElementById("target");
const elPreview = document.getElementById("preview");
const btn = document.getElementById("translateBtn");

// Вставь свой backend URL (тот, где /health = ok)
const BACKEND_URL = "https://email-translation-app-production.up.railway.app";

function recommendTarget(detected) {
  const d = (detected || "").toLowerCase();
  if (d && d !== "en" && d !== "english") return "en";
  return "uk";
}

// безопасно получаем первый доступный locale, не падая на InvalidPathError
async function getDetectedLocaleSafe() {
  const candidates = [
    "ticket.requester.locale",
    "ticket.requester.language",
    "currentUser.locale",
  ];

  for (const path of candidates) {
    try {
      const data = await client.get(path);
      const val = data?.[path];
      if (val) return val;
    } catch (_) {
      // игнорируем InvalidPathError и пробуем следующий
    }
  }
  return "en";
}

async function loadTicketContext() {
  elStatus.textContent = "Reading ticket…";

  try {
    const { "ticket.comment.text": text } = await client.get(
      "ticket.comment.text",
    );

    const detected = await getDetectedLocaleSafe();
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
    const detected = await getDetectedLocaleSafe();
    const target = recommendTarget(detected);

    const response = await fetch(`${BACKEND_URL}/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        sourceLang: detected,
        targetLang: target,
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || "Translation failed");

    const translated = data.translatedText || "";
    const delimiter = "\n\n---\n\n";

    const base = (text || "").includes(delimiter)
      ? (text || "").split(delimiter)[0].trim()
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
