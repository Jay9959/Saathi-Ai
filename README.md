# ⚡Saathi AI

A full-stack Saathibuilt with **Node.js + Express + Groq API** on the backend and **pure HTML/CSS/JS** on the frontend.
Groq offers **blazing-fast inference** (often 10x faster than OpenAI) and a **free tier** — perfect for this project.

---

## 🚀 Features

- ✅ Real-time **streaming responses** (Server-Sent Events)
- ✅ **Markdown rendering** with syntax-highlighted code blocks
- ✅ **Chat history** saved in localStorage
- ✅ **Model selection** (GPT-3.5 Turbo, GPT-4, GPT-4 Turbo)
- ✅ **Rate limiting** to protect the API
- ✅ **Stop generation** mid-stream
- ✅ **Responsive design** (mobile-friendly)
- ✅ **Dark premium UI** with glassmorphism & animations
- ✅ **Token usage counter**
- ✅ **Copy code** button on code blocks

---

## 📁 Project Structure

```
ChatGpt/
├── backend/
│   ├── server.js          ← Express server + OpenAI integration
│   ├── package.json       ← Backend dependencies
│   └── .env               ← Your OpenAI API key (create this!)
├── frontend/
│   ├── index.html         ← Chat UI
│   ├── style.css          ← Premium dark design
│   └── script.js          ← All frontend logic
└── README.md
```

---

## ⚙️ Setup Instructions

### Step 1 — Get OpenAI API Key
1. Go to https://platform.openai.com/api-keys
2. Create a new API key
3. Copy it

### Step 2 — Setup Backend
```bash
cd backend
npm install
```

Create a `.env` file:
```env
GROQ_API_KEY=gsk_your_groq_api_key_here
PORT=5000
```

> 🔑 Get a **free** Groq API key at: https://console.groq.com/keys

### Step 3 — Start Backend
```bash
cd backend
npm run dev         # Development (with auto-restart)
# OR
npm start           # Production
```

Backend will run at: **http://localhost:5000**

### Step 4 — Open Frontend
Open `frontend/index.html` in your browser.

> **Tip:** Use VS Code's Live Server extension for a better experience!

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Health check |
| `GET` | `/api/models` | List available models |
| `POST` | `/api/chat` | Send message (regular) |
| `POST` | `/api/chat/stream` | Send message (streaming) |

### POST /api/chat — Request Body
```json
{
  "messages": [
    { "role": "user", "content": "Hello!" }
  ],
  "model": "llama3-8b-8192"
}
```

---

## 🤖 Available Models (Groq)

| Model | ID | Speed |
|-------|----|-------|
| LLaMA 3 8B | `llama3-8b-8192` | ⚡ Fastest |
| LLaMA 3 70B | `llama3-70b-8192` | 🧠 Powerful |
| Mixtral 8x7B | `mixtral-8x7b-32768` | 📄 Long context |
| Gemma 2 9B | `gemma2-9b-it` | 💎 Google's model |
| LLaMA 3.3 70B | `llama-3.3-70b-versatile` | 🚀 Latest |

---

## 🛠️ Technologies Used

| Layer | Technology |
|-------|----------|
| Backend | Node.js + Express.js |
| AI | Groq API (LLaMA 3, Mixtral, Gemma) |
| Streaming | Server-Sent Events (SSE) |
| Frontend | HTML + CSS + JavaScript |
| Markdown | Marked.js |
| Code Highlighting | Highlight.js |
| Fonts | Google Fonts (Inter) |

---

## 🎨 UI Highlights

- Deep dark theme (`#0d0d0d`) with purple accent (`#7c3aed`)
- Floating logo animation
- Smooth message entrance animations
- Streaming text cursor effect
- Mobile responsive sidebar
- Toast notifications

---

Made with ⚡ bySaathi AI
