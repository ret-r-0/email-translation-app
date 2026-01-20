const client = ZAFClient.init();

const elStatus = document.getElementById("status");
const elDetected = document.getElementById("detected");
const elTarget = document.getElementById("target");
const elPreview = document.getElementById("preview");
const btn = document.getElementById("translateBtn");

// Вставь свой backend URL (тот, где /health = ok)
const BACKEND_URL = "https://email-translation-app-production.up.railway.app";

// ДЛИННАЯ линия как в поле (а не markdown-hr)
const delimiter = "\n\n" + "-".repeat(60) + "\n\n";

// Тексты, которые нужно вставлять на других языках
const messages = {
  de: "Um eine klarere und schnellere Kommunikation zu gewährleisten, wurde diese Nachricht mit automatischen Übersetzungswerkzeugen übersetzt. Während wir uns um Genauigkeit bemühen, danken wir Ihnen für Ihr Verständnis hinsichtlich möglicher Unvollkommenheiten aufgrund der automatisierten Übersetzung.",
  es: "Para asegurar una comunicación más clara y rápida, este mensaje ha sido traducido utilizando herramientas de traducción automática. Si bien nos esforzamos por lograr la precisión, apreciamos su comprensión sobre las imperfecciones que puedan ocurrir debido a la traducción automatizada.",
  fr: "Pour garantir une communication plus claire et rapide, ce message a été traduit à l'aide d'outils de traduction automatique. Bien que nous nous efforcions de garantir la précision, nous vous remercions de votre compréhension quant aux imperfections qui peuvent survenir en raison de la traduction automatisée.",
  it: "Per garantire una comunicazione più chiara e rapida, questo messaggio è stato tradotto utilizzando strumenti di traduzione automatica. Sebbene ci impegniamo per la precisione, apprezziamo la vostra comprensione riguardo a eventuali imperfezioni che potrebbero verificarsi a causa della traduzione automatica.",
  pt: "Para garantir uma comunicação mais clara e rápida, esta mensagem foi traduzida utilizando ferramentas de tradução automática. Embora nos esforcemos pela precisão, agradecemos a sua compreensão em relação a quaisquer imperfeições que possam ocorrer devido à tradução automatizada.",
  ja: "より明確で迅速なコミュニケーションを確保するため、このメッセージは機械翻訳ツールを使用して翻訳されました。正確性を期していますが、機械翻訳に起因する可能な不完全さについて理解をいただければと思います。",
  ar: "لتوفير اتصال أوضح وأسرع، تم ترجمة هذه الرسالة باستخدام أدوات الترجمة الآلية. بينما نسعى جاهدين من أجل الدقة، نقدر تفهمك بشأن أي عيوب قد تحدث بسبب الترجمة الآلية.",
  en: "To ensure clearer and faster communication, this message has been translated using machine translation tools. While we strive for accuracy, we appreciate your understanding regarding any imperfections that may occur due to automated translation.",
};

// Функция для нормализации языка из локали агента (выбираем правильный язык)
function normalizeTargetFromAgentLocale(locale) {
  const l = (locale || "").toLowerCase();

  if (l.startsWith("de")) return "de"; // Немецкий
  if (l.startsWith("es")) return "es"; // Испанский
  if (l.startsWith("fr")) return "fr"; // Французский
  if (l.startsWith("it")) return "it"; // Итальянский
  if (l.startsWith("pt")) return "pt"; // Португальский
  if (l.startsWith("ja")) return "ja"; // Японский
  if (l.startsWith("ar")) return "ar"; // Арабский
  return "en"; // По умолчанию английский
}

// Функция для безопасного получения языка из различных путей
async function getAgentLocaleSafe() {
  const candidates = [
    "ticket.requester.locale", // ищем локаль у клиента
    "ticket.requester.language", // проверяем language у клиента
    "currentUser.locale", // проверяем локаль у агента
    "currentUser.language", // проверяем язык агента
  ];

  for (const path of candidates) {
    try {
      const data = await client.get(path);
      console.log(`Checking path: ${path}`, data); // Логируем для отладки
      const val = data?.[path];
      if (val) return val;
    } catch (err) {
      console.log(`Error at path: ${path}`, err); // Логируем ошибку, если не удается получить значение
    }
  }

  // Возвращаем дефолтный язык, если ничего не найдено
  return "en";
}

async function loadTicketContext() {
  elStatus.textContent = "Reading ticket…";

  try {
    const { "ticket.comment.text": rawText } = await client.get(
      "ticket.comment.text",
    );
    console.log("Raw text:", rawText); // Логируем текст
    const text = rawText || "";

    // Показываем preview только оригинала (до delimiter), чтобы не путаться
    const base = text.includes(delimiter) ? text.split(delimiter)[0] : text;

    // Получаем локаль клиента или агента
    const agentLocale = await getAgentLocaleSafe();
    console.log("Detected language:", agentLocale); // Логируем детектированный язык

    // Нормализуем target для перевода
    const target = normalizeTargetFromAgentLocale(agentLocale);

    elDetected.textContent = agentLocale;
    elTarget.textContent = target;

    elPreview.textContent = base ? base.slice(0, 1200) : "(no text)";
    btn.disabled = !base;

    elStatus.textContent = "Ready";
  } catch (err) {
    console.error("Error loading ticket context:", err);
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
    console.log("Raw text for translation:", rawText); // Логируем текст

    const text = rawText || "";
    const base = text.includes(delimiter) ? text.split(delimiter)[0] : text;

    // Получаем локаль клиента или агента
    const agentLocale = await getAgentLocaleSafe();
    const target = normalizeTargetFromAgentLocale(agentLocale);

    console.log("Sending translation request:", {
      text: base,
      targetLang: target,
    }); // Логируем запрос

    const response = await fetch(`${BACKEND_URL}/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: base,
        targetLang: target,
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || "Translation failed");

    const translated = data.translatedText || "";

    // Вставляем текст о переводе на нужном языке
    const translationMessage = messages[agentLocale] || messages["en"];

    // Формируем финальный текст: перевод + чёрточки + оригинал
    const newText = `${translationMessage}${translated}${delimiter}${base}`;

    // Обновляем текст в редакторе
    await client.set("ticket.comment.text", newText);

    elStatus.textContent = "Done";
  } catch (err) {
    console.error("Error during translation:", err);
    elStatus.textContent = "Error (see console)";
  } finally {
    btn.disabled = false;
  }
});
