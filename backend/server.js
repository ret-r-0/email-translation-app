import express from "express";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const OPENAI_API_URL = "https://api.openai.com/v1/responses";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const OPENAI_TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS || 30000);
const DEFAULT_INTRO_PHRASE =
  "To ensure clearer and faster communication, this message has been translated using machine translation tools. While we strive for accuracy, we appreciate your understanding regarding any imperfections that may occur due to automated translation.";
const TRANSLATE_COUNTER_FILE =
  process.env.TRANSLATE_COUNTER_FILE ||
  path.join(process.cwd(), "data", "translate-counter.json");
const TRANSLATE_EVENTS_FILE =
  process.env.TRANSLATE_EVENTS_FILE ||
  path.join(process.cwd(), "data", "translate-events.log");

let translateCount = 0;
let translatePerDay = {};

function loadTranslateCount() {
  try {
    const raw = fs.readFileSync(TRANSLATE_COUNTER_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (typeof parsed?.count === "number" && Number.isFinite(parsed.count)) {
      translateCount = parsed.count;
    }
    if (parsed?.perDay && typeof parsed.perDay === "object") {
      translatePerDay = parsed.perDay;
    }
  } catch (err) {
    if (err?.code !== "ENOENT") {
      console.error("Failed to read translate counter:", err);
    }
  }
}

async function persistTranslateCount() {
  try {
    await fs.promises.mkdir(path.dirname(TRANSLATE_COUNTER_FILE), {
      recursive: true,
    });
    await fs.promises.writeFile(
      TRANSLATE_COUNTER_FILE,
      JSON.stringify({ count: translateCount, perDay: translatePerDay }),
      "utf-8"
    );
  } catch (err) {
    console.error("Failed to persist translate counter:", err);
  }
}

async function appendTranslateEvent(event) {
  try {
    await fs.promises.mkdir(path.dirname(TRANSLATE_EVENTS_FILE), {
      recursive: true,
    });
    await fs.promises.appendFile(
      TRANSLATE_EVENTS_FILE,
      `${JSON.stringify(event)}\n`,
      "utf-8"
    );
  } catch (err) {
    console.error("Failed to append translate event:", err);
  }
}

loadTranslateCount();

// ROOT endpoint (важно для Railway healthcheck)
app.get("/", (_req, res) => {
  res.status(200).send("OK");
});

// health check
app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true });
});

// metrics
app.get("/metrics", (_req, res) => {
  res.status(200).json({
    total: translateCount,
    perDay: translatePerDay,
  });
});

// translate endpoint
app.post("/translate", async (req, res) => {
  const requestId = Math.random().toString(36).slice(2, 10);
  const { text, targetLang, introPhrase } = req.body;
  console.log("Request body:", req.body);
  console.log("OPENAI_API_KEY set:", Boolean(process.env.OPENAI_API_KEY));

  if (typeof text !== "string" || !text.length || !targetLang) {
    console.error("Missing parameters:", { requestId });
    return res.status(400).json({ error: "Missing required parameters" });
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY not configured:", { requestId });
    return res.status(500).json({ error: "OPENAI_API_KEY not configured" });
  }

  try {
    translateCount += 1;
    const now = new Date();
    const dayKey = now.toISOString().slice(0, 10);
    translatePerDay[dayKey] = (translatePerDay[dayKey] || 0) + 1;
    persistTranslateCount();
    appendTranslateEvent({
      ts: now.toISOString(),
      requestId,
      targetLang,
      textLength: typeof text === "string" ? text.length : 0,
    });
    console.log("Translate clicks total:", translateCount);

    const targetLanguage = String(targetLang || "").trim();
    const resolvedIntroPhrase =
      typeof introPhrase === "string" && introPhrase.trim().length
        ? introPhrase.trim()
        : DEFAULT_INTRO_PHRASE;

    const developerInstruction = [
      "You are a translation assistant.",
      "Return ONLY the formatted output below with no extra text.",
      "Format:",
      "1) Intro phrase in the user's language (single sentence).",
      "2) Blank line.",
      `3) Translation into the user's language: ${targetLanguage}.`,
      "4) Line with exactly three dashes: ---",
      "5) Translation into English.",
      "Do not add quotes, bullet points, or explanations.",
    ].join("\n");

    const userPrompt = [
      `Intro phrase must be exactly: ${resolvedIntroPhrase}`,
      "",
      "Text to translate:",
      text,
    ].join("\n");

    const sendOpenAIRequest = () =>
      axios.post(
        OPENAI_API_URL,
        {
          model: OPENAI_MODEL,
          input: [
            { role: "developer", content: developerInstruction },
            { role: "user", content: userPrompt },
          ],
          max_output_tokens: 800,
          temperature: 0.2,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          timeout: OPENAI_TIMEOUT_MS,
        }
      );

    const maxAttempts = 3;
    const baseDelayMs = 1000;
    let response;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        response = await sendOpenAIRequest();
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

    const outputItems = response?.data?.output || [];
    const outputText = outputItems
      .flatMap((item) => item.content || [])
      .find((content) => content.type === "output_text")?.text;

    if (!outputText) {
      return res.status(500).json({ error: "Empty translation response" });
    }

    res.json({ translatedText: outputText });
  } catch (err) {
    const status = err.response?.status;
    const data = err.response?.data;
    console.error("OpenAI error:", {
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
