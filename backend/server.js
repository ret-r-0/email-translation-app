import express from "express";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";

// Загружаем переменные окружения из .env файла
dotenv.config();

const app = express();
app.use(express.json()); // Парсим JSON в теле запросов
app.use(cors()); // Разрешаем CORS для всех источников

// API endpoint для проверки, что сервер работает
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// API endpoint для перевода текста
app.post("/translate", async (req, res) => {
  const { text, sourceLang, targetLang } = req.body;

  if (!text || !targetLang) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  try {
    // Запрос к DeepL API для перевода текста
    const response = await axios.post(
      "https://api-free.deepl.com/v2/translate",
      null,
      {
        params: {
          auth_key: process.env.DEEPL_API_KEY, // Ключ API из переменных окружения
          text: text,
          source_lang: sourceLang || "auto", // Если не указан язык источника, используем авто-определение
          target_lang: targetLang.toUpperCase(), // DeepL ожидает код языка в верхнем регистре
        },
      },
    );

    // Возвращаем переведённый текст
    const translatedText = response.data.translations[0].text;
    res.json({ translatedText });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Translation failed" });
  }
});

// Запускаем сервер на порту 3000
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
