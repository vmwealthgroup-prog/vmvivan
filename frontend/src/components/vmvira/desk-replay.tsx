import { useEffect, useMemo, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { clsx } from "clsx";
import { desk } from "@/data/generated";
import { effectLabel, points, prettyDay, price, reasonLabel } from "@/components/vmvira/format";

type Book = (typeof desk.books)[number];
type Bar = Book["bars"][number];

const W = 720;
const H = 300;
const PAD_L = 12;
const PAD_R = 72;
const PAD_T = 16;
const PAD_B = 28;

function cueOf(book: Book) {
  const first = book.trades[0]?.bar ?? book.start;
  return Math.max(book.start, first - 8);
}

function positionAt(book: Book, cursor: number) {
  let side: "flat" | "long" | "short" = "flat";
  let entry = 0;
  for (const trade of book.trades) {
    if (trade.bar > cursor) break;
    if (trade.effect === "open_long") {
      side = "long";
      entry = trade.price;
    } else if (trade.effect === "open_short") {
      side = "short";
      entry = trade.price;
    } else {
      side = "flat";
      entry = 0;
    }
  }
  return { side, entry };
}

function Chart({ bars, trades }: { bars: Bar[]; trades: Book["trades"] }) {
  if (bars.length < 2) {
    return <p className="px-4 py-16 text-sm text-muted">Advance the session to draw the book.</p>;
  }

  const values = bars.flatMap((bar) => [bar.low, bar.high, bar.ema20, bar.ema200, bar.vwap]);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const span = rawMax - rawMin || 1;
  const min = rawMin - span * 0.08;
  const max = rawMax + span * 0.1;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;
  const slot = innerW / bars.length;
  const y = (value: number) => PAD_T + ((max - value) / (max - min)) * innerH;
  const line = (pick: (bar: Bar) => number) =>
    bars
      .map((bar, index) => {
        const x = PAD_L + slot * index + slot / 2;
        return `${x.toFixed(1)},${y(pick(bar)).toFixed(1)}`;
      })
      .join(" ");

  const ticks = [max, (max + min) / 2, min];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-64 w-full sm:h-80" role="img" aria-label="Price, 20 EMA, 200 EMA, and session VWAP">
      {ticks.map((tick) => (
        <g key={tick}>
          <line
            x1={PAD_L}
            x2={W - PAD_R}
            y1={y(tick)}
            y2={y(tick)}
            stroke="var(--color-line)"
            strokeWidth="1"
          />
          <text x={W - PAD_R + 8} y={y(tick) + 4} fill="var(--color-muted)" fontSize="11">
            {price(tick)}
          </text>
        </g>
      ))}
      {bars.map((bar, index) => {
        const previous = bars[index - 1];
        if (!previous || previous.session === bar.session) return null;
        const x = PAD_L + slot * index;
        return (
          <line
            key={bar.session}
            x1={x}
            x2={x}
            y1={PAD_T}
            y2={H - PAD_B}
            stroke="var(--color-line)"
            strokeDasharray="3 4"
          />
        );
      })}
      {bars.map((bar, index) => {
        const x = PAD_L + slot * index + slot / 2;
        const up = bar.close >= bar.open;
        const bodyTop = y(Math.max(bar.open, bar.close));
        const bodyBot = y(Math.min(bar.open, bar.close));
        const bodyH = Math.max(1.5, bodyBot - bodyTop);
        return (
          <g key={bar.i}>
            <line
              x1={x}
              x2={x}
              y1={y(bar.high)}
              y2={y(bar.low)}
              stroke={up ? "var(--color-primary)" : "var(--color-muted)"}
              strokeWidth="1"
            />
            <rect
              x={x - Math.max(1.5, slot * 0.28)}
              y={bodyTop}
              width={Math.max(2, slot * 0.56)}
              height={bodyH}
              fill={up ? "var(--color-primary)" : "var(--color-elevated)"}
              stroke="var(--color-muted)"
              strokeWidth={up ? 0 : 1}
            />
          </g>
        );
      })}
      <polyline fill="none" stroke="var(--color-faint)" strokeWidth="1.4" points={line((bar) => bar.ema200)} />
      <polyline
        fill="none"
        stroke="var(--color-fg)"
        strokeWidth="1.4"
        strokeDasharray="5 4"
        points={line((bar) => bar.vwap)}
      />
      <polyline fill="none" stroke="var(--color-primary)" strokeWidth="2" points={line((bar) => bar.ema20)} />
      {trades.map((trade) => {
        const index = bars.findIndex((bar) => bar.i === trade.bar);
        if (index < 0) return null;
        const x = PAD_L + slot * index + slot / 2;
        const py = y(trade.price);
        const open = trade.effect.startsWith("open");
        return (
          <g key={`${trade.bar}-${trade.effect}`}>
            <circle
              cx={x}
              cy={py}
              r={open ? 4.5 : 3.5}
              fill={open ? "var(--color-primary)" : "var(--color-bg)"}
              stroke="var(--color-fg)"
              strokeWidth="1.4"
            />
          </g>
        );
      })}
    </svg>
  );
}

export function DeskReplay() {
  const [bookId, setBookId] = useState(desk.books[0].id);
  const book = desk.books.find((item) => item.id === bookId) ?? desk.books[0];
  const [cursor, setCursor] = useState(() => cueOf(desk.books[0]));
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    setCursor(cueOf(book));
    setPlaying(false);
  }, [book]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setCursor((current) => {
        if (current >= book.end) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 160);
    return () => window.clearInterval(timer);
  }, [playing, book.end]);

  const visible = useMemo(() => book.bars.filter((bar) => bar.i <= cursor).slice(-72), [book, cursor]);
  const printed = book.trades.filter((trade) => trade.bar <= cursor);
  const latest = visible[visible.length - 1];
  const position = positionAt(book, cursor);
  const unrealized =
    latest && position.side === "long"
      ? latest.close - position.entry
      : latest && position.side === "short"
        ? position.entry - latest.close
        : 0;

  return (
    <div className="border border-line bg-surface">
      <div className="flex flex-col gap-4 border-b border-line px-4 py-4 sm:px-5">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Sample book">
          {desk.books.map((item) => {
            const selected = item.id === book.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setBookId(item.id)}
                className={
                  selected
                    ? "min-h-11 border border-primary bg-primary px-4 text-sm text-primary-fg"
                    : "min-h-11 border border-line px-4 text-sm text-fg"
                }
              >
                {item.label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (!playing && cursor >= book.end) {
                setCursor(cueOf(book));
                setPlaying(true);
                return;
              }
              setPlaying((value) => !value);
            }}
            className="inline-flex min-h-11 items-center gap-2 bg-primary px-4 text-sm font-medium text-primary-fg transition-transform duration-150 ease-out active:scale-[0.96]"
          >
            <span className="relative grid size-4 place-items-center">
              <Play
                className={clsx(
                  "col-start-1 row-start-1 size-4 transition-[opacity,filter,scale] duration-300 ease-[cubic-bezier(0.2,0,0,1)]",
                  playing ? "scale-[0.25] opacity-0 blur-[4px]" : "scale-100 opacity-100 blur-none",
                )}
                aria-hidden
              />
              <Pause
                className={clsx(
                  "col-start-1 row-start-1 size-4 transition-[opacity,filter,scale] duration-300 ease-[cubic-bezier(0.2,0,0,1)]",
                  playing ? "scale-100 opacity-100 blur-none" : "scale-[0.25] opacity-0 blur-[4px]",
                )}
                aria-hidden
              />
            </span>
            {playing ? "Pause" : cursor >= book.end ? "Replay" : "Run sample"}
          </button>
          <button
            type="button"
            onClick={() => {
              setPlaying(false);
              setCursor(cueOf(book));
            }}
            className="inline-flex min-h-11 items-center gap-2 border border-line px-4 text-sm"
          >
            <RotateCcw className="size-4" aria-hidden />
            Restart
          </button>
          <p className="text-sm text-muted">
            <span className="text-fg">{position.side === "flat" ? "Flat" : position.side === "long" ? "Long" : "Short"}</span>
            {position.side !== "flat" && latest ? (
              <span className="tabular-nums"> · open {points(unrealized)} pts</span>
            ) : null}
          </p>
        </div>
        <label className="flex items-center gap-3 text-sm text-muted">
          <span className="sr-only">Scrub the sample</span>
          <input
            type="range"
            min={book.start}
            max={book.end}
            value={Math.min(cursor, book.end)}
            onChange={(event) => {
              setPlaying(false);
              setCursor(Number(event.target.value));
            }}
            className="w-full"
          />
        </label>
      </div>

      <div className="grid lg:grid-cols-3">
        <div className="min-w-0 border-b border-line lg:col-span-2 lg:border-r lg:border-b-0">
          <div className="flex items-baseline justify-between gap-3 px-4 pt-4 sm:px-5">
            <p className="tabular-nums text-2xl">{latest ? price(latest.close) : "—"}</p>
            <p className="text-sm text-muted">
              {latest ? `${prettyDay(latest.session)} ${latest.time}` : "Waiting"}
              {book.kind === "index" ? " · index pts" : " · per share"}
            </p>
          </div>
          <Chart bars={visible} trades={printed} />
          <ul className="flex flex-wrap gap-x-5 gap-y-2 px-4 pb-4 text-xs text-muted sm:px-5">
            <li className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 bg-primary" /> Price up
            </li>
            <li className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 border border-muted bg-elevated" /> Price down
            </li>
            <li className="flex items-center gap-2">
              <span className="inline-block h-0.5 w-5 bg-primary" /> 20 EMA
            </li>
            <li className="flex items-center gap-2">
              <span className="inline-block h-0.5 w-5 bg-faint" /> 200 EMA
            </li>
            <li className="flex items-center gap-2">
              <span className="inline-block h-0 w-5 border-t border-dashed border-fg" /> VWAP
            </li>
          </ul>
        </div>
        <div className="flex max-h-96 flex-col lg:max-h-none">
          <div className="border-b border-line px-4 py-3 text-sm text-muted">Prints</div>
          <ol className="flex flex-1 flex-col gap-3 overflow-auto px-4 py-3" aria-live="polite">
            {printed.length === 0 ? (
              <li className="text-sm text-muted">No order yet. The cross has not printed.</li>
            ) : (
              [...printed].reverse().map((trade) => (
                <li key={`${trade.bar}-${trade.effect}`} className="border-b border-line pb-3 last:border-b-0">
                  <p className="flex items-baseline justify-between gap-3">
                    <span className="font-medium">{effectLabel(trade.effect, trade.reason)}</span>
                    <span className="tabular-nums">{price(trade.price)}</span>
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {prettyDay(trade.session)} {trade.time} · {reasonLabel(trade.reason)}
                    {trade.pnl !== null ? <span className="tabular-nums"> · {points(trade.pnl)} pts</span> : null}
                  </p>
                </li>
              ))
            )}
          </ol>
          <p className="border-t border-line px-4 py-3 text-sm text-muted tabular-nums">
            Whole sample net {points(book.summary.net_points)} pts. Not a track record.
          </p>
        </div>
      </div>
    </div>
  );
}
