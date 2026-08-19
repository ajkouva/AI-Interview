# 🎯 AI-Powered Mock Interview Platform (Backend)

A high-performance backend built with **Bun**, **Express**, **TypeScript**, **Prisma ORM**, **PostgreSQL**, and **Google Gemini AI**. This platform powers a **Dual-Engine AI Mock Interview System**:
1. **📝 Practice Exam Mode:** Timed, card-by-card online technical assessment with integrated code runner and step-by-step scoring.
2. **🎙️ Live Voice Simulation Mode:** Real-time conversational interview over WebSockets with Google Gemini Multimodal Live, featuring sub-500ms audio and live code review.

---

## ⚡ Tech Stack

* **Runtime:** [Bun](https://bun.sh) (v1.3+)
* **Framework:** Express.js with TypeScript
* **Database & ORM:** PostgreSQL 16 + Prisma ORM 7 (with B-Tree Indexing)
* **Authentication:** Clerk Auth (`clerkMiddleware` + `getAuth`) & Svix Webhook Sync
* **AI Models:** 
  - `gemini-2.5-flash` for structured Zod JSON parsing & evaluation
  - `gemini-2.0-flash-exp` for real-time Multimodal Live WebSockets
* **File Storage:** ImageKit Cloud Storage (with signed 5-min expiring URLs)
* **PDF Parsing:** `pdf-parse` with `%PDF` magic-byte security guards

---

## 🚀 Key Features Implemented

1. **🔒 Clerk Auth & Real-Time Sync:** Webhook synchronization via Svix keeps Clerk user accounts automatically synced with the PostgreSQL database.
2. **👤 Candidate Onboarding:** Profile creation, target career goals, and credit balance management.
3. **🎯 Job Description Manager:** Save target job descriptions for tailored mock interview generation.
4. **📄 AI PDF Resume Extractor:** Validates `%PDF` magic bytes, uploads to ImageKit private storage, and extracts candidate skills, experience, projects, and education into structured JSON.
5. **🧠 Dual-Engine Interview Architecture:**
   - **Mode 1 (Practice Exam):** Generates 5–20 tailored questions, accepts text/code submissions via `POST /api/sessions/:sessionId/answers`, delivers instant AI grading (0.0–10.0), and automatically aggregates scores on completion.
   - **Mode 2 (Live Voice Call):** Bidirectional PCM audio streaming over WebSockets (`ws://localhost:3000/ws/interview/:sessionId`) with live speech, natural interruptions, and Monaco code synchronization.
6. **🛡️ Enterprise Reliability:**
   - Atomic `$transaction` guards prevent credit-balance TOCTOU race conditions.
   - 15-second `AbortController` timeout protection on Gemini calls with custom 504 mapping.
   - Resilient ImageKit deletion verifying HTTP 404 status.

---

## 🛠️ Quick Start Guide

### 1. Install Dependencies
```bash
bun install
```

### 2. Environment Configuration
Create a `.env` file in the root directory:
```env
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/ai_interview_db?schema=public"

# Clerk Auth
CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
CLERK_WEBHOOK_SECRET="whsec_..."

# Google Gemini AI
GEMINI_API_KEY="AIzaSy..."

# ImageKit Cloud Storage
IMAGEKIT_PUBLIC_KEY="public_..."
IMAGEKIT_PRIVATE_KEY="private_..."
IMAGEKIT_URL_ENDPOINT="https://ik.imagekit.io/..."
```

### 3. Database Migration & Setup
```bash
# Push database schema & create indexes
bun db:migrate

# Generate Prisma Client
bun db:generate

# Open Prisma Studio (GUI)
bun db:studio
```

### 4. Run Development Server
```bash
bun dev
```

### 5. Start Tunnel for Local Webhooks (Optional)
```bash
cloudflared tunnel --url http://localhost:3000
```

---

## 📖 API Documentation

For the complete API reference including headers, request schemas, status codes, and sample JSON responses, check out:
👉 **[API Documentation (`api_docs.md`)](./api_docs.md)**
