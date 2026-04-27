"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import BetHistory from "@/components/BetHistory";
import { placeRouletteBet, getBalances, getRouletteBetHistory } from "@/lib/api";

const CURRENCIES = ["USDT_POLYGON", "ETH_POLYGON", "USDT_TRON", "BTC"];
const RED_NUMBERS = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
const WHEEL_ORDER = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];

function getColor(n) {
  if (n === 0) return "green";
  return RED_NUMBERS.includes(n) ? "red" : "black";
}

function RouletteWheel({ spinning, resultNumber }) {
  const sliceAngle = 360 / WHEEL_ORDER.length;
  const resultIdx = resultNumber !== null ? WHEEL_ORDER.indexOf(resultNumber) : -1;
  const targetAngle = resultIdx >= 0 ? -(resultIdx * sliceAngle) - sliceAngle / 2 : 0;
  const [rotation, setRotation] = useState(0);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (spinning) {
      setAnimating(true);
      setRotation(prev => prev + 1800 + Math.random() * 360);
    }
  }, [spinning]);

  useEffect(() => {
    if (!spinning && resultNumber !== null && animating) {
      const finalRot = rotation - (rotation % 360) + 360 * 3 + (360 - (resultIdx * sliceAngle + sliceAngle / 2));
      setRotation(finalRot);
      setTimeout(() => setAnimating(false), 3000);
    }
  }, [spinning, resultNumber]);

  return (
    <div className="relative w-40 h-40 mx-auto">
      <div
        className="w-full h-full rounded-full border-4 border-gold/60 overflow-hidden relative"
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: animating ? "transform 3s cubic-bezier(0.25, 0.1, 0.25, 1)" : "none",
          background: `conic-gradient(${WHEEL_ORDER.map((n, i) => {
            const color = n === 0 ? "#16a34a" : RED_NUMBERS.includes(n) ? "#dc2626" : "#1f2937";
            const start = (i / WHEEL_ORDER.length * 100).toFixed(2);
            const end = ((i + 1) / WHEEL_ORDER.length * 100).toFixed(2);
            return `${color} ${start}% ${end}%`;
          }).join(", ")})`
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-12 h-12 rounded-full bg-casino-card border-2 border-gold/40 flex items-center justify-center shadow-lg">
          <span className={`text-sm font-black ${
            resultNumber !== null && !spinning
              ? getColor(resultNumber) === "red" ? "text-red-400" : getColor(resultNumber) === "green" ? "text-green-400" : "text-white"
              : "text-gold"
          }`}>
            {resultNumber !== null && !spinning ? resultNumber : "?"}
          </span>
        </div>
      </div>
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[14px] border-t-gold z-10 drop-shadow-lg" />
    </div>
  );
}

// Table layout: numbers arranged 3 rows x 12 columns (standard roulette table)
const TABLE_ROWS = [
  [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
  [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
  [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34],
];

function getCornerNumbers(row, col) {
  const tl = TABLE_ROWS[row]?.[col];
  const tr = TABLE_ROWS[row]?.[col + 1];
  const bl = TABLE_ROWS[row + 1]?.[col];
  const br = TABLE_ROWS[row + 1]?.[col + 1];
  if (tl && tr && bl && br) return [tl, tr, bl, br];
  return null;
}

export default function RoulettePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [currency, setCurrency]   = useState("USDT_POLYGON");
  const [betAmount, setBetAmount] = useState("10");
  const [betType, setBetType]     = useState("red");
  const [betValue, setBetValue]   = useState(null);
  const [spinning, setSpinning]   = useState(false);
  const [result, setResult]       = useState(null);
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
      const data = await getRouletteBetHistory(20, historyPage * 20);
      setHistory(prev => historyPage === 0 ? data.bets : [...prev, ...data.bets]);
    } catch {}
  }

  async function handleSpin() {
    setError("");
    setSpinning(true);
    setResult(null);
    try {
      const data = await placeRouletteBet({
        currency,
        betAmount: parseFloat(betAmount),
        betType,
        betValue: betValue !== null ? betValue : undefined,
      });

      // Wait for wheel animation before showing result
      setTimeout(() => {
        setResult(data.bet);
        setSpinning(false);
        setBalances(prev => ({ ...prev, [currency]: data.balance }));
        setHistory(prev => [{
          id: data.bet.betId,
          game: "roulette",
          roll: data.bet.result,
          bet_amount: data.bet.betAmount,
          payout: data.bet.payout,
          profit: data.bet.profit,
          won: data.bet.won,
          multiplier: data.bet.multiplier,
          created_at: new Date().toISOString(),
        }, ...prev]);
      }, 3200);
    } catch (err) {
      setError(err.message);
      setSpinning(false);
    }
  }

  function selectStraight(num) {
    setBetType("straight");
    setBetValue(num);
  }

  function selectCorner(nums) {
    setBetType("corner");
    setBetValue(nums.join(","));
  }

  function selectOutsideBet(type) {
    setBetType(type);
    setBetValue(null);
  }

  function halfBet()   { setBetAmount(v => Math.max(0.01, parseFloat(v) / 2).toFixed(2)); }
  function doubleBet() { setBetAmount(v => (parseFloat(v) * 2).toFixed(2)); }
  function maxBet()    { setBetAmount((balances[currency] || 0).toFixed(2)); }

  if (authLoading) return <LoadingScreen />;

  const payoutMap = {
    straight: 36, split: 18, corner: 9, red: 2, black: 2, odd: 2, even: 2,
    low: 2, high: 2, dozen1: 3, dozen2: 3, dozen3: 3, column1: 3, column2: 3, column3: 3,
  };
  const currentPayout = payoutMap[betType] || 2;
  const potentialWin = ((parseFloat(betAmount) || 0) * currentPayout).toFixed(2);

  const pendingResult = spinning ? null : result?.result ?? null;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar balances={balances} activeCurrency={currency} onCurrencyChange={setCurrency} />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">

          {/* Wheel + Result */}
          <div className="bg-casino-card border border-casino-border rounded-2xl p-4 relative overflow-hidden">
            <div className="absolute inset-0 opacity-5"
              style={{backgroundImage:"radial-gradient(circle at 50% 50%, var(--gold) 0%, transparent 70%)"}} />
            <div className="relative z-10 flex flex-col items-center">
              <RouletteWheel spinning={spinning} resultNumber={pendingResult} />
              {result && !spinning && (
                <div className="mt-3 text-center animate-fadeIn">
                  <p className={`text-lg font-bold ${result.won ? "text-green-400" : "text-red-400"}`}>
                    {result.won ? `WIN! +${result.profit.toFixed(2)}` : `${result.profit.toFixed(2)}`}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Recent results strip */}
          {history.length > 0 && (
            <div className="flex gap-1 overflow-x-auto pb-1">
              {history.slice(0, 20).map((bet, i) => {
                const raw = bet.roll !== undefined && bet.roll !== null ? bet.roll : bet.result;
                const num = raw !== undefined && raw !== null ? parseInt(raw) : null;
                const c = num !== null && !isNaN(num) ? getColor(num) : "gray";
                return (
                  <div key={bet.id || i} className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-all ${
                    c === "green" ? "bg-green-600" : c === "red" ? "bg-red-600" : "bg-gray-700"
                  }`}>
                    {num !== null && !isNaN(num) ? num : "?"}
                  </div>
                );
              })}
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-3 py-2">{error}</div>
          )}

          {/* Roulette Table */}
          <div className="bg-casino-card border border-casino-border rounded-2xl p-3 space-y-2">
            <div className="overflow-x-auto">
              <div className="min-w-[500px]">
                {/* Zero */}
                <div className="flex gap-0.5 mb-0.5">
                  <button onClick={() => selectStraight(0)}
                    className={`w-full py-2 rounded-t-lg text-sm font-bold transition-all border ${
                      betType === "straight" && betValue === 0
                        ? "bg-green-600 border-green-400 ring-2 ring-gold"
                        : "bg-green-700/60 border-green-600/40 hover:bg-green-600"
                    }`}>
                    0
                  </button>
                </div>

                {/* Number grid */}
                {TABLE_ROWS.map((row, rowIdx) => (
                  <div key={rowIdx} className="flex gap-0.5 mb-0.5">
                    {row.map((num, colIdx) => {
                      const c = getColor(num);
                      const isSelected = betType === "straight" && parseInt(betValue) === num;
                      const isCornerSelected = betType === "corner" && betValue && String(betValue).split(",").map(Number).includes(num);
                      return (
                        <div key={num} className="relative flex-1">
                          <button
                            onClick={() => selectStraight(num)}
                            className={`w-full py-1.5 text-xs font-bold transition-all border rounded ${
                              isSelected ? "ring-2 ring-gold scale-105 z-10" :
                              isCornerSelected ? "ring-1 ring-gold/60" : ""
                            } ${
                              c === "red" ? "bg-red-700/70 border-red-600/40 hover:bg-red-600" : "bg-gray-700/70 border-gray-600/40 hover:bg-gray-600"
                            }`}>
                            {num}
                          </button>
                          {/* Corner bet button (intersection point) */}
                          {rowIdx < 2 && colIdx < 11 && (
                            <button
                              onClick={() => {
                                const corners = getCornerNumbers(rowIdx, colIdx);
                                if (corners) selectCorner(corners);
                              }}
                              className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-gold/30 hover:bg-gold/70 z-20 transition-all hover:scale-150"
                              title={(() => {
                                const c = getCornerNumbers(rowIdx, colIdx);
                                return c ? `Corner: ${c.join(",")}` : "";
                              })()}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}

                {/* Column bets */}
                <div className="flex gap-0.5 mb-1">
                  {["column1", "column2", "column3"].map((col, i) => (
                    <button key={col} onClick={() => selectOutsideBet(col)}
                      className={`flex-1 py-1 rounded text-xs font-bold transition-all border ${
                        betType === col ? "bg-gold/20 border-gold text-gold" : "bg-casino-surface border-casino-border text-casino-muted hover:text-white"
                      }`}>
                      Col {i + 1}
                    </button>
                  ))}
                </div>

                {/* Dozen bets */}
                <div className="flex gap-0.5 mb-1">
                  {[
                    { type: "dozen1", label: "1st 12" },
                    { type: "dozen2", label: "2nd 12" },
                    { type: "dozen3", label: "3rd 12" },
                  ].map(d => (
                    <button key={d.type} onClick={() => selectOutsideBet(d.type)}
                      className={`flex-1 py-1.5 rounded text-xs font-bold transition-all border ${
                        betType === d.type ? "bg-gold/20 border-gold text-gold" : "bg-casino-surface border-casino-border text-casino-muted hover:text-white"
                      }`}>
                      {d.label}
                    </button>
                  ))}
                </div>

                {/* Outside bets */}
                <div className="grid grid-cols-6 gap-0.5">
                  {[
                    { type: "low", label: "1-18" },
                    { type: "even", label: "Even" },
                    { type: "red", label: "Red", color: "bg-red-700/50" },
                    { type: "black", label: "Black", color: "bg-gray-700/50" },
                    { type: "odd", label: "Odd" },
                    { type: "high", label: "19-36" },
                  ].map(b => (
                    <button key={b.type} onClick={() => selectOutsideBet(b.type)}
                      className={`py-1.5 rounded text-xs font-bold transition-all border ${
                        betType === b.type ? "bg-gold/20 border-gold text-gold" :
                        `${b.color || "bg-casino-surface"} border-casino-border text-casino-muted hover:text-white`
                      }`}>
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Current bet info */}
            <div className="flex items-center justify-between text-xs text-casino-muted border-t border-casino-border pt-2">
              <span>
                Bet: <span className="text-gold capitalize">{betType}</span>
                {betValue !== null && <span className="text-white ml-1">({betValue})</span>}
              </span>
              <span>Payout: <span className="text-gold">{currentPayout}x</span> | Win: <span className="text-green-400">{potentialWin}</span></span>
            </div>
          </div>

          {/* Bet amount + spin */}
          <div className="bg-casino-card border border-casino-border rounded-2xl p-3">
            <div className="grid grid-cols-3 gap-3 items-end">
              <div className="space-y-1">
                <span className="text-xs text-casino-muted font-mono uppercase tracking-widest">Bet Amount</span>
                <input type="number" value={betAmount} onChange={e => setBetAmount(e.target.value)}
                  className="w-full bg-casino-surface border border-casino-border rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-gold/50" />
                <div className="flex gap-1">
                  <button onClick={halfBet} className="flex-1 bg-casino-surface border border-casino-border rounded px-2 py-1 text-xs text-casino-muted hover:text-white">1/2</button>
                  <button onClick={doubleBet} className="flex-1 bg-casino-surface border border-casino-border rounded px-2 py-1 text-xs text-casino-muted hover:text-white">2x</button>
                  <button onClick={maxBet} className="flex-1 bg-casino-surface border border-casino-border rounded px-2 py-1 text-xs text-casino-muted hover:text-white">Max</button>
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-casino-muted font-mono uppercase tracking-widest">Currency</span>
                <select value={currency} onChange={e => setCurrency(e.target.value)}
                  className="w-full bg-casino-surface border border-casino-border rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-gold/50">
                  {CURRENCIES.map(c => <option key={c} value={c}>{c.replace("_", " ")}</option>)}
                </select>
              </div>
              <button onClick={handleSpin}
                disabled={spinning || (betType === "straight" && betValue === null)}
                className="py-3 rounded-xl font-bold text-sm transition-all bg-gradient-to-r from-green-600 to-green-500 text-white hover:shadow-lg hover:shadow-green-500/20 disabled:opacity-50 disabled:cursor-not-allowed">
                {spinning ? "Spinning..." : "SPIN"}
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <BetHistory title="Roulette History" bets={history} onLoadMore={() => setHistoryPage(p => p + 1)} />
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
