/**
 * Slots Machine Game Logic — Provably Fair
 *
 * 3x3 grid with symbols.
 * House edge: 5%
 *
 * Symbols (weighted):
 *   7    — rare    (weight 2)   | 3-of-a-kind: 50x  | 2-of-a-kind: 5x
 *   BAR  — uncommon (weight 4)  | 3-of-a-kind: 20x  | 2-of-a-kind: 3x
 *   Bell — medium  (weight 6)   | 3-of-a-kind: 10x  | 2-of-a-kind: 2x
 *   Cherry — common (weight 8)  | 3-of-a-kind: 5x   | 2-of-a-kind: 1.5x
 *   Lemon — common (weight 10)  | 3-of-a-kind: 3x   | 2-of-a-kind: 0.5x
 *
 * Paylines: 5 lines (3 rows + 2 diagonals)
 * Best payline wins.
 */

const { generateFloat } = require("../engine/rng");

const SYMBOLS = [
  { name: "seven",  emoji: "7\ufe0f\u20e3",  weight: 2,  pay3: 50,  pay2: 5 },
  { name: "bar",    emoji: "\ud83c\udfa8",    weight: 4,  pay3: 20,  pay2: 3 },
  { name: "bell",   emoji: "\ud83d\udd14",    weight: 6,  pay3: 10,  pay2: 2 },
  { name: "cherry", emoji: "\ud83c\udf52",    weight: 8,  pay3: 5,   pay2: 1.5 },
  { name: "lemon",  emoji: "\ud83c\udf4b",    weight: 10, pay3: 3,   pay2: 0.5 },
];

const TOTAL_WEIGHT = SYMBOLS.reduce((s, sym) => s + sym.weight, 0);

function pickSymbol(float) {
  let cumulative = 0;
  for (const sym of SYMBOLS) {
    cumulative += sym.weight / TOTAL_WEIGHT;
    if (float < cumulative) return sym;
  }
  return SYMBOLS[SYMBOLS.length - 1];
}

function spinReels(serverSeed, clientSeed, nonce) {
  // 3x3 grid = 9 symbols, each from a different cursor
  const grid = [];
  for (let row = 0; row < 3; row++) {
    const rowSymbols = [];
    for (let col = 0; col < 3; col++) {
      const float = generateFloat(serverSeed, clientSeed, nonce, row * 3 + col);
      rowSymbols.push(pickSymbol(float));
    }
    grid.push(rowSymbols);
  }
  return grid;
}

function getPaylines(grid) {
  return [
    [grid[0][0], grid[0][1], grid[0][2]], // top row
    [grid[1][0], grid[1][1], grid[1][2]], // middle row
    [grid[2][0], grid[2][1], grid[2][2]], // bottom row
    [grid[0][0], grid[1][1], grid[2][2]], // diagonal TL-BR
    [grid[2][0], grid[1][1], grid[0][2]], // diagonal BL-TR
  ];
}

function evaluatePayline(symbols) {
  // Check 3 of a kind
  if (symbols[0].name === symbols[1].name && symbols[1].name === symbols[2].name) {
    return { match: 3, symbol: symbols[0], multiplier: symbols[0].pay3 };
  }
  // Check 2 of a kind (first two)
  if (symbols[0].name === symbols[1].name) {
    return { match: 2, symbol: symbols[0], multiplier: symbols[0].pay2 };
  }
  return { match: 0, symbol: null, multiplier: 0 };
}

function resolveSlotsBet({ serverSeed, clientSeed, nonce, betAmount }) {
  const grid = spinReels(serverSeed, clientSeed, nonce);
  const paylines = getPaylines(grid);

  let bestResult = { match: 0, symbol: null, multiplier: 0, lineIndex: -1 };

  for (let i = 0; i < paylines.length; i++) {
    const result = evaluatePayline(paylines[i]);
    if (result.multiplier > bestResult.multiplier) {
      bestResult = { ...result, lineIndex: i };
    }
  }

  const multiplier = bestResult.multiplier;
  const won = multiplier > 0;
  const payout = won ? parseFloat((betAmount * multiplier).toFixed(8)) : 0;
  const profit = parseFloat((payout - betAmount).toFixed(8));

  // Serialize grid for response
  const gridResult = grid.map(row => row.map(sym => ({
    name: sym.name,
    emoji: sym.emoji,
  })));

  return {
    grid: gridResult,
    won,
    multiplier,
    matchCount: bestResult.match,
    matchSymbol: bestResult.symbol?.name || null,
    winningLine: bestResult.lineIndex,
    betAmount,
    payout,
    profit,
    nonce,
  };
}

function validateSlotsBet({ betAmount, balance }) {
  if (betAmount <= 0) return { valid: false, error: "Bet amount must be positive" };
  if (betAmount > balance) return { valid: false, error: "Insufficient balance" };
  return { valid: true };
}

module.exports = {
  resolveSlotsBet,
  validateSlotsBet,
  spinReels,
  SYMBOLS,
};
