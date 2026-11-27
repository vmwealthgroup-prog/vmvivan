import { Braces, Clock3, Crosshair, Scale, Shield, Workflow } from "lucide-react";
import { desk } from "@/data/generated";
import { DeskReplay } from "@/components/vmvira/desk-replay";
import { price, prettyDay } from "@/components/vmvira/format";
import { LiveDesk } from "@/components/vmvira/live-desk";
import { SignupForm } from "@/components/vmvira/signup-form";
import { ContactForm } from "@/components/vmvira/contact-form";
import { SiteAnnouncement } from "@/components/vmvira/site-announcement";
import { SiteHeader } from "@/components/vmvira/site-header";

const nifty = desk.books[0];
const buy = nifty.trades.find((trade) => trade.effect === "open_long");
const stop = nifty.trades.find((trade) => trade.reason === "vwap_stop");
const sell = nifty.trades.find((trade) => trade.effect === "open_short");
const buyBar = buy ? nifty.bars.find((bar) => bar.i === buy.bar) : undefined;

const features = [
  {
    icon: Workflow,
    title: "Fully automatic",
    body: "A finished bar is the only trigger. There is no confirm button and no discretionary override in the file.",
  },
  {
    icon: Crosshair,
    title: "20 / 200 cross",
    body: "The fast average crossing the slow one, on the close. Wicks that have not finished do not count.",
  },
  {
    icon: Shield,
    title: "VWAP stop",
    body: "Session VWAP is typical price, reset at 09:15. A later close through it flattens the trade. The entry bar cannot stop itself.",
  },
  {
    icon: Scale,
    title: "Auto buy and auto sell",
    body: "Up-cross above VWAP buys. Down-cross under VWAP sells. Shorts can be switched off per market in the JSON.",
  },
  {
    icon: Clock3,
    title: "Flat at 15:25",
    body: "The book is intraday. Session VWAP is meaningless overnight, so the last bar squares whatever is open.",
  },
  {
    icon: Braces,
    title: "Python reads JSON",
    body: "rules.json is the whole strategy. engine.py does not keep a second, hidden copy of the periods or the stop.",
  },
];

const steps = [
  {
    n: "01",
    title: "The file names the book",
    body: "Periods, session, both sides, and the markets — Nifty 50, Bank Nifty, Reliance, HDFC Bank — sit in one JSON document.",
  },
  {
    n: "02",
    title: "Python waits for the close",
    body: "When the 20 EMA crosses the 200 and the close agrees with VWAP, the engine buys or sells. It does not look inside a bar that is still forming.",
  },
  {
    n: "03",
    title: "VWAP or the bell ends it",
    body: "A close back through session VWAP is the stop. If that never prints, the 15:25 bar flattens the position anyway.",
  },
];

const tiers = [
  {
    name: "Reader",
    price: "₹0",
    note: "See the rule before you rent a seat.",
    points: ["The JSON, in full", "The sample replay on this page", "One browser, no mail server"],
    featured: false,
  },
  {
    name: "Desk",
    price: "₹4,900",
    note: "Per month. Indices only.",
    points: ["Nifty 50 and Bank Nifty", "Auto buy, auto sell, VWAP stop", "The Python runner on your rules file"],
    featured: true,
  },
  {
    name: "Book",
    price: "₹12,500",
    note: "Per month. Indices and stocks.",
    points: ["Everything in Desk", "Stock names in the same JSON", "Shorts toggled per symbol"],
    featured: false,
  },
];

const quotes = [
  {
    quote: "I stopped arguing with the 200. If the 20 has not crossed, the book is flat. That is a calmer morning.",
    name: "Anika Shah",
    role: "Index futures, Mumbai",
  },
  {
    quote: "The stop is the part I trust. It took the long off while the averages still looked fine. That is the job.",
    name: "Rohit Menon",
    role: "Prop desk, Bengaluru",
  },
  {
    quote: "I can read the file. Periods, filter, session flat. If it is not in the JSON, the engine does not do it.",
    name: "Leela Iyer",
    role: "Cash equities, Chennai",
  },
];

const questions = [
  {
    q: "Does this page send live orders?",
    a: "No. The replay is the Python engine on a drawn sample, so you can watch the cross and the stop. It is not connected to a broker, and it is not a record of the NSE.",
  },
  {
    q: "Why flatten at the close?",
    a: "The stop is session VWAP. That average resets at 09:15, so carrying a trade overnight would hang it on a level that no longer exists. The JSON says intraday. Change the file if you want a different hold.",
  },
  {
    q: "What if VWAP stops me and the trend continues?",
    a: "You stay flat. The engine does not buy again until the 20 crosses the 200 again. In the sample, the 19 Nov long is stopped and the next order is the next day’s down-cross.",
  },
  {
    q: "Can stocks be long-only?",
    a: "Yes. allow_short is set per market. Turn it off and a down-cross only exits a long. It will not open a short.",
  },
];

export function HomePage() {
  const rules = JSON.stringify(desk.rules, null, 2);

  return (
    <div id="top" className="min-h-screen">
      <SiteAnnouncement />
      <SiteHeader />
      <main>
        <section className="mx-auto grid max-w-6xl gap-12 px-5 pt-28 pb-16 lg:grid-cols-12 lg:items-end lg:pt-32">
          <div className="lg:col-span-7">
            <p className="rise text-xs tracking-widest text-primary uppercase">Python engine · JSON rules · NSE 5-minute</p>
            <h1 className="rise rise-2 mt-4 font-display text-5xl leading-none sm:text-7xl">
              Fully automatic.
              <span className="mt-2 block italic">The 20 crosses the 200.</span>
              <span className="mt-2 block text-primary italic">VWAP is the stop.</span>
            </h1>
            <p className="rise rise-3 mt-6 max-w-xl text-lg text-muted">
              VMVIRA buys when the 20 EMA crosses above the 200 and the close is over session VWAP. It sells when
              the cross goes the other way. A close back through VWAP gets out. Nifty 50, Bank Nifty, and stocks —
              one file.
            </p>
            <div className="rise rise-4 mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="#live"
                className="inline-flex min-h-12 items-center justify-center bg-primary px-5 font-medium text-primary-fg transition-transform duration-150 ease-out active:scale-[0.96]"
              >
                Connect Kotak
              </a>
              <a
                href="#desk"
                className="inline-flex min-h-12 items-center justify-center border border-line px-5 text-fg"
              >
                Watch the sample
              </a>
            </div>
          </div>
          {buy && stop && sell && buyBar ? (
            <aside className="rise rise-4 border border-line bg-surface shadow-card lg:col-span-5">
              <div className="flex items-center justify-between border-b border-line px-5 py-3 text-xs tracking-widest text-muted uppercase">
                <span>Nifty 50 · sample</span>
                <span className="text-primary">Engine print</span>
              </div>
              <dl className="grid grid-cols-2 gap-px bg-line">
                <Stat label="20 EMA" value={price(buyBar.ema20)} />
                <Stat label="200 EMA" value={price(buyBar.ema200)} />
                <Stat label="VWAP" value={price(buyBar.vwap)} />
                <Stat label="Close" value={price(buyBar.close)} />
              </dl>
              <ol className="divide-y divide-line px-5">
                <Print
                  title="Auto buy"
                  detail={`${prettyDay(buy.session)} ${buy.time} · 20 crossed above 200`}
                  value={price(buy.price)}
                />
                <Print
                  title="VWAP stop"
                  detail={`${prettyDay(stop.session)} ${stop.time} · close crossed under VWAP`}
                  value={price(stop.price)}
                />
                <Print
                  title="Auto sell"
                  detail={`${prettyDay(sell.session)} ${sell.time} · 20 crossed below 200`}
                  value={price(sell.price)}
                />
              </ol>
            </aside>
          ) : null}
        </section>

        <section className="border-y border-line">
          <ul className="mx-auto grid max-w-6xl grid-cols-2 gap-px bg-line md:grid-cols-4">
            {desk.books.map((book) => (
              <li key={book.id} className="bg-bg px-5 py-5">
                <p className="text-xs tracking-widest text-muted uppercase">{book.kind}</p>
                <p className="mt-1 text-lg">{book.label}</p>
              </li>
            ))}
          </ul>
        </section>

        <section id="live" className="border-t border-line">
          <div className="mx-auto max-w-6xl px-5 py-20">
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs tracking-widest text-primary uppercase">Live · Kotak Neo</p>
                <h2 className="mt-3 font-display text-4xl leading-none sm:text-5xl">Real time, on your account.</h2>
              </div>
              <p className="max-w-md text-muted">
                Quotes poll every two seconds. The same 20/200 cross and VWAP stop run on 5-minute bars. Nothing is
                sent until you type ARM and turn orders on. Nifty and Bank Nifty need the futures symbol.
              </p>
            </div>
            <LiveDesk />
          </div>
        </section>

        <section id="engine" className="mx-auto grid max-w-6xl gap-10 px-5 py-20 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <p className="text-xs tracking-widest text-primary uppercase">01 — Engine</p>
            <h2 className="mt-3 font-display text-4xl leading-none sm:text-5xl">One file in. Orders out.</h2>
            <p className="mt-4 text-muted">
              The strategy is not a screenshot of a chart. It is <span className="text-fg">strategy/rules.json</span>,
              read by <span className="text-fg">strategy/engine.py</span>. Change a period and the next run follows.
              The sample below is that run — synthetic bars, real arithmetic, no lookahead.
            </p>
            <ol className="mt-8 flex flex-col gap-6">
              {steps.map((step) => (
                <li key={step.n} className="flex gap-4">
                  <span className="w-12 shrink-0 font-display text-2xl text-primary italic">{step.n}</span>
                  <div>
                    <h3 className="text-lg">{step.title}</h3>
                    <p className="mt-1 text-muted">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div className="min-w-0 lg:col-span-7">
            <div className="flex items-center justify-between border border-b-0 border-line bg-elevated px-4 py-3 text-xs tracking-widest text-muted uppercase">
              <span>rules.json</span>
              <span>version {desk.rules.version}</span>
            </div>
            <pre className="max-h-96 overflow-auto border border-line bg-bg p-4 text-sm leading-relaxed text-fg lg:max-h-screen">
              {rules}
            </pre>
          </div>
        </section>

        <section id="desk" className="border-t border-line bg-bg">
          <div className="mx-auto max-w-6xl px-5 py-20">
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs tracking-widest text-primary uppercase">02 — Sample desk</p>
                <h2 className="mt-3 font-display text-4xl leading-none sm:text-5xl">Watch it buy, stop, and sell.</h2>
              </div>
              <p className="max-w-md text-muted">
                Run the sample. The long is bought on the up-cross, removed at VWAP, and not put back on. The next
                print is the down-cross. Bars are drawn, not downloaded from the exchange.
              </p>
            </div>
            <DeskReplay />
          </div>
        </section>

        <section id="features" className="mx-auto max-w-6xl px-5 py-20">
          <p className="text-xs tracking-widest text-primary uppercase">03 — What the rule does</p>
          <h2 className="mt-3 max-w-xl font-display text-4xl leading-none sm:text-5xl">
            Six lines. No extra indicators hiding behind them.
          </h2>
          <ul className="mt-10 grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <li key={feature.title} className="bg-bg px-6 py-6">
                  <Icon className="size-5 text-primary" aria-hidden />
                  <h3 className="mt-4 text-lg">{feature.title}</h3>
                  <p className="mt-2 text-muted">{feature.body}</p>
                </li>
              );
            })}
          </ul>
        </section>

        <section id="markets" className="border-t border-line">
          <div className="mx-auto grid max-w-6xl gap-8 px-5 py-20 lg:grid-cols-3">
            <article>
              <p className="text-xs tracking-widest text-muted uppercase">Index</p>
              <h2 className="mt-3 font-display text-4xl leading-none">Nifty 50</h2>
              <p className="mt-3 text-muted">
                The same 5-minute cross. Both sides are on. The sample buys, gets stopped, then sells the next session.
              </p>
            </article>
            <article className="border-line lg:border-l lg:pl-8">
              <p className="text-xs tracking-widest text-muted uppercase">Index</p>
              <h2 className="mt-3 font-display text-4xl leading-none">Bank Nifty</h2>
              <p className="mt-3 text-muted">
                A second book, not a second strategy. The JSON lists it beside Nifty. The engine does not special-case the symbol.
              </p>
            </article>
            <article className="border-line lg:border-l lg:pl-8">
              <p className="text-xs tracking-widest text-muted uppercase">Stocks</p>
              <h2 className="mt-3 font-display text-4xl leading-none">Names, not a basket blur</h2>
              <p className="mt-3 text-muted">
                Reliance and HDFC Bank are in this sample. Add a symbol by adding an object. Turn shorts off if the name should only be bought.
              </p>
            </article>
          </div>
        </section>

        <section id="pricing" className="border-t border-line">
          <div className="mx-auto max-w-6xl px-5 py-20">
            <p className="text-xs tracking-widest text-primary uppercase">04 — Seats</p>
            <h2 className="mt-3 font-display text-4xl leading-none sm:text-5xl">Pay for the book you want run.</h2>
            <div className="mt-10 grid gap-px bg-line lg:grid-cols-3">
              {tiers.map((tier) => (
                <article key={tier.name} className={tier.featured ? "bg-elevated p-6" : "bg-bg p-6"}>
                  <p className="text-sm text-primary">{tier.featured ? "Most desks start here" : tier.name === "Reader" ? "Look first" : "Full list"}</p>
                  <h3 className="mt-4 font-display text-3xl">{tier.name}</h3>
                  <p className="mt-3 font-display text-5xl leading-none">{tier.price}</p>
                  <p className="mt-2 text-sm text-muted">{tier.note}</p>
                  <ul className="mt-6 flex flex-col gap-3 text-sm">
                    {tier.points.map((point) => (
                      <li key={point} className="border-t border-line pt-3">
                        {point}
                      </li>
                    ))}
                  </ul>
                  <a
                    href="#access"
                    className={
                      tier.featured
                        ? "mt-8 flex min-h-12 items-center justify-center bg-primary font-medium text-primary-fg transition-transform duration-150 ease-out active:scale-[0.96]"
                        : "mt-8 flex min-h-12 items-center justify-center border border-line"
                    }
                  >
                    {tier.price === "₹0" ? "Replay the sample" : "Request this seat"}
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="proof" className="border-t border-line">
          <div className="mx-auto max-w-6xl px-5 py-20">
            <p className="text-xs tracking-widest text-primary uppercase">05 — From the desk</p>
            <h2 className="mt-3 font-display text-4xl leading-none sm:text-5xl">What people keep the rule for.</h2>
            <div className="mt-10 grid gap-10 lg:grid-cols-3">
              {quotes.map((item) => (
                <figure key={item.name} className="border-t border-primary pt-5">
                  <blockquote className="font-display text-2xl leading-snug italic">“{item.quote}”</blockquote>
                  <figcaption className="mt-5 text-sm text-muted">
                    <span className="text-fg">{item.name}</span> · {item.role}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-line">
          <div className="mx-auto max-w-3xl px-5 py-16">
            <h2 className="font-display text-4xl leading-none">Questions, answered flat.</h2>
            <div className="mt-8 border-b border-line">
              {questions.map((item) => (
                <details key={item.q} className="group border-t border-line py-4">
                  <summary className="flex min-h-12 items-center justify-between gap-4 text-lg">
                    {item.q}
                    <span className="text-primary transition-transform duration-200 group-open:rotate-45" aria-hidden>
                      +
                    </span>
                  </summary>
                  <p className="pt-2 pr-8 text-muted">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section id="access" className="border-t border-line">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 lg:grid-cols-2">
            <div>
              <p className="text-xs tracking-widest text-primary uppercase">06 — Access</p>
              <h2 className="mt-3 font-display text-4xl leading-none sm:text-5xl">Ask for the seat. Read the rule while you wait.</h2>
              <p className="mt-4 text-muted">
                Tell us which book you want run. Your request is stored securely for admin review. Nothing here is advice, and
                nothing here is a live route to the exchange.
              </p>
            </div>
            <SignupForm idPrefix="footer" />
          </div>
        </section>

        <section id="contact" className="border-t border-line">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 lg:grid-cols-2">
            <div><p className="text-xs tracking-widest text-primary uppercase">Contact</p><h2 className="mt-3 font-display text-4xl">Send the desk a message.</h2><p className="mt-4 max-w-md text-muted">Website enquiries are stored in the VMVIRA admin inbox for review. No email is sent automatically from this form.</p></div>
            <ContactForm />
          </div>
        </section>
      </main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 text-sm text-muted sm:flex-row sm:items-start sm:justify-between">
          <p className="max-w-xl">
            VMVIRA is a rules preview. Futures and equities can lose money, including the whole of a position.
            The sample is not a track record, not a SEBI registration, and not a recommendation to trade.
          </p>
          <a href="#top" className="min-h-11 text-fg">
            Back to the top
          </a>
        </div>
      </footer>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface px-5 py-4">
      <dt className="text-xs tracking-widest text-muted uppercase">{label}</dt>
      <dd className="mt-1 text-lg tabular-nums">{value}</dd>
    </div>
  );
}

function Print({ title, detail, value }: { title: string; detail: string; value: string }) {
  return (
    <li className="flex items-baseline justify-between gap-4 py-4">
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted">{detail}</p>
      </div>
      <p className="tabular-nums">{value}</p>
    </li>
  );
}
