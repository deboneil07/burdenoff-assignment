# Habit Tracker with Streaks

A full-stack habit tracker where users define habits, check in once per local day, and see their current and longest streaks. The core design constraint: **streaks are measured in the user's own local days, not in elapsed hours.**

## Table of Contents

- [Setup](#setup)
- [How Local Days Work](#how-local-days-work)
- [Streak Algorithm](#streak-algorithm)
- [API Endpoints](#api-endpoints)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [Design Decisions](#design-decisions)

---

## Setup

### Prerequisites

- Node.js 18+
- Docker (for Postgres)

### 1. Start the database

```bash
cd server
docker compose up -d
```

This starts Postgres 16 on `localhost:5432` with a persistent named volume.

### 2. Set up the backend

```bash
cd server
cp .env.example .env   # or create .env manually (see below)
npm install
npx prisma migrate dev --name init
npm run dev
```

The server runs on `http://localhost:3000`.

**`.env` file:**

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/habit_tracker?schema=public"
JWT_SECRET="your-secret-here"
```

### 3. Set up the frontend

```bash
cd client
npm install
npm run dev
```

The frontend runs on `http://localhost:5173`.

---

## How Local Days Work

This is the central design problem in the assignment. Two check-ins 20 hours apart may fall on the same or different local days depending on the user's timezone. Only one check-in per habit per local day ever counts.

### The problem

Consider a user in `Asia/Kolkata` (UTC+05:30):

| Check-in | UTC timestamp | Local time | Local day |
|----------|--------------|------------|-----------|
| A | 2026-03-10T14:30Z | 20:00 | 2026-03-10 |
| B | 2026-03-11T10:30Z | 16:00 | 2026-03-11 |
| C | 2026-03-11T21:30Z | 03:00 (+1) | **2026-03-12** |
| D | 2026-03-12T17:30Z | 23:00 | **2026-03-12** (duplicate of C) |

- A→B: 20 hours apart, but **different local days** → streak = 2
- B→C: 11 hours apart, but **a new local day** → streak = 3
- C→D: 20 hours apart, but **same local day** → duplicate, streak stays 3

### Our solution: two-field storage

Each check-in stores **two things** in the database:

1. `occurredAt` (DateTime, UTC) — the actual instant it happened, the audit trail
2. `localDay` (String, `YYYY-MM-DD`) — which local day it counts for, derived server-side

This separation is critical. The UTC instant is when it happened; the `localDay` is what the streak algorithm operates on.

### How `localDay` is derived

In `server/lib/days.ts`, the `toLocalDay` function uses the JavaScript `Intl.DateTimeFormat` API with the `en-CA` locale:

```ts
export function toLocalDay(instant: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}
```

The `en-CA` locale formats dates as `YYYY-MM-DD` (ISO 8601), so one API call gives us the exact string we store. This approach:

- **Handles DST automatically** — on a 23-hour or 25-hour day, `Intl.DateTimeFormat` resolves what "the date" is in that timezone at that instant
- **Never shifts by ±1 day** — unlike `new Date("2026-03-10")` which interprets the string as local midnight on the *server's* timezone
- **Is timezone-aware** — the `timeZone` option delegates to the OS's IANA timezone database

### Why `localDay` is a String, not a DateTime

Storing `localDay` as `"2026-03-10"` (a plain string) instead of a `DateTime @db.date` avoids silent timezone shifts during serialization. A `Date` object carries time internally, and date-only values can shift by ±1 day when Postgres/Prisma round-trips them. A plain string is unambiguous, trivially sortable, and makes the streak logic pure and testable.

### How duplicates are prevented

Two layers:

1. **Database-level** (schema.prisma): `@@unique([habitId, localDay])` — Postgres rejects any second row with the same habit + local day. This catches race conditions even if application logic has a bug.
2. **Application-level** (check-in route): The server derives `localDay` server-side from the user's stored timezone. The client never sends `localDay` directly — only an optional date string for backfill.

Both layers reject with appropriate HTTP status codes (409 Conflict for duplicates).

### Timezone updates

If a user changes their timezone, **historical check-ins keep their original `localDay`**. This is correct: a check-in earned under `Asia/Kolkata` should not shift to a different day just because the user moved to `UTC`. Only new check-ins use the updated timezone.

---

## Streak Algorithm

Implemented in `server/lib/streaks.ts` as a pure function with no database dependency:

```ts
computeStreaks(days: string[], today: string): { currentStreak, longestStreak }
```

**How it works:**

1. Deduplicate and sort `localDay` strings chronologically (lexicographic sort works because ISO dates are naturally ordered)
2. **Longest streak**: walk all days, count consecutive runs (gap of exactly 1 day between entries)
3. **Current streak**: anchor at today (if logged) or yesterday (if logged); count consecutive days backwards from the anchor. If neither today nor yesterday is logged, the streak is dead (current = 0)

**Key rule**: a streak is only "alive" if it ends at today or yesterday. Three days ago does not count as alive even if there were 100 consecutive days before it.

**Why it's pure**: `computeStreaks` takes plain strings, returns plain numbers. No DB calls, no timezone logic, no Express dependencies. This makes it trivially unit-testable — the SOP's requirement for "testable/isolated local-day logic."

---

## API Endpoints

All protected endpoints require `Authorization: Bearer <token>` header.

### Auth

| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| POST | `/api/auth/signup` | `{ email, password, timezone }` | `{ user, token }` |
| POST | `/api/auth/login` | `{ email, password }` | `{ user, token }` |

### Habits

| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| GET | `/api/habits` | — | `{ habits: [...], today }` |
| POST | `/api/habits` | `{ name, description? }` | `{ habit }` |
| PATCH | `/api/habits/:id` | `{ name?, description? }` | `{ habit }` |
| DELETE | `/api/habits/:id` | — | `204 No Content` |

Each habit in the GET response includes `currentStreak`, `longestStreak`, and `checkedInToday`.

### Check-ins

| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| POST | `/api/habits/:id/check-ins` | `{ date?: "YYYY-MM-DD" }` | `{ checkedInFor, currentStreak, longestStreak }` |
| GET | `/api/habits/:id/check-ins` | query: `?page=1&limit=10` | `{ checkIns: [...], pagination }` |

**POST validation rules** (all enforced server-side):

1. **Ownership**: habit must belong to the authenticated user
2. **No duplicates**: rejects if `localDay` already has a check-in (P2002 → 409)
3. **No future dates**: `localDay` must not be after today in the user's timezone
4. **No pre-creation dates**: `localDay` must not be before the habit's creation date in the user's timezone

---

## Project Structure

```
burdenoff-assignment/
├── .gitignore
├── server/
│   ├── docker-compose.yml          # Postgres 16 with persistent volume
│   ├── .env                        # DATABASE_URL, JWT_SECRET
│   ├── index.ts                    # Express app entry point
│   ├── prisma/
│   │   └── schema.prisma           # User, Habit, CheckIn models
│   ├── lib/
│   │   ├── prisma.ts               # PrismaClient singleton
│   │   ├── auth.ts                 # bcrypt + JWT helpers
│   │   ├── days.ts                 # Pure local-day functions (toLocalDay, todayIn, daysBetween)
│   │   └── streaks.ts              # Pure streak computation
│   ├── middleware/
│   │   └── auth.ts                 # JWT verification middleware
│   ├── validators/
│   │   ├── schema.ts               # Zod schemas for all endpoints
│   │   └── validate.ts             # Reusable validation middleware
│   └── routes/
│       ├── auth.routes.ts          # Signup, login
│       └── habits.routes.ts        # Habits CRUD + check-in creation + history
└── client/
    └── src/
        ├── api/client.ts           # Fetch wrapper with token injection
        ├── context/AuthContext.tsx  # Auth state management
        ├── protected.tsx           # Route guard
        ├── pages/
        │   ├── LoginPage.tsx
        │   ├── SignupPage.tsx
        │   ├── DashboardPage.tsx   # Habit list + streaks + one-click check-in
        │   └── HabitDetailPage.tsx # History view + backfill + pagination
        └── components/
            ├── HabitCard.tsx       # Habit card with streak badges
            ├── CreateHabitModal.tsx
            └── ErrorMessage.tsx
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Database | PostgreSQL 16 (Docker) |
| ORM | Prisma 5 |
| Backend | Express 5, TypeScript, Node.js |
| Auth | bcryptjs (passwords), JWT (tokens) |
| Validation | Zod 4 |
| Frontend | React 19, Vite 8, TypeScript |
| Routing | React Router 7 |

---

## Design Decisions

### Why server-side streak computation

The SOP explicitly requires: "The frontend must never decide if a streak is alive." Streaks are computed in the `GET /api/habits` handler and returned as integers. The frontend displays numbers; it never evaluates date logic.

### Why Express 5

Express 5 natively handles rejected promises from async route handlers (forwarding them to error middleware). This eliminates the common Express 4 pattern of wrapping every handler in try/catch.

### Why `localDay` is derived server-side, not sent by the client

If the client computed and sent `localDay`, a malicious or buggy client could:
- Send a future date to fake a streak
- Send a date before the habit existed
- Bypass the one-per-day rule by sending a different `localDay` for the same real day

By deriving `localDay` from the user's stored timezone + the optional date string, the server is the single source of truth.

### Database-level uniqueness

`@@unique([habitId, localDay])` in the Prisma schema means Postgres itself enforces the one-check-in-per-day rule. Even if application code has a bug or a race condition, the database rejects the duplicate. This is both a correctness guarantee and a bonus point in the SOP.

### `Date.UTC` for day comparison

When parsing `"YYYY-MM-DD"` strings for streak walking, we use `Date.UTC(y, m-1, d)` instead of `new Date("YYYY-MM-DD")`. The latter interprets the string as local midnight on the *server's* timezone, which can shift the day by ±1 depending on where the server is deployed. `Date.UTC` makes the mapping deterministic regardless of server location.
