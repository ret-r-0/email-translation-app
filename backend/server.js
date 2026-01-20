import express from "express";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";

// load env vars
dotenv.config();

const app = express();

// middlewares
app.use(cors());
app.use(express.json());

// ROOT endpoint (ВАЖНО для Railway)
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

  if (!text || !targetLang) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  if (!process.env.DEEPL_API_KEY) {
    return res.status(500).json({ error: "DEEPL_API_KEY not configured" });
  }

  try {
    const response = await axios.post(
      "https://api-free.deepl.com/v2/translate",
      null,
      {
        params: {
          auth_key: process.env.DEEPL_API_KEY,
          text,
          source_lang: sourceLang || "auto",
          target_lang: targetLang.toUpperCase(),
        },
        timeout: 10000,
      },
    );

    const translatedText = response?.data?.translations?.[0]?.text;

    if (!translatedText) {
      return res.status(500).json({ error: "Empty translation response" });
    }

    res.json({ translatedText });
  } catch (err) {
    console.error("DeepL error:", err?.response?.data || err.message);
    res.status(500).json({ error: "Translation failed" });
  }
});

// listen (Railway-compatible)
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running on port ${PORT}`);
});
