import { Router, type NextFunction, type Response, type Request } from "express";
import { prisma } from "../lib/prisma.js";
import { hashPassword, signToken, verifyPassword } from "../lib/auth.js";
import { validate } from "../validators/validate.js";
import { loginSchema, signupSchema } from "../validators/schema.js";

const router = Router();

router.post("/signup", validate(signupSchema), async (req: Request, res: Response, next: NextFunction) => {
	const { email, password, timezone } = req.body;

	try {
		const user = await prisma.user.create({
			data: {
				email: email.toLowerCase(),
				password: await hashPassword(password),
				timezone,
			},
			select: { id: true, email: true, timezone: true, createdAt: true },
		});

		res.status(201).json({ user, token: signToken({ userId: user.id }) });
	} catch (err: any) {
		if (err?.code === "P2002") {
			return res.status(409).json({ message: "email already registered" });
		}
		next(err);
	}
});

router.post("/login", validate(loginSchema), async (req, res, next) => {
	const { email, password } = req.body;
	try {
		const user = await prisma.user.findUnique({
			where: { email: email.toLowerCase() },
		});
		if (!user || !(await verifyPassword(password, user.password))) {
			return res.status(401).json({ message: "Invalid creds" });
		}

		res.json({ user: { id: user.id, email: user.email, timezone: user.timezone }, token: signToken({ userId: user.id }), });
	} catch (err: any) {
		next(err);
	}
});

export default router;