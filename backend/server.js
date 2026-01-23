import express from "express";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
  const { text, targetLang } = req.body;
  console.log("Request body:", req.body);
  console.log("DEEPL_API_KEY set:", Boolean(process.env.DEEPL_API_KEY));

  if (typeof text !== "string" || !text.length || !targetLang) {
    console.error("Missing parameters:", { requestId });
    return res.status(400).json({ error: "Missing required parameters" });
  }

  if (!process.env.DEEPL_API_KEY) {
    console.error("DEEPL_API_KEY not configured:", { requestId });
    return res.status(500).json({ error: "DEEPL_API_KEY not configured" });
  }

  try {
    const deeplUrl =
      process.env.DEEPL_API_URL || "https://api-free.deepl.com/v2/translate";
    const deeplTarget = String(targetLang || "").toUpperCase();

    const sendDeepLRequest = () => {
      const body = new URLSearchParams();
      body.append("auth_key", process.env.DEEPL_API_KEY);
      body.append("text", text);
      body.append("target_lang", deeplTarget);
      body.append("tag_handling", "html");
      body.append("split_sentences", "nonewlines");

      return axios.post(deeplUrl, body, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
    };

    const maxAttempts = 3;
    const baseDelayMs = 1000;
    let response;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        response = await sendDeepLRequest();
        break;
      } catch (err) {
        const status = err.response?.status;
        if (status === 429 && attempt < maxAttempts) {
          const retryAfter =
            Number(err.response?.headers?.["retry-after"]) || 0;
          const delayMs = Math.max(baseDelayMs * 2 ** (attempt - 1), retryAfter * 1000);
          console.error("Rate limit exceeded. Retrying...", {
            requestId,
            attempt,
            nextDelayMs: delayMs,
          });
          await sleep(delayMs);
          continue;
        }
        throw err;
      }
    }

    const translatedText = response?.data?.translations?.[0]?.text;

    if (!translatedText) {
      return res.status(500).json({ error: "Empty translation response" });
    }

    res.json({ translatedText });
  } catch (err) {
    const status = err.response?.status;
    const data = err.response?.data;
    console.error("DeepL error:", {
      requestId,
      message: err.message,
      status,
      data,
    });
    const details =
      data?.message ||
      data?.error?.message ||
      data?.error ||
      (typeof data === "string" ? data : undefined);
    if (status === 429) {
      return res
        .status(429)
        .json({ error: "Rate limit exceeded", details });
    }
    res.status(500).json({ error: "Translation failed", details });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running on port ${PORT}`);
});
