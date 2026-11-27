import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const LOGIN_URL = "https://mis.kotaksecurities.com/login/1.0/tradeApiLogin";
const VALIDATE_URL = "https://mis.kotaksecurities.com/login/1.0/tradeApiValidate";

const loginSchema = z.object({
  accessToken: z.string().trim().min(8).max(200),
  mobileNumber: z.string().trim().min(10).max(16),
  ucc: z.string().trim().min(3).max(12),
  totp: z.string().trim().regex(/^\d{6}$/),
  mpin: z.string().trim().regex(/^\d{6}$/),
});

const quoteSchema = z.object({
  accessToken: z.string().trim().min(8).max(200),
  baseUrl: z.string().trim().url(),
  neosymbol: z.string().trim().min(3).max(80),
});

const historySchema = quoteSchema.extend({
  fromdate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  todate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const orderSchema = z.object({
  baseUrl: z.string().trim().url(),
  sid: z.string().trim().min(8).max(80),
  auth: z.string().trim().min(20).max(4000),
  arm: z.literal("ARM"),
  tradingSymbol: z.string().trim().min(2).max(40),
  exchangeSegment: z.enum(["nse_cm", "nse_fo"]),
  product: z.enum(["MIS", "CNC", "NRML"]),
  quantity: z.number().int().min(1).max(500),
  transactionType: z.enum(["B", "S"]),
});

function kotakOrigin(baseUrl: string) {
  const url = new URL(baseUrl);
  if (url.protocol !== "https:" || !url.hostname.endsWith("kotaksecurities.com")) {
    throw new Error("Kotak returned an unexpected host.");
  }
  return url.origin;
}

function mobile(value: string) {
  const digits = value.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  const bare = digits.replace(/\D/g, "");
  if (bare.length === 10) return `+91${bare}`;
  if (bare.length === 12 && bare.startsWith("91")) return `+${bare}`;
  return `+${bare}`;
}

async function readBody(response: Response) {
  const text = await response.text();
  if (!text) return { status: response.status, body: null as unknown };
  try {
    return { status: response.status, body: JSON.parse(text) as unknown };
  } catch {
    return { status: response.status, body: text.slice(0, 240) };
  }
}

function failMessage(body: unknown, status: number) {
  if (typeof body === "string" && body) return body;
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    for (const key of ["message", "emsg", "errMsg", "error"]) {
      if (typeof record[key] === "string" && record[key]) return record[key] as string;
    }
    const data = record.data;
    if (data && typeof data === "object") {
      const inner = data as Record<string, unknown>;
      if (typeof inner.message === "string") return inner.message;
    }
  }
  return `Kotak rejected the call (${status}).`;
}

export const kotakLogin = createServerFn({ method: "POST" })
  .validator((input: unknown) => loginSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const headers = {
        Authorization: data.accessToken,
        "neo-fin-key": "neotradeapi",
        "Content-Type": "application/json",
        Accept: "application/json",
      };
      const viewResponse = await fetch(LOGIN_URL, {
        method: "POST",
        headers,
        body: JSON.stringify({
          mobileNumber: mobile(data.mobileNumber),
          ucc: data.ucc.toUpperCase(),
          totp: data.totp,
        }),
        signal: AbortSignal.timeout(15000),
      });
      const view = await readBody(viewResponse);
      const viewData =
        view.body && typeof view.body === "object" ? (view.body as { data?: Record<string, unknown> }).data : undefined;
      if (!viewResponse.ok || !viewData || typeof viewData.token !== "string" || typeof viewData.sid !== "string") {
        return { ok: false as const, message: failMessage(view.body, view.status) };
      }

      const tradeResponse = await fetch(VALIDATE_URL, {
        method: "POST",
        headers: { ...headers, sid: viewData.sid, Auth: viewData.token },
        body: JSON.stringify({ mpin: data.mpin }),
        signal: AbortSignal.timeout(15000),
      });
      const trade = await readBody(tradeResponse);
      const tradeData =
        trade.body && typeof trade.body === "object"
          ? (trade.body as { data?: Record<string, unknown> }).data
          : undefined;
      if (
        !tradeResponse.ok ||
        !tradeData ||
        typeof tradeData.token !== "string" ||
        typeof tradeData.sid !== "string" ||
        typeof tradeData.baseUrl !== "string"
      ) {
        return { ok: false as const, message: failMessage(trade.body, trade.status) };
      }
      kotakOrigin(tradeData.baseUrl);
      return {
        ok: true as const,
        token: tradeData.token,
        sid: tradeData.sid,
        baseUrl: kotakOrigin(tradeData.baseUrl),
        name: typeof tradeData.greetingName === "string" ? tradeData.greetingName : "Desk",
      };
    } catch (error) {
      return { ok: false as const, message: error instanceof Error ? error.message : "Kotak login failed." };
    }
  });

export const kotakQuote = createServerFn({ method: "POST" })
  .validator((input: unknown) => quoteSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const origin = kotakOrigin(data.baseUrl);
      const path = `/script-details/1.0/quotes/neosymbol/${encodeURI(data.neosymbol)}/all`;
      const response = await fetch(`${origin}${path}`, {
        headers: { Authorization: data.accessToken, Accept: "application/json" },
        signal: AbortSignal.timeout(12000),
      });
      const parsed = await readBody(response);
      if (!response.ok) return { ok: false as const, message: failMessage(parsed.body, parsed.status) };
      const row = Array.isArray(parsed.body) ? parsed.body[0] : parsed.body;
      if (!row || typeof row !== "object") return { ok: false as const, message: "Kotak returned no quote." };
      const quote = row as Record<string, unknown>;
      const ohlc = (quote.ohlc && typeof quote.ohlc === "object" ? quote.ohlc : {}) as Record<string, unknown>;
      const ltp = Number(quote.ltp);
      if (!Number.isFinite(ltp)) return { ok: false as const, message: "Quote had no last price." };
      return {
        ok: true as const,
        ltp,
        open: Number(ohlc.open) || ltp,
        high: Number(ohlc.high) || ltp,
        low: Number(ohlc.low) || ltp,
        close: Number(ohlc.close) || ltp,
        volume: Number(quote.last_volume ?? quote.volume ?? 0) || 0,
        symbol: typeof quote.display_symbol === "string" ? quote.display_symbol : data.neosymbol,
      };
    } catch (error) {
      return { ok: false as const, message: error instanceof Error ? error.message : "Quote failed." };
    }
  });

export const kotakHistory = createServerFn({ method: "POST" })
  .validator((input: unknown) => historySchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const origin = kotakOrigin(data.baseUrl);
      const url = new URL("/market-data/1.0/historical/details", origin);
      url.searchParams.set("neosymbol", data.neosymbol);
      url.searchParams.set("fromdate", data.fromdate);
      url.searchParams.set("todate", data.todate);
      url.searchParams.set("interval", "5min");
      const response = await fetch(url, {
        headers: { Authorization: data.accessToken, Accept: "application/json" },
        signal: AbortSignal.timeout(20000),
      });
      const parsed = await readBody(response);
      if (!response.ok) return { ok: false as const, message: failMessage(parsed.body, parsed.status) };
      const root = parsed.body as { data?: { candles?: unknown[] }; status?: string } | null;
      const candles = root?.data?.candles;
      if (!Array.isArray(candles)) return { ok: false as const, message: failMessage(parsed.body, parsed.status) };
      const rows = candles.flatMap((item) => {
        if (!Array.isArray(item) || item.length < 5) return [];
        const time = Date.parse(String(item[0]));
        if (!Number.isFinite(time)) return [];
        return [
          {
            time,
            open: Number(item[1]),
            high: Number(item[2]),
            low: Number(item[3]),
            close: Number(item[4]),
            volume: Number(item[5] ?? 0) || 0,
          },
        ];
      });
      return { ok: true as const, candles: rows };
    } catch (error) {
      return { ok: false as const, message: error instanceof Error ? error.message : "History failed." };
    }
  });

export const kotakOrder = createServerFn({ method: "POST" })
  .validator((input: unknown) => orderSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const origin = kotakOrigin(data.baseUrl);
      const jData = {
        am: "NO",
        dq: "0",
        es: data.exchangeSegment,
        mp: "0",
        pc: data.product,
        pf: "N",
        pr: "0",
        pt: "MKT",
        qt: String(data.quantity),
        rt: "DAY",
        tp: "0",
        ts: data.tradingSymbol.toUpperCase(),
        tt: data.transactionType,
      };
      const response = await fetch(`${origin}/quick/order/rule/ms/place`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
          Sid: data.sid,
          Auth: data.auth,
          "neo-fin-key": "neotradeapi",
        },
        body: new URLSearchParams({ jData: JSON.stringify(jData) }),
        signal: AbortSignal.timeout(15000),
      });
      const parsed = await readBody(response);
      const record = parsed.body && typeof parsed.body === "object" ? (parsed.body as Record<string, unknown>) : {};
      const orderNo = typeof record.nOrdNo === "string" ? record.nOrdNo : "";
      if (!response.ok || (record.stat && record.stat !== "Ok") || !orderNo) {
        return { ok: false as const, message: failMessage(parsed.body, parsed.status) };
      }
      return { ok: true as const, orderNo };
    } catch (error) {
      return { ok: false as const, message: error instanceof Error ? error.message : "Order failed." };
    }
  });
