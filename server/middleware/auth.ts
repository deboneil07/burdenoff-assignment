import type { NextFunction, Request, Response } from "express";
import { verifyToken } from "../lib/auth.js";

declare module "express-serve-static-core" {
	interface Request {
		userId?: string;
	}
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
	const header = req.headers.authorization;
	if (!header?.startsWith("Bearer ")) {
		return res.status(401).json({ message: "Missing bearer Token!" });
	}

	const payload = verifyToken(header.slice("Bearer ".length));
	if (!payload) {
		return res.status(401).json({ message: "Invalid or expired token" });
	}

	req.userId = payload.userId;
	next();
}