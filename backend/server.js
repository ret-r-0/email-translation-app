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
  const { text, targetLang } = req.body;

  if (typeof text !== "string" || !text.length || !targetLang) {
    console.error("Missing parameters:", { requestId });
    return res.status(400).json({ error: "Missing required parameters" });
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY not configured:", { requestId });
    return res.status(500).json({ error: "OPENAI_API_KEY not configured" });
  }

  try {
    // Constructing the prompt for translation
    const prompt = `Translate the following text into ${targetLang}: ${text}`;

    const response = await axios.post(
      "https://api.openai.com/v1/completions",
      {
        model: "gpt-3.5-turbo", // or use GPT-4 if preferred
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: prompt },
        ],
        max_tokens: 500,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      },
    );

    const translatedText = response?.data?.choices?.[0]?.message?.content;

    if (!translatedText) {
      return res.status(500).json({ error: "Empty translation response" });
    }

    res.json({ translatedText });
  } catch (err) {
    console.error("OpenAI error:", err.message);
    res.status(500).json({ error: "Translation failed" });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running on port ${PORT}`);
});
