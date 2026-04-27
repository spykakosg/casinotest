"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import BetHistory from "@/components/BetHistory";
import { placeRouletteBet, getBalances, getRouletteBetHistory } from "@/lib/api";

const CURRENCIES = ["USDT_POLYGON", "ETH_POLYGON", "USDT_TRON", "BTC"];

const RED_NUMBERS  = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
const BLACK_NUMBERS = [2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35];

function getColor(n) {
  if (n === 0) return "green";
  return RED_NUMBERS.includes(n) ? "red" : "black";
}

const WHEEL_ORDER = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];

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
  const [selectedNumber, setSelectedNumber] = useState(null);

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
        betType: betType === "straight" ? "straight" : betType,
        betValue: betType === "straight" ? selectedNumber : undefined,
      });
      setResult(data.bet);
      setBalances(prev => ({ ...prev, [currency]: data.balance }));
      setHistory(prev => [{
        id: data.bet.betId,
        game: "roulette",
        bet_amount: data.bet.betAmount,
        payout: data.bet.payout,
        profit: data.bet.profit,
        won: data.bet.won,
        multiplier: data.bet.multiplier,
        created_at: new Date().toISOString(),
      }, ...prev]);
    } catch (err) {
      setError(err.message);
    } finally {
      setSpinning(false);
    }
  }

  function halfBet()   { setBetAmount(v => Math.max(0.01, parseFloat(v) / 2).toFixed(2)); }
  function doubleBet() { setBetAmount(v => (parseFloat(v) * 2).toFixed(2)); }
  function maxBet()    { setBetAmount((balances[currency] || 0).toFixed(2)); }

  if (authLoading) return <LoadingScreen />;

  const payoutMap = {
    straight: 36, red: 2, black: 2, odd: 2, even: 2,
    low: 2, high: 2, dozen1: 3, dozen2: 3, dozen3: 3,
    column1: 3, column2: 3, column3: 3,
  };
  const currentPayout = payoutMap[betType] || 2;
  const potentialWin = ((parseFloat(betAmount) || 0) * currentPayout).toFixed(2);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar balances={balances} activeCurrency={currency} onCurrencyChange={setCurrency} />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">

          {/* Roulette Wheel Display */}
          <div className="bg-casino-card border border-casino-border rounded-2xl p-4 min-h-[120px] flex flex-col items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-5"
              style={{backgroundImage:"radial-gradient(circle at 50% 50%, var(--gold) 0%, transparent 70%)"}} />

            {spinning ? (
              <div className="text-center relative z-10">
                <div className="w-16 h-16 border-4 border-gold border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-casino-muted text-sm">Spinning...</p>
              </div>
            ) : result ? (
              <div className="text-center relative z-10">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold mx-auto mb-2 border-2 ${
                  result.color === "green" ? "bg-green-600 border-green-400" :
                  result.color === "red" ? "bg-red-600 border-red-400" :
                  "bg-gray-800 border-gray-500"
                }`}>
                  {result.result}
                </div>
                <p className={`text-lg font-bold ${result.won ? "text-green-400" : "text-red-400"}`}>
                  {result.won ? `+${result.profit.toFixed(2)}` : result.profit.toFixed(2)}
                </p>
                <p className="text-casino-muted text-xs capitalize">{result.color}</p>
              </div>
            ) : (
              <div className="text-center relative z-10">
                <p className="text-5xl font-bold text-casino-muted/40 font-mono">0</p>
                <p className="text-casino-muted text-sm mt-1">Place a bet to spin</p>
              </div>
            )}
          </div>

          {/* Recent results strip */}
          {history.length > 0 && (
            <div className="flex gap-1 overflow-x-auto pb-1">
              {history.slice(0, 20).map((bet, i) => {
                const num = bet.roll ?? bet.result;
                const c = num !== undefined ? getColor(num) : "gray";
                return (
                  <div key={bet.id || i} className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    c === "green" ? "bg-green-600" : c === "red" ? "bg-red-600" : "bg-gray-700"
                  }`}>
                    {num ?? "?"}
                  </div>
                );
              })}
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          {/* Controls */}
          <div className="bg-casino-card border border-casino-border rounded-2xl p-4 space-y-3">
            {/* Bet type buttons */}
            <div className="space-y-2">
              <span className="text-xs text-casino-muted font-mono uppercase tracking-widest">Bet Type</span>
              <div className="grid grid-cols-4 gap-1.5">
                <BetTypeBtn active={betType === "red"} onClick={() => { setBetType("red"); setBetValue(null); }}
                  className="bg-red-600/20 border-red-500/40 text-red-400">Red</BetTypeBtn>
                <BetTypeBtn active={betType === "black"} onClick={() => { setBetType("black"); setBetValue(null); }}
                  className="bg-gray-600/20 border-gray-500/40 text-gray-300">Black</BetTypeBtn>
                <BetTypeBtn active={betType === "odd"} onClick={() => { setBetType("odd"); setBetValue(null); }}>Odd</BetTypeBtn>
                <BetTypeBtn active={betType === "even"} onClick={() => { setBetType("even"); setBetValue(null); }}>Even</BetTypeBtn>
                <BetTypeBtn active={betType === "low"} onClick={() => { setBetType("low"); setBetValue(null); }}>1-18</BetTypeBtn>
                <BetTypeBtn active={betType === "high"} onClick={() => { setBetType("high"); setBetValue(null); }}>19-36</BetTypeBtn>
                <BetTypeBtn active={betType === "dozen1"} onClick={() => { setBetType("dozen1"); setBetValue(null); }}>1st 12</BetTypeBtn>
                <BetTypeBtn active={betType === "dozen2"} onClick={() => { setBetType("dozen2"); setBetValue(null); }}>2nd 12</BetTypeBtn>
                <BetTypeBtn active={betType === "dozen3"} onClick={() => { setBetType("dozen3"); setBetValue(null); }}>3rd 12</BetTypeBtn>
                <BetTypeBtn active={betType === "straight"} onClick={() => setBetType("straight")}>Number</BetTypeBtn>
              </div>
            </div>

            {/* Number picker for straight bet */}
            {betType === "straight" && (
              <div className="space-y-2">
                <span className="text-xs text-casino-muted font-mono uppercase tracking-widest">Pick Number</span>
                <div className="grid grid-cols-10 gap-1">
                  {Array.from({length: 37}, (_, i) => i).map(n => (
                    <button key={n} onClick={() => setSelectedNumber(n)}
                      className={`w-full aspect-square rounded text-xs font-bold transition-all ${
                        selectedNumber === n ? "ring-2 ring-gold scale-110" : ""
                      } ${getColor(n) === "green" ? "bg-green-600" : getColor(n) === "red" ? "bg-red-600" : "bg-gray-700"}`}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Bet amount + currency side by side */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <span className="text-xs text-casino-muted font-mono uppercase tracking-widest">Bet Amount</span>
                <div className="flex items-center gap-1">
                  <input type="number" value={betAmount} onChange={e => setBetAmount(e.target.value)}
                    className="w-full bg-casino-surface border border-casino-border rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-gold/50" />
                </div>
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
                <div className="text-xs text-casino-muted mt-1">
                  Payout: <span className="text-gold">{currentPayout}x</span> | Win: <span className="text-green-400">{potentialWin}</span>
                </div>
              </div>
            </div>

            <button onClick={handleSpin}
              disabled={spinning || (betType === "straight" && selectedNumber === null)}
              className="w-full py-3 rounded-xl font-bold text-sm transition-all bg-gradient-to-r from-gold to-yellow-500 text-black hover:shadow-lg hover:shadow-gold/20 disabled:opacity-50 disabled:cursor-not-allowed">
              {spinning ? "Spinning..." : "Spin Roulette"}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <BetHistory
            title="Roulette History"
            bets={history}
            onLoadMore={() => setHistoryPage(p => p + 1)}
          />
        </div>
      </main>
    </div>
  );
}

function BetTypeBtn({ active, onClick, children, className = "" }) {
  return (
    <button onClick={onClick}
      className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-all border ${
        active
          ? "bg-gold/20 border-gold/50 text-gold"
          : `bg-casino-surface border-casino-border text-casino-muted hover:text-white ${className}`
      }`}>
      {children}
    </button>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
