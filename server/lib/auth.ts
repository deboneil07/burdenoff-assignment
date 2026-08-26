import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const BCRYPT_ROUNDS = 10;

export function hashPassword(plain: string): Promise<string> {
	return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
	return bcrypt.compare(plain, hash);
}

export interface JwtPayload {
	userId: string
}

export function signToken(payload: JwtPayload): string {
	return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: "7d" });
}

export function verifyToken(token: string): JwtPayload | null {
	try {
		return jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
	} catch {
		return null;
	}
}