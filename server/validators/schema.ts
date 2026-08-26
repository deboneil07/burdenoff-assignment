import { z } from "zod";
import { isValidTimezone } from "../lib/days.js";

export const signupSchema = z.object({
	email: z.email(),
	password: z.string().min(8),
	timezone: z.string().refine(isValidTimezone, "Invalid IANA Timezone"),
});

export const loginSchema = z.object({
	email: z.email(),
	password: z.string().min(1),
});

export const createHabitSchema = z.object({
	name: z.string().min(1).max(100),
	description: z.string().max(500).optional(),
});

export const updateHabitSchema = createHabitSchema.partial();
export const checkInSchema = z.object({
	date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD").optional(),
});