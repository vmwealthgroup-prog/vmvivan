#!/usr/bin/env python3
"""Veyra rule engine.

Reads strategy/rules.json and runs a close-confirmed 20/200 EMA cross
with a session-VWAP stop. Sample books are synthetic — shaped so the
cross and the stop can both print — and are not live NSE data.

Writes src/data/generated.ts for the landing page.
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RULES_PATH = ROOT / "strategy" / "rules.json"
OUT_PATH = ROOT / "src" / "data" / "generated.ts"

BARS_PER_SESSION = 75
SESSIONS = [
    "2026-11-12",
    "2026-11-13",
    "2026-11-16",
    "2026-11-17",
    "2026-11-18",
    "2026-11-19",
    "2026-11-20",
    "2026-11-23",
]
N_BARS = BARS_PER_SESSION * len(SESSIONS)


def ema(values: list[float], period: int) -> list[float | None]:
    out: list[float | None] = [None] * len(values)
    if len(values) < period:
        return out
    k = 2 / (period + 1)
    prev = sum(values[:period]) / period
    out[period - 1] = prev
    for i in range(period, len(values)):
        prev = values[i] * k + prev * (1 - k)
        out[i] = prev
    return out


def session_vwap(bars: list[dict]) -> list[float | None]:
    out: list[float | None] = []
    cum_pv = 0.0
    cum_v = 0.0
    current = None
    for bar in bars:
        if bar["session"] != current:
            cum_pv = 0.0
            cum_v = 0.0
            current = bar["session"]
        typical = (bar["high"] + bar["low"] + bar["close"]) / 3
        vol = float(bar["volume"])
        cum_pv += typical * vol
        cum_v += vol
        out.append(cum_pv / cum_v if cum_v else None)
    return out


def crossed_up(fast: list[float | None], slow: list[float | None], i: int) -> bool:
    if i < 1:
        return False
    a0, b0, a1, b1 = fast[i - 1], slow[i - 1], fast[i], slow[i]
    if None in (a0, b0, a1, b1):
        return False
    return a0 <= b0 and a1 > b1


def crossed_down(fast: list[float | None], slow: list[float | None], i: int) -> bool:
    if i < 1:
        return False
    a0, b0, a1, b1 = fast[i - 1], slow[i - 1], fast[i], slow[i]
    if None in (a0, b0, a1, b1):
        return False
    return a0 >= b0 and a1 < b1


def _same_session(bars: list[dict], i: int) -> bool:
    return i > 0 and bars[i]["session"] == bars[i - 1]["session"]


def _vwap_ready(i: int) -> bool:
    """Session VWAP is ignored until it holds half an hour of bars."""
    return (i % BARS_PER_SESSION) >= 6


def clock(index: int) -> str:
    minute = 9 * 60 + 15 + (index % BARS_PER_SESSION) * 5
    hour, mins = divmod(minute, 60)
    return f"{hour:02d}:{mins:02d}"


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def build_closes(anchor: float, seed: int) -> list[float]:
    """Decline into a base, then an intraday cross, a VWAP pierce, and a later sell."""
    state = seed % 2147483647
    closes: list[float] = []
    price = anchor

    def noise(scale: float) -> float:
        nonlocal state
        state = (1103515245 * state + 12345) % 2147483647
        return ((state / 2147483647) - 0.5) * scale

    # Five sessions: a gentle decline so the 20 EMA sits under the 200.
    for _ in range(BARS_PER_SESSION * 5):
        price *= 0.9999
        closes.append(price * (1 + noise(0.0004)))

    # 19 Nov — lift through the 200 while VWAP is still nearby, then pierce it.
    rally = (
        [1.0007] * 10
        + [1.00105] * 12
        + [1.00012] * 16
        + [0.9962] * 3
        + [1.0007] * 6
        + [1.00002] * (75 - 47)
    )
    for mult in rally:
        price *= mult
        closes.append(price * (1 + noise(0.00012)))

    # 20 Nov — a downside cross and a contained sell, not a crash.
    sell = [0.99985] * 18 + [0.99945] * 14 + [0.99995] * (75 - 32)
    for mult in sell:
        price *= mult
        closes.append(price * (1 + noise(0.00012)))

    # 23 Nov — drift, no need for another epic trend. Keeps the book honest.
    for _ in range(BARS_PER_SESSION):
        price *= 0.99985
        closes.append(price * (1 + noise(0.0002)))

    if len(closes) != N_BARS:
        raise SystemExit(f"expected {N_BARS} bars, built {len(closes)}")
    return closes


def ohlc(closes: list[float], sessions: list[str], seed: int) -> list[dict]:
    state = (seed * 17) % 2147483647
    bars = []
    prev = closes[0]
    for i, close in enumerate(closes):
        state = (1103515245 * state + 12345) % 2147483647
        wobble = abs(close - prev) * 0.35 + close * 0.00035
        unit = state / 2147483647
        high = max(prev, close) + wobble * (0.35 + unit * 0.65)
        state = (1103515245 * state + 12345) % 2147483647
        unit = state / 2147483647
        low = min(prev, close) - wobble * (0.35 + unit * 0.65)
        state = (1103515245 * state + 12345) % 2147483647
        volume = int(90000 + (state % 140000) + abs(close - prev) * 80)
        bars.append(
            {
                "i": i,
                "session": sessions[i // BARS_PER_SESSION],
                "time": clock(i),
                "open": round(prev, 2),
                "high": round(high, 2),
                "low": round(low, 2),
                "close": round(close, 2),
                "volume": volume,
            }
        )
        prev = close
    return bars


def run_book(bars: list[dict], rules: dict, allow_short: bool) -> list[dict]:
    fast_n = rules["indicators"]["fast_ema"]["period"]
    slow_n = rules["indicators"]["slow_ema"]["period"]
    closes = [b["close"] for b in bars]
    fast = ema(closes, fast_n)
    slow = ema(closes, slow_n)
    vwap = session_vwap(bars)

    side = "flat"
    entry_bar = -1
    entry_price = 0.0
    trades: list[dict] = []
    trace: list[dict] = []

    def push(i: int, effect: str, reason: str, price: float, pnl: float | None) -> None:
        trades.append(
            {
                "bar": i,
                "session": bars[i]["session"],
                "time": bars[i]["time"],
                "effect": effect,
                "reason": reason,
                "price": round(price, 2),
                "pnl": None if pnl is None else round(pnl, 2),
            }
        )

    for i in range(len(bars)):
        if fast[i] is None or slow[i] is None or vwap[i] is None:
            continue
        price = bars[i]["close"]
        up = crossed_up(fast, slow, i)
        down = crossed_down(fast, slow, i)
        bar_in_session = i % BARS_PER_SESSION
        # Skip the open auction noise, and don't open a trade in the last half hour.
        can_open = 6 <= bar_in_session <= 66

        if up:
            if side == "short":
                push(i, "close_short", "ema20_cross_above_ema200", price, entry_price - price)
                side = "flat"
            if side == "flat" and can_open and price > (vwap[i] or 0):
                push(i, "open_long", "ema20_cross_above_ema200", price, None)
                side = "long"
                entry_bar = i
                entry_price = price
        elif down:
            if side == "long":
                push(i, "close_long", "ema20_cross_below_ema200", price, price - entry_price)
                side = "flat"
            if side == "flat" and can_open and allow_short and price < (vwap[i] or 0):
                push(i, "open_short", "ema20_cross_below_ema200", price, None)
                side = "short"
                entry_bar = i
                entry_price = price
        elif side == "long" and i > entry_bar and _vwap_ready(i) and _same_session(bars, i):
            if bars[i - 1]["close"] >= (vwap[i - 1] or 0) and price < (vwap[i] or 0):
                push(i, "close_long", "vwap_stop", price, price - entry_price)
                side = "flat"
        elif side == "short" and i > entry_bar and _vwap_ready(i) and _same_session(bars, i):
            if bars[i - 1]["close"] <= (vwap[i - 1] or 0) and price > (vwap[i] or 0):
                push(i, "close_short", "vwap_stop", price, entry_price - price)
                side = "flat"

        if side != "flat" and fast[i] is not None and slow[i] is not None and vwap[i] is not None:
            trace.append(
                {
                    "session": bars[i]["session"],
                    "time": bars[i]["time"],
                    "side": side,
                    "close": round(price, 2),
                    "vwap": round(vwap[i] or 0, 2),
                    "spread": round(price - (vwap[i] or 0), 2),
                    "gap": round((fast[i] or 0) - (slow[i] or 0), 2),
                }
            )

        if side != "flat" and bar_in_session == BARS_PER_SESSION - 1:
            if side == "long":
                push(i, "close_long", "session_flat", price, price - entry_price)
            else:
                push(i, "close_short", "session_flat", price, entry_price - price)
            side = "flat"

    for bar, f, s, v in zip(bars, fast, slow, vwap):
        bar["ema20"] = None if f is None else round(f, 2)
        bar["ema200"] = None if s is None else round(s, 2)
        bar["vwap"] = None if v is None else round(v, 2)

    if side == "long":
        last = len(bars) - 1
        push(last, "close_long", "sample_end", bars[last]["close"], bars[last]["close"] - entry_price)
    elif side == "short":
        last = len(bars) - 1
        push(last, "close_short", "sample_end", bars[last]["close"], entry_price - bars[last]["close"])

    return trades, trace


# End-of-segment prices as a fraction of each book's anchor.
# Long decline, a session that rips through the 200, a VWAP break, then a roll-over.
SHAPE = [
    (160, 0.994),
    (300, 0.982),
    (374, 0.974),
    (405, 0.984),
    (435, 1.0),
    (449, 1.014),
    (468, 1.012),
    (486, 0.984),
    (505, 0.996),
    (524, 1.002),
    (545, 0.99),
    (575, 0.978),
    (599, 0.974),
]

BOOKS = [
    {"id": "NIFTY50", "anchor": 24860.0, "seed": 11, "shift": 0.0},
    {"id": "BANKNIFTY", "anchor": 52440.0, "seed": 29, "shift": 0.004},
    {"id": "RELIANCE", "anchor": 1468.0, "seed": 47, "shift": -0.003},
    {"id": "HDFCBANK", "anchor": 1712.0, "seed": 83, "shift": 0.002},
]


def shape_for(anchor: float, shift: float) -> list[tuple[int, float]]:
    return [(bar, anchor * (frac + shift)) for bar, frac in SHAPE]


def window(bars: list[dict], trades: list[dict]) -> tuple[int, int]:
    signal_bars = [t["bar"] for t in trades if t["reason"] != "sample_end"] or [N_BARS - 80]
    start = max(200, min(signal_bars) - 18)
    # Keep the replay inside the story, not the whole decline.
    start = max(start, 360)
    return start, N_BARS - 1


def summarize(trades: list[dict]) -> dict:
    closes = [t for t in trades if t["pnl"] is not None]
    net = round(sum(t["pnl"] or 0 for t in closes), 2)
    return {
        "fills": len(trades),
        "opens": sum(1 for t in trades if t["effect"].startswith("open")),
        "stops": sum(1 for t in trades if t["reason"] == "vwap_stop"),
        "crosses": sum(1 for t in trades if "cross" in t["reason"]),
        "net_points": net,
    }


def main() -> None:
    rules = json.loads(RULES_PATH.read_text())
    by_id = {m["id"]: m for m in rules["markets"]}
    sessions = SESSIONS
    books_out = []

    for spec in BOOKS:
        market = by_id[spec["id"]]
        closes = build_closes(spec["anchor"], spec["seed"])
        bars = ohlc(closes, sessions, spec["seed"])
        trades, trace = run_book(bars, rules, bool(market["allow_short"]))
        start, end = window(bars, trades)
        view = []
        for bar in bars[start : end + 1]:
            if bar["ema200"] is None:
                continue
            view.append(
                {
                    "i": bar["i"],
                    "session": bar["session"],
                    "time": bar["time"],
                    "open": bar["open"],
                    "high": bar["high"],
                    "low": bar["low"],
                    "close": bar["close"],
                    "ema20": bar["ema20"],
                    "ema200": bar["ema200"],
                    "vwap": bar["vwap"],
                }
            )
        visible_trades = [t for t in trades if t["bar"] >= start]
        summary = summarize(trades)
        print(
            f"{spec['id']}: fills={summary['fills']} stops={summary['stops']} "
            f"crosses={summary['crosses']} net={summary['net_points']} "
            f"window={start}-{end} view={len(view)}"
        )
        for t in trades:
            print(
                f"  {t['session']} {t['time']} {t['effect']:12} {t['reason']:28} {t['price']} pnl={t['pnl']}"
            )
        if summary["opens"] < 1 or summary["stops"] < 1 or summary["crosses"] < 2:
            print("  trace while in a position (spread = close - vwap):")
            for row in trace:
                print(
                    f"    {row['session']} {row['time']} {row['side']:5} "
                    f"c={row['close']} v={row['vwap']} spr={row['spread']} gap={row['gap']}"
                )
            raise SystemExit(f"{spec['id']} did not print a cross and a VWAP stop")
        books_out.append(
            {
                "id": market["id"],
                "label": market["label"],
                "kind": market["kind"],
                "allow_short": market["allow_short"],
                "start": start,
                "end": end,
                "summary": summary,
                "bars": view,
                "trades": visible_trades,
            }
        )

    payload = {
        "engine": "strategy/engine.py",
        "rules_file": "strategy/rules.json",
        "sample": True,
        "note": "Synthetic 5-minute bars. EMA 200 is warmed up on earlier sessions that are not drawn.",
        "rules": rules,
        "books": books_out,
    }
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    body = (
        "// Generated by strategy/engine.py — do not edit by hand.\n"
        "export const desk = "
        + json.dumps(payload, indent=2)
        + "\n"
    )
    OUT_PATH.write_text(body)
    print(f"wrote {OUT_PATH}")


if __name__ == "__main__":
    main()
