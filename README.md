# 🤖 InterviewAI — AI-Powered Interview Platform

> **Role of this document**: Master Engineering & Architecture Blueprint.
> Covers the Dual-Engine Architecture (Practice Exam Assessment + Real-Time Voice Simulation), Cloud AI vs Local Models, Data Models, API Contracts, and Execution Roadmap.

---

## Table of Contents

1. [Project Overview & Core Value Proposition](#1-project-overview--core-value-proposition)
2. [System Architecture Diagram (Dual-Engine)](#2-system-architecture-diagram-dual-engine)
3. [Model Selection: Local Voice vs Gemini Live API](#3-model-selection-local-voice-vs-gemini-live-api)
4. [Database Schema & Data Models](#4-database-schema--data-models)
5. [Tech Stack & Infrastructure Document](#5-tech-stack--infrastructure-document)
6. [Dual-Engine Interview System Design](#6-dual-engine-interview-system-design)
   - [Engine 1: 📝 Practice Exam / Online Assessment Mode](#engine-1--practice-exam--online-assessment-mode)
   - [Engine 2: 🎙️ Live Voice & Code Simulation Mode](#engine-2-️-live-voice--code-simulation-mode)
7. [Split-Screen Live Coding Environment](#7-split-screen-live-coding-environment)
8. [Post-Interview Analytics & Report Card System](#8-post-interview-analytics--report-card-system)
9. [Payment & Credit Tokenomics](#9-payment--credit-tokenomics)
10. [API Routes Reference](#10-api-routes-reference)
11. [Project Roadmap & Next Steps](#11-project-roadmap--next-steps)

---

## 1. Project Overview & Core Value Proposition

**InterviewAI** is an intelligent, full-stack AI interview preparation platform designed to help software engineers, developers, and tech candidates ace real-world technical and behavioral interviews.

Candidates can:
1. **Upload Resume & Target Job Descriptions**: Automatically parsed via ImageKit and Gemini AI into structured candidate profiles and skill matrices.
2. **Dual-Mode Interview Preparation**:
   - **Mode 1: Timed Practice Assessment** — Structured, card-by-card Q&A with live code runner and step-by-step scoring.
   - **Mode 2: Live Voice & Code Simulation** — Real-time bidirectional voice call with Gemini Multimodal Live, featuring live code review and conversational interruptions.
3. **Comprehensive Performance Analytics**: Instant post-session scoring, radar charts, strengths/weaknesses, and suggested model answers.
4. **Freemium & Credit Economy**: Free tier onboarding with optional Razorpay/Stripe credit pack upgrades.

---

## 2. System Architecture Diagram (Dual-Engine)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             CLIENT LAYER (React / Vite)                     │
│                                                                             │
│  ┌───────────────────────┐  ┌───────────────────────┐  ┌─────────────────┐  │
│  │ Mode 1: Practice Exam │  │ Mode 2: Live Voice UI │  │ Monaco Code IDE │  │
│  │ (Card-by-Card Timed)  │  │ (Audio Visualizer)    │  │ (Split Screen)  │  │
│  └───────────┬───────────┘  └───────────┬───────────┘  └────────┬────────┘  │
└──────────────┼──────────────────────────┼───────────────────────┼───────────┘
               │ (REST API)               │ (WebSocket Stream)    │
               ▼                          ▼                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    BUN BACKEND GATEWAY (Bun + Express)                      │
│                                                                             │
│   ┌───────────────────────────────┐   ┌─────────────────────────────────┐   │
│   │ REST API Router (/api/...)    │   │ Bun WebSocket Server (/ws/...)  │   │
│   │ - /api/users (Clerk + Svix)   │   │ - Audio Stream Relay (PCM)      │   │
│   │ - /api/jobs (CRUD)            │   │ - Live Closed-Caption Stream    │   │
│   │ - /api/resumes (ImageKit/PDF) │   │ - Code Snippet Event Dispatch   │   │
│   │ - /api/sessions & /api/answers│   │ - Live Session Buffer           │   │
│   └──────────────┬────────────────┘   └────────────────┬────────────────┘   │
└──────────────────┼─────────────────────────────────────┼────────────────────┘
                   │                                     │
        ┌──────────▼──────────┐               ┌──────────▼─────────────────┐
        │    PostgreSQL DB     │               │   Google Gemini AI Engine   │
        │  (via Prisma ORM)   │               │   (@google/genai SDK v2)    │
        │                     │               │                             │
        │  - Users & Credits  │               │  - gemini-2.5-flash         │
        │  - Resumes & Jobs   │               │    (Structured Zod Parsing) │
        │  - Sessions & Trans │               │  - gemini-2.0-flash-exp     │
        │  - Questions & Answ │               │    (Multimodal Live Voice)  │
        │  - Payments & Logs  │               │                             │
        └─────────────────────┘               └─────────────────────────────┘
```

---

## 3. Model Selection: Local Voice vs Gemini Live API

| Comparison Dimension | 💻 Local Voice / Local LLM Stack | ☁️ Google Gemini 2.0 Flash Live API |
| :--- | :--- | :--- |
| **Context Window** | **Tiny (4K – 8K tokens)**. Easily overflows with long resumes + job specs + multi-turn conversations. | **Huge (1,000,000+ tokens)**. Effortlessly retains entire resumes, full job descriptions, and 45-minute calls. |
| **Latency** | **Slow (2.5s – 4.5s waterfall)**. Audio ➔ Local Whisper ➔ Local Llama ➔ Local TTS. | **Ultra-Fast (<500ms)**. Native bidirectional audio-to-audio streaming without STT/TTS chaining. |
| **Reasoning & Smarts** | **Medium**. Smaller 7B/8B parameter models struggle with complex system design & code debugging. | **State-of-the-art**. Advanced coding, logic, and nuanced conversational feedback. |
| **Infrastructure Cost** | **High ($50–$200/mo)**. Requires dedicated GPU servers (NVIDIA RTX/A10G VRAM). | **$0 / Free Tier**. Free on Google AI Studio for developers and low per-minute pricing at scale. |
| **Verdict** | ❌ Not practical for production SaaS | ✅ **Selected Choice for InterviewAI** |

---

## 4. Database Schema & Data Models

### 4.1 Prisma Schema (`schema.prisma`)

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client"
  output   = "../generated/prisma"
}

enum Plan {
  FREE
  BASIC
  PRO
}

enum Role {
  USER
  ADMIN
}

enum SessionStatus {
  ACTIVE
  COMPLETED
  ABANDONED
}

enum SessionType {
  BEHAVIORAL
  TECHNICAL
  CODING
  MIXED
}

enum Difficulty {
  EASY
  MEDIUM
  HARD
}

enum InterviewMode {
  ASSESSMENT    // Mode 1: Practice Exam / Turn-Based
  LIVE_VOICE    // Mode 2: Real-time Gemini Live Voice Stream
}

model User {
  id               String              @id @default(uuid())
  clerkId          String              @unique
  email            String              @unique
  username         String?             @unique
  fullName         String?
  avatarUrl        String?
  authProvider     String              @default("clerk")
  role             Role                @default(USER)
  plan             Plan                @default(FREE)
  credits          Int                 @default(3)
  isOnboarded      Boolean             @default(false)
  college          String?
  bio              String?
  targetRole       String?
  experienceLevel  String?
  createdAt        DateTime            @default(now())
  updatedAt        DateTime            @updatedAt

  resumes          Resume[]
  jobDescriptions  JobDescription[]
  sessions         InterviewSession[]
  payments         Payment[]
  creditLogs       CreditUsageLog[]

  @@index([clerkId])
  @@index([email])
}

model Resume {
  id           String             @id @default(uuid())
  userId       String
  fileUrl      String
  fileName     String
  fileId       String?
  content      String?
  aiSummary    String?
  skills       Json?
  experience   Json?
  createdAt    DateTime           @default(now())

  user         User               @relation(fields: [userId], references: [id], onDelete: Cascade)
  sessions     InterviewSession[]

  @@index([userId])
}

model JobDescription {
  id           String             @id @default(uuid())
  userId       String
  title        String
  description  String
  createdAt    DateTime           @default(now())

  user         User               @relation(fields: [userId], references: [id], onDelete: Cascade)
  sessions     InterviewSession[]

  @@index([userId])
}

model InterviewSession {
  id               String             @id @default(uuid())
  userId           String
  resumeId         String
  jobDescriptionId String
  status           SessionStatus      @default(ACTIVE)
  sessionType      SessionType        @default(MIXED)
  difficulty       Difficulty         @default(MEDIUM)
  interviewMode    InterviewMode      @default(ASSESSMENT)
  durationMinutes  Int                @default(30)
  totalScore       Float?
  aiFeedback       String?
  transcript       Json?              // Live Voice Conversation Log
  voiceName        String?            @default("Puck")
  startedAt        DateTime           @default(now())
  endedAt          DateTime?
  createdAt        DateTime           @default(now())

  user             User               @relation(fields: [userId], references: [id], onDelete: Cascade)
  resume           Resume             @relation(fields: [resumeId], references: [id], onDelete: Cascade)
  jobDescription   JobDescription     @relation(fields: [jobDescriptionId], references: [id], onDelete: Cascade)
  questions        Question[]
  answers          Answer[]
  creditLogs       CreditUsageLog[]

  @@index([userId])
  @@index([status])
}

model Question {
  id           String             @id @default(uuid())
  sessionId    String
  questionNo   Int
  questionText String
  questionType SessionType        @default(MIXED)
  createdAt    DateTime           @default(now())

  session      InterviewSession   @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  answer       Answer?

  @@index([sessionId])
}

model Answer {
  id           String             @id @default(uuid())
  questionId   String             @unique
  sessionId    String
  answerText   String?
  codeSnippet  String?
  codeLanguage String?
  aiScore      Float?
  aiFeedback   String?
  keywordHit   Json?
  answerAt     DateTime           @default(now())

  question     Question           @relation(fields: [questionId], references: [id], onDelete: Cascade)
  session      InterviewSession   @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([sessionId])
}

model Payment {
  id                 String           @id @default(uuid())
  userId             String
  amount             Decimal          @db.Decimal(10, 2)
  currency           String           @default("INR")
  gateway            String           // "razorpay" | "stripe"
  gatewayOrderId     String           @unique
  gatewayPaymentId   String?
  status             String           @default("PENDING")
  creditsPurchased   Int
  createdAt          DateTime         @default(now())

  user               User             @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

model CreditUsageLog {
  id          String            @id @default(uuid())
  userId      String
  sessionId   String?
  creditsUsed Int               @default(1)
  action      String            // "CREATE_INTERVIEW_SESSION"
  createdAt   DateTime          @default(now())

  user        User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  session     InterviewSession? @relation(fields: [sessionId], references: [id], onDelete: SetNull)

  @@index([userId])
}
```

---

## 5. Tech Stack & Infrastructure Document

### Backend (Bun Runtime)
* **Runtime**: **Bun** (Ultra-fast startup, native WebSocket server, high-performance HTTP).
* **Framework**: **Express.js** mounted on Bun.
* **Database & ORM**: **PostgreSQL 16** via **Prisma ORM 7**.
* **Authentication**: **Clerk Express** (`clerkMiddleware` + `getAuth`) with Svix webhook sync.
* **Storage**: **ImageKit** with private folders and signed expiring download URLs.
* **AI Engine**: **`@google/genai` (Google GenAI SDK v2)**:
  - `gemini-2.5-flash` for structured Zod JSON parsing & validation.
  - `gemini-2.0-flash-exp` for real-time Multimodal Live WebSockets.

### Frontend (React 18 + Vite)
* **Build Tool**: Vite.
* **UI Components**: Tailwind CSS + shadcn/ui.
* **Code Editor**: `@monaco-editor/react` (VS Code engine in the browser).
* **Voice & Audio**: Web Audio API (PCM 16kHz audio capture & playback buffer).
* **State Management**: Zustand.

---

## 6. Dual-Engine Interview System Design

### Engine 1: 📝 Practice Exam / Online Assessment Mode
* **Format**: Card-by-card timed online test.
* **Flow**:
  1. `POST /api/sessions` ➔ Generates 5–10 structured questions in advance.
  2. Candidate reads question, writes text or runs code in Monaco Editor.
  3. `POST /api/sessions/:sessionId/answers` ➔ Gemini evaluates single answer in real-time, grades 0.0–10.0, and delivers feedback.
  4. Once all questions are answered, session status moves to `COMPLETED` and calculates overall score.

---

### Engine 2: 🎙️ Live Voice & Code Simulation Mode
* **Format**: Real-time conversational interview over WebSockets (Zoom/Google Meet style).
* **Flow**:
  1. `POST /api/sessions` with `interviewMode: "LIVE_VOICE"`.
  2. Frontend opens WebSocket connection: `ws://localhost:3000/ws/interview/:sessionId`.
  3. Backend injects candidate's resume + target job context into Gemini Live setup.
  4. Candidate speaks into mic; Gemini speaks response aloud (<500ms latency).
  5. If candidate struggles, AI offers hints; if candidate excels, AI dives deeper.
  6. On session completion, backend collects full transcript and runs holistic post-interview evaluation.

---

## 7. Split-Screen Live Coding Environment

During live technical interviews, the frontend presents a synchronized split-screen:
* **Left Panel**: AI Voice Audio Visualizer & Real-time Live Closed Captions.
* **Right Panel**: Monaco Code Editor with syntax highlighting (TypeScript, Python, JavaScript, SQL, Go, Java).

### Real-Time WebSocket Code Event Protocol:
1. **AI Prompts Code Challenge**:
   ```json
   {
     "type": "CODING_PROMPT",
     "language": "typescript",
     "starterCode": "function longestSubstring(s: string): number {\n  // Code here\n}"
   }
   ```
2. **Candidate Explains While Typing**: Mic audio streams in real-time while candidate types.
3. **Candidate Submits Solution**:
   ```json
   {
     "type": "SUBMIT_CODE",
     "code": "function longestSubstring(s) { ... }",
     "language": "typescript"
   }
   ```
4. **Instant Spoken Review**: AI reviews code in < 1s and speaks review aloud.

---

## 8. Post-Interview Analytics & Report Card System

When a session completes, Gemini produces an in-depth candidate performance summary:

* **Overall Readiness Score**: 0% – 100%.
* **Competency Radar Matrix**:
  - Technical Knowledge (0–100%)
  - Coding & Problem Solving (0–100%)
  - Communication & Articulation (0–100%)
  - System Design & Architecture (0–100%)
* **Key Strengths**: Specific highlights from candidate's answers.
* **Actionable Improvement Plan**: Clear study roadmap to fix weak areas.
* **Model Suggested Answers**: Gold-standard answers for questions candidate missed.

---

## 9. Payment & Credit Tokenomics

* **Freemium Allocation**: 3 Free Mock Interview Credits on onboarding.
* **Credit Consumption**: 1 Credit deducted per created interview session.
* **Credit Top-Up Packs (Razorpay / Stripe)**:
  - **Starter Pack**: 5 Interviews = ₹499 ($10)
  - **Pro Pack**: 20 Interviews = ₹1,499 ($25)
  - **Unlimited Pass**: ₹2,499/month ($39/mo)

---

## 10. API Routes Reference

### Authentication & Users
* `GET /api/users/me` — Current user profile & onboarding status.
* `POST /api/users/onboarding` — Update profile & target career details.
* `POST /api/webhooks/clerk` — Svix-verified user sync webhook.

### Job Descriptions
* `POST /api/jobs` — Create target job role.
* `GET /api/jobs` — List user's job targets.
* `GET /api/jobs/:id` — Get single job details.
* `DELETE /api/jobs/:id` — Delete job target.

### Resumes
* `POST /api/resumes/upload` — Upload PDF (ImageKit + Gemini extraction).
* `GET /api/resumes` — List uploaded resumes.
* `GET /api/resumes/:id` — Get resume details & AI parsed skills.
* `DELETE /api/resumes/:id` — Delete resume from DB & ImageKit.

### Sessions & Evaluations (Engine 1: Practice Exam)
* `POST /api/sessions` — Create interview session (deducts 1 credit).
* `GET /api/sessions` — List all past interview sessions.
* `GET /api/sessions/latest` — Get latest session.
* `GET /api/sessions/:id` — Get session details with questions.
* `POST /api/sessions/:sessionId/answers` — Submit answer for real-time evaluation.

### Live Voice Gateway (Engine 2: Live Voice Simulation)
* `WS /ws/interview/:sessionId` — Bidirectional PCM audio streaming & Monaco code sync.

---

## 11. Project Roadmap & Next Steps

1. **Step 1: Database Migration** (`schema.prisma`):
   - Add `isVoiceMode`, `voiceName`, `transcript` JSON, and `interviewMode` to `InterviewSession`.
   - Run `bun db:migrate`.
2. **Step 2: WebSocket Voice Engine Implementation**:
   - Create `src/services/voice/gemini.live.ts` (Gemini Multimodal Live client).
   - Create `src/websocket/interview.socket.ts` (Bun WebSocket handler).
   - Mount WebSockets in `src/index.ts`.
3. **Step 3: Post-Interview Analytics Report Card**:
   - Build `GET /api/sessions/:id/results` endpoint for rich radar charts and recommendations.
4. **Step 4: Payment Gateway Integration**:
   - Wire up Razorpay / Stripe checkout and webhooks.
5. **Step 5: Frontend Connection**:
   - Connect React Vite frontend with Monaco Editor & Web Audio API.