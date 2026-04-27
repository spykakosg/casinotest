"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import BetHistory from "@/components/BetHistory";
import { placePlinkoBet, getBalances, getPlinkoBetHistory } from "@/lib/api";

const CURRENCIES = ["USDT_POLYGON", "ETH_POLYGON", "USDT_TRON", "BTC"];

const MULTIPLIERS = {
  8: {
    low:    [5.6, 2.1, 1.1, 1.0, 0.5, 1.0, 1.1, 2.1, 5.6],
    medium: [13,  3.0, 1.3, 0.7, 0.4, 0.7, 1.3, 3.0, 13],
    high:   [29,  4.0, 1.5, 0.3, 0.2, 0.3, 1.5, 4.0, 29],
  },
  12: {
    low:    [10,  3.0, 1.6, 1.4, 1.1, 1.0, 0.5, 1.0, 1.1, 1.4, 1.6, 3.0, 10],
    medium: [33,  11,  4.0, 2.0, 1.1, 0.6, 0.3, 0.6, 1.1, 2.0, 4.0, 11,  33],
    high:   [170, 24,  8.1, 2.0, 0.7, 0.2, 0.2, 0.2, 0.7, 2.0, 8.1, 24,  170],
  },
  16: {
    low:    [16,  9.0, 2.0, 1.4, 1.4, 1.2, 1.1, 1.0, 0.5, 1.0, 1.1, 1.2, 1.4, 1.4, 2.0, 9.0, 16],
    medium: [110, 41,  10,  5.0, 3.0, 1.5, 1.0, 0.5, 0.3, 0.5, 1.0, 1.5, 3.0, 5.0, 10,  41,  110],
    high:   [1000,130, 26,  9.0, 4.0, 2.0, 0.2, 0.2, 0.2, 0.2, 0.2, 2.0, 4.0, 9.0, 26,  130, 1000],
  },
};

function PlinkoBoard({ rows, path, bucket, risk, animating }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;
    const pegRadius = 3;
    const pegSpacingY = (H - 60) / rows;
    const multipliers = MULTIPLIERS[rows]?.[risk] || [];

    function getPegX(row, col) {
      const cols = row + 1;
      const totalWidth = cols * 20;
      const startX = (W - totalWidth) / 2 + 10;
      return startX + col * 20;
    }

    function drawBoard(ballRow, ballCol) {
      ctx.clearRect(0, 0, W, H);

      // Draw pegs
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c <= r; c++) {
          const x = getPegX(r, c);
          const y = 30 + r * pegSpacingY;
          ctx.beginPath();
          ctx.arc(x, y, pegRadius, 0, Math.PI * 2);
          ctx.fillStyle = "#4a5568";
          ctx.fill();
        }
      }

      // Draw buckets
      const bucketCount = rows + 1;
      const bucketW = W / bucketCount;
      for (let i = 0; i < bucketCount; i++) {
        const x = i * bucketW;
        const y = H - 24;
        const m = multipliers[i] || 0;
        const isHit = bucket === i && !animating;

        ctx.fillStyle = isHit ? "#eab308" : m >= 2 ? "#22c55e33" : m >= 1 ? "#3b82f633" : "#ef444433";
        ctx.fillRect(x + 1, y, bucketW - 2, 22);
        ctx.fillStyle = isHit ? "#000" : "#9ca3af";
        ctx.font = "bold 9px monospace";
        ctx.textAlign = "center";
        ctx.fillText(`${m}x`, x + bucketW / 2, y + 15);
      }

      // Draw ball
      if (ballRow !== null && ballRow !== undefined) {
        let bx, by;
        if (ballRow < rows) {
          bx = getPegX(ballRow, ballCol);
          by = 30 + ballRow * pegSpacingY;
        } else {
          const bucketW2 = W / (rows + 1);
          bx = ballCol * bucketW2 + bucketW2 / 2;
          by = H - 35;
        }
        ctx.beginPath();
        ctx.arc(bx, by, 6, 0, Math.PI * 2);
        ctx.fillStyle = "#eab308";
        ctx.fill();
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    if (animating && path && path.length > 0) {
      let step = 0;
      let col = 0;
      function animate() {
        if (step <= rows) {
          drawBoard(step, col);
          if (step < rows) {
            col += path[step];
          }
          step++;
          animRef.current = requestAnimationFrame(() => {
            setTimeout(animate, 80);
          });
        } else {
          drawBoard(rows, bucket);
        }
      }
      animate();
    } else {
      drawBoard(path ? rows : null, bucket);
    }

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [rows, path, bucket, risk, animating]);

  return (
    <canvas
      ref={canvasRef}
      width={Math.max(200, (rows + 2) * 22)}
      height={rows * 25 + 80}
      className="mx-auto"
    />
  );
}

export default function PlinkoPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [currency, setCurrency]   = useState("USDT_POLYGON");
  const [betAmount, setBetAmount] = useState("10");
  const [rows, setRows]           = useState(12);
  const [risk, setRisk]           = useState("medium");
  const [dropping, setDropping]   = useState(false);
  const [result, setResult]       = useState(null);
  const [path, setPath]           = useState(null);
  const [bucket, setBucket]       = useState(null);
  const [animating, setAnimating] = useState(false);
  const [error, setError]         = useState("");
  const [balances, setBalances]   = useState({});
  const [history, setHistory]     = useState([]);
  const [historyPage, setHistoryPage] = useState(0);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [user, authLoading, router]);

  useEffect(() => { if (user) fetchBalances(); }, [user]);
  useEffect(() => { if (user) fetchHistory(); }, [user, historyPage]);

  async function fetchBalances() {
    try {
      const data = await getBalances();
      const map = {};
      for (const [k, v] of Object.entries(data.balances)) map[k] = v.balance;
      setBalances(map);
    } catch {}
  }

  async function fetchHistory() {
    try {
      const data = await getPlinkoBetHistory(20, historyPage * 20);
      setHistory(prev => historyPage === 0 ? data.bets : [...prev, ...data.bets]);
    } catch {}
  }

  async function handleDrop() {
    setError("");
    setDropping(true);
    setResult(null);
    setPath(null);
    setBucket(null);
    setAnimating(false);
    try {
      const data = await placePlinkoBet({
        currency,
        betAmount: parseFloat(betAmount),
        rows,
        risk,
      });
      const bet = data.bet;
      setResult(bet);
      setPath(bet.path);
      setBucket(bet.bucket);
      setAnimating(true);
      setBalances(prev => ({ ...prev, [currency]: data.balance }));
      setHistory(prev => [{
        id: bet.betId,
        game: "plinko",
        bet_amount: bet.betAmount,
        payout: bet.payout,
        profit: bet.profit,
        won: bet.won,
        multiplier: bet.multiplier,
        created_at: new Date().toISOString(),
      }, ...prev]);

      // Stop animation after it completes
      setTimeout(() => {
        setAnimating(false);
        setDropping(false);
      }, (rows + 2) * 100);
    } catch (err) {
      setError(err.message);
      setDropping(false);
    }
  }

  function halfBet()   { setBetAmount(v => Math.max(0.01, parseFloat(v) / 2).toFixed(2)); }
  function doubleBet() { setBetAmount(v => (parseFloat(v) * 2).toFixed(2)); }
  function maxBet()    { setBetAmount((balances[currency] || 0).toFixed(2)); }

  if (authLoading) return <LoadingScreen />;

  const multipliers = MULTIPLIERS[rows]?.[risk] || [];

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar balances={balances} activeCurrency={currency} onCurrencyChange={setCurrency} />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">

          {/* Plinko Board */}
          <div className="bg-casino-card border border-casino-border rounded-2xl p-4 flex flex-col items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-5"
              style={{backgroundImage:"radial-gradient(circle at 50% 50%, var(--gold) 0%, transparent 70%)"}} />

            <div className="relative z-10 w-full flex flex-col items-center">
              <PlinkoBoard rows={rows} path={path} bucket={bucket} risk={risk} animating={animating} />

              {result && !animating && (
                <div className="text-center mt-3">
                  <p className="text-lg font-bold">
                    <span className="text-gold">{result.multiplier}x</span>
                  </p>
                  <p className={`text-sm font-mono ${result.profit >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {result.profit >= 0 ? "+" : ""}{result.profit.toFixed(2)}
                  </p>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          {/* Controls */}
          <div className="bg-casino-card border border-casino-border rounded-2xl p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {/* Rows */}
              <div className="space-y-1">
                <span className="text-xs text-casino-muted font-mono uppercase tracking-widest">Rows</span>
                <div className="flex gap-1">
                  {[8, 12, 16].map(r => (
                    <button key={r} onClick={() => setRows(r)}
                      className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all border ${
                        rows === r
                          ? "bg-gold/20 border-gold/50 text-gold"
                          : "bg-casino-surface border-casino-border text-casino-muted hover:text-white"
                      }`}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Risk */}
              <div className="space-y-1">
                <span className="text-xs text-casino-muted font-mono uppercase tracking-widest">Risk</span>
                <div className="flex gap-1">
                  {["low", "medium", "high"].map(r => (
                    <button key={r} onClick={() => setRisk(r)}
                      className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all border capitalize ${
                        risk === r
                          ? "bg-gold/20 border-gold/50 text-gold"
                          : "bg-casino-surface border-casino-border text-casino-muted hover:text-white"
                      }`}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Bet amount + currency */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <span className="text-xs text-casino-muted font-mono uppercase tracking-widest">Bet Amount</span>
                <input type="number" value={betAmount} onChange={e => setBetAmount(e.target.value)}
                  className="w-full bg-casino-surface border border-casino-border rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-gold/50" />
                <div className="flex gap-1">
                  <button onClick={halfBet} className="flex-1 bg-casino-surface border border-casino-border rounded px-2 py-1 text-xs text-casino-muted hover:text-white transition-colors">1/2</button>
                  <button onClick={doubleBet} className="flex-1 bg-casino-surface border border-casino-border rounded px-2 py-1 text-xs text-casino-muted hover:text-white transition-colors">2x</button>
                  <button onClick={maxBet} className="flex-1 bg-casino-surface border border-casino-border rounded px-2 py-1 text-xs text-casino-muted hover:text-white transition-colors">Max</button>
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-casino-muted font-mono uppercase tracking-widest">Currency</span>
                <select value={currency} onChange={e => setCurrency(e.target.value)}
                  className="w-full bg-casino-surface border border-casino-border rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-gold/50">
                  {CURRENCIES.map(c => <option key={c} value={c}>{c.replace("_", " ")}</option>)}
                </select>
              </div>
            </div>

            <button onClick={handleDrop} disabled={dropping}
              className="w-full py-3 rounded-xl font-bold text-sm transition-all bg-gradient-to-r from-gold to-yellow-500 text-black hover:shadow-lg hover:shadow-gold/20 disabled:opacity-50 disabled:cursor-not-allowed">
              {dropping ? "Dropping..." : "Drop Ball"}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <BetHistory
            title="Plinko History"
            bets={history}
            onLoadMore={() => setHistoryPage(p => p + 1)}
          />
        </div>
      </main>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
