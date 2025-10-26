// server.js (ESM)
import express from "express";
import path from "path";
import fs from "fs";

const app = express();
const ROOT = process.cwd();
const PORT = Number(process.env.PORT) || 8080;

// Раздаём статику из корня (index:false — чтобы SPA-fallback работал)
app.use(express.static(ROOT, { index: false }));

// Простой healthcheck
app.get("/healthz", (_req, res) => res.json({ ok: true, ts: Date.now() }));

// SPA fallback: отдаём index.html на любые HTML-роуты
app.get("*", (req, res, next) => {
  if (req.path.includes(".")) return next(); // не трогаем файлы с расширением
  const file = path.join(ROOT, "index.html");
  if (!fs.existsSync(file)) return res.status(404).send("index.html not found");
  res.sendFile(file);
});

app.listen(PORT, () => console.log(`Listening on http://localhost:${PORT}`));
