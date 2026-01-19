import express from "express";
import cors from "cors";
import axios from "axios";
import "dotenv/config";

const app = express();

app.use(express.json({ limit: "1mb" }));

// Для dev можно разрешить все origin.
// Для продакшена лучше ограничить (позже можно ужесточить).
app.use(cors({ origin: true }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// Zendesk frontend присылает: { text, sourceLang, targetLang }
app.post("/translate", async (req, res) => {
  try {
    const { text, sourceLang, targetLang } = req.body || {};

    if (!process.env.DEEPL_API_KEY) {
      return res.status(500).json({ error: "DEEPL_API_KEY is not set" });
    }

    const cleanText = (text || "").toString().trim();
    if (!cleanText) {
      return res.status(400).json({ error: "Text is empty" });
    }

    // DeepL expects uppercase language codes, and Ukrainian is "UK"
    const mapLang = (lang) => {
      const l = (lang || "").toString().trim().toLowerCase();
      if (!l) return "";
      if (l === "uk" || l === "ua" || l === "ukrainian") return "UK";
      if (l === "en" || l === "english") return "EN";
      if (l === "it") return "IT";
      if (l === "de") return "DE";
      if (l === "fr") return "FR";
      if (l === "es") return "ES";
      // если пришло уже в формате EN/UK — тоже ок
      return l.toUpperCase();
    };

    const target = mapLang(targetLang);
    if (!target) {
      return res.status(400).json({ error: "targetLang is required" });
    }

    const params = new URLSearchParams();
    params.append("auth_key", process.env.DEEPL_API_KEY);
    params.append("text", cleanText);
    params.append("target_lang", target);

    const src = mapLang(sourceLang);
    // Если sourceLang = auto/пусто — просто не передаем, DeepL сам определит
    if (src && src !== "AUTO") params.append("source_lang", src);

    const deeplUrl = "https://api-free.deepl.com/v2/translate";

    const resp = await axios.post(deeplUrl, params, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      timeout: 15000,
    });

    const translatedText = resp.data?.translations?.[0]?.text || "";
    return res.json({ translatedText });
  } catch (err) {
    // Без логирования текста, только общий статус
    return res.status(500).json({ error: "Translation failed" });
  }
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});
