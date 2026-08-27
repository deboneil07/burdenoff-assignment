import express, { type Response } from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes.ts";
import habitRoutes from "./routes/habits.routes.ts";

const app = express();
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

app.get("/health", (_req, res) => res.status(200).json({ ok: true }));
app.use("/api/auth", authRoutes);
app.use("/api/habits", habitRoutes);

app.use((_req, res) => res.status(404).json({ error: "not found" }));
app.use((err : any, _req: any, res: Response, _next: any) => {
	console.error(err);
	res.status(err.status ?? 500).json({ message: "something is wrong.." });
})

export default app;
