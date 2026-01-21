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
  const { text, sourceLang, targetLang } = req.body;

  if (typeof text !== "string" || !text.length || !targetLang) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  if (!process.env.DEEPL_API_KEY) {
    return res.status(500).json({ error: "DEEPL_API_KEY not configured" });
  }

  try {
    // IMPORTANT:
    // DeepL auto-detect = do NOT send source_lang at all.
    const params = {
      auth_key: process.env.DEEPL_API_KEY,
      text,
      target_lang: String(targetLang).toUpperCase(),
      preserve_formatting: 1,
      split_sentences: 0,
    };

    // only add source_lang if explicitly provided (optional)
    if (sourceLang) {
      params.source_lang = String(sourceLang).toUpperCase();
    }

    const deeplBaseUrl =
      process.env.DEEPL_API_BASE_URL || "https://api-free.deepl.com";
    const safeParams = { ...params, auth_key: "REDACTED" };
    console.log("DeepL request:", {
      url: `${deeplBaseUrl}/v2/translate`,
      params: safeParams,
    });
    const response = await axios.post(
      `${deeplBaseUrl}/v2/translate`,
      null,
      { params, timeout: 20000 },
    );
    console.log("DeepL response:", response?.data);

    const translatedText = response?.data?.translations?.[0]?.text;

    if (!translatedText) {
      return res.status(500).json({ error: "Empty translation response" });
    }

    res.json({ translatedText });
  } catch (err) {
    const status = err?.response?.status;
    const data = err?.response?.data;
    console.error("DeepL error:", data || err.message);
    res.status(500).json({
      error: "Translation failed",
      details: status ? { status, data } : undefined,
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running on port ${PORT}`);
});
