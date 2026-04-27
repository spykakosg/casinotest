"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import BetHistory from "@/components/BetHistory";
import { blackjackDeal, blackjackAction, getBalances, getBlackjackBetHistory } from "@/lib/api";

const CURRENCIES = ["USDT_POLYGON", "ETH_POLYGON", "USDT_TRON", "BTC"];

const SUIT_SYMBOLS = { hearts: "\u2665", diamonds: "\u2666", clubs: "\u2663", spades: "\u2660" };
const SUIT_COLORS  = { hearts: "text-red-500", diamonds: "text-red-500", clubs: "text-white", spades: "text-white" };

function Card({ card, hidden = false }) {
  if (hidden) {
    return (
      <div className="w-16 h-24 bg-gradient-to-br from-blue-800 to-blue-600 border-2 border-blue-400/30 rounded-lg flex items-center justify-center shadow-lg">
        <span className="text-2xl text-blue-300/50">?</span>
      </div>
    );
  }
  const suitChar = SUIT_SYMBOLS[card.suit] || card.suit;
  const colorClass = SUIT_COLORS[card.suit] || "text-white";
  return (
    <div className="w-16 h-24 bg-white border-2 border-gray-200 rounded-lg flex flex-col items-center justify-center shadow-lg relative">
      <span className={`text-xs font-bold absolute top-1 left-1.5 ${["hearts","diamonds"].includes(card.suit) ? "text-red-600" : "text-gray-900"}`}>{card.rank}</span>
      <span className={`text-2xl ${colorClass}`}>{suitChar}</span>
      <span className={`text-xs font-bold absolute bottom-1 right-1.5 rotate-180 ${["hearts","diamonds"].includes(card.suit) ? "text-red-600" : "text-gray-900"}`}>{card.rank}</span>
    </div>
  );
}

function HandDisplay({ cards, value, label }) {
  return (
    <div className="text-center">
      <p className="text-xs text-casino-muted font-mono uppercase tracking-widest mb-2">
        {label} {value !== null && value !== undefined ? `(${value})` : ""}
      </p>
      <div className="flex gap-2 justify-center flex-wrap">
        {cards.map((card, i) => <Card key={i} card={card} />)}
      </div>
    </div>
  );
}

export default function BlackjackPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [currency, setCurrency]   = useState("USDT_POLYGON");
  const [betAmount, setBetAmount] = useState("10");
  const [error, setError]         = useState("");
  const [balances, setBalances]   = useState({});
  const [history, setHistory]     = useState([]);
  const [historyPage, setHistoryPage] = useState(0);

  // Game state
  const [phase, setPhase]               = useState("betting"); // betting | playing | result
  const [gameId, setGameId]             = useState(null);
  const [playerCards, setPlayerCards]    = useState([]);
  const [dealerCards, setDealerCards]    = useState([]);
  const [dealerUpCard, setDealerUpCard] = useState(null);
  const [playerValue, setPlayerValue]   = useState(null);
  const [dealerValue, setDealerValue]   = useState(null);
  const [outcome, setOutcome]           = useState(null);
  const [profit, setProfit]             = useState(null);
  const [busy, setBusy]                 = useState(false);

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
      const data = await getBlackjackBetHistory(20, historyPage * 20);
      setHistory(prev => historyPage === 0 ? data.bets : [...prev, ...data.bets]);
    } catch {}
  }

  async function handleDeal() {
    setError("");
    setBusy(true);
    setOutcome(null);
    setProfit(null);
    setDealerCards([]);
    setDealerUpCard(null);
    setDealerValue(null);
    try {
      const data = await blackjackDeal({
        currency,
        betAmount: parseFloat(betAmount),
      });
      setGameId(data.gameId);
      setPlayerCards(data.playerCards);
      setPlayerValue(data.playerValue);
      setBalances(prev => ({ ...prev, [currency]: data.balance }));

      if (data.finished) {
        // Natural blackjack or dealer blackjack
        setDealerCards(data.dealerCards);
        setDealerValue(data.dealerValue);
        setOutcome(data.outcome);
        setProfit(data.profit);
        setPhase("result");
        addToHistory(data);
      } else {
        setDealerUpCard(data.dealerUpCard);
        setPhase("playing");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleAction(action) {
    setError("");
    setBusy(true);
    try {
      const data = await blackjackAction({ gameId, action });
      setPlayerCards(data.playerCards);
      setPlayerValue(data.playerValue);
      setBalances(prev => data.balance !== undefined ? { ...prev, [currency]: data.balance } : prev);

      if (data.finished) {
        setDealerCards(data.dealerCards);
        setDealerValue(data.dealerValue);
        setOutcome(data.outcome);
        setProfit(data.profit);
        setPhase("result");
        addToHistory(data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function addToHistory(data) {
    setHistory(prev => [{
      id: Date.now(),
      game: "blackjack",
      bet_amount: parseFloat(betAmount),
      payout: data.payout || 0,
      profit: data.profit || 0,
      won: (data.multiplier || 0) > 1,
      multiplier: data.multiplier || 0,
      created_at: new Date().toISOString(),
    }, ...prev]);
  }

  function newGame() {
    setPhase("betting");
    setGameId(null);
    setPlayerCards([]);
    setDealerCards([]);
    setDealerUpCard(null);
    setPlayerValue(null);
    setDealerValue(null);
    setOutcome(null);
    setProfit(null);
  }

  function halfBet()   { setBetAmount(v => Math.max(0.01, parseFloat(v) / 2).toFixed(2)); }
  function doubleBet() { setBetAmount(v => (parseFloat(v) * 2).toFixed(2)); }
  function maxBet()    { setBetAmount(((balances[currency] || 0) / 2).toFixed(2)); }

  if (authLoading) return <LoadingScreen />;

  const outcomeLabels = {
    blackjack: "BLACKJACK!",
    win: "YOU WIN!",
    dealer_bust: "DEALER BUST!",
    push: "PUSH",
    bust: "BUST",
    lose: "DEALER WINS",
    dealer_blackjack: "DEALER BLACKJACK",
  };

  const outcomeColors = {
    blackjack: "text-yellow-400",
    win: "text-green-400",
    dealer_bust: "text-green-400",
    push: "text-yellow-400",
    bust: "text-red-400",
    lose: "text-red-400",
    dealer_blackjack: "text-red-400",
  };

  // Build dealer display cards
  const displayDealerCards = phase === "playing" && dealerUpCard
    ? [dealerUpCard, { suit: "back", rank: "?" }]
    : dealerCards;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar balances={balances} activeCurrency={currency} onCurrencyChange={setCurrency} />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">

          {/* Card Table */}
          <div className="bg-casino-card border border-casino-border rounded-2xl p-6 min-h-[280px] flex flex-col items-center justify-center relative overflow-hidden"
               style={{background:"linear-gradient(135deg, #1a2e1a 0%, #0f1f0f 100%)"}}>

            {phase === "betting" && !busy && (
              <div className="text-center relative z-10">
                <p className="text-5xl font-bold text-green-900/60 font-mono mb-2">BLACKJACK</p>
                <p className="text-green-600/60 text-sm">Place your bet and deal</p>
              </div>
            )}

            {busy && phase === "betting" && (
              <div className="text-center relative z-10">
                <div className="w-16 h-16 border-4 border-gold border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-casino-muted text-sm">Dealing...</p>
              </div>
            )}

            {(phase === "playing" || phase === "result") && (
              <div className="w-full space-y-6 relative z-10">
                {/* Dealer hand */}
                {phase === "playing" && dealerUpCard ? (
                  <div className="text-center">
                    <p className="text-xs text-green-400/60 font-mono uppercase tracking-widest mb-2">Dealer</p>
                    <div className="flex gap-2 justify-center">
                      <Card card={dealerUpCard} />
                      <Card card={{}} hidden={true} />
                    </div>
                  </div>
                ) : phase === "result" && dealerCards.length > 0 ? (
                  <HandDisplay cards={dealerCards} value={dealerValue} label="Dealer" />
                ) : null}

                <div className="border-t border-green-800/30" />

                {/* Player hand */}
                <HandDisplay cards={playerCards} value={playerValue} label="You" />

                {/* Outcome */}
                {phase === "result" && outcome && (
                  <div className="text-center">
                    <p className={`text-2xl font-bold ${outcomeColors[outcome] || "text-white"}`}>
                      {outcomeLabels[outcome] || outcome}
                    </p>
                    {profit !== null && (
                      <p className={`text-sm font-mono ${profit >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {profit >= 0 ? "+" : ""}{profit.toFixed(2)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          {/* Controls */}
          <div className="bg-casino-card border border-casino-border rounded-2xl p-4 space-y-3">
            {phase === "betting" && (
              <>
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
                    <p className="text-xs text-casino-muted">BJ pays 3:2 | Need 2x for double</p>
                  </div>
                </div>

                <button onClick={handleDeal} disabled={busy}
                  className="w-full py-3 rounded-xl font-bold text-sm transition-all bg-gradient-to-r from-gold to-yellow-500 text-black hover:shadow-lg hover:shadow-gold/20 disabled:opacity-50 disabled:cursor-not-allowed">
                  {busy ? "Dealing..." : "Deal"}
                </button>
              </>
            )}

            {phase === "playing" && (
              <div className="flex gap-2">
                <button onClick={() => handleAction("hit")} disabled={busy}
                  className="flex-1 py-3 rounded-xl font-bold text-sm bg-green-600 hover:bg-green-500 text-white transition-all disabled:opacity-50">
                  Hit
                </button>
                <button onClick={() => handleAction("stand")} disabled={busy}
                  className="flex-1 py-3 rounded-xl font-bold text-sm bg-red-600 hover:bg-red-500 text-white transition-all disabled:opacity-50">
                  Stand
                </button>
                <button onClick={() => handleAction("double")} disabled={busy}
                  className="flex-1 py-3 rounded-xl font-bold text-sm bg-yellow-600 hover:bg-yellow-500 text-white transition-all disabled:opacity-50">
                  Double
                </button>
              </div>
            )}

            {phase === "result" && (
              <button onClick={newGame}
                className="w-full py-3 rounded-xl font-bold text-sm transition-all bg-gradient-to-r from-gold to-yellow-500 text-black hover:shadow-lg hover:shadow-gold/20">
                New Game
              </button>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <BetHistory
            title="Blackjack History"
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
