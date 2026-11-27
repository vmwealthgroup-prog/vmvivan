/** Close-confirmed 20/200 EMA cross with a session VWAP stop. No lookahead. */

export type Candle = {
  time: number;
  session: string;
  clock: string;
  barInSession: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type Effect = "open_long" | "close_long" | "open_short" | "close_short";

export type Signal = {
  key: string;
  effect: Effect;
  reason: string;
  price: number;
  clock: string;
  session: string;
};

export type Mark = Candle & {
  ema20: number | null;
  ema200: number | null;
  vwap: number | null;
};

const IST = 5.5 * 60 * 60 * 1000;
const OPEN = 9 * 60 + 15;

export function ema(values: number[], period: number): Array<number | null> {
  const out: Array<number | null> = Array(values.length).fill(null);
  if (values.length < period) return out;
  const k = 2 / (period + 1);
  let prev = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i += 1) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

export function istParts(ms: number) {
  const shifted = new Date(ms + IST);
  const minutes = shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
  const session = `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
  const barInSession = Math.floor((minutes - OPEN) / 5);
  const clockMin = OPEN + Math.max(0, barInSession) * 5;
  const clock = `${String(Math.floor(clockMin / 60)).padStart(2, "0")}:${String(clockMin % 60).padStart(2, "0")}`;
  return { session, minutes, barInSession, clock, inSession: barInSession >= 0 && barInSession < 75 };
}

export function candleFromHistory(time: number, open: number, high: number, low: number, close: number, volume: number): Candle | null {
  const parts = istParts(time);
  if (!parts.inSession) return null;
  return {
    time,
    session: parts.session,
    clock: parts.clock,
    barInSession: parts.barInSession,
    open,
    high,
    low,
    close,
    volume: Math.max(0, volume),
  };
}

function crossedUp(fast: Array<number | null>, slow: Array<number | null>, i: number) {
  if (i < 1) return false;
  const a0 = fast[i - 1];
  const b0 = slow[i - 1];
  const a1 = fast[i];
  const b1 = slow[i];
  if (a0 == null || b0 == null || a1 == null || b1 == null) return false;
  return a0 <= b0 && a1 > b1;
}

function crossedDown(fast: Array<number | null>, slow: Array<number | null>, i: number) {
  if (i < 1) return false;
  const a0 = fast[i - 1];
  const b0 = slow[i - 1];
  const a1 = fast[i];
  const b1 = slow[i];
  if (a0 == null || b0 == null || a1 == null || b1 == null) return false;
  return a0 >= b0 && a1 < b1;
}

export function markCandles(candles: Candle[]): Mark[] {
  const fast = ema(
    candles.map((candle) => candle.close),
    20,
  );
  const slow = ema(
    candles.map((candle) => candle.close),
    200,
  );
  const vwap: Array<number | null> = [];
  let pv = 0;
  let vol = 0;
  let typicalSum = 0;
  let count = 0;
  let session = "";
  for (const candle of candles) {
    if (candle.session !== session) {
      pv = 0;
      vol = 0;
      typicalSum = 0;
      count = 0;
      session = candle.session;
    }
    const typical = (candle.high + candle.low + candle.close) / 3;
    pv += typical * candle.volume;
    vol += candle.volume;
    typicalSum += typical;
    count += 1;
    vwap.push(vol > 0 ? pv / vol : typicalSum / count);
  }
  return candles.map((candle, index) => ({
    ...candle,
    ema20: fast[index],
    ema200: slow[index],
    vwap: vwap[index],
  }));
}

export function runSignals(candles: Candle[], allowShort: boolean): { marks: Mark[]; signals: Signal[]; side: "flat" | "long" | "short" } {
  const marks = markCandles(candles);
  const fast = marks.map((mark) => mark.ema20);
  const slow = marks.map((mark) => mark.ema200);
  const signals: Signal[] = [];
  let side: "flat" | "long" | "short" = "flat";
  let entryBar = -1;

  const push = (index: number, effect: Effect, reason: string) => {
    const mark = marks[index];
    signals.push({
      key: `${mark.session}|${mark.clock}|${effect}|${reason}`,
      effect,
      reason,
      price: mark.close,
      clock: mark.clock,
      session: mark.session,
    });
  };

  for (let i = 0; i < marks.length; i += 1) {
    const mark = marks[i];
    if (mark.ema20 == null || mark.ema200 == null || mark.vwap == null) continue;
    const up = crossedUp(fast, slow, i);
    const down = crossedDown(fast, slow, i);
    const canOpen = mark.barInSession >= 6 && mark.barInSession <= 66;

    if (up) {
      if (side === "short") {
        push(i, "close_short", "ema20_cross_above_ema200");
        side = "flat";
      }
      if (side === "flat" && canOpen && mark.close > mark.vwap) {
        push(i, "open_long", "ema20_cross_above_ema200");
        side = "long";
        entryBar = i;
      }
    } else if (down) {
      if (side === "long") {
        push(i, "close_long", "ema20_cross_below_ema200");
        side = "flat";
      }
      if (side === "flat" && canOpen && allowShort && mark.close < mark.vwap) {
        push(i, "open_short", "ema20_cross_below_ema200");
        side = "short";
        entryBar = i;
      }
    } else if (side === "long" && i > entryBar && mark.barInSession >= 6 && i > 0 && marks[i - 1].session === mark.session) {
      const prev = marks[i - 1];
      if (prev.vwap != null && prev.close >= prev.vwap && mark.close < mark.vwap) {
        push(i, "close_long", "vwap_stop");
        side = "flat";
      }
    } else if (side === "short" && i > entryBar && mark.barInSession >= 6 && i > 0 && marks[i - 1].session === mark.session) {
      const prev = marks[i - 1];
      if (prev.vwap != null && prev.close <= prev.vwap && mark.close > mark.vwap) {
        push(i, "close_short", "vwap_stop");
        side = "flat";
      }
    }

    if (side !== "flat" && mark.barInSession === 74) {
      push(i, side === "long" ? "close_long" : "close_short", "session_flat");
      side = "flat";
    }
  }

  return { marks, signals, side };
}

export function orderSide(effect: Effect): "B" | "S" {
  return effect === "open_long" || effect === "close_short" ? "B" : "S";
}
