# 🎯 AI-Powered Mock Interview Platform (Backend)

A high-performance RESTful API backend built with **Bun**, **Express**, **TypeScript**, **Prisma ORM**, **PostgreSQL**, and **Google Gemini AI**. This platform powers real-time AI mock interviews, automated PDF resume parsing, job description matching, and credit-based session limits.

---

## ⚡ Tech Stack

* **Runtime:** [Bun](https://bun.sh) (v1.3+)
* **Framework:** Express.js with TypeScript
* **Database & ORM:** PostgreSQL + Prisma ORM (with B-Tree Indexing)
* **Authentication:** Clerk Auth + Webhooks (Svix)
* **AI Model:** Google Gemini (`gemini-2.5-flash`) via `@google/genai`
* **File Storage:** ImageKit Cloud Storage (with signed 5-min URLs)
* **PDF Parsing:** `pdf-parse` + Magic-Byte Security Guards

---

## 🚀 Key Features Implemented

1. **🔒 Clerk Auth & Real-Time Sync:** Webhook synchronization via Svix keeps Clerk user accounts automatically synced with the PostgreSQL database.
2. **👤 Candidate Onboarding:** Profile creation, target role configuration, and credit management.
3. **🎯 Job Description Target Manager:** Save target job descriptions for tailored mock interview preparation.
4. **📄 AI PDF Resume Extractor:** Validates `%PDF` magic bytes, uploads to ImageKit storage, and extracts candidate skills, experience, projects, and education into structured JSON using Gemini AI.
5. **🧠 AI Interview Question Engine:** 
   - Deducts 1 credit atomically per session.
   - Analyzes the candidate's resume + target job description.
   - Generates 5–20 tailored interview questions matching specified difficulty levels.
   - Saves sessions and questions to PostgreSQL.

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
