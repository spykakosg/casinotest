/**
 * Game Routes — /api/games
 *
 * POST /api/games/dice/bet        - Place a dice bet
 * POST /api/games/dice/seed       - Rotate server seed
 * GET  /api/games/dice/info       - Game config / presets
 * GET  /api/games/dice/verify     - Verify a past bet result
 * GET  /api/games/bets            - Bet history
 */

const express = require("express");
const router = express.Router();
const { placeDiceBet, rotateServerSeed, getBetHistory } = require("../engine/bet");
const { getDiceGameInfo } = require("../games/dice");
const { rollDice, hashServerSeed } = require("../engine/rng");
const auth = require("../middleware/auth");

// ─── Dice: Place Bet ──────────────────────────────────────────────────────────
router.post("/dice/bet", auth, async (req, res) => {
  const { currency, betAmount, target, direction } = req.body;
  const userId = req.user.id;

  // Basic input checks
  if (!currency || !betAmount || target === undefined || !direction) {
    return res.status(400).json({ error: "Missing required fields: currency, betAmount, target, direction" });
  }

  const validCurrencies = ["USDT_POLYGON", "ETH_POLYGON", "USDT_TRON", "BTC"];
  if (!validCurrencies.includes(currency)) {
    return res.status(400).json({ error: `Invalid currency. Supported: ${validCurrencies.join(", ")}` });
  }

  const amount = parseFloat(betAmount);
  if (isNaN(amount) || amount <= 0) {
    return res.status(400).json({ error: "betAmount must be a positive number" });
  }

  try {
    const result = await placeDiceBet(req.db, {
      userId,
      currency,
      betAmount: amount,
      target: parseFloat(target),
      direction,
    });

    return res.json({
      success: true,
      bet: {
        id: result.betId,
        roll: result.roll,
        target: result.target,
        direction: result.direction,
        won: result.won,
        betAmount: result.betAmount,
        payout: result.payout,
        profit: result.profit,
        multiplier: result.multiplier,
        currency: result.currency,
        nonce: result.nonce,
      },
      balance: result.newBalance,
    });
  } catch (err) {
    // Distinguish user errors from server errors
    const userErrors = ["Insufficient balance", "Minimum bet", "Target must be", "Direction must be"];
    const isUserError = userErrors.some((e) => err.message.includes(e));
    return res.status(isUserError ? 400 : 500).json({ error: err.message });
  }
});

// ─── Dice: Game Info ──────────────────────────────────────────────────────────
router.get("/dice/info", (req, res) => {
  return res.json(getDiceGameInfo());
});

// ─── Dice: Verify Past Bet ───────────────────────────────────────────────────
// Anyone can verify — just pass serverSeed (revealed after rotation), clientSeed, nonce
router.get("/dice/verify", (req, res) => {
  const { serverSeed, clientSeed, nonce } = req.query;

  if (!serverSeed || !clientSeed || nonce === undefined) {
    return res.status(400).json({ error: "serverSeed, clientSeed, nonce required" });
  }

  const roll = rollDice(serverSeed, clientSeed, parseInt(nonce));
  const serverSeedHash = hashServerSeed(serverSeed);

  return res.json({
    roll,
    serverSeedHash,
    clientSeed,
    nonce: parseInt(nonce),
    message: "Verify serverSeedHash matches what was shown before the bet",
  });
});

// ─── Dice: Rotate Server Seed ────────────────────────────────────────────────
router.post("/dice/seed", auth, async (req, res) => {
  const { currency } = req.body;

  if (!currency) return res.status(400).json({ error: "currency required" });

  try {
    const result = await rotateServerSeed(req.db, req.user.id, currency);
    return res.json({
      success: true,
      revealedServerSeed: result.revealedServerSeed,
      newServerSeedHash: result.newServerSeedHash,
      message: "Old seed revealed. New seed hash committed. Nonce reset to 0.",
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── Bet History ─────────────────────────────────────────────────────────────
router.get("/bets", auth, async (req, res) => {
  const { limit = 20, offset = 0, game } = req.query;

  try {
    const bets = await getBetHistory(req.db, req.user.id, {
      limit: Math.min(parseInt(limit), 100),
      offset: parseInt(offset),
      game: game || null,
    });
    return res.json({ bets });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
