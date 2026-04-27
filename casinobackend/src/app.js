/**
 * Casino Backend — Entry Point
 */

require("dotenv").config();
const express  = require("express");
const http     = require("http");
const cors     = require("cors");
const helmet   = require("helmet");
const rateLimit = require("express-rate-limit");

const pool = require("./db/pool");
const authRouter   = require("./routes/auth");
const gamesRouter  = require("./routes/games");
const walletRouter = require("./routes/wallet");
const adminRouter  = require("./routes/admin");
const { router: crashRouter, initCrash } = require("./routes/crash");
const blackjackRouter = require("./routes/blackjack");

const app    = express();
const server = http.createServer(app);
const PORT   = process.env.PORT || 4000;

// ─── Attach DB pool to every request ─────────────────────────────────────────
app.use((req, _res, next) => { req.db = pool; next(); });

// ─── Security & Parsing ───────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));
app.use(express.json());

// ─── Rate Limiters ────────────────────────────────────────────────────────────
const authLimiter = rateLimit({ windowMs: 15*60*1000, max: 20, message: { error: "Too many auth attempts" } });
const betLimiter  = rateLimit({ windowMs: 60*1000,    max: 120, message: { error: "Too many requests" } });
const genLimiter  = rateLimit({ windowMs: 60*1000,    max: 200, message: { error: "Too many requests" } });

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/auth",   authLimiter, authRouter);
app.use("/api/games",  betLimiter,  gamesRouter);
app.use("/api/wallet", genLimiter,  walletRouter);
app.use("/api/admin",  genLimiter,  adminRouter);
app.use("/api/crash",  genLimiter,  crashRouter);
app.use("/api/blackjack", betLimiter, blackjackRouter);

// ─── Health ───────────────────────────────────────────────────────────────────
app.get("/health", async (_req, res) => {
  try { await pool.query("SELECT 1"); res.json({ status: "ok", db: "connected" }); }
  catch { res.status(503).json({ status: "error", db: "disconnected" }); }
});

app.use((_req, res) => res.status(404).json({ error: "Route not found" }));
app.use((err, _req, res, _next) => { console.error(err); res.status(500).json({ error: "Internal server error" }); });

// ─── Start ────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`🎲 Casino backend running on http://localhost:${PORT}`);
  console.log(`   Routes: /api/auth  /api/games  /api/crash  /api/blackjack  /api/wallet  /api/admin`);
  // Boot crash game (WebSocket + game loop)
  initCrash(server, pool);
});

module.exports = app;
