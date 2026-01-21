import express from "express";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// ROOT endpoint (важно для Railway healthcheck)
app.get("/", (_req, res) => {
  res.status(200).send("OK");
});

// health check
app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true });
});

// translate endpoint
app.post("/translate", async (req, res) => {
  const requestId = Math.random().toString(36).slice(2, 10);
  const { text, sourceLang, targetLang } = req.body;

  if (typeof text !== "string" || !text.length || !targetLang) {
    console.error("Missing parameters:", { requestId });
    return res.status(400).json({ error: "Missing required parameters" });
  }

  if (!process.env.DEEPL_API_KEY) {
    console.error("DEEPL_API_KEY not configured:", { requestId });
    return res.status(500).json({ error: "DEEPL_API_KEY not configured" });
  }

  try {
    // IMPORTANT:
    // DeepL auto-detect = do NOT send source_lang at all.
    const targetLangNormalized = String(targetLang).trim().toUpperCase();
    if (!/^[A-Z]{2,3}(-[A-Z]{2})?$/.test(targetLangNormalized)) {
      return res.status(400).json({ error: "Invalid targetLang format" });
    }

    const params = {
      auth_key: process.env.DEEPL_API_KEY,
      text,
      target_lang: targetLangNormalized,
      preserve_formatting: 1,
      split_sentences: 0,
    };

    // only add source_lang if explicitly provided (optional)
    if (sourceLang) {
      const sourceLangNormalized = String(sourceLang).trim().toUpperCase();
      if (!/^[A-Z]{2,3}(-[A-Z]{2})?$/.test(sourceLangNormalized)) {
        return res.status(400).json({ error: "Invalid sourceLang format" });
      }
      params.source_lang = sourceLangNormalized;
    }

    const deeplBaseUrl =
      process.env.DEEPL_API_BASE_URL || "https://api-free.deepl.com";
    const safeParams = { ...params, auth_key: "REDACTED" };
    console.log("DeepL request:", {
      url: `${deeplBaseUrl}/v2/translate`,
      params: safeParams,
      requestId,
    });
    const response = await axios.post(
      `${deeplBaseUrl}/v2/translate`,
      null,
      { params, timeout: 20000 },
    );
    console.log("DeepL response:", { data: response?.data, requestId });

    const translatedText = response?.data?.translations?.[0]?.text;

    if (!translatedText) {
      return res.status(500).json({ error: "Empty translation response" });
    }

    res.json({ translatedText });
  } catch (err) {
    const status = err?.response?.status;
    const data = err?.response?.data;
    console.error("DeepL error:", data || err.message);
    const details =
      process.env.NODE_ENV !== "production" && status
        ? { status, data, requestId }
        : undefined;
    res.status(500).json({ error: "Translation failed", details });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running on port ${PORT}`);
});
