# CBT Examination Platform — Complete Technical Architecture & Developer Reference

> **Branding Requirement:** Designed & developed by **Sudarshan Mishra**.  
> **Version:** 1.2.0 Production  
> **Target Scale:** 100+ Concurrent Students  
> **Repository:** `github.com/Sudarshan180392/cbtforDSC`  
> **Production URL:** `https://cbtfor-dsc.vercel.app`

---

## 1. Executive Summary & System Overview

The **CBT Examination Platform** is an enterprise-grade Computer-Based Testing web application built to simulate national-level competitive exam formats such as **SSC CGL/CHSL**, **IBPS PO/Clerk**, **Railways RRB**, and **State PSC** examinations.

### Core Capabilities
- **High Concurrency:** Capable of sustaining simultaneous burst examination sessions from 100+ students.
- **Official Exam Experience:** Exact SSC/IBPS palette navigation, section switching, real-time countdown clock, and automated paper submission.
- **Anti-Cheat & Re-Attempt Locking:** Client-side lockouts and immutable result generation prevent answer tampering or duplicate submissions.
- **Dynamic Exam Routing:** Students logging in are routed straight into the most recent examination published by the faculty.
- **Monetized Test Series Gate:** A protected `/dashboard` directory cataloging all exams, accessible only when unlocked by the Superadmin.
- **Granular Multi-Tiered RBAC:** Strict separation of privileges between Superadmin, Faculty Admin, and Students.
- **Faculty Accountability Audit Trail:** Every uploaded question logs the uploading faculty member's name and renders an attribution badge.

---

## 2. Technology Stack & Architectural Decisions

| Layer | Technology | Version | Rationale & Configuration |
|---|---|---|---|
| **Framework** | Next.js (App Router) | `16.3.5` | React Server Components, server actions, route handlers, dynamic edge routing |
| **UI Library** | React | `19.2.8` | Latest React engine with native client-side hooks |
| **Styling** | Tailwind CSS | `4.x` | Modern utility CSS |
| **Database ORM** | Prisma | `5.14.0` | Type-safe PostgreSQL client, schema validation, and database push |
| **Database** | PostgreSQL (Supabase) | `AWS ap-northeast-1` | Cloud relational database with connection pooling |
| **Connection Pooler** | PgBouncer | Port `6543` | Multiplexes 100+ concurrent student connections |
| **Authentication** | NextAuth.js | `5.0.0-beta.25` | Google OAuth 2.0 (Superadmin) + Credentials Provider (Faculty Admin) |
| **Bundler Engine** | Webpack (`--webpack`) | N/A | **Crucial:** Next.js 16 Turbopack has a PostCSS parser bug on macOS; dev script must use `next dev --webpack` |
| **Deployment / CI** | Vercel | Vercel CLI | Automated CI/CD linked to GitHub repository `main` branch |

---

## 3. High-Concurrency Database Architecture

Competitive examinations produce burst traffic patterns: all examinees authenticate simultaneously, load all question data within seconds, and submit at the timer expiration.

### Dual-Connection Architecture (Supabase + PgBouncer)
Configured in `prisma/schema.prisma`:
- **`DATABASE_URL` (Port 6543, `?pgbouncer=true`):** Used for all application reads and writes. PgBouncer transaction pooling multiplexes connections, allowing 100+ students to interact with the database on minimal compute.
- **`DIRECT_URL` (Port 5432):** Direct session connection used strictly for Prisma schema pushes (`prisma db push`) and structural DDL modifications.

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

---

## 4. Database Schema Reference

```prisma
enum Role {
  STUDENT
  ADMIN
  SUPERADMIN
}

model User {
  id              Int        @id @default(autoincrement())
  rollNo          String     @unique
  name            String
  email           String?    @unique
  password        String     @default("123456")
  role            Role       @default(STUDENT)
  dashboardAccess Boolean    @default(false)
  responses       Response[]
  results         Result[]
}

model Exam {
  id            Int        @id @default(autoincrement())
  title         String
  duration      Int        // Duration in minutes
  totalMarks    Int
  negativeMarks Float      @default(0)
  questions     Question[]
  results       Result[]
}

model Question {
  id            Int        @id @default(autoincrement())
  examId        Int
  exam          Exam       @relation(fields: [examId], references: [id])
  section       String
  text          String
  optionA       String
  optionB       String
  optionC       String
  optionD       String
  correctOption String     // "A", "B", "C", or "D"
  marks         Int        @default(1)
  addedBy       String?    // Faculty name audit trail
  createdAt     DateTime   @default(now())
  responses     Response[]
}

model Response {
  id             Int      @id @default(autoincrement())
  userId         Int
  user           User     @relation(fields: [userId], references: [id])
  questionId     Int
  question       Question @relation(fields: [questionId], references: [id])
  selectedOption String?
  status         String
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@unique([userId, questionId])
}

model Result {
  id              Int      @id @default(autoincrement())
  userId          Int
  user            User     @relation(fields: [userId], references: [id])
  examId          Int
  exam            Exam     @relation(fields: [examId], references: [id])
  score           Float
  correctCount    Int
  incorrectCount  Int
  unansweredCount Int
  createdAt       DateTime @default(now())

  @@unique([userId, examId])
}
```

---

## 5. Authentication & Role-Based Access Control (RBAC)

### Access Control Matrix

| Operational Permission | STUDENT | ADMIN (Faculty) | SUPERADMIN (Owner) |
|---|:---:|:---:|:---:|
| Take Assigned Mock Exams | ✅ Yes | ❌ No | ❌ No |
| View Test Series Dashboard (`/dashboard`) | 🔒 Paid Only | ❌ No | ✅ Yes |
| Create New Exams | ❌ No | ✅ Yes | ✅ Yes |
| Add / Delete Questions (With Name Tag) | ❌ No | ✅ Yes (Own tag) | ✅ Yes |
| Manage Students (Add, Delete, Reset Password) | ❌ No | ✅ Yes | ✅ Yes |
| Toggle Student Dashboard Access (Paid) | ❌ Blocked | ❌ Blocked | 👑 Sole Authority |
| Delete Whole Exam & Cascading Data | ❌ Blocked | ❌ Blocked | 👑 Sole Authority |
| Grant / Revoke Admin Privileges (`/admin/users`) | ❌ Blocked | ❌ Blocked | 👑 Sole Authority |
| Authentication Scheme | Roll No + Pwd | Admin ID + Pwd + Name | Google OAuth 2.0 |

### Administrative Authentication (`src/auth.ts`)
1. **Superadmin (Google OAuth):**
   - Whitelist restricted: Only `sudarshan.contactwebdev@gmail.com` can sign in.
   - Any other Google identity is rejected automatically in the `signIn` callback.
2. **Faculty Admin (Credentials Provider):**
   - Shared Admin ID: `ADMIN` | Shared Password: `adminpassword123`
   - Mandatory input: **Full Name** (`fullName`).
   - The session adopts this name: `session.user.name = credentials.fullName`.
   - All questions created by this session save `addedBy: session.user.name`.

---

## 6. Exam Delivery Engine & Candidate Workflow

### Question Palette States (SSC/IBPS Specification)
- **Answered (Green):** Candidate selected an option and clicked *Save & Next*.
- **Not Answered (Red):** Candidate visited the question but moved on without answering.
- **Marked for Review (Purple):** Candidate flagged question without an answer.
- **Answered & Marked for Review (Purple with Green Accent):** Candidate selected an option and flagged for review (counted in final evaluation).
- **Not Visited (Gray):** Candidate has not opened the question yet.

### Post-Submission Locking
1. Submitting invokes `POST /api/submit`, computing total score, negative deductions, and persisting a `Result` record.
2. When fetching `/api/exam/[id]?userId=...`, the server verifies whether a `Result` exists for `[userId, examId]`.
3. If found, the exam engine renders the locked scorecard directly, preventing duplicate submissions or answer alteration.

### Dynamic Login Routing vs Test Series Dashboard
- **Default Route (`/login`):** Directs student to `GET /api/student/latest-exam`. Student enters the most recent paper published by teachers without navigation ambiguity.
- **Paid Test Library (`/dashboard`):** Shows all tests with past scores. If `dashboardAccess === false`, a locked screen is rendered instructing candidate to contact administration. Superadmin toggles access via `/admin/students`.

---

## 7. Complete API Route Reference

| Route | Method | Access Level | Description |
|---|:---:|---|---|
| `/api/login` | `POST` | Public | Validates student Roll No and Password. Returns user object. |
| `/api/student/latest-exam` | `GET` | Public / Student | Returns `{ examId }` of the most recently created exam paper. |
| `/api/student/exams` | `GET` | Student | Accepts `?userId=X`. Returns list of all exams and candidate results. |
| `/api/student/dashboard-access` | `POST` | Student | Checks if student has `dashboardAccess: true`. |
| `/api/exam/[id]` | `GET` | Candidate / Admin | Fetches exam questions. Strips `correctOption` for non-admin users. |
| `/api/submit` | `POST` | Candidate | Evaluates submitted answers, deducts negative marks, and saves `Result`. |
| `/api/admin/exam` | `GET`, `POST` | Admin / Superadmin | Lists exams or creates new exam (`title`, `duration`, `marks`, `negMarks`). |
| `/api/admin/exam/[id]` | `DELETE` | **Superadmin Only** | Cascades and removes responses, results, questions, and the exam. |
| `/api/admin/question` | `POST` | Admin / Superadmin | Creates question with option A-D, answer, and faculty `addedBy` tag. |
| `/api/admin/question/[id]` | `DELETE` | Admin / Superadmin | Deletes question and related student responses. |
| `/api/admin/students` | `GET`, `POST` | Admin / Superadmin | Lists all students or registers a new student (`name`, `rollNo`, `pwd`). |
| `/api/admin/students/[id]` | `DELETE`, `PATCH` | Admin / Superadmin | Deletes student, resets password, or toggles `dashboardAccess` (Superadmin). |
| `/api/admin/users` | `GET`, `PATCH` | **Superadmin Only** | Lists staff members and grants/revokes `ADMIN` role. |
| `/api/auth/[...nextauth]` | `GET`, `POST` | NextAuth Handler | NextAuth OAuth callbacks and credentials authentication. |

---

## 8. Directory & File Manifest

```
cbt-exam-software/
├── .gitignore                      # Blocks .env, dev.db, node_modules, .next
├── .npmrc                          # legacy-peer-deps=true (NextAuth v5 beta compatibility)
├── package.json                    # Scripts and dependencies
├── next.config.ts                  # Next.js configuration
├── prisma/
│   ├── schema.prisma               # PostgreSQL datasource & entity models
│   └── seed.mjs                    # Superadmin, shared Admin, and demo exam seed
├── src/
│   ├── auth.ts                     # NextAuth v5 configuration & RBAC rules
│   └── app/
│       ├── layout.tsx              # Root layout with required branding
│       ├── providers.tsx           # Client SessionProvider wrapper
│       ├── page.tsx                # Redirects / to /login
│       ├── login/page.tsx          # Student login form (routes to latest exam)
│       ├── dashboard/page.tsx      # Paid student test series library (locked by default)
│       ├── exam/[id]/page.tsx      # SSC/IBPS examination engine & result view
│       ├── admin-login/page.tsx    # Admin login (Google SSO & Faculty credentials)
│       ├── admin/
│       │   ├── layout.tsx          # Server Component route guard (ADMIN/SUPERADMIN)
│       │   ├── page.tsx            # Admin dashboard, exam creator & exam deletion
│       │   ├── exam/[id]/page.tsx  # Question authoring with faculty attribution
│       │   ├── students/page.tsx   # Student directory & Superadmin dashboard toggle
│       │   └── users/page.tsx      # Superadmin privilege management console
│       └── api/                    # Route handlers (detailed in Section 7)
```

---

## 9. Environment Variables & Deployment

### Required Environment Variables (Vercel)

| Variable Key | Type | Description |
|---|:---:|---|
| `DATABASE_URL` | Secret | Supabase PgBouncer pooler URL (port `6543`, with `?pgbouncer=true`) |
| `DIRECT_URL` | Secret | Supabase direct connection URL (port `5432`) |
| `GOOGLE_CLIENT_ID` | Secret | Google Cloud Console OAuth 2.0 Web Client ID |
| `GOOGLE_CLIENT_SECRET` | Secret | Google Cloud Console OAuth 2.0 Web Client Secret |
| `NEXTAUTH_SECRET` | Secret | Secret string: `cbt-exam-sudarshan-2026-secret` |
| `NEXTAUTH_URL` | Config | `https://cbtfor-dsc.vercel.app` |

### Vercel Build Pipeline
The `build` script in `package.json` runs:
```bash
prisma generate && prisma db push --accept-data-loss && node prisma/seed.mjs && next build
```
- `--accept-data-loss`: Ensures non-destructive schema additions deploy automatically without blocking the build.
- `seed.mjs`: Uses `upsert` queries so seeding is idempotent and safe to run on every deploy.

### Google Cloud Console Configuration
- **Authorized JavaScript Origins:** `https://cbtfor-dsc.vercel.app` (Strictly origin only)
- **Authorized Redirect URIs:** `https://cbtfor-dsc.vercel.app/api/auth/callback/google`

---

## 10. Developer Quick Start

```bash
# 1. Clone repository
git clone https://github.com/Sudarshan180392/cbtforDSC.git
cd cbtforDSC

# 2. Install dependencies
npm install

# 3. Configure environment
# Ensure .env contains DATABASE_URL, DIRECT_URL, NEXTAUTH_SECRET, etc.

# 4. Generate Prisma client & sync schema
npx prisma generate
npx prisma db push --accept-data-loss

# 5. Seed database
node prisma/seed.mjs

# 6. Start development server (MUST use --webpack)
npm run dev
```

### Pre-Configured Test Credentials
- **Superadmin:** `sudarshan.contactwebdev@gmail.com` (Google Sign-In)
- **Staff Admin:** ID: `ADMIN` | Password: `adminpassword123` | Enter any name in Full Name box
- **Demo Student:** Roll No: `SSC20260001` | Password: `password123`
