# 🤖 InterviewAI — AI-Powered Interview Platform

  

> **Role of this document**: Senior AI Web Developer planning guide. No code — pure architecture, design, and strategy.

  

---

  

## Table of Contents

  

1. [Project Overview](#1-project-overview)

2. [System Architecture Diagram](#2-system-architecture-diagram)

3. [Database Schema / Data Models](#3-database-schema--data-models)

4. [ER Diagram](#4-er-diagram)

5. [Tech Stack Document](#5-tech-stack-document)

6. [Free Alternatives & Cost Breakdown](#6-free-alternatives--cost-breakdown)

7. [MVP — Minimum Viable Product](#7-mvp--minimum-viable-product)

8. [Feature Breakdown (All 7 Features)](#8-feature-breakdown-all-7-features)

9. [Future Features](#9-future-features)

10. [Project Roadmap](#10-project-roadmap)

11. [Task Breakdown](#11-task-breakdown)

12. [Workflow Diagrams](#12-workflow-diagrams)

  

---

  

## 1. Project Overview

  

**InterviewAI** is a full-stack AI-powered mock interview platform where users can:

  

- Upload their resume and job description

- Be interviewed in real-time by an AI using voice (STT + TTS)

- Solve coding problems live in an integrated IDE

- Receive AI-generated feedback after each session

- Pay for premium features via a freemium model

  

The platform also includes an **Admin Panel** for business analytics and a **Python AI microservice** for NLP-heavy tasks.

  

---

  

## 2. System Architecture Diagram

  

```

┌─────────────────────────────────────────────────────────────────────┐

│                          CLIENT LAYER                               │

│                                                                     │

│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │

│  │  React App   │  │  Admin Panel │  │   Browser APIs           │  │

│  │  (Vite/CRA)  │  │  (React)     │  │ (WebSpeech / MediaStream)│  │

│  └──────┬───────┘  └──────┬───────┘  └────────────┬─────────────┘  │

└─────────┼────────────────┼──────────────────────── ┼───────────────┘

          │                │                          │

          ▼                ▼                          ▼

┌─────────────────────────────────────────────────────────────────────┐

│                         API GATEWAY LAYER                           │

│                                                                     │

│            Node.js + Express REST API (Main Backend)                │

│            ┌─────────────────────────────────────┐                  │

│            │  /api/auth  /api/interviews          │                  │

│            │  /api/users /api/sessions            │                  │

│            │  /api/resume /api/admin              │                  │

│            │  /api/payments /api/code             │                  │

│            └─────────────────────────────────────┘                  │

│                     │                   │                           │

│            WebSocket Server         REST Proxy                      │

│          (Socket.io / ws)         (to Python AI)                    │

└──────────────┬──────────────────────────┬──────────────────────────┘

               │                          │

    ┌──────────▼──────────┐   ┌──────────▼─────────────────┐

    │    PostgreSQL DB     │   │   Python AI Microservice    │

    │  (via Prisma ORM)   │   │   (FastAPI / Flask)         │

    │                     │   │                             │

    │  - Users            │   │  - Resume Parser (NLP)      │

    │  - Interviews       │   │  - Question Generator       │

    │  - Sessions         │   │  - Code Analyser            │

    │  - Payments         │   │  - Answer Evaluator         │

    │  - QA Logs          │   │  - Session Summarizer       │

    └─────────────────────┘   └──────────┬──────────────────┘

                                         │

                              ┌──────────▼──────────────────┐

                              │      AI/LLM Providers        │

                              │                             │

                              │  - Google Gemini API (Free) │

                              │  - Groq API (Free tier)     │

                              │  - OpenAI (optional paid)   │

                              │  - HuggingFace Inference API│

                              └─────────────────────────────┘

  

VOICE PIPELINE:

  Browser Mic → Web Speech API (STT, free, browser-native)

              → Socket.io → Node → Python AI → LLM Response

              → Python TTS (gTTS/edge-tts, free) → Audio Stream

              → Browser Speaker

  

STORAGE:

  Resumes / Audio → Cloudinary (free tier) or local FS (dev)

  Session Logs    → PostgreSQL JSON columns

```

  

### Key Architectural Decisions

  

| Decision | Choice | Reason |

|---|---|---|

| Real-time comms | WebSockets (Socket.io) | Low latency for voice turns |

| AI processing | Python microservice | Isolates heavy NLP; Python has best AI libs |

| ORM | Prisma | Type-safe, great DX, easy migrations |

| Voice input | Web Speech API | Free, browser-native, no server cost |

| Voice output | edge-tts / gTTS | Free TTS, runs on your server |

| Payments | Razorpay (India) / Stripe | Razorpay free to integrate; Stripe has sandbox |

  

---

  

## 3. Database Schema / Data Models

  

### 3.1 Users Table

  

```

users

─────────────────────────────

id            UUID (PK)

email         VARCHAR(255) UNIQUE NOT NULL

name          VARCHAR(100)

password_hash VARCHAR(255)          -- null if OAuth

avatar_url    VARCHAR(500)

role          ENUM('user', 'admin') DEFAULT 'user'

plan          ENUM('free', 'basic', 'pro') DEFAULT 'free'

credits       INT DEFAULT 3         -- free credits for interview

oauth_provider VARCHAR(50)          -- 'google' | 'github' | null

oauth_id      VARCHAR(100)

created_at    TIMESTAMP DEFAULT NOW()

updated_at    TIMESTAMP

```

  

### 3.2 Resumes Table

  

```

resumes

─────────────────────────────

id            UUID (PK)

user_id       UUID (FK → users.id)

file_url      VARCHAR(500)          -- stored on Cloudinary / S3

file_name     VARCHAR(200)

parsed_text   TEXT                  -- extracted raw text

ai_summary    TEXT                  -- AI-generated profile summary

skills        JSONB                 -- ["React", "Python", ...]

experience    JSONB                 -- [{company, role, years}, ...]

education     JSONB

uploaded_at   TIMESTAMP DEFAULT NOW()

```

  

### 3.3 Job Descriptions Table

  

```

job_descriptions

─────────────────────────────

id            UUID (PK)

user_id       UUID (FK → users.id)

title         VARCHAR(200)

company       VARCHAR(200)

description   TEXT

required_skills JSONB

ai_summary    TEXT                  -- AI parsed requirements

created_at    TIMESTAMP DEFAULT NOW()

```

  

### 3.4 Interview Sessions Table

  

```

interview_sessions

─────────────────────────────

id            UUID (PK)

user_id       UUID (FK → users.id)

resume_id     UUID (FK → resumes.id)

job_desc_id   UUID (FK → job_descriptions.id)

status        ENUM('pending','active','completed','abandoned')

type          ENUM('behavioral','technical','coding','mixed')

difficulty    ENUM('easy','medium','hard')

total_score   FLOAT                 -- AI-rated overall score (0-100)

ai_feedback   TEXT                  -- Final AI-generated feedback

duration_sec  INT                   -- Total session time in seconds

started_at    TIMESTAMP

ended_at      TIMESTAMP

created_at    TIMESTAMP DEFAULT NOW()

```

  

### 3.5 Questions Table

  

```

questions

─────────────────────────────

id            UUID (PK)

session_id    UUID (FK → interview_sessions.id)

question_no   INT                   -- 1, 2, 3...

question_text TEXT NOT NULL

question_type ENUM('behavioral','technical','coding','hr')

ai_voice_url  VARCHAR(500)          -- TTS audio URL (optional cache)

asked_at      TIMESTAMP

```

  

### 3.6 Answers Table

  

```

answers

─────────────────────────────

id            UUID (PK)

question_id   UUID (FK → questions.id)

session_id    UUID (FK → interview_sessions.id)

answer_text   TEXT                  -- STT-transcribed answer

code_snippet  TEXT                  -- If it's a coding question

code_language VARCHAR(50)

ai_score      FLOAT                 -- Per-question score (0-10)

ai_feedback   TEXT                  -- Per-answer AI feedback

keywords_hit  JSONB                 -- Keywords the AI expected

answered_at   TIMESTAMP

```

  

### 3.7 Payments Table

  

```

payments

─────────────────────────────

id            UUID (PK)

user_id       UUID (FK → users.id)

plan          ENUM('basic','pro')

amount        DECIMAL(10,2)

currency      VARCHAR(10) DEFAULT 'INR'

gateway       VARCHAR(50)           -- 'razorpay' | 'stripe'

gateway_order_id   VARCHAR(200)

gateway_payment_id VARCHAR(200)

status        ENUM('pending','success','failed','refunded')

credits_added INT

created_at    TIMESTAMP DEFAULT NOW()

```

  

### 3.8 Credit Usage Log Table

  

```

credit_usage_logs

─────────────────────────────

id            UUID (PK)

user_id       UUID (FK → users.id)

session_id    UUID (FK → interview_sessions.id)

credits_used  INT

action        VARCHAR(100)          -- 'interview_start' | 'resume_parse' | etc.

used_at       TIMESTAMP DEFAULT NOW()

```

  

### 3.9 Admin Analytics (Materialized View)

  

```

admin_stats (refreshed view or separate table)

─────────────────────────────

total_users

active_users_today

total_sessions

sessions_today

revenue_total

revenue_month

avg_session_score

top_job_roles

top_skills_tested

free_to_paid_conversion_rate

```

  

---

  

## 4. ER Diagram

  

```

┌──────────┐         ┌────────────────┐        ┌──────────────────┐

│  users   │ 1     * │    resumes     │        │ job_descriptions │

│──────────│─────────│────────────────│        │──────────────────│

│ id (PK)  │         │ id (PK)        │        │ id (PK)          │

│ email    │         │ user_id (FK)   │        │ user_id (FK)     │

│ name     │         │ file_url       │        │ title            │

│ plan     │         │ parsed_text    │        │ description      │

│ credits  │         │ ai_summary     │        │ ai_summary       │

│ role     │         │ skills (JSON)  │        │ required_skills  │

└────┬─────┘         └────────────────┘        └─────────┬────────┘

     │                                                   │

     │ 1                                                 │

     │                                                   │

     ▼ *                                                 │

┌────────────────────────────────────────────────────────▼────────┐

│                     interview_sessions                          │

│─────────────────────────────────────────────────────────────────│

│ id (PK)                                                         │

│ user_id (FK) ──────────────────────────────────── → users       │

│ resume_id (FK) ────────────────────────────────── → resumes     │

│ job_desc_id (FK) ──────────────────────────────── → job_descs   │

│ status | type | difficulty | total_score | ai_feedback          │

└───────────────────────────┬─────────────────────────────────────┘

                            │ 1

                            ▼ *

                   ┌────────────────┐

                   │   questions    │

                   │────────────────│

                   │ id (PK)        │

                   │ session_id(FK) │

                   │ question_text  │

                   │ question_type  │

                   └───────┬────────┘

                           │ 1

                           ▼ 1

                   ┌────────────────┐

                   │    answers     │

                   │────────────────│

                   │ id (PK)        │

                   │ question_id(FK)│

                   │ answer_text    │

                   │ code_snippet   │

                   │ ai_score       │

                   │ ai_feedback    │

                   └────────────────┘

  

┌──────────┐ 1    * ┌────────────┐

│  users   │────────│  payments  │

└──────────┘        └────────────┘

  

┌──────────┐ 1    * ┌──────────────────┐

│  users   │────────│ credit_usage_logs│

└──────────┘        └──────────────────┘

```

  

---

  

## 5. Tech Stack Document

  

### Frontend

  

| Category | Technology | Why |

|---|---|---|

| Framework | **React 18** (Vite) | Fast, component-based, huge ecosystem |

| Routing | **React Router v6** | Industry standard |

| State Management | **Zustand** | Lightweight, no boilerplate vs Redux |

| Styling | **Tailwind CSS** | Utility-first, rapid UI dev |

| UI Components | **shadcn/ui** | Beautiful, headless, copy-paste components |

| Code Editor | **Monaco Editor** (React) | Same as VS Code — perfect for coding interviews |

| Voice Input | **Web Speech API** (browser-native) | Free, no API key needed |

| Real-time | **Socket.io-client** | Matches server |

| Forms | **React Hook Form + Zod** | Type-safe form validation |

| HTTP Client | **Axios** | Simple REST requests |

| Charts (Admin) | **Recharts** | Free, React-native charting |

| PDF Upload | **react-dropzone** | Drag-and-drop file uploads |

| Auth tokens | **jwt-decode** | Decode JWTs on client |

  

### Backend (Node.js)

  

| Category | Technology | Why |

|---|---|---|

| Runtime | **Node.js 20+** | JS everywhere |

| Framework | **Express.js** | Minimal, flexible, huge middleware ecosystem |

| Real-time | **Socket.io** | WebSocket abstraction, rooms, namespaces |

| ORM | **Prisma** | Type-safe DB access, auto migrations |

| Database | **PostgreSQL 16** | Relational, JSONB support, rock-solid |

| Auth | **JWT + bcryptjs** | Stateless auth |

| OAuth | **Passport.js** (Google strategy) | Social login |

| File Upload | **Multer** | Middleware for multipart/form-data |

| PDF Parsing | **pdf-parse** (Node) | Extract text from resume PDFs |

| Validation | **Zod** | Shared schema validation |

| Task Queue | **Bull / BullMQ** | Background jobs (resume parsing, feedback gen) |

| Rate Limiting | **express-rate-limit** | Protect endpoints |

| CORS | **cors** package | Handle cross-origin |

| Env | **dotenv** | Environment variables |

| Logging | **Winston** | Structured logging |

  

### AI Microservice (Python)

  

| Category | Technology | Why |

|---|---|---|

| Framework | **FastAPI** | Async, auto Swagger docs, fast |

| LLM Client | **Google Generative AI SDK** | Gemini 1.5 Flash (free tier) |

| Alt LLM | **Groq SDK** | Llama 3 — very fast, free tier |

| PDF Parsing | **PyMuPDF / pdfplumber** | Better PDF parsing than Node |

| TTS | **edge-tts** | Microsoft Azure TTS, free, high quality |

| Alt TTS | **gTTS** | Google TTS, free |

| STT | Browser Web Speech API | Free, client-side — no Python needed |

| Code Analysis | **Gemini API** | Analyse user's code, give feedback |

| NLP/Embeddings | **sentence-transformers** | Optional: semantic matching |

| HTTP Client | **httpx** | Async HTTP for internal calls |

  

### Database & Storage

  

| Category | Technology | Free Plan |

|---|---|---|

| Database | **PostgreSQL** (Neon.tech) | 0.5 GB free, serverless |

| Cache | **Redis** (Upstash) | 10k req/day free |

| File Storage | **Cloudinary** | 25 GB free storage + bandwidth |

| Alt Storage | **Supabase Storage** | 1 GB free |

  

### DevOps & Deployment (All Free)

  

| Service | Free Platform |

|---|---|

| Frontend | **Vercel** (free hobby tier) |

| Backend (Node) | **Render.com** (free 750hr/month) |

| AI Microservice | **Railway.app** or **Render** (free tier) |

| PostgreSQL | **Neon.tech** (free serverless Postgres) |

| Redis | **Upstash** (free serverless Redis) |

| CI/CD | **GitHub Actions** (free for public repos) |

| Monitoring | **Sentry** (free tier, error tracking) |

  

### Payments

  

| Option | Notes |

|---|---|

| **Razorpay** | Best for India — free to integrate, charges per transaction only |

| **Stripe** | International — free sandbox, 2.9% + 30c per live transaction |

| **Cashfree** | India alternative, competitive rates |

  

> Recommendation: Use Razorpay if targeting India. Stripe for international. Both have free sandboxes for development.

  

---

  

## 6. Free Alternatives & Cost Breakdown

  

### AI APIs (Free Tiers)

  

| API | Free Limit | Use Case |

|---|---|---|

| **Google Gemini 1.5 Flash** | 15 req/min, 1M tokens/day | Main LLM — question gen, analysis |

| **Groq (Llama 3)** | 14,400 req/day | Fast inference, alt LLM |

| **HuggingFace Inference API** | 1000 req/day | Embeddings, small models |

| **OpenAI** | No free tier (avoid for now) | — |

  

### Voice (Free)

  

| Technology | Cost | Notes |

|---|---|---|

| **Web Speech API** (STT) | FREE | Browser native, Chrome/Edge |

| **edge-tts** (TTS) | FREE | Runs on your server, Azure voices |

| **gTTS** (TTS) | FREE | Google Translate TTS |

| **ResponsiveVoice** | Free tier | Web-based TTS alternative |

  

### Monthly Cost (Zero Budget Mode)

  

```

Hosting (Render/Vercel/Railway)  →  $0

Database (Neon.tech free)         →  $0

Redis (Upstash free)              →  $0

File Storage (Cloudinary free)    →  $0

AI API (Gemini free tier)         →  $0

TTS (edge-tts self-hosted)        →  $0

STT (Web Speech API)              →  $0

CI/CD (GitHub Actions)            →  $0

─────────────────────────────────────

TOTAL MONTHLY (Dev/MVP)           →  $0

```

  

---

  

## 7. MVP — Minimum Viable Product

  

The MVP should be **completable in 6-8 weeks** solo and must validate the core value proposition.

  

### MVP Scope

  

**Include in MVP:**

  

1. **User Auth** — Email/password registration + login (JWT)

2. **Resume Upload** — PDF upload → AI parses and stores profile

3. **Job Description Input** — Simple text form

4. **Interview Session** — AI generates 5-7 questions based on resume + JD

5. **Voice Interview** — STT (Web Speech API) input + TTS (edge-tts) audio output

6. **Q&A Panel** — Show current question + transcribed answer on screen

7. **Session Save** — Store all Q&As in DB after completion

8. **Basic Feedback** — AI-generated summary after interview

9. **Credit System** — 3 free interviews per account

10. **Simple Dashboard** — User can see past sessions and scores

  

**Exclude from MVP (do later):**

  

- Coding environment (Phase 2)

- Admin panel (Phase 2)

- Payment gateway (Phase 2)

- OAuth (Phase 2)

- Advanced analytics (Phase 3)

  

### MVP User Flow

  

```

Register → Upload Resume → Enter Job Description

    → Start Interview → AI greets with voice

    → AI asks question (TTS audio + text shown)

    → User speaks answer (STT transcribes)

    → AI evaluates + asks next question

    → [5-7 rounds]

    → Interview ends → AI gives feedback

    → Session saved → View in dashboard

```

  

### MVP Pages

  

| Page | Path | Description |

|---|---|---|

| Landing Page | `/` | Hero, features, CTA |

| Register | `/register` | Email + password |

| Login | `/login` | Auth form |

| Dashboard | `/dashboard` | Past sessions list |

| Upload Resume | `/setup/resume` | PDF upload |

| Job Description | `/setup/job` | Text input |

| Interview Room | `/interview/:id` | Voice + Q&A panel |

| Feedback | `/interview/:id/feedback` | Post-session review |

  

---

  

## 8. Feature Breakdown (All 7 Features)

  

### Feature 1: Real-time Voice Interview

  

**How it works:**

- User clicks "Start Interview" → mic permission requested

- Web Speech API's `SpeechRecognition` listens continuously

- Transcribed text sent to Node backend via Socket.io

- Node forwards to Python AI microservice

- Python generates next question + TTS audio

- Audio played on browser via `<audio>` element

- UI shows both the AI question text and the user's transcribed answer

  

**Technical Flow:**

```

Mic → Web Speech API → Socket.io (text) → Node → Python FastAPI

    → Gemini API (next question) → edge-tts (audio bytes)

    → Socket.io (audio back) → Browser plays audio

```

  

**Socket.io Events:**

- `interview:start` — Initialize session

- `interview:answer` — User's transcribed answer

- `interview:question` — AI's next question + audio

- `interview:end` — End session trigger

- `interview:feedback` — Final AI feedback

  

---

  

### Feature 2: AI Voice + Q&A Panel

  

**UI Layout:**

```

┌─────────────────────────────────────────────────────┐

│              InterviewAI — Session Active            │

│─────────────────────────────────────────────────────│

│  AI Avatar (animated)   │   Timer: 00:12:34          │

│─────────────────────────────────────────────────────│

│                                                     │

│  AI QUESTION (TTS playing):                          │

│  "Tell me about a time you handled a difficult      │

│   team situation..."                                 │

│                                                     │

│─────────────────────────────────────────────────────│

│                                                     │

│  YOUR ANSWER (live transcription):                  │

│  "I once worked on a project where the deadline...  │

│   [recording indicator]"                             │

│                                                     │

│─────────────────────────────────────────────────────│

│  Question 2 of 7   [Skip] [End Interview]           │

└─────────────────────────────────────────────────────┘

```

  

**Past Q&A Log:**

- Shows previous questions + answers as a chat transcript

- Allows review during session

  

---

  

### Feature 3: Coding Environment

  

**UI Layout (Split View):**

```

┌───────────────────────┬─────────────────────────────┐

│   AI Question Panel   │    Monaco Code Editor       │

│                       │                             │

│  "Write a function to │  Language: Python           │

│   reverse a linked   │  ──────────────────────      │

│   list in O(n) time" │  def reverse_linked_list(   │

│                       │    head: Node               │

│  [Hint] [Submit]      │  ) -> Node:                 │

│                       │      # your code here       │

│  AI Feedback:         │      pass                   │

│  "Good approach!      │                             │

│   Consider edge       │  [Run] [Submit to AI]       │

│   cases..."           │                             │

└───────────────────────┴─────────────────────────────┘

```

  

**How Code Analysis Works:**

1. User writes code in Monaco Editor

2. Clicks "Submit to AI"

3. Code + question sent to Python AI service

4. Python sends to Gemini: "Analyze this code: [code]. Question was: [question]"

5. AI returns: correctness, time complexity, suggestions

6. Displayed in AI feedback panel

  

**Package:** `@monaco-editor/react` — free, no license needed

  

---

  

### Feature 4: Resume + Job Description Analysis

  

**Resume Processing Pipeline:**

```

User uploads PDF

      ↓

Node backend receives (Multer)

      ↓

Forward to Python service

      ↓

PyMuPDF extracts text

      ↓

Gemini API prompt:

  "Extract from this resume:

   1. Name, email, skills list

   2. Years of experience per technology

   3. Most recent role and company

   4. Education details

   Return as structured JSON"

      ↓

Store structured data in DB (resumes table)

      ↓

Used as context for interview question generation

```

  

**Interview Context Prompt Pattern:**

```

System: You are an expert interviewer.

Candidate Profile: {ai_summary from resume}

Job Role: {job title and description}

Interview Type: {behavioral | technical | mixed}

Difficulty: {easy | medium | hard}

  

Generate interview questions that are:

- Relevant to their experience level

- Specific to the tech stack mentioned in their resume

- Appropriate for the job they're applying to

```

  

---

  

### Feature 5: Session Recording & Save

  

**What Gets Saved:**

```

interview_sessions

├── metadata (duration, score, status)

├── questions[] (all AI questions asked)

│   └── answers[] (user's spoken answers + code)

│       └── ai_feedback per answer

└── final_feedback (overall AI assessment)

```

  

**Post-Session Feedback Page includes:**

- Overall score (0-100)

- Per-question score

- Strengths identified

- Areas for improvement

- Sample better answers for weak questions

- Downloadable PDF report (optional, Phase 2)

  

---

  

### Feature 6: Payment Gateway (Freemium)

  

**Pricing Model:**

  

| Plan | Price | Credits | Features |

|---|---|---|---|

| Free | Rs 0 | 3 interviews | Basic Q&A, no coding env |

| Basic | Rs 199/month | 15 interviews | + Coding env, PDF feedback |

| Pro | Rs 499/month | Unlimited | + Priority AI, analytics |

  

**Payment Flow (Razorpay):**

```

User clicks "Upgrade"

    → Node creates Razorpay Order (server-side)

    → Frontend loads Razorpay checkout widget

    → User pays

    → Razorpay webhook → Node verifies signature

    → Node updates user.plan + user.credits in DB

    → Node logs in payments table

    → User redirected to success page

```

  

**Security Rule:** Always verify payment server-side using Razorpay signature. Never trust frontend payment confirmation alone.

  

---

  

### Feature 7: Admin Panel

  

**Admin Dashboard Sections:**

  

| Section | Metrics Shown |

|---|---|

| Overview | Total users, DAU, total sessions, revenue |

| Users | Table of all users, plan, join date, usage |

| Sessions | All interview sessions, status, scores |

| Payments | Payment history, revenue charts |

| AI Usage | API calls per day, credit consumption |

| Reports | Conversion funnel, retention stats |

  

**Admin Access Control:**

- `role = 'admin'` in users table

- Admin routes protected with `isAdmin` middleware

- Separate `/admin` route prefix

  

---

  

## 9. Future Features

  

### Phase 3 — Intelligence Upgrades

- AI Interviewer Personas — Choose between "Strict Google Interviewer", "Friendly Startup" etc.

- Multi-language Support — Interview in Hindi, Spanish, etc.

- Video Recording — Record face + audio, store session replay

- Emotion Analysis — Detect confidence from voice tone

- Mock Group Interviews — Multiple AI interviewers simulated

  

### Phase 4 — Platform Expansion

- Company-Specific Prep — Amazon, Google, Microsoft interview patterns

- Interview Scheduler — Schedule mock interviews for a specific date/time

- Peer Interview Mode — Two users interview each other (gamified)

- Mentor Marketplace — Real humans can review AI sessions and give feedback

- LinkedIn Integration — Auto-pull profile instead of resume upload

  

### Phase 5 — Business Features

- B2B / Enterprise — Companies use platform to pre-screen candidates

- White-label — Coding bootcamps and universities buy the platform

- API Access — Developers can integrate InterviewAI into their apps

- Affiliate Program — Referral credits system

  

---

  

## 10. Project Roadmap

  

```

PHASE 1 — Foundation (Weeks 1-4)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Week 1: Project setup, DB schema, auth (register/login)

Week 2: Resume upload + Python AI parsing service

Week 3: Interview session creation, question generation

Week 4: Basic Q&A panel (text-only first, no voice yet)

  

PHASE 2 — Voice MVP (Weeks 5-8)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Week 5: Web Speech API STT integration, Socket.io setup

Week 6: TTS (edge-tts) integration, real-time voice loop

Week 7: Session save, feedback generation, dashboard

Week 8: Testing, bug fixes, deploy to free hosting

  

>>> DEMO-READY MVP AT END OF WEEK 8 <<<

  

PHASE 3 — Full Features (Weeks 9-14)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Week 9:  Monaco Editor coding environment

Week 10: Code AI analysis integration

Week 11: Payment gateway (Razorpay)

Week 12: Credits/freemium system

Week 13: Admin panel — user/session management

Week 14: Admin panel — analytics charts

  

PHASE 4 — Polish & Launch (Weeks 15-18)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Week 15: OAuth (Google login)

Week 16: UI/UX polish, mobile responsiveness

Week 17: Performance optimization, caching

Week 18: Public launch, social media, ProductHunt

```

  

---

  

## 11. Task Breakdown

  

### Backend Tasks (Node.js + Express)

  

#### Auth Module

- [ ] Set up Express project structure (MVC pattern)

- [ ] Install & configure Prisma with PostgreSQL

- [ ] Write Prisma schema for all models

- [ ] `POST /api/auth/register` — hash password, create user

- [ ] `POST /api/auth/login` — validate, return JWT

- [ ] JWT middleware for protected routes

- [ ] `POST /api/auth/refresh` — refresh token

- [ ] `GET /api/auth/me` — current user profile

  

#### Resume Module

- [ ] Configure Multer for PDF file uploads

- [ ] `POST /api/resume/upload` — upload + forward to Python

- [ ] `GET /api/resume/:id` — fetch resume details

- [ ] `GET /api/resume/mine` — user's resumes

  

#### Job Description Module

- [ ] `POST /api/jobs` — save job description

- [ ] `GET /api/jobs/:id` — fetch JD

- [ ] `GET /api/jobs/mine` — user's saved JDs

  

#### Interview Module

- [ ] `POST /api/interview/create` — create session, link resume + JD

- [ ] `GET /api/interview/:id` — get session details + Q&A

- [ ] `GET /api/interview/mine` — user's all sessions

- [ ] `PATCH /api/interview/:id/end` — mark complete, store feedback

- [ ] Socket.io server setup

- [ ] Handle `interview:start` event — context setup

- [ ] Handle `interview:answer` event — forward to Python AI

- [ ] Emit `interview:question` event with audio + text

- [ ] Handle `interview:end` event — trigger feedback gen

  

#### Payments Module

- [ ] Razorpay SDK integration

- [ ] `POST /api/payments/create-order` — Razorpay order

- [ ] `POST /api/payments/verify` — verify signature, update plan

- [ ] `POST /api/payments/webhook` — Razorpay webhook handler

- [ ] `GET /api/payments/history` — user payment history

  

#### Admin Module

- [ ] `isAdmin` middleware

- [ ] `GET /api/admin/stats` — overview metrics

- [ ] `GET /api/admin/users` — paginated user list

- [ ] `GET /api/admin/sessions` — all sessions

- [ ] `GET /api/admin/payments` — payment history

- [ ] `PATCH /api/admin/users/:id` — update user plan/role

  

---

  

### Python AI Microservice Tasks (FastAPI)

  

#### Setup

- [ ] FastAPI project with `requirements.txt`

- [ ] Configure Gemini API client

- [ ] Configure edge-tts for TTS

- [ ] Health check endpoint

  

#### Resume Parser

- [ ] `POST /parse-resume` — accept PDF bytes, extract text, call Gemini, return JSON

- [ ] Prompt engineering for structured resume extraction

- [ ] Handle multi-page PDFs

  

#### Interview AI

- [ ] `POST /generate-question` — given context (resume, JD, history), return next question

- [ ] `POST /evaluate-answer` — score answer (0-10) + generate feedback

- [ ] `POST /generate-tts` — text to audio bytes (edge-tts)

- [ ] `POST /generate-feedback` — end-of-session overall feedback

- [ ] Prompt engineering: system prompt templates

  

#### Code Analyser

- [ ] `POST /analyse-code` — code + question → correctness, complexity, suggestions

- [ ] Support multiple languages (Python, Java, JavaScript, C++)

  

---

  

### Frontend Tasks (React + Vite)

  

#### Project Setup

- [ ] Vite + React project, configure Tailwind + shadcn/ui

- [ ] React Router setup (all routes)

- [ ] Axios instance with base URL + interceptors

- [ ] Zustand store setup (auth, interview state)

- [ ] Socket.io client setup

  

#### Auth Pages

- [ ] `/register` — registration form + validation (Zod)

- [ ] `/login` — login form

- [ ] Auth guard HOC for protected routes

- [ ] JWT storage in httpOnly cookie (or localStorage with care)

  

#### Landing Page

- [ ] Hero section with CTA

- [ ] Features section

- [ ] Pricing table (free/basic/pro)

- [ ] Testimonials placeholder

  

#### Dashboard

- [ ] Past sessions list (cards with score + date)

- [ ] Credits remaining indicator

- [ ] Quick start button

  

#### Setup Flow

- [ ] Resume upload page (drag-and-drop, pdf only)

- [ ] Job description input page

- [ ] Interview type selector (behavioral/technical/coding/mixed)

- [ ] Difficulty selector

  

#### Interview Room (Core Feature)

- [ ] Layout: Q&A panel + sidebar

- [ ] AI question display component

- [ ] Web Speech API hook (`useSpeechRecognition`)

- [ ] Live transcription display

- [ ] Audio player for TTS

- [ ] Question counter / progress indicator

- [ ] Controls: Skip, End Interview, Mute

- [ ] Monaco Editor integration (for coding type)

- [ ] "Submit Code" button + AI feedback display

  

#### Feedback Page

- [ ] Overall score visualization (circular progress)

- [ ] Per-question score list

- [ ] Strengths / weaknesses sections

- [ ] Expandable Q&A review

  

#### Payments

- [ ] Pricing page

- [ ] Razorpay checkout integration

- [ ] Success / failure pages

  

#### Admin Panel

- [ ] Admin-only route guard

- [ ] Stats overview cards

- [ ] Users table with search/filter

- [ ] Sessions table

- [ ] Revenue chart (Recharts)

  

---

  

### DevOps Tasks

  

- [ ] GitHub repository setup, `.gitignore`

- [ ] Environment variable files (`.env.example`)

- [ ] Docker Compose for local dev (Postgres + Redis)

- [ ] Deploy frontend to Vercel

- [ ] Deploy Node backend to Render

- [ ] Deploy Python service to Render / Railway

- [ ] Set up Neon.tech free Postgres DB

- [ ] Configure Upstash Redis

- [ ] GitHub Actions CI (lint + test on PR)

- [ ] Set up Sentry for error tracking

  

---

  

## 12. Workflow Diagrams

  

### Complete Interview Session Workflow

  

```

User lands on /interview/setup

           ↓

    Upload Resume (PDF)

           ↓

    Enter Job Description

           ↓

    Select: Type + Difficulty

           ↓

POST /api/interview/create

  → DB: interview_sessions row created (status: pending)

  → Python: pre-generate first question using resume context

           ↓

User enters /interview/:id

  → Socket.io: client connects, joins session room

  → status: active

           ↓

Socket emits → interview:question

  → AI question text shown on screen

  → TTS audio plays automatically

           ↓

User speaks answer (STT transcribing in real-time)

           ↓

User clicks "Next" or auto-detects silence

  → Socket emits → interview:answer {text, questionId}

  → Node → Python: evaluate_answer() → store score

  → Python: generate_next_question()

  → Python: generate_tts(next_question)

  → Socket emits → interview:question (next)

           ↓

After 7 questions OR user clicks "End":

  → Socket emits → interview:end

  → Python: generate_feedback(all QAs)

  → DB: update session status=completed, store feedback

  → Redirect to /interview/:id/feedback

```

  

### Voice Pipeline Detail

  

```

SPEECH-TO-TEXT (Client-side, FREE):

  Browser Mic → navigator.mediaDevices.getUserMedia()

             → SpeechRecognition API

             → onresult event → transcript text

             → Socket.io emit → server

  

TEXT-TO-SPEECH (Server-side, FREE):

  Question text → Python edge-tts

               → generates .mp3 bytes

               → base64 encoded

               → Socket.io emit → client

               → new Audio(base64).play()

```

  

### Credit Deduction Flow

  

```

User starts interview

       ↓

Check user.credits > 0 ?

       ↓ YES                    ↓ NO

Deduct 1 credit           Show upgrade modal

Create session              Redirect to /pricing

Log credit_usage

Continue interview

```

  

---

  

## Project Folder Structure

  

```

interview-ai/

├── frontend/                   # React + Vite app

│   ├── src/

│   │   ├── components/         # Reusable UI components

│   │   ├── pages/              # Route-level page components

│   │   ├── hooks/              # Custom React hooks (useSpeech, etc.)

│   │   ├── store/              # Zustand state stores

│   │   ├── services/           # API call functions (axios)

│   │   ├── socket/             # Socket.io client setup

│   │   └── lib/                # Utils, constants, helpers

│   └── package.json

│

├── backend/                    # Node.js + Express

│   ├── prisma/

│   │   └── schema.prisma       # DB schema definition

│   ├── src/

│   │   ├── routes/             # Express route handlers

│   │   ├── controllers/        # Business logic

│   │   ├── middleware/         # Auth, rate-limit, admin guards

│   │   ├── services/           # DB queries (Prisma calls)

│   │   ├── socket/             # Socket.io handlers

│   │   └── utils/              # Helpers, validators

│   └── package.json

│

├── ai-service/                 # Python FastAPI microservice

│   ├── routers/                # FastAPI route handlers

│   ├── services/               # AI logic (Gemini, TTS, parser)

│   ├── prompts/                # Prompt templates

│   ├── models/                 # Pydantic request/response models

│   ├── main.py                 # FastAPI app entry

│   └── requirements.txt

│

├── docker-compose.yml          # Local dev (Postgres + Redis)

├── .env.example                # Template for environment vars

└── README.md                   # This file

```

  

---

  

## Environment Variables Reference

  

### Backend (.env)

```

DATABASE_URL=postgresql://user:pass@host:5432/interviewai

JWT_SECRET=your_super_secret_key

JWT_EXPIRES_IN=7d

PYTHON_AI_URL=http://localhost:8000

CLOUDINARY_URL=cloudinary://key:secret@cloud_name

RAZORPAY_KEY_ID=rzp_test_xxxxx

RAZORPAY_KEY_SECRET=your_secret

REDIS_URL=redis://localhost:6379

PORT=5000

```

  

### Python AI Service (.env)

```

GEMINI_API_KEY=your_gemini_key

GROQ_API_KEY=your_groq_key

PORT=8000

```

  

### Frontend (.env)

```

VITE_API_URL=http://localhost:5000

VITE_SOCKET_URL=http://localhost:5000

VITE_RAZORPAY_KEY=rzp_test_xxxxx

```

  

---

  

## Getting Started (Development)

  

```bash

# 1. Clone repo

git clone https://github.com/yourusername/interview-ai

  

# 2. Start local Postgres + Redis

docker-compose up -d

  

# 3. Setup backend

cd backend

npm install

npx prisma migrate dev

npm run dev

  

# 4. Setup frontend

cd ../frontend

npm install

npm run dev

  

# 5. Setup Python AI service

cd ../ai-service

pip install -r requirements.txt

uvicorn main:app --reload --port 8000

```

  

---

  

*Document Version: 1.0 | Last Updated: July 2026*

*Built with focus — Zero budget, maximum ambition.*