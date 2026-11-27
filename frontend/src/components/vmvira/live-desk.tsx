import { useEffect, useRef, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { kotakHistory, kotakLogin, kotakOrder, kotakQuote } from "@/lib/kotak.functions";
import { candleFromHistory, istParts, orderSide, runSignals, type Candle, type Effect, type Signal } from "@/lib/signals";
import { effectLabel, price } from "@/components/vmvira/format";

const SESSION_KEY = "VMVIRA-kotak-session";

type Session = {
  accessToken: string;
  token: string;
  sid: string;
  baseUrl: string;
  name: string;
};

type Book = {
  id: string;
  label: string;
  quote: string;
  symbol: string;
  segment: "nse_cm" | "nse_fo";
  product: "MIS" | "CNC" | "NRML";
};

const BOOKS: Book[] = [
  { id: "NIFTY", label: "Nifty 50", quote: "nse_cm|Nifty 50", symbol: "", segment: "nse_fo", product: "NRML" },
  { id: "BANK", label: "Bank Nifty", quote: "nse_cm|Nifty Bank", symbol: "", segment: "nse_fo", product: "NRML" },
  { id: "RELIANCE", label: "Reliance", quote: "nse_cm|2885", symbol: "RELIANCE-EQ", segment: "nse_cm", product: "MIS" },
  { id: "HDFC", label: "HDFC Bank", quote: "nse_cm|1333", symbol: "HDFCBANK-EQ", segment: "nse_cm", product: "MIS" },
];

type LogLine = { id: string; text: string; bad?: boolean };

function isoDaysAgo(days: number) {
  const now = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  const then = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const format = (date: Date) =>
    `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
  return { fromdate: format(then), todate: format(now) };
}

function effectText(effect: Effect) {
  if (effect === "open_long") return "Auto buy";
  if (effect === "open_short") return "Auto sell";
  return effectLabel(effect === "close_long" ? "close_long" : "close_short", effect.includes("stop") ? "vwap_stop" : "session_flat");
}

export function LiveDesk() {
  const loginFn = useServerFn(kotakLogin);
  const quoteFn = useServerFn(kotakQuote);
  const historyFn = useServerFn(kotakHistory);
  const orderFn = useServerFn(kotakOrder);

  const [session, setSession] = useState<Session | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [ucc, setUcc] = useState("");
  const [totp, setTotp] = useState("");
  const [mpin, setMpin] = useState("");

  const [bookId, setBookId] = useState(BOOKS[0].id);
  const book = BOOKS.find((item) => item.id === bookId) ?? BOOKS[0];
  const [neosymbol, setNeosymbol] = useState(book.quote);
  const [tradingSymbol, setTradingSymbol] = useState(book.symbol);
  const [segment, setSegment] = useState(book.segment);
  const [product, setProduct] = useState(book.product);
  const [quantity, setQuantity] = useState(1);
  const [allowShort, setAllowShort] = useState(true);
  const [armText, setArmText] = useState("");
  const [auto, setAuto] = useState(false);

  const [ltp, setLtp] = useState<number | null>(null);
  const [bars, setBars] = useState<Candle[]>([]);
  const [side, setSide] = useState<"flat" | "long" | "short">("flat");
  const [log, setLog] = useState<LogLine[]>([]);
  const seen = useRef(new Set<string>());
  const primed = useRef(false);
  const forming = useRef<Candle | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const autoRef = useRef(false);
  const orderLock = useRef(false);
  const sendRef = useRef<(effect: Effect, signal: Signal | null) => Promise<void>>(async () => {});

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);
  useEffect(() => {
    autoRef.current = auto && armText === "ARM";
  }, [auto, armText]);

  useEffect(() => {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Session;
      if (parsed.token && parsed.baseUrl && parsed.accessToken) setSession(parsed);
    } catch {
      sessionStorage.removeItem(SESSION_KEY);
    }
  }, []);

  function pushLog(text: string, bad = false) {
    setLog((lines) => [{ id: `${Date.now()}-${text}`, text, bad }, ...lines].slice(0, 12));
  }

  async function connect(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await loginFn({ data: { accessToken, mobileNumber, ucc, totp, mpin } });
      setTotp("");
      setMpin("");
      if (!result.ok) {
        setError(result.message);
        return;
      }
      const next = { accessToken, token: result.token, sid: result.sid, baseUrl: result.baseUrl, name: result.name };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
      setSession(next);
      pushLog(`Signed in as ${result.name}. Orders stay off until you arm the desk.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Kotak login failed.");
    } finally {
      setBusy(false);
    }
  }

  function disconnect() {
    sessionStorage.removeItem(SESSION_KEY);
    setSession(null);
    setAuto(false);
    setLtp(null);
    setBars([]);
    forming.current = null;
    primed.current = false;
    seen.current.clear();
  }

  function selectBook(next: Book) {
    setBookId(next.id);
    setNeosymbol(next.quote);
    setTradingSymbol(next.symbol);
    setSegment(next.segment);
    setProduct(next.product);
    setBars([]);
    setLtp(null);
    forming.current = null;
    primed.current = false;
    seen.current.clear();
  }

  async function sendOrder(effect: Effect, signal: Signal | null) {
    const current = sessionRef.current;
    if (!current) return;
    if (orderLock.current) return;
    if (!tradingSymbol.trim()) {
      pushLog("No trading symbol. Indices need the futures symbol, stocks need the -EQ symbol.", true);
      return;
    }
    orderLock.current = true;
    const result = await orderFn({
      data: {
        baseUrl: current.baseUrl,
        sid: current.sid,
        auth: current.token,
        arm: "ARM",
        tradingSymbol,
        exchangeSegment: segment,
        product,
        quantity,
        transactionType: orderSide(effect),
      },
    });
    orderLock.current = false;
    if (!result.ok) {
      pushLog(result.message, true);
      return;
    }
    const label = signal ? `${signal.session} ${signal.clock}` : "Manual";
    pushLog(`${label} ${effectText(effect)} sent. Kotak order ${result.orderNo}.`);
  }
  sendRef.current = sendOrder;

  useEffect(() => {
    const run = runSignals(bars, allowShort);
    setSide(run.side);
    const lastBar = bars[bars.length - 1];
    if (!lastBar || !primed.current) return;
    for (const signal of run.signals) {
      const fresh = signal.session === lastBar.session && signal.clock === lastBar.clock;
      if (!fresh || seen.current.has(signal.key)) {
        seen.current.add(signal.key);
        continue;
      }
      seen.current.add(signal.key);
      if (autoRef.current) void sendRef.current(signal.effect, signal);
    }
  }, [bars, allowShort]);

  useEffect(() => {
    if (!session) return;
    let stopped = false;
    const current = session;

    async function loadHistory() {
      const range = isoDaysAgo(12);
      const result = await historyFn({
        data: { accessToken: current.accessToken, baseUrl: current.baseUrl, neosymbol, ...range },
      });
      if (stopped) return;
      if (!result.ok) {
        pushLog(result.message, true);
        return;
      }
      const completed = result.candles.flatMap((row) => {
        const candle = candleFromHistory(row.time, row.open, row.high, row.low, row.close, row.volume);
        if (!candle) return [];
        const live = istParts(Date.now());
        if (candle.session === live.session && candle.barInSession === live.barInSession) return [];
        return [candle];
      });
      const run = runSignals(completed, allowShort);
      seen.current = new Set(run.signals.map((signal) => signal.key));
      primed.current = true;
      setBars(completed);
      setSide(run.side);
      pushLog(`${completed.length} closed 5-minute bars loaded. The 200 EMA needs 200 of them.`);
    }

    void loadHistory();
    return () => {
      stopped = true;
    };
    // Reload history when the symbol or session changes. allowShort is applied on the live pass.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, neosymbol]);

  useEffect(() => {
    if (!session) return;
    let stopped = false;

    async function tick() {
      const current = sessionRef.current;
      if (!current || stopped) return;
      const result = await quoteFn({
        data: { accessToken: current.accessToken, baseUrl: current.baseUrl, neosymbol },
      });
      if (stopped || !result.ok) {
        if (!stopped && result.ok === false) setError(result.message);
        return;
      }
      setError("");
      setLtp(result.ltp);
      const parts = istParts(Date.now());
      if (!parts.inSession) return;

      const previous = forming.current;
      if (!previous || previous.session !== parts.session || previous.barInSession !== parts.barInSession) {
        if (previous) {
          const closed = previous;
          setBars((existing) => [...existing, closed]);
        }
        forming.current = {
          time: Date.now(),
          session: parts.session,
          clock: parts.clock,
          barInSession: parts.barInSession,
          open: result.ltp,
          high: result.ltp,
          low: result.ltp,
          close: result.ltp,
          volume: result.volume,
        };
        return;
      }

      previous.high = Math.max(previous.high, result.ltp);
      previous.low = Math.min(previous.low, result.ltp);
      previous.close = result.ltp;
      previous.volume = Math.max(previous.volume, result.volume);
    }

    void tick();
    const timer = window.setInterval(() => void tick(), 2000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
    // Quote loop follows the connected symbol. Order settings are read from the latest render via refs and state setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, neosymbol, allowShort, tradingSymbol, segment, product, quantity]);

  const view = runSignals(forming.current ? [...bars, forming.current] : bars, allowShort);
  const last = view.marks[view.marks.length - 1];
  const armed = armText === "ARM" && auto;

  return (
    <div className="border border-line bg-surface">
      {!session ? (
        <form onSubmit={connect} className="grid gap-4 p-5 sm:grid-cols-2" autoComplete="off">
          <label className="flex flex-col gap-2 sm:col-span-2">
            <span className="text-sm text-muted">API access token from Neo → Trade API</span>
            <input
              type="password"
              required
              value={accessToken}
              onChange={(event) => setAccessToken(event.target.value)}
              className="min-h-12 border border-line bg-bg px-4"
            />
          </label>
          <Field label="Mobile" value={mobileNumber} onChange={setMobileNumber} placeholder="98XXXXXXXX" />
          <Field label="UCC" value={ucc} onChange={setUcc} placeholder="AB123" />
          <Field label="TOTP" value={totp} onChange={setTotp} placeholder="6 digits" inputMode="numeric" />
          <Field label="MPIN" value={mpin} onChange={setMpin} placeholder="6 digits" inputMode="numeric" secret />
          {error ? (
            <p className="text-sm text-fg sm:col-span-2" role="alert">
              {error}
            </p>
          ) : (
            <p className="text-sm text-muted sm:col-span-2">
              The MPIN is sent once to Kotak and is not saved. The session token stays in this tab only.
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="min-h-12 bg-primary px-5 font-medium text-primary-fg transition-transform duration-150 ease-out disabled:opacity-60 sm:col-span-2 active:scale-[0.96]"
          >
            {busy ? "Connecting" : "Connect Kotak Neo"}
          </button>
        </form>
      ) : (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div>
              <p className="text-xs tracking-widest text-primary uppercase">Kotak session</p>
              <p className="mt-1">{session.name}</p>
            </div>
            <button type="button" onClick={disconnect} className="min-h-11 border border-line px-4 text-sm">
              Disconnect
            </button>
          </div>
          <div className="flex flex-wrap gap-2 border-b border-line px-5 py-4">
            {BOOKS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={item.id === book.id}
                onClick={() => selectBook(item)}
                className={
                  item.id === book.id
                    ? "min-h-11 border border-primary bg-primary px-4 text-sm text-primary-fg"
                    : "min-h-11 border border-line px-4 text-sm"
                }
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="grid gap-4 border-b border-line px-5 py-4 sm:grid-cols-2">
            <Field label="Quote symbol" value={neosymbol} onChange={setNeosymbol} />
            <Field label="Order symbol" value={tradingSymbol} onChange={setTradingSymbol} placeholder="RELIANCE-EQ or NIFTY26DECFUT" />
            <label className="flex flex-col gap-2 text-sm text-muted">
              Segment
              <select
                value={segment}
                onChange={(event) => setSegment(event.target.value as "nse_cm" | "nse_fo")}
                className="min-h-12 border border-line bg-bg px-3 text-fg"
              >
                <option value="nse_cm">NSE cash</option>
                <option value="nse_fo">NSE futures</option>
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm text-muted">
              Product
              <select
                value={product}
                onChange={(event) => setProduct(event.target.value as "MIS" | "CNC" | "NRML")}
                className="min-h-12 border border-line bg-bg px-3 text-fg"
              >
                <option value="MIS">MIS</option>
                <option value="CNC">CNC</option>
                <option value="NRML">NRML</option>
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm text-muted">
              Quantity
              <input
                type="number"
                min={1}
                max={500}
                value={quantity}
                onChange={(event) => setQuantity(Number(event.target.value))}
                className="min-h-12 border border-line bg-bg px-4 text-fg"
              />
            </label>
            <label className="flex min-h-12 items-center gap-3 self-end text-sm">
              <input type="checkbox" checked={allowShort} onChange={(event) => setAllowShort(event.target.checked)} />
              Allow auto short
            </label>
          </div>
          <div className="grid gap-px bg-line sm:grid-cols-4">
            <Readout label="Last" value={ltp == null ? "—" : price(ltp)} />
            <Readout label="20 EMA" value={last?.ema20 == null ? "—" : price(last.ema20)} />
            <Readout label="200 EMA" value={last?.ema200 == null ? "—" : price(last.ema200)} />
            <Readout label="VWAP" value={last?.vwap == null ? "—" : price(last.vwap)} />
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-4">
            <p className="text-sm text-muted">
              Book is <span className="text-fg">{side}</span>
              {armed ? <span className="text-primary"> · live orders on</span> : <span> · signals only</span>}
            </p>
            <button
              type="button"
              onClick={() => void sendOrder("open_long", null)}
              disabled={!armed}
              className="min-h-11 bg-primary px-4 text-sm font-medium text-primary-fg disabled:opacity-40"
            >
              Buy market
            </button>
            <button
              type="button"
              onClick={() => void sendOrder("open_short", null)}
              disabled={!armed}
              className="min-h-11 border border-line px-4 text-sm disabled:opacity-40"
            >
              Sell market
            </button>
          </div>
          <div className="grid gap-4 border-t border-line px-5 py-4 lg:grid-cols-[16rem_1fr]">
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-2 text-sm text-muted">
                Type ARM to allow orders
                <input
                  value={armText}
                  onChange={(event) => {
                    setArmText(event.target.value.toUpperCase());
                    if (event.target.value.toUpperCase() !== "ARM") setAuto(false);
                  }}
                  className="min-h-12 border border-line bg-bg px-4 tracking-widest text-fg"
                />
              </label>
              <label className="flex min-h-12 items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={auto}
                  disabled={armText !== "ARM"}
                  onChange={(event) => setAuto(event.target.checked)}
                />
                Send the cross and the VWAP stop to Kotak
              </label>
            </div>
            <div>
              {error ? (
                <p className="mb-3 text-sm text-fg" role="alert">
                  {error}
                </p>
              ) : null}
              <ul className="flex max-h-48 flex-col gap-2 overflow-auto text-sm">
                {log.length === 0 ? <li className="text-muted">Waiting for the first quote.</li> : null}
                {log.map((line) => (
                  <li key={line.id} className={line.bad ? "text-fg" : "text-muted"}>
                    {line.text}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  secret,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  secret?: boolean;
  inputMode?: "numeric" | "text";
}) {
  return (
    <label className="flex flex-col gap-2 text-sm text-muted">
      {label}
      <input
        type={secret ? "password" : "text"}
        inputMode={inputMode}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-12 border border-line bg-bg px-4 text-fg placeholder:text-faint"
      />
    </label>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface px-5 py-4">
      <p className="text-xs tracking-widest text-muted uppercase">{label}</p>
      <p className="mt-1 text-lg tabular-nums">{value}</p>
    </div>
  );
}
