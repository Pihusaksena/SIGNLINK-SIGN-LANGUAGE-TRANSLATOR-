import express, { Request, Response } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini Client
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
} else {
  console.warn("WARNING: GEMINI_API_KEY environment variable is not set. Gemini features will run in fallback mock mode.");
}

// 1. API: Health Check
app.get("/api/health", (req: Request, res: Response) => {
  res.json({ status: "ok", geminiEnabled: !!ai });
});

// 2. API: Advanced AI Translation & Auto-Correction
// Fulfills Module 7 (Auto-Correction, Sentence Prediction, and suggestions)
app.post("/api/translate-sequence", async (req: Request, res: Response) => {
  const { sequence, context } = req.body;

  if (!sequence || !Array.isArray(sequence) || sequence.length === 0) {
    res.json({ corrected: "", suggestions: [] });
    return;
  }

  const wordSequence = sequence.join(" ");

  if (!ai) {
    // Elegant offline fallback if key is missing
    const words = sequence.map(w => w.toUpperCase());
    const simpleSentence = words.join(" ") + ".";
    res.json({
      corrected: simpleSentence,
      suggestions: ["Is that correct?", "Next sign", "How are you?"],
      log: "Mock translation: Provide GEMINI_API_KEY in Secrets for live AI smoothing."
    });
    return;
  }

  try {
    const prompt = `You are an expert Sign Language Translator assistant.
The user has captured a sequence of real-time sign gestures: [${wordSequence}].
Additional conversation context: "${context || 'None'}".

Tasks:
1. Translate and auto-correct this raw sequence of gestures into a smooth, natural, and polite spoken sentence. Combine abbreviations, fix typos, add necessary grammar/articles (e.g. "HELO ARE U OK" -> "Hello, are you okay?"). Keep the response concise.
2. Provide 3 likely word/phrase suggestions the user might want to sign next, to speed up their communication (e.g. if sequence ends on "How are you", suggestions might be "I am fine", "What is your name?", "Good, thank you").

Respond strictly with valid JSON conforming to this TypeScript schema:
{
  "corrected": "The fully smoothed natural sentence",
  "suggestions": ["suggestion 1", "suggestion 2", "suggestion 3"]
}

Do not include any Markdown tags like \`\`\`json or \`\`\`. Answer only with raw JSON.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const responseText = response.text || "{}";
    try {
      const result = JSON.parse(responseText.trim());
      res.json(result);
    } catch (e) {
      // In case formatting slipped, try to parse or return base
      console.error("Failed to parse Gemini JSON:", responseText, e);
      res.json({
        corrected: wordSequence,
        suggestions: ["Hello", "Please", "Are you OK?"]
      });
    }
  } catch (error: any) {
    console.error("Gemini Translation API error:", error);
    res.status(500).json({ error: error.message || "Internal AI translation error." });
  }
});

// Start Full-Stack Asset Routing & Development Server
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Full-Stack Server actively running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
