const BASE = "http://localhost:3000/api";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("token");
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    localStorage.removeItem("token");
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }

  if (res.status === 204) return null as T;

  const body = await res.json();

  if (!res.ok) {
    throw new Error(body.error || "Something went wrong");
  }

  return body as T;
}

export interface AuthResponse {
  user: { id: string; email: string; timezone: string; createdAt?: string };
  token: string;
}

export interface Habit {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  checkedInToday: boolean;
  currentStreak: number;
  longestStreak: number;
}

export interface HabitsResponse {
  habits: Habit[];
  today: string;
}

export interface CheckIn {
  id: string;
  localDay: string;
  occurredAt: string;
  createdAt: string;
}

export interface CheckInHistoryResponse {
  checkIns: CheckIn[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CheckInResponse {
  checkedInFor: string;
  currentStreak: number;
  longestStreak: number;
}

export const api = {
  login: (data: { email: string; password: string }) =>
    request<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify(data) }),

  signup: (data: { email: string; password: string; timezone: string }) =>
    request<AuthResponse>("/auth/signup", { method: "POST", body: JSON.stringify(data) }),

  habits: () => request<HabitsResponse>("/habits"),

  createHabit: (data: { name: string; description?: string }) =>
    request<{ habit: { id: string; name: string; description: string | null; createdAt: string } }>("/habits", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateHabit: (id: string, data: { name?: string; description?: string }) =>
    request<{ habit: { id: string; name: string; description: string | null; createdAt: string } }>(`/habits/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteHabit: (id: string) =>
    request<null>(`/habits/${id}`, { method: "DELETE" }),

  checkIn: (id: string, date?: string) =>
    request<CheckInResponse>(`/habits/${id}/check-ins`, {
      method: "POST",
      body: JSON.stringify(date ? { date } : {}),
    }),

  checkInHistory: (id: string, page = 1) =>
    request<CheckInHistoryResponse>(`/habits/${id}/check-ins?page=${page}`),
};
