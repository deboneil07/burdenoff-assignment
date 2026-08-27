import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "./app";
import { prisma } from "./lib/prisma";
import { todayIn } from "./lib/days";

const TEST_EMAIL = `test-${Date.now()}@example.com`;
const TEST_PASSWORD = "password123";
const TEST_TIMEZONE = "Asia/Kolkata";

// Compute dates relative to the user's timezone, not UTC.
// Using UTC-based new Date() can drift by a day when the server is late evening UTC
// but early next day in the user's timezone.
function daysAgo(days: number): string {
  const today = todayIn(TEST_TIMEZONE); // "YYYY-MM-DD" in user's tz
  const [y, m, d] = today.split("-").map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - days);
  return dt.toISOString().split("T")[0]!;
}

let token: string;
let habitId: string;

beforeAll(async () => {
  // signup
  const signup = await request(app)
    .post("/api/auth/signup")
    .send({ email: TEST_EMAIL, password: TEST_PASSWORD, timezone: TEST_TIMEZONE });
  expect(signup.status).toBe(201);
  token = signup.body.token;
});

afterAll(async () => {
  // cleanup all test data (including backfill habit)
  const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
  if (user) {
    await prisma.checkIn.deleteMany({ where: { habit: { userId: user.id } } });
    await prisma.habit.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
  // also cleanup other test users created during tests
  const testUsers = await prisma.user.findMany({
    where: { email: { contains: "test-" } },
  });
  for (const u of testUsers) {
    await prisma.checkIn.deleteMany({ where: { habit: { userId: u.id } } });
    await prisma.habit.deleteMany({ where: { userId: u.id } });
    await prisma.user.delete({ where: { id: u.id } });
  }
  await prisma.$disconnect();
});

describe("Auth", () => {
  it("signup creates a new user and returns token", () => {
    // already done in beforeAll, just verify token exists
    expect(token).toBeTruthy();
    expect(typeof token).toBe("string");
  });

  it("signup rejects duplicate email", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD, timezone: TEST_TIMEZONE });
    expect(res.status).toBe(409);
  });

  it("signup rejects invalid timezone", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ email: "other@test.com", password: TEST_PASSWORD, timezone: "Mars/Olympus" });
    expect(res.status).toBe(400);
  });

  it("signup rejects short password", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ email: "other@test.com", password: "short", timezone: "UTC" });
    expect(res.status).toBe(400);
  });

  it("login returns token with correct credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });

  it("login rejects wrong password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: TEST_EMAIL, password: "wrongpassword" });
    expect(res.status).toBe(401);
  });

  it("login rejects non-existent email", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: TEST_PASSWORD });
    expect(res.status).toBe(401);
  });
});

describe("Habits", () => {
  it("creates a habit", async () => {
    const res = await request(app)
      .post("/api/habits")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Drink water", description: "Stay hydrated" });
    expect(res.status).toBe(200);
    expect(res.body.habit.name).toBe("Drink water");
    habitId = res.body.habit.id;
  });

  it("lists habits with streaks", async () => {
    const res = await request(app)
      .get("/api/habits")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.habits).toHaveLength(1);
    expect(res.body.habits[0].currentStreak).toBeDefined();
    expect(res.body.habits[0].longestStreak).toBeDefined();
    expect(res.body.habits[0].checkedInToday).toBe(false);
    expect(res.body.today).toBeTruthy();
  });

  it("rejects request without auth", async () => {
    const res = await request(app).get("/api/habits");
    expect(res.status).toBe(401);
  });

  it("updates a habit", async () => {
    const res = await request(app)
      .patch(`/api/habits/${habitId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Drink 8 glasses of water" });
    expect(res.status).toBe(200);
    expect(res.body.habit.name).toBe("Drink 8 glasses of water");
  });

  it("returns 404 for other user's habit", async () => {
    // create a second user
    const signup2 = await request(app)
      .post("/api/auth/signup")
      .send({ email: `other-${Date.now()}@test.com`, password: TEST_PASSWORD, timezone: "UTC" });
    const token2 = signup2.body.token;

    const res = await request(app)
      .patch(`/api/habits/${habitId}`)
      .set("Authorization", `Bearer ${token2}`)
      .send({ name: "Hacked!" });
    expect(res.status).toBe(404);
  });
});

describe("Check-ins", () => {
  let backfillHabitId: string;

  beforeAll(async () => {
    // Insert a habit with createdAt = 5 days ago via Prisma directly
    // so we can backfill past dates without hitting "before creation" validation
    const createdAt = new Date(daysAgo(5) + "T12:00:00Z");

    const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
    const habit = await prisma.habit.create({
      data: {
        userId: user!.id,
        name: "Read a book",
        createdAt,
      },
    });
    backfillHabitId = habit.id;
  });

  it("creates a check-in for today", async () => {
    const res = await request(app)
      .post(`/api/habits/${habitId}/check-ins`)
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(201);
    expect(res.body.checkedInFor).toBeTruthy();
    expect(res.body.currentStreak).toBe(1);
    expect(res.body.longestStreak).toBe(1);
  });

  it("rejects duplicate check-in for same day", async () => {
    const res = await request(app)
      .post(`/api/habits/${habitId}/check-ins`)
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(409);
  });

  it("rejects future date", async () => {
    const res = await request(app)
      .post(`/api/habits/${habitId}/check-ins`)
      .set("Authorization", `Bearer ${token}`)
      .send({ date: "2099-01-01" });
    expect(res.status).toBe(400);
  });

  it("rejects date before habit creation", async () => {
    const res = await request(app)
      .post(`/api/habits/${habitId}/check-ins`)
      .set("Authorization", `Bearer ${token}`)
      .send({ date: "2020-01-01" });
    expect(res.status).toBe(400);
  });

  it("allows backfill for yesterday on a habit created in the past", async () => {
    const dateStr = daysAgo(1);

    const res = await request(app)
      .post(`/api/habits/${backfillHabitId}/check-ins`)
      .set("Authorization", `Bearer ${token}`)
      .send({ date: dateStr });
    expect(res.status).toBe(201);
    expect(res.body.currentStreak).toBe(1);
  });

  it("allows backfill for 3 days ago on the same habit", async () => {
    const dateStr = daysAgo(3);

    const res = await request(app)
      .post(`/api/habits/${backfillHabitId}/check-ins`)
      .set("Authorization", `Bearer ${token}`)
      .send({ date: dateStr });
    expect(res.status).toBe(201);
    expect(res.body.currentStreak).toBe(1); // yesterday is alive (consecutive with today), 3 days ago is a separate run
  });

  it("returns check-in history with pagination", async () => {
    const res = await request(app)
      .get(`/api/habits/${habitId}/check-ins`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.checkIns.length).toBe(1);
    expect(res.body.pagination.total).toBe(1);
    expect(res.body.pagination.totalPages).toBe(1);
  });

  it("habits list shows checkedInToday = true after check-in", async () => {
    const res = await request(app)
      .get("/api/habits")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    const habit = res.body.habits.find((h: any) => h.id === habitId);
    expect(habit.checkedInToday).toBe(true);
  });
});
