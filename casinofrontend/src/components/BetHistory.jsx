"use client";

export default function BetHistory({ history, currency, onLoadMore }) {
  return (
    <div className="bg-casino-card border border-casino-border rounded-2xl overflow-hidden h-full flex flex-col">
      <div className="px-4 py-3 border-b border-casino-border flex items-center justify-between">
        <h3 className="text-sm font-mono uppercase tracking-widest text-casino-muted">Bet History</h3>
        <span className="text-xs text-casino-muted">{history.length} bets</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {history.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-casino-muted text-sm font-mono">
            No bets yet
          </div>
        ) : (
          <div className="divide-y divide-casino-border">
            {history.map((bet, i) => (
              <BetRow key={bet.id ?? i} bet={bet} />
            ))}
          </div>
        )}
      </div>

      {history.length >= 20 && (
        <div className="p-3 border-t border-casino-border">
          <button
            onClick={onLoadMore}
            className="w-full text-casino-muted text-xs font-mono hover:text-white transition-colors py-1"
          >
            Load more
          </button>
        </div>
      )}
    </div>
  );
}

function BetRow({ bet }) {
  const won = bet.won;
  const amount = bet.betAmount ?? bet.bet_amount;
  const roll = typeof bet.roll === "number" ? bet.roll : parseFloat(bet.roll);
  return (
    <div className={`px-4 py-3 flex items-center gap-3 hover:bg-casino-surface/50 transition-colors ${
      won ? "border-l-2 border-green-500/40" : "border-l-2 border-red-500/20"
    }`}>
      {/* Roll */}
      <div className={`font-mono font-bold text-sm w-12 shrink-0 ${won ? "text-green-400" : "text-red-400"}`}>
        {!isNaN(roll) ? roll.toFixed(2) : "—"}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="text-xs text-casino-muted font-mono truncate">
          {bet.direction} {bet.target} · {bet.multiplier}×
        </div>
        <div className="text-xs text-casino-muted/60 font-mono">
          {amount} → {won ? parseFloat(bet.payout).toFixed(2) : "0"}
        </div>
      </div>

      {/* Profit */}
      <div className={`text-xs font-mono font-semibold shrink-0 ${
        won ? "text-green-400" : "text-red-400"
      }`}>
        {won ? `+${(parseFloat(bet.payout) - parseFloat(amount)).toFixed(2)}` : `-${amount}`}
      </div>
    </div>
  );
}
