/** Exact 20/200 EMA cross with a session VWAP stop. Sample tape, not a broker. */

export type InstrumentId = "nifty" | "banknifty" | "reliance" | "hdfcbank" | "tcs";

export type Instrument = {
  id: InstrumentId;
  name: string;
  venue: string;
  kind: "index" | "stock";
  base: number;
  noise: number;
  unit: string;
};

export const INSTRUMENTS: Instrument[] = [
  { id: "nifty", name: "Nifty 50", venue: "NSE", kind: "index", base: 24480, noise: 0.00055, unit: "pts" },
  { id: "banknifty", name: "Bank Nifty", venue: "NSE", kind: "index", base: 52140, noise: 0.0007, unit: "pts" },
  { id: "reliance", name: "Reliance", venue: "NSE", kind: "stock", base: 1486, noise: 0.0008, unit: "₹" },
  { id: "hdfcbank", name: "HDFC Bank", venue: "NSE", kind: "stock", base: 1742, noise: 0.0007, unit: "₹" },
  { id: "tcs", name: "TCS", venue: "NSE", kind: "stock", base: 4128, noise: 0.00065, unit: "₹" },
];

export const SESSION_BARS = 75;
export const BAR_MINUTES = 5;

const SESSION_DATES = [
  [2026, 10, 16],
  [2026, 10, 17],
  [2026, 10, 18],
  [2026, 10, 19],
  [2026, 10, 20],
  [2026, 10, 23],
  [2026, 10, 24],
  [2026, 10, 25],
] as const;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type Side = "long" | "short" | "flat";

export type Bar = {
  i: number;
  session: number;
  label: string;
  clock: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  ema20: number | null;
  ema200: number | null;
  vwap: number;
};

export type FillAction = "BUY" | "SELL" | "EXIT";

export type Fill = {
  i: number;
  label: string;
  action: FillAction;
  price: number;
  reason: string;
  pnl: number | null;
};

export type Sim = {
  instrument: Instrument;
  bars: Bar[];
  fills: Fill[];
};

export type Book = {
  side: Side;
  entry: number | null;
  entryLabel: string | null;
  entryReason: string | null;
  realized: number;
  unrealized: number;
  closed: number;
  wins: number;
  last: Fill | null;
};

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Scheduled drift so a real 20/200 cross and a real VWAP cross both print. */
function driftAt(i: number): number {
  if (i < 240) return -0.00016;
  if (i < 278) return 0.00145;
  if (i < 318) return -0.0012;
  if (i < 345) return 0.00012;
  if (i < 430) return -0.00082;
  if (i < 468) return -0.00012;
  if (i < 515) return 0.00125;
  if (i < 555) return -0.00105;
  return 0.00004;
}

const PHASE: Record<InstrumentId, number> = {
  nifty: 0,
  banknifty: 8,
  reliance: -6,
  hdfcbank: 14,
  tcs: -11,
};

function pad(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

export function barLabel(index: number): { label: string; clock: string; session: number } {
  const session = Math.floor(index / SESSION_BARS);
  const slot = index % SESSION_BARS;
  const date = SESSION_DATES[Math.min(session, SESSION_DATES.length - 1)] ?? SESSION_DATES[0];
  const minutes = 9 * 60 + 15 + slot * BAR_MINUTES;
  const hh = Math.floor(minutes / 60);
  const mm = minutes % 60;
  const clock = `${pad(hh)}:${pad(mm)}`;
  const label = `${date[2]} ${MONTHS[date[1]]} ${clock}`;
  return { label, clock, session };
}

export function computeEma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = Array.from({ length: values.length }, () => null);
  if (values.length < period) return out;
  const k = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i] ?? 0;
  let prev = sum / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    const price = values[i] ?? prev;
    prev = price * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

function buildCloses(instrument: Instrument): { o: number; h: number; l: number; c: number; v: number }[] {
  const count = SESSION_DATES.length * SESSION_BARS;
  const rand = mulberry32(
    instrument.id.split("").reduce((acc, ch) => acc + ch.charCodeAt(0) * 17, 1000),
  );
  const rows: { o: number; h: number; l: number; c: number; v: number }[] = [];
  let price = instrument.base;
  for (let i = 0; i < count; i++) {
    if (i > 0 && i % SESSION_BARS === 0) {
      price *= 1 + (rand() - 0.5) * 0.0012;
    }
    const open = price;
    const shock = (rand() - 0.48) * instrument.noise;
    const ret = driftAt(i - (PHASE[instrument.id] ?? 0)) + shock;
    const close = Math.max(0.5, open * (1 + ret));
    const wick = Math.abs(close - open) * (0.25 + rand() * 0.85) + close * instrument.noise * 0.35;
    const high = Math.max(open, close) + wick * (0.35 + rand());
    const low = Math.min(open, close) - wick * (0.35 + rand());
    const volume = Math.round(80000 * (0.65 + rand()) * (1 + Math.min(4, Math.abs(ret) * 900)));
    rows.push({ o: open, h: high, l: Math.max(0.25, low), c: close, v: volume });
    price = close;
  }
  return rows;
}

export function simulate(instrument: Instrument): Sim {
  const raw = buildCloses(instrument);
  const closes = raw.map((row) => row.c);
  const ema20 = computeEma(closes, 20);
  const ema200 = computeEma(closes, 200);

  let cumPv = 0;
  let cumV = 0;
  let session = -1;
  const bars: Bar[] = raw.map((row, i) => {
    const meta = barLabel(i);
    if (meta.session !== session) {
      cumPv = 0;
      cumV = 0;
      session = meta.session;
    }
    const typical = (row.h + row.l + row.c) / 3;
    cumPv += typical * row.v;
    cumV += row.v;
    return {
      i,
      session: meta.session,
      label: meta.label,
      clock: meta.clock,
      open: row.o,
      high: row.h,
      low: row.l,
      close: row.c,
      volume: row.v,
      ema20: ema20[i] ?? null,
      ema200: ema200[i] ?? null,
      vwap: cumPv / cumV,
    };
  });

  const fills: Fill[] = [];
  let side: Side = "flat";
  let entry = 0;

  for (let i = 1; i < bars.length; i++) {
    const bar = bars[i];
    const prev = bars[i - 1];
    if (!bar || !prev) continue;
    const fast = bar.ema20;
    const slow = bar.ema200;
    const prevFast = prev.ema20;
    const prevSlow = prev.ema200;
    if (fast == null || slow == null || prevFast == null || prevSlow == null) continue;

    const crossUp = prevFast <= prevSlow && fast > slow;
    const crossDown = prevFast >= prevSlow && fast < slow;
    const close = bar.close;
    const vwap = bar.vwap;
    const sameSession = bar.session === prev.session;
    const lostVwap = sameSession && prev.close >= prev.vwap && close < vwap;
    const reclaimedVwap = sameSession && prev.close <= prev.vwap && close > vwap;

    if (side === "long" && (lostVwap || crossDown)) {
      fills.push({
        i,
        label: bar.label,
        action: "EXIT",
        price: close,
        reason: lostVwap && crossDown
          ? "Cross down through VWAP"
          : lostVwap
            ? "VWAP stop — close crossed under session VWAP"
            : "20 crossed below 200 — flat",
        pnl: close - entry,
      });
      side = "flat";
    } else if (side === "short" && (reclaimedVwap || crossUp)) {
      fills.push({
        i,
        label: bar.label,
        action: "EXIT",
        price: close,
        reason: reclaimedVwap && crossUp
          ? "Cross up through VWAP"
          : reclaimedVwap
            ? "VWAP stop — close crossed back over session VWAP"
            : "20 crossed above 200 — flat",
        pnl: entry - close,
      });
      side = "flat";
    }

    if (side === "flat" && crossUp && close > vwap) {
      side = "long";
      entry = close;
      fills.push({
        i,
        label: bar.label,
        action: "BUY",
        price: close,
        reason: "20 crossed above 200, close above VWAP",
        pnl: null,
      });
    } else if (side === "flat" && crossDown && close < vwap) {
      side = "short";
      entry = close;
      fills.push({
        i,
        label: bar.label,
        action: "SELL",
        price: close,
        reason: "20 crossed below 200, close below VWAP",
        pnl: null,
      });
    }
  }

  return { instrument, bars, fills };
}

export function bookAt(sim: Sim, cursor: number): Book {
  let side: Side = "flat";
  let entry: number | null = null;
  let entryLabel: string | null = null;
  let entryReason: string | null = null;
  let realized = 0;
  let closed = 0;
  let wins = 0;
  let last: Fill | null = null;

  for (const fill of sim.fills) {
    if (fill.i > cursor) break;
    last = fill;
    if (fill.action === "BUY") {
      side = "long";
      entry = fill.price;
      entryLabel = fill.label;
      entryReason = fill.reason;
    } else if (fill.action === "SELL") {
      side = "short";
      entry = fill.price;
      entryLabel = fill.label;
      entryReason = fill.reason;
    } else {
      side = "flat";
      entry = null;
      entryLabel = null;
      entryReason = null;
      if (fill.pnl != null) {
        realized += fill.pnl;
        closed += 1;
        if (fill.pnl > 0) wins += 1;
      }
    }
  }

  const bar = sim.bars[Math.min(cursor, sim.bars.length - 1)];
  let unrealized = 0;
  if (bar && entry != null && side === "long") unrealized = bar.close - entry;
  if (bar && entry != null && side === "short") unrealized = entry - bar.close;

  return { side, entry, entryLabel, entryReason, realized, unrealized, closed, wins, last };
}

export function formatPx(n: number, digits = 2): string {
  const sign = n < 0 ? "-" : "";
  const [whole, frac] = Math.abs(n).toFixed(digits).split(".");
  const grouped = (whole ?? "0").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return frac ? `${sign}${grouped}.${frac}` : `${sign}${grouped}`;
}

export function formatPnl(n: number, unit: string): string {
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  const body = formatPx(Math.abs(n), 2);
  return unit === "₹" ? `${sign}₹${body}` : `${sign}${body} ${unit}`;
}

const cache = new Map<InstrumentId, Sim>();

export function getSim(id: InstrumentId): Sim {
  const hit = cache.get(id);
  if (hit) return hit;
  const instrument = INSTRUMENTS.find((item) => item.id === id) ?? INSTRUMENTS[0];
  const sim = simulate(instrument);
  cache.set(id, sim);
  return sim;
}
