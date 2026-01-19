const client = ZAFClient.init();

const elStatus = document.getElementById("status");
const elDetected = document.getElementById("detected");
const elTarget = document.getElementById("target");
const elPreview = document.getElementById("preview");
const btn = document.getElementById("translateBtn");

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

btn.addEventListener("click", () => {
  // пока просто заглушка: позже здесь будет fetch на backend /translate
  elStatus.textContent = "Clicked (backend later)";
});
