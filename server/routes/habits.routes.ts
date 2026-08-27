import { Router, type Request, type Response } from "express";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { validate } from "../validators/validate.js";
import { checkInSchema, createHabitSchema, updateHabitSchema } from "../validators/schema.js";
import { todayIn, toLocalDay } from "../lib/days.js";
import { computeStreaks } from "../lib/streaks.js";

const router = Router();
router.use(requireAuth);

async function findOwned(habitId: string, userId: string) {
	const habit = await prisma.habit.findFirst({
		where: { id: habitId, userId }
	});

	return habit;
}

router.post("/", validate(createHabitSchema), async (req: Request, res: Response, next) => {
	try {
		const habit = await prisma.habit.create({
			data: { name: req.body.name, description: req.body.description, userId: req.userId! },
			select: { id: true, name: true, description: true, createdAt: true },
		});

		res.status(200).json({ habit });
	} catch (err: any) {
		next(err);
	}
});

router.get("/", async (req, res, next) => {
	try {
		const user = await prisma.user.findUniqueOrThrow({
			where: { id: req.userId! },
			select: { timezone: true },
		});
		const today = todayIn(user.timezone);

		const habits = await prisma.habit.findMany({
			where: { userId: req.userId! },
			select: {
				id: true, name: true, description: true, createdAt: true, checkIns: {
					select: { localDay: true }
				},
			},
			orderBy: { createdAt: "desc" },
		});

		const result = habits.map((h) => {
			const days = h.checkIns.map((c) => c.localDay);
			const { currentStreak, longestStreak } = computeStreaks(days, today);

			return {
				id: h.id,
				name: h.name,
				description: h.description,
				createdAt: h.createdAt,
				checkedInToday: days.includes(today),
				currentStreak,
				longestStreak,
			};
		});

		res.status(200).json({ habits: result, today });
	} catch (err: any) {
		next(err);
	}
});

router.post("/:id/check-ins", validate(checkInSchema) ,async (req, res, next) => {
	try {
		const { id: habitId } = req.params;
		const userId = req.userId!;

		const habit = await prisma.habit.findFirst({
			where: { id: habitId, userId },
			select: { id: true, createdAt: true }
		});
		if (!habit) {
			return res.status(404).json({ message: "Habit not found" });
		}

		const user = await prisma.user.findUniqueOrThrow({
			where: { id: userId },
			select: { timezone: true },
		});

		const today = todayIn(user.timezone);
		let targetDay: string;
		if (req.body.date) {
			targetDay = req.body.date;
		} else {
			targetDay = today;
		}

		if (targetDay > today) {
			return res.status(400).json({ error: "cannot check in for a future date." });
		}

		const habitCreatedLocalDate = toLocalDay(habit.createdAt, user.timezone);
		if (targetDay < habitCreatedLocalDate) {
			return res.status(400).json({ error: "date is set before the creation date." });
		}

		try {
			await prisma.checkIn.create({
				data: {
					habitId: habitId,
					localDay: targetDay,
					occurredAt: new Date(),
				},
			});
		} catch (err: any) {
			if (err?.code === "P2002") {
				return res.status(409).json({ error: "already checked-in for today" });
			}

			throw err;
		}

		const allDays = await prisma.checkIn.findMany({
			where: { habitId },
			select: { localDay: true }
		});

		const streaks = computeStreaks(allDays.map((c) => c.localDay), today);
		res.status(201).json({
			checkedInFor: targetDay,
			...streaks,
		});
	} catch (err) {
		next(err);
	}
})

router.get("/:id/check-ins", async (req, res, next) => {
	try {
		const { id: habitId } = req.params;
		const userId = req.userId;

		const habit = await prisma.habit.findFirst({
			where: { id: habitId, userId },
			select: { id: true },
		});
		if (!habit) {
			return res.status(404).json({ message: "habit not found!" });
		}

		const page = Math.max(parseInt(req.query.page as string) || 1, 1);
		const limit = Math.min(parseInt(req.query.limit as string) || 30, 100);
		const skip = (page - 1) * limit;

		const [checkIns, total] = await Promise.all([
			prisma.checkIn.findMany({
				where: { habitId },
				select: { id: true, localDay: true, createdAt: true, occurredAt: true },
				orderBy: { localDay: "desc" },
				skip,
				take: limit,
			}),
			prisma.checkIn.count({
				where: { habitId }
			}),
		]);

		res.json({
			checkIns,
			pagination: {
				page, limit, total, totalPages: Math.ceil(total / limit),
			},
		});
	} catch (err: any) {
		next(err);
	}
});

router.patch("/:id", validate(updateHabitSchema), async (req, res, next) => {
	try {
		const habit = await findOwned(req.params.id!, req.userId!);
		if (!habit) {
			return res.status(404).json({ message: "not available" });
		}

		const updated = await prisma.habit.update({
			where: { id: habit.id },
			data: req.body,
			select: { id: true, name: true, description: true, createdAt: true },
		});

		res.json({ habit: updated });
	} catch (err) {
		next(err);
	}
});

router.delete("/:id", async (req, res, next) => {
	try {
		const habit = await findOwned(req.params.id!, req.userId!);
		if (!habit) {
			return res.status(404).json({ message: "not available" });
		}

		await prisma.habit.delete({
			where: { id: habit.id }
		});
		res.status(204).end();
	} catch (err) {
		next(err);
	}
});

export default router;