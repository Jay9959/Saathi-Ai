// ============================================================
// Saathi- Backend Server
// Stack: Node.js + Express + Groq API + Passport OAuth
// Author:Saathi Ai
// ============================================================

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const session = require("express-session");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const GitHubStrategy = require("passport-github2").Strategy;
const OpenAI = require("openai");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const rateLimit = require("express-rate-limit");

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5000";

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Global Error Safety Net ──────────────────────────────────
process.on("uncaughtException", (err) => {
  console.error("CRITICAL ERROR (Uncaught Exception):", err.message || err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("CRITICAL ERROR (Unhandled Rejection) at:", promise, "reason:", reason);
});

// ─── AI Clients Setup ──────────────────────────────────────────
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

const groqClient = process.env.GROQ_API_KEY ? new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1", 
}) : null;

// Helper to get correct chat response from Gemini (Native)
async function getGeminiResponse(targetModel, messages, stream = false) {
  const systemInstruction = "You are Saathi AI, a highly intelligent and exceptionally detailed assistant. Always provide comprehensive, extensive, and deeply informative answers. Break down complex topics with structured explanations. Use markdown formatting when helpful.";
  
  const model = genAI.getGenerativeModel({ 
    model: targetModel,
    systemInstruction: systemInstruction 
  });
  
  const chat = model.startChat({
    history: messages.slice(0, -1).map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
  });
  
  const lastMessage = messages[messages.length - 1].content;
  
  if (stream) {
    return await chat.sendMessageStream(lastMessage);
  } else {
    return await chat.sendMessage(lastMessage);
  }
}

// Helper to get correct client based on model ID
const getClientType = (modelId) => {
  if (modelId.startsWith("gemini")) return "gemini";
  return "groq";
};

// ─── Middleware ───────────────────────────────────────────────
const isProduction = process.env.NODE_ENV === "production";

app.use(cors({
  origin: FRONTEND_URL,
  credentials: true,
}));
app.use(express.json());

// Trust proxy (required for secure cookies on Render/Railway/Heroku)
if (isProduction) app.set("trust proxy", 1);

// Session Middleware (required for Passport)
app.use(session({
  secret: process.env.SESSION_SECRET || "saathi_secret",
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: isProduction,  // true on HTTPS, false on localhost
    sameSite: isProduction ? "none" : "lax",
    maxAge: 24 * 60 * 60 * 1000 
  },
}));

// Passport Init
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

// ─── Google OAuth Strategy ───────────────────────────────────
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "/auth/google/callback",
}, (accessToken, refreshToken, profile, done) => {
  const user = {
    name: profile.displayName,
    email: profile.emails?.[0]?.value || "",
    avatar: profile.photos?.[0]?.value || "",
    provider: "google",
  };
  return done(null, user);
}));

// ─── GitHub OAuth Strategy ───────────────────────────────────
passport.use(new GitHubStrategy({
  clientID: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  callbackURL: "/auth/github/callback",
  scope: ["user:email"],
}, (accessToken, refreshToken, profile, done) => {
  const user = {
    name: profile.displayName || profile.username,
    email: profile.emails?.[0]?.value || "",
    avatar: profile.photos?.[0]?.value || "",
    provider: "github",
  };
  return done(null, user);
}));

// Rate Limiting: max 30 requests per minute per IP
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: "Too many requests. Please slow down." },
});
app.use("/api/", limiter);

// ─── Serve Frontend Static Files ──────────────────────────────
app.use(express.static(path.join(__dirname, "../frontend")));

// ─── Health Check ─────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "SaathiAPI is running 🚀" });
});

// ─── Google OAuth Routes ──────────────────────────────────────
app.get("/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get("/auth/google/callback",
  passport.authenticate("google", { failureRedirect: `${FRONTEND_URL}/login.html?error=google_failed` }),
  (req, res) => {
    const user = req.user;
    const params = new URLSearchParams({
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      provider: user.provider,
    });
    res.redirect(`${FRONTEND_URL}/index.html?oauth=${params.toString()}`);
  }
);

// ─── GitHub OAuth Routes ──────────────────────────────────────
app.get("/auth/github",
  passport.authenticate("github", { scope: ["user:email"] })
);

app.get("/auth/github/callback",
  passport.authenticate("github", { failureRedirect: `${FRONTEND_URL}/login.html?error=github_failed` }),
  (req, res) => {
    const user = req.user;
    const params = new URLSearchParams({
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      provider: user.provider,
    });
    res.redirect(`${FRONTEND_URL}/index.html?oauth=${params.toString()}`);
  }
);

// ─── POST /api/chat (Non-Streaming) ───────────────────────────
app.post("/api/chat", async (req, res) => {
  const { messages, model } = req.body;
  const targetModel = model || (genAI ? "gemini-2.5-flash" : "llama-3.3-70b-versatile");

  console.log(`[Chat] Request for model: ${targetModel}`);

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Messages array is required." });
  }

  try {
    const provider = getClientType(targetModel);
    let reply = "";

    if (provider === "gemini") {
      if (!genAI) throw new Error("Gemini API key is missing.");
      const result = await getGeminiResponse(targetModel, messages);
      reply = result.response.text();
    } else {
      if (!groqClient) throw new Error("Groq API key is missing.");
      const systemMessage = { role: "system", content: "You are Saathi AI..." };
      const completion = await groqClient.chat.completions.create({
        model: targetModel,
        messages: [systemMessage, ...messages],
      });
      reply = completion.choices[0].message.content;
    }

    res.json({ success: true, message: { role: "assistant", content: reply } });
  } catch (error) {
    console.error("Chat Error Detail:", error);
    res.status(500).json({ error: error.message || "Something went wrong." });
  }
});

// ─── POST /api/chat/stream (Streaming Response) ───────────────
app.post("/api/chat/stream", async (req, res) => {
  const { messages, model } = req.body;
  const targetModel = model || (genAI ? "gemini-2.5-flash" : "llama-3.3-70b-versatile");

  console.log(`[Stream] Request for model: ${targetModel}`);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const provider = getClientType(targetModel);

    if (provider === "gemini") {
      if (!genAI) throw new Error("Gemini API key is missing.");
      const result = await getGeminiResponse(targetModel, messages, true);
      for await (const chunk of result.stream) {
        const content = chunk.text();
        if (content) {
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }
    } else {
      if (!groqClient) throw new Error("Groq API key is missing.");
      const systemMessage = { role: "system", content: "You are Saathi AI..." };
      const stream = await groqClient.chat.completions.create({
        model: targetModel,
        messages: [systemMessage, ...messages],
        stream: true,
      });
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    res.write(`data: [DONE]\n\n`);
    res.end();
  } catch (error) {
    console.error("Stream Error Detail:", error.message || error);
    // Ensure we don't try to write if response is finished
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ error: error.message || "Something went wrong with the AI provider." })}\n\n`);
      res.end();
    }
  }
});

// ─── GET /api/models ──────────────────────────────────────────
app.get("/api/models", (req, res) => {
  const models = [];
  
  if (genAI) {
    models.push(
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", description: "Ultra-fast Next Gen (Free)" }
    );
  }
  
  if (groqClient) {
    models.push(
      { id: "llama-3.3-70b-versatile", name: "LLaMA 3.3 70B", description: "Groq (High Performance)" },
      { id: "llama-3.1-8b-instant", name: "LLaMA 3.1 8B", description: "Groq (Instant Speed)" },
      { id: "qwen/qwen3-32b", name: "Qwen 3 (32B)", description: "Reasoning Model (Next-Gen)" }
    );
  }

  // Fallback if nothing configured
  if (models.length === 0) {
    models.push({ id: "offline", name: "Offline", description: "Add API Key to .env" });
  }

  res.json({ models });
});

// ─── GET /api/image (Proxy for Pollinations) ──────────────────
app.get("/api/image", async (req, res) => {
  try {
    const { prompt, model = "flux", seed } = req.query;
    if (!prompt) return res.status(400).json({ error: "Prompt is required" });

    const encodedPrompt = encodeURIComponent(prompt);
    const targetUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?model=${model}&width=512&height=512&nologo=true&seed=${seed || Math.floor(Math.random() * 999999)}`;

    let response = null;
    let lastError = null;
    let arrayBuffer = null;

    // Backend retry logic for stability
    for (let i = 0; i < 3; i++) {
      let timeout;
      try {
        const controller = new AbortController();
        timeout = setTimeout(() => controller.abort(), 120000); // 120s timeout

        response = await fetch(targetUrl, { signal: controller.signal });

        if (!response.ok) {
          clearTimeout(timeout);
          throw new Error(`Status ${response.status}`);
        }

        // Must await arrayBuffer inside the try block with timeout active
        arrayBuffer = await response.arrayBuffer();
        clearTimeout(timeout);
        break; // Success!

      } catch (err) {
        if (timeout) clearTimeout(timeout);
        lastError = err;
        // Wait 2 seconds before retry
        if (i < 2) await new Promise(r => setTimeout(r, 2000));
      }
    }

    if (!arrayBuffer || !response) {
      throw new Error(`Pollinations API failed after retries: ${lastError?.message}`);
    }

    const contentType = response.headers.get("content-type");
    if (contentType) res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=31536000");

    const buffer = Buffer.from(arrayBuffer);
    res.send(buffer);
  } catch (error) {
    console.error("Image generation proxy error:", error.message);
    res.status(500).json({ error: "Failed to generate image" });
  }
});

// ─── 404 Handler ──────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: "Route not found." });
});

// ─── Start Server ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 SaathiBackend running on http://localhost:${PORT}`);
  console.log(`📡 API Endpoints:`);
  console.log(`   GET  /          → Health check`);
  console.log(`   GET  /api/models → List available models`);
  console.log(`   POST /api/chat  → Send a message`);
  console.log(`   POST /api/chat/stream → Streaming response\n`);
});
