import express from "express";
import cors from "cors";
import { pool } from "./db.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: "db_unreachable" });
  }
});

app.get("/scorecards", async (_req, res) => {
  const { rows } = await pool.query(
    "SELECT id, course_name, hole_count, total_par, total_score, created_at FROM scorecards ORDER BY created_at DESC"
  );
  res.json(rows);
});

app.post("/scorecards", async (req, res) => {
  const { course_name, hole_count, total_par, total_score, holes } = req.body || {};
  const { rows } = await pool.query(
    "INSERT INTO scorecards (course_name, hole_count, total_par, total_score, holes) VALUES ($1,$2,$3,$4,$5) RETURNING *",
    [course_name, hole_count, total_par, total_score, holes]
  );
  res.status(201).json(rows[0]);
});

app.delete("/scorecards/:id", async (req, res) => {
  await pool.query("DELETE FROM scorecards WHERE id = $1", [req.params.id]);
  res.status(204).end();
});

app.get("/active-rounds", async (_req, res) => {
  const { rows } = await pool.query(
    "SELECT id, course_name, hole_count, tee, started_at FROM active_rounds ORDER BY started_at DESC"
  );
  res.json(rows);
});

app.post("/active-rounds", async (req, res) => {
  const { course_name, hole_count, tee } = req.body || {};
  const { rows } = await pool.query(
    "INSERT INTO active_rounds (course_name, hole_count, tee) VALUES ($1,$2,$3) RETURNING *",
    [course_name, hole_count, tee]
  );
  res.status(201).json(rows[0]);
});

app.delete("/active-rounds/:id", async (req, res) => {
  await pool.query("DELETE FROM active_rounds WHERE id = $1", [req.params.id]);
  res.status(204).end();
});

app.get("/course-details", async (_req, res) => {
  const { rows } = await pool.query(
    "SELECT id, course_name, hole_count, tee, created_at FROM course_details ORDER BY created_at DESC"
  );
  res.json(rows);
});

app.post("/course-details", async (req, res) => {
  const { course_name, hole_count, tee } = req.body || {};
  const { rows } = await pool.query(
    "INSERT INTO course_details (course_name, hole_count, tee) VALUES ($1,$2,$3) RETURNING *",
    [course_name, hole_count, tee]
  );
  res.status(201).json(rows[0]);
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`API listening on ${port}`);
});
