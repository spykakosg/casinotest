"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import BetHistory from "@/components/BetHistory";
import { placeDiceBet, getBalances, getBetHistory } from "@/lib/api";

const CURRENCIES = ["USDT_POLYGON", "ETH_POLYGON", "USDT_TRON", "BTC"];

export default function DicePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // Game state
  const [currency, setCurrency]       = useState("USDT_POLYGON");
  const [betAmount, setBetAmount]     = useState("10");
  const [target, setTarget]           = useState(50);
  const [direction, setDirection]     = useState("under");
  const [rolling, setRolling]         = useState(false);
  const [result, setResult]           = useState(null);  // last bet result
  const [error, setError]             = useState("");

  // Balance & history
  const [balances, setBalances]       = useState({});
  const [history, setHistory]         = useState([]);
  const [historyPage, setHistoryPage] = useState(0);

  // Derived
  const winProbability = direction === "under" ? target : 100 - target;
  const multiplier     = winProbability > 0 ? ((99 / winProbability)).toFixed(4) : "0";
  const profit         = ((parseFloat(betAmount) || 0) * (parseFloat(multiplier) - 1)).toFixed(2);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) fetchBalances();
  }, [user]);

  useEffect(() => {
    if (user) fetchHistory();
  }, [user, historyPage]);

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
      const data = await getBetHistory(20, historyPage * 20);
      setHistory(prev => historyPage === 0 ? data.bets : [...prev, ...data.bets]);
    } catch {}
  }

  async function handleBet() {
    setError("");
    setRolling(true);
    setResult(null);
    try {
      const data = await placeDiceBet({
        currency,
        betAmount: parseFloat(betAmount),
        target,
        direction,
      });
      setResult(data);
      setBalances(prev => ({ ...prev, [currency]: data.balance }));
      setHistory(prev => [data.bet, ...prev]);
    } catch (err) {
      setError(err.message);
    } finally {
      setRolling(false);
    }
  }

  function halfBet()   { setBetAmount(v => Math.max(0.01, parseFloat(v) / 2).toFixed(2)); }
  function doubleBet() { setBetAmount(v => (parseFloat(v) * 2).toFixed(2)); }
  function maxBet()    { setBetAmount((balances[currency] || 0).toFixed(2)); }

  if (authLoading) return <LoadingScreen />;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar balances={balances} activeCurrency={currency} onCurrencyChange={setCurrency} />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left: Game Controls */}
        <div className="lg:col-span-2 space-y-4">

          {/* Roll Result Display */}
          <div className="bg-casino-card border border-casino-border rounded-2xl p-6 min-h-[160px] flex flex-col items-center justify-center relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute inset-0 opacity-5"
              style={{backgroundImage:"radial-gradient(circle at 50% 50%, var(--gold) 0%, transparent 70%)"}} />

            {rolling ? (
              <RollingAnimation />
            ) : result ? (
              <ResultDisplay result={result} />
            ) : (
              <IdleDisplay />
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          {/* Direction Toggle */}
          <div className="bg-casino-card border border-casino-border rounded-2xl p-5">
            <div className="flex gap-3 mb-5">
              <DirectionButton
                active={direction === "under"}
                onClick={() => setDirection("under")}
                label="Roll Under"
                icon="↓"
              />
              <DirectionButton
                active={direction === "over"}
                onClick={() => setDirection("over")}
                label="Roll Over"
                icon="↑"
              />
            </div>

            {/* Target Slider */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-casino-muted font-mono uppercase tracking-widest">Target</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="2" max="98" step="1"
                    value={target}
                    onChange={e => setTarget(Math.min(98, Math.max(2, parseInt(e.target.value) || 50)))}
                    className="bg-casino-surface border border-casino-border rounded-lg w-20 text-center py-1 font-mono text-white text-sm focus:outline-none focus:border-gold"
                  />
                  <span className="text-casino-muted font-mono text-sm">/ 100</span>
                </div>
              </div>

              <div className="relative pt-1">
                {/* Track fill */}
                <div className="absolute top-3.5 left-0 h-1 rounded-full bg-gold/30 pointer-events-none"
                  style={{ width: `${target}%` }} />
                <input
                  type="range" min="2" max="98" step="1"
                  value={target}
                  onChange={e => setTarget(parseInt(e.target.value))}
                  className="w-full relative"
                />
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3 pt-1">
                <StatBox label="Win Chance" value={`${winProbability}%`} />
                <StatBox label="Multiplier" value={`${parseFloat(multiplier).toFixed(2)}×`} highlight />
                <StatBox label="Profit" value={`+${profit}`} />
              </div>
            </div>
          </div>

          {/* Bet Amount */}
          <div className="bg-casino-card border border-casino-border rounded-2xl p-5">
            <label className="text-xs text-casino-muted font-mono uppercase tracking-widest block mb-3">
              Bet Amount
            </label>
            <div className="flex gap-2 mb-3">
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={betAmount}
                onChange={e => setBetAmount(e.target.value)}
                className="flex-1 bg-casino-surface border border-casino-border rounded-lg px-4 py-3 text-white font-mono text-lg focus:outline-none focus:border-gold transition-colors"
              />
              <span className="bg-casino-surface border border-casino-border rounded-lg px-3 flex items-center text-casino-muted font-mono text-sm">
                {currency.split("_")[0]}
              </span>
            </div>
            <div className="flex gap-2">
              {[["½", halfBet], ["2×", doubleBet], ["Max", maxBet]].map(([label, fn]) => (
                <button key={label} onClick={fn}
                  className="flex-1 bg-casino-surface hover:bg-casino-muted/20 border border-casino-border rounded-lg py-2 text-sm font-mono text-casino-muted hover:text-white transition-colors">
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Bet Button */}
          <button
            onClick={handleBet}
            disabled={rolling || !betAmount || parseFloat(betAmount) <= 0}
            className="btn-gold w-full py-4 text-lg font-display tracking-widest"
          >
            {rolling ? "ROLLING..." : "ROLL DICE"}
          </button>
        </div>

        {/* Right: Bet History */}
        <div className="lg:col-span-1">
          <BetHistory history={history} currency={currency} onLoadMore={() => setHistoryPage(p => p + 1)} />
        </div>
      </main>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function IdleDisplay() {
  return (
    <div className="text-center">
      <div className="font-display text-7xl text-casino-border mb-2">?</div>
      <p className="text-casino-muted text-sm font-mono">Place a bet to roll</p>
    </div>
  );
}

function RollingAnimation() {
  return (
    <div className="text-center">
      <div className="font-display text-7xl text-gold animate-pulse-gold mb-2">...</div>
      <p className="text-casino-muted text-sm font-mono animate-pulse">Rolling the dice</p>
    </div>
  );
}

function ResultDisplay({ result }) {
  const { bet } = result;
  const won = bet.won;
  return (
    <div className="text-center animate-roll-in w-full">
      {/* Roll number */}
      <div className={`font-display text-8xl mb-1 ${won ? "text-green-400" : "text-red-400"}`}>
        {bet.roll.toFixed(2)}
      </div>

      {/* Win/Loss badge */}
      <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-mono font-medium mb-3 ${
        won ? "bg-green-500/10 text-green-400 border border-green-500/30"
             : "bg-red-500/10 text-red-400 border border-red-500/30"
      }`}>
        {won ? "✓ WIN" : "✗ LOSS"}
        <span className="opacity-70">
          {won ? `+${bet.payout.toFixed(2)}` : `-${bet.betAmount.toFixed(2)}`}
        </span>
      </div>

      {/* Detail row */}
      <div className="flex justify-center gap-6 text-xs font-mono text-casino-muted">
        <span>{bet.direction === "under" ? "< " : "> "}{bet.target}</span>
        <span>{bet.multiplier}×</span>
        <span>nonce #{bet.nonce}</span>
      </div>
    </div>
  );
}

function DirectionButton({ active, onClick, label, icon }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-mono font-medium transition-all ${
        active
          ? "bg-gold text-casino-bg shadow-lg shadow-gold/20"
          : "bg-casino-surface border border-casino-border text-casino-muted hover:text-white"
      }`}
    >
      <span className="text-lg">{icon}</span> {label}
    </button>
  );
}

function StatBox({ label, value, highlight }) {
  return (
    <div className="bg-casino-surface border border-casino-border rounded-xl p-3 text-center">
      <div className={`font-mono font-semibold text-sm ${highlight ? "text-gold" : "text-white"}`}>
        {value}
      </div>
      <div className="text-casino-muted text-xs mt-0.5">{label}</div>
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
