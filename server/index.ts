import "dotenv/config";
import express, { type Response } from "express";
import authRoutes from "./routes/auth.routes.js";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.status(200).json({ ok: true }));
app.use("/api/auth", authRoutes);

app.use((_req, res) => res.status(400).json({ error: "not found" }));
app.use((err : any, _req, res: Response, _next) => {
	console.error(err);
	res.status(err.status ?? 500).json({ message: "something is wrong.." });
})

app.listen(3000, () => console.log(`server running on ${3000}`));