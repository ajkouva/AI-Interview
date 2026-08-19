# 🚀 AI Interview Platform - Backend API Documentation

Welcome to the backend API documentation for the AI Interview Platform. This guide provides full details on authentication, endpoints, request formats, and response schemas for frontend developers.

---

## 🔐 Authentication & Headers

All protected routes require authentication. In production, pass the Clerk Session Token in the standard HTTP Authorization header. For local development & Postman testing, you can also pass `x-clerk-user-id`.

### Headers
* **Standard Production Auth:** `Authorization: Bearer <clerk_session_token>`
* **Development / Postman Bypass:** `x-clerk-user-id: user_3Hgz...` *(Only active when `NODE_ENV !== 'production'`)*
* **Content Type:** `Content-Type: application/json` *(Except for file uploads, which use `multipart/form-data`)*

> [!WARNING]
> **Security Notice:** The `x-clerk-user-id` header bypass is strictly intended for local loopback development (`http://localhost:3000`). Never expose a public cloudflare tunnel without an access policy or IP allowlist when `NODE_ENV !== 'production'`.

---

## 🛠️ Base URLs
* **Local Development:** `http://localhost:3000`
* **Cloudflare Tunnel (Dev):** `https://ai-interview.ajkouva.in`

---

## 📋 API Summary Matrix

| Category | Endpoint | Method | Description |
| :--- | :--- | :--- | :--- |
| **Webhooks** | `/api/webhooks/clerk` | `POST` | Clerk Svix sync for user creation/updates |
| **Users** | `/api/users/me` | `GET` | Get authenticated user profile & credit balance |
| **Users** | `/api/users/onboarding` | `POST` | Update user onboarding details |
| **Jobs** | `/api/jobs` | `POST` | Create a new job description target |
| **Jobs** | `/api/jobs` | `GET` | List all job descriptions for current user |
| **Jobs** | `/api/jobs/:id` | `GET` | Get specific job description details |
| **Jobs** | `/api/jobs/:id` | `DELETE` | Delete a job description |
| **Resumes** | `/api/resumes/upload` | `POST` | Upload PDF resume, extract AI data & save to ImageKit |
| **Resumes** | `/api/resumes` | `GET` | List user resumes with signed ImageKit URLs |
| **Resumes** | `/api/resumes/:id` | `GET` | Get single resume by ID with signed URL |
| **Resumes** | `/api/resumes/:id` | `DELETE` | Delete resume from ImageKit & DB |
| **Sessions** | `/api/sessions` | `POST` | Deduct 1 credit, generate AI questions & start session |
| **Sessions** | `/api/sessions/latest` | `GET` | Get candidate's most recent interview session |
| **Sessions** | `/api/sessions/:id` | `GET` | Get specific session details and questions by ID |

---

## 1️⃣ User Routes (`/api/users`)

### 1.1 Get Current User (`GET /api/users/me`)
Retrieves the logged-in candidate's profile, onboarding status, and available credit balance.

* **Auth Required:** `Yes`
* **Response (200 OK):**
```json
{
  "id": "uuid-1234",
  "clerkId": "user_3HgzSaYMvOmi55WZYTLemUiVfgo",
  "email": "user@example.com",
  "isOnboarded": true,
  "fullName": "Aman Singh",
  "avatarUrl": "https://...",
  "college": "Tech University",
  "bio": "Full Stack Engineer",
  "targetRole": "Backend Developer",
  "experienceLevel": "MID",
  "role": "USER",
  "plan": "FREE",
  "credits": 3,
  "createdAt": "2026-08-10T12:00:00.000Z"
}
```

### 1.2 User Onboarding (`POST /api/users/onboarding`)
Submits candidate profile details during first-time onboarding. Sets `isOnboarded: true`.

* **Auth Required:** `Yes`
* **Request Body:**
```json
{
  "fullName": "Aman Singh",
  "college": "Tech University",
  "bio": "Full Stack Engineer specializing in Node.js & React",
  "targetRole": "Backend Engineer",
  "experienceLevel": "MID",
  "avatarUrl": "https://example.com/avatar.jpg"
}
```
* **Response (200 OK):** Updated user object.

---

## 2️⃣ Job Description Routes (`/api/jobs`)

### 2.1 Create Job Description (`POST /api/jobs`)
* **Auth Required:** `Yes`
* **Request Body:**
```json
{
  "title": "Senior Backend Developer - Node.js",
  "description": "We are seeking a Backend Developer with 3+ years of experience in Express, PostgreSQL, Bun, Prisma, and REST APIs..."
}
```
* **Response (201 Created):**
```json
{
  "id": "job-uuid-5678",
  "userId": "user-uuid-1234",
  "title": "Senior Backend Developer - Node.js",
  "description": "We are seeking a Backend Developer...",
  "createdAt": "2026-08-14T10:00:00.000Z"
}
```

### 2.2 List All Job Descriptions (`GET /api/jobs`)
* **Auth Required:** `Yes`
* **Response (200 OK):** Array of Job Description objects.

### 2.3 Get Job Description By ID (`GET /api/jobs/:id`)
* **Auth Required:** `Yes`
* **Response (200 OK):** Single Job Description object.

### 2.4 Delete Job Description (`DELETE /api/jobs/:id`)
* **Auth Required:** `Yes`
* **Response (200 OK):** `{ "message": "Job description deleted successfully" }`

---

## 3️⃣ Resume Management Routes (`/api/resumes`)

### 3.1 Upload & Parse Resume (`POST /api/resumes/upload`)
Uploads a PDF resume, parses raw text, sends it to Gemini AI (`gemini-2.5-flash`) for structured data extraction, saves to ImageKit, and creates a database record.

* **Auth Required:** `Yes`
* **Content-Type:** `multipart/form-data`
* **Form Fields:**
  - `file`: PDF file *(Max 5MB)*
  - `title` *(Optional)*: Custom resume title string
* **Response (201 Created):**
```json
{
  "id": "resume-uuid-9999",
  "userId": "user-uuid-1234",
  "title": "Aman Singh - Software Engineer",
  "fileUrl": "https://ik.imagekit.io/ai-interviews/resumes/my_resume.pdf?token=...",
  "aiSummary": "Candidate has 3 years of experience in TypeScript, React, and PostgreSQL.",
  "skills": ["Node.js", "TypeScript", "PostgreSQL", "Prisma", "Docker"],
  "experience": [
    {
      "company": "Tech Corp",
      "role": "Backend Engineer",
      "duration": "2023 - Present",
      "description": "Built scalable REST APIs"
    }
  ],
  "education": [
    {
      "institution": "Tech University",
      "degree": "B.Tech Computer Science",
      "year": "2023"
    }
  ],
  "projects": [],
  "certifications": [],
  "createdAt": "2026-08-14T12:00:00.000Z"
}
```

### 3.2 List All Resumes (`GET /api/resumes`)
Returns all resumes belonging to the user with freshly signed ImageKit download URLs (valid for 5 minutes).

* **Auth Required:** `Yes`
* **Response (200 OK):** Array of Resume objects with signed `fileUrl` strings.

### 3.3 Get Resume By ID (`GET /api/resumes/:id`)
* **Auth Required:** `Yes`
* **Response (200 OK):** Single Resume object with signed `fileUrl`.

### 3.4 Delete Resume (`DELETE /api/resumes/:id`)
Deletes the file from ImageKit cloud storage and removes the record from PostgreSQL.

* **Auth Required:** `Yes`
* **Response (200 OK):** `{ "message": "Resume deleted successfully" }`

---

## 4️⃣ Interview Session Engine (`/api/sessions`)

### 4.1 Create & Start Interview Session (`POST /api/sessions`)
Deducts 1 credit from user, creates an active `InterviewSession`, calls Gemini AI to generate customized questions matching the candidate's resume and target job, and saves questions to the database.

* **Auth Required:** `Yes`
* **Request Body:**
```json
{
  "resumeId": "resume-uuid-9999",
  "jobDescriptionId": "job-uuid-5678",
  "sessionType": "TECHNICAL",
  "difficulty": "MEDIUM",
  "durationMinutes": 15,
  "noOfQuestions": 5
}
```
* **Response (201 Created):**
```json
{
  "id": "session-uuid-7777",
  "userId": "user-uuid-1234",
  "resumeId": "resume-uuid-9999",
  "jobDescriptionId": "job-uuid-5678",
  "status": "ACTIVE",
  "sessionType": "TECHNICAL",
  "difficulty": "MEDIUM",
  "durationMinutes": 15,
  "startedAt": "2026-08-14T15:00:00.000Z",
  "questions": [
    {
      "id": "question-uuid-001",
      "sessionId": "session-uuid-7777",
      "questionNo": 1,
      "questionText": "Can you explain how connection pooling works in PostgreSQL?",
      "questionType": "TECHNICAL"
    },
    {
      "id": "question-uuid-002",
      "sessionId": "session-uuid-7777",
      "questionNo": 2,
      "questionText": "Describe how you optimize slow database queries using indexes.",
      "questionType": "TECHNICAL"
    }
  ],
  "jobDescription": {
    "title": "Senior Backend Developer - Node.js",
    "description": "We are seeking a Backend Developer..."
  },
  "resume": {
    "title": "Aman Singh - Software Engineer"
  }
}
```

### 4.2 Get Candidate's Latest Session (`GET /api/sessions/latest`)
* **Auth Required:** `Yes`
* **Response (200 OK):** Candidate's most recent `InterviewSession` object with questions included.

### 4.3 Get Session Details By ID (`GET /api/sessions/:id`)
* **Auth Required:** `Yes`
* **Response (200 OK):** Specific `InterviewSession` object with questions included.

---

## 5️⃣ Answer Submission & AI Evaluation (`/api/sessions/:sessionId/answers`)

### 5.1 Submit Answer for Real-Time Evaluation (`POST /api/sessions/:sessionId/answers`)
Submits a candidate's answer (text or code) for a specific question within a session. Invokes Gemini AI to grade the response, computes scoring metrics, creates the answer record, and automatically completes the interview session when all questions have been answered.

* **Auth Required:** `Yes`
* **URL:** `POST /api/sessions/:sessionId/answers` (or `/api/answers` with `sessionId` in body)
* **Request Body:**
```json
{
  "questionId": "question-uuid-001",
  "answerText": "Index scanning uses B-Trees in PostgreSQL to quickly locate row pointer offsets without reading full table pages.",
  "codeSnippet": "CREATE INDEX idx_user_email ON users(email);",
  "codeLanguage": "sql"
}
```
* **Response (201 Created):**
```json
{
  "message": "Answer evaluated and submitted successfully",
  "data": {
    "answerId": "answer-uuid-1111",
    "questionId": "question-uuid-001",
    "sessionId": "session-uuid-7777",
    "aiScore": 8.5,
    "aiFeedback": "Clear explanation of indexing mechanics with correct SQL syntax.",
    "keywordHit": ["B-Tree", "Table Scan", "Index Pointer"],
    "suggestedAnswer": "A comprehensive answer should cover B-Tree structure, how PostgreSQL scans index pages before reading table heaps, and when composite indexes are preferred.",
    "confidenceLevel": "HIGH",
    "isCompleted": false,
    "remainingQuestions": 4
  }
}
```

---

## ⚠️ Error Handling & Status Codes

All API errors return a standard JSON payload:
```json
{
  "error": "Error description message here"
}
```

### Common HTTP Status Codes
* `200 OK` — Successful operation
* `201 Created` — Resource successfully created
* `400 Bad Request` — Invalid input, missing required parameters, or invalid PDF file
* `401 Unauthorized` — Missing or invalid authentication token / Clerk ID
* `402 Payment Required` — Insufficient user credits to perform an action (e.g., start interview session)
* `404 Not Found` — Requested resource does not exist or belong to user
* `413 Payload Too Large` — File exceeds the 5MB upload limit
* `500 Internal Server Error` — Unhandled backend exception or external service failure
