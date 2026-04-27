const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("casino_token");
}

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export async function login(username, password) {
  const data = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  localStorage.setItem("casino_token", data.token);
  return data;
}

export async function register(username, password, email) {
  const data = await request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ username, password, email }),
  });
  localStorage.setItem("casino_token", data.token);
  return data;
}

export function logout() {
  localStorage.removeItem("casino_token");
}

export async function getMe() {
  return request("/api/auth/me");
}

export async function getSeeds() {
  return request("/api/auth/seeds");
}

export async function setClientSeed(currency, clientSeed) {
  return request("/api/auth/client-seed", {
    method: "PUT",
    body: JSON.stringify({ currency, clientSeed }),
  });
}

export async function rotateServerSeed(currency) {
  return request("/api/games/dice/seed", {
    method: "POST",
    body: JSON.stringify({ currency }),
  });
}

// ─── Games ────────────────────────────────────────────────────────────────────
export async function placeDiceBet({ currency, betAmount, target, direction }) {
  return request("/api/games/dice/bet", {
    method: "POST",
    body: JSON.stringify({ currency, betAmount, target, direction }),
  });
}

export async function getDiceInfo() {
  return request("/api/games/dice/info");
}

export async function getBetHistory(limit = 20, offset = 0) {
  return request(`/api/games/bets?limit=${limit}&offset=${offset}&game=dice`);
}

// ─── Wallet ───────────────────────────────────────────────────────────────────
export async function getBalances() {
  return request("/api/wallet/balances");
}

export async function getDepositAddress(currency) {
  return request(`/api/wallet/deposit/${currency}`);
}

export async function requestWithdrawal(currency, amount, toAddress) {
  return request("/api/wallet/withdraw", {
    method: "POST",
    body: JSON.stringify({ currency, amount, toAddress }),
  });
}

export async function getDepositHistory() {
  return request("/api/wallet/deposits");
}

export async function getWithdrawalHistory() {
  return request("/api/wallet/withdrawals");
}

export async function getCrashBetHistory(limit = 20, offset = 0) {
  return request(`/api/crash/my-bets?limit=${limit}&offset=${offset}`);
}
