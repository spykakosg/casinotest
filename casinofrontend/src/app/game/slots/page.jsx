"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import BetHistory from "@/components/BetHistory";
import { placeSlotsBet, getBalances, getSlotsBetHistory } from "@/lib/api";

const CURRENCIES = ["USDT_POLYGON", "ETH_POLYGON", "USDT_TRON", "BTC"];

const SYMBOL_EMOJIS = {
  seven:  "\u0037\ufe0f\u20e3",
  bar:    "\ud83c\udfa8",
  bell:   "\ud83d\udd14",
  cherry: "\ud83c\udf52",
  lemon:  "\ud83c\udf4b",
};

const SYMBOL_LIST = ["seven", "bar", "bell", "cherry", "lemon"];

const PAYOUTS = [
  { symbols: "7\ufe0f\u20e3 7\ufe0f\u20e3 7\ufe0f\u20e3", payout: "50x" },
  { symbols: "\ud83c\udfa8 \ud83c\udfa8 \ud83c\udfa8", payout: "20x" },
  { symbols: "\ud83d\udd14 \ud83d\udd14 \ud83d\udd14", payout: "10x" },
  { symbols: "\ud83c\udf52 \ud83c\udf52 \ud83c\udf52", payout: "5x" },
  { symbols: "\ud83c\udf4b \ud83c\udf4b \ud83c\udf4b", payout: "3x" },
];

function SlotReel({ symbol, spinning, delay = 0 }) {
  const [displaySymbol, setDisplaySymbol] = useState(symbol);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (spinning) {
      const timeout = setTimeout(() => {
        intervalRef.current = setInterval(() => {
          const rand = SYMBOL_LIST[Math.floor(Math.random() * SYMBOL_LIST.length)];
          setDisplaySymbol(rand);
        }, 80);
      }, delay);
      return () => {
        clearTimeout(timeout);
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setDisplaySymbol(symbol);
    }
  }, [spinning, symbol, delay]);

  return (
    <div className="w-20 h-20 bg-casino-surface border-2 border-casino-border rounded-xl flex items-center justify-center text-4xl transition-transform">
      {SYMBOL_EMOJIS[displaySymbol] || "\u2753"}
    </div>
  );
}

export default function SlotsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [currency, setCurrency]   = useState("USDT_POLYGON");
  const [betAmount, setBetAmount] = useState("10");
  const [spinning, setSpinning]   = useState(false);
  const [grid, setGrid]           = useState(null);
  const [result, setResult]       = useState(null);
  const [error, setError]         = useState("");
  const [balances, setBalances]   = useState({});
  const [history, setHistory]     = useState([]);
  const [historyPage, setHistoryPage] = useState(0);
  const [showPaytable, setShowPaytable] = useState(false);
  const [reelSpinning, setReelSpinning] = useState([false, false, false]);

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
      const data = await getSlotsBetHistory(20, historyPage * 20);
      setHistory(prev => historyPage === 0 ? data.bets : [...prev, ...data.bets]);
    } catch {}
  }

  async function handleSpin() {
    setError("");
    setSpinning(true);
    setResult(null);
    setReelSpinning([true, true, true]);

    try {
      const data = await placeSlotsBet({
        currency,
        betAmount: parseFloat(betAmount),
      });
      const bet = data.bet;

      // Stop reels sequentially
      setTimeout(() => {
        setGrid(bet.grid);
        setReelSpinning(prev => [false, prev[1], prev[2]]);
      }, 600);
      setTimeout(() => {
        setReelSpinning(prev => [prev[0], false, prev[2]]);
      }, 1000);
      setTimeout(() => {
        setReelSpinning([false, false, false]);
        setResult(bet);
        setSpinning(false);
        setBalances(prev => ({ ...prev, [currency]: data.balance }));
        setHistory(prev => [{
          id: bet.betId,
          game: "slots",
          bet_amount: bet.betAmount,
          payout: bet.payout,
          profit: bet.profit,
          won: bet.won,
          multiplier: bet.multiplier,
          created_at: new Date().toISOString(),
        }, ...prev]);
      }, 1400);
    } catch (err) {
      setError(err.message);
      setSpinning(false);
      setReelSpinning([false, false, false]);
    }
  }

  function halfBet()   { setBetAmount(v => Math.max(0.01, parseFloat(v) / 2).toFixed(2)); }
  function doubleBet() { setBetAmount(v => (parseFloat(v) * 2).toFixed(2)); }
  function maxBet()    { setBetAmount((balances[currency] || 0).toFixed(2)); }

  if (authLoading) return <LoadingScreen />;

  // Default display grid
  const displayGrid = grid || [
    [{ name: "cherry" }, { name: "bell" }, { name: "seven" }],
    [{ name: "lemon" }, { name: "cherry" }, { name: "bar" }],
    [{ name: "bell" }, { name: "seven" }, { name: "lemon" }],
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar balances={balances} activeCurrency={currency} onCurrencyChange={setCurrency} />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">

          {/* Slot Machine */}
          <div className="bg-casino-card border border-casino-border rounded-2xl p-4 relative overflow-hidden">
            <div className="absolute inset-0 opacity-5"
              style={{backgroundImage:"radial-gradient(circle at 50% 50%, var(--gold) 0%, transparent 70%)"}} />

            {/* Machine frame */}
            <div className="relative z-10">
              <div className="text-center mb-3">
                <h2 className="text-lg font-black text-gold tracking-wider">SLOT MACHINE</h2>
                <p className="text-xs text-casino-muted">5% House Edge &bull; 5 Paylines</p>
              </div>

              {/* Reels */}
              <div className="bg-black/30 rounded-xl p-3 border border-gold/20">
                {displayGrid.map((row, rowIdx) => (
                  <div key={rowIdx} className={`flex items-center justify-center gap-2 py-1 ${
                    result?.winningLine === rowIdx ? "bg-gold/10 rounded-lg" :
                    result?.winningLine === 3 && rowIdx === 0 ? "" :
                    result?.winningLine === 4 && rowIdx === 2 ? "" : ""
                  }`}>
                    {/* Row indicator */}
                    <div className="w-6 text-xs text-casino-muted/40 font-mono text-right shrink-0">
                      {rowIdx === 1 ? "\u25b6" : ""}
                    </div>
                    {row.map((sym, colIdx) => (
                      <SlotReel
                        key={`${rowIdx}-${colIdx}`}
                        symbol={sym.name}
                        spinning={reelSpinning[colIdx]}
                        delay={colIdx * 100}
                      />
                    ))}
                    <div className="w-6 text-xs text-casino-muted/40 font-mono shrink-0">
                      {rowIdx === 1 ? "\u25c0" : ""}
                    </div>
                  </div>
                ))}
              </div>

              {/* Result */}
              {result && (
                <div className="text-center mt-3">
                  {result.won ? (
                    <>
                      <p className="text-xl font-bold text-green-400">
                        WIN! {result.multiplier}x
                      </p>
                      <p className="text-green-400 font-mono text-sm">+{result.profit.toFixed(2)}</p>
                    </>
                  ) : (
                    <p className="text-casino-muted text-sm">No win this spin</p>
                  )}
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
                <button onClick={() => setShowPaytable(!showPaytable)}
                  className="text-xs text-gold hover:text-yellow-400 transition-colors">
                  {showPaytable ? "Hide" : "Show"} Paytable
                </button>
              </div>
            </div>

            {showPaytable && (
              <div className="bg-casino-surface rounded-lg p-2 space-y-1">
                <p className="text-xs text-casino-muted font-mono uppercase tracking-widest mb-1">Paytable</p>
                {PAYOUTS.map((p, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span>{p.symbols}</span>
                    <span className="text-gold font-mono">{p.payout}</span>
                  </div>
                ))}
                <p className="text-[10px] text-casino-muted mt-1">2-of-a-kind on first two symbols also pays. Best payline wins.</p>
              </div>
            )}

            <button onClick={handleSpin} disabled={spinning}
              className="w-full py-3 rounded-xl font-bold text-sm transition-all bg-gradient-to-r from-gold to-yellow-500 text-black hover:shadow-lg hover:shadow-gold/20 disabled:opacity-50 disabled:cursor-not-allowed">
              {spinning ? "Spinning..." : "Spin"}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <BetHistory title="Slots History" bets={history} onLoadMore={() => setHistoryPage(p => p + 1)} />
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
