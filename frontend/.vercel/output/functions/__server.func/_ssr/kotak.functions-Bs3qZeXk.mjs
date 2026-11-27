import { t as createServerRpc } from "./createServerRpc-DAydqu_B.mjs";
import { dn as number, fn as object, hn as string, in as _enum, ln as literal } from "../_libs/@better-auth/core+[...].mjs";
import { n as createServerFn } from "./ssr.mjs";
// node_modules/.nitro/vite/services/ssr/assets/kotak.functions-Bs3qZeXk.js
var LOGIN_URL = "https://mis.kotaksecurities.com/login/1.0/tradeApiLogin";
var VALIDATE_URL = "https://mis.kotaksecurities.com/login/1.0/tradeApiValidate";
var loginSchema = object({
	accessToken: string().trim().min(8).max(200),
	mobileNumber: string().trim().min(10).max(16),
	ucc: string().trim().min(3).max(12),
	totp: string().trim().regex(/^\d{6}$/),
	mpin: string().trim().regex(/^\d{6}$/)
});
var quoteSchema = object({
	accessToken: string().trim().min(8).max(200),
	baseUrl: string().trim().url(),
	neosymbol: string().trim().min(3).max(80)
});
var historySchema = quoteSchema.extend({
	fromdate: string().regex(/^\d{4}-\d{2}-\d{2}$/),
	todate: string().regex(/^\d{4}-\d{2}-\d{2}$/)
});
var orderSchema = object({
	baseUrl: string().trim().url(),
	sid: string().trim().min(8).max(80),
	auth: string().trim().min(20).max(4e3),
	arm: literal("ARM"),
	tradingSymbol: string().trim().min(2).max(40),
	exchangeSegment: _enum(["nse_cm", "nse_fo"]),
	product: _enum([
		"MIS",
		"CNC",
		"NRML"
	]),
	quantity: number().int().min(1).max(500),
	transactionType: _enum(["B", "S"])
});
function kotakOrigin(baseUrl) {
	const url = new URL(baseUrl);
	if (url.protocol !== "https:" || !url.hostname.endsWith("kotaksecurities.com")) throw new Error("Kotak returned an unexpected host.");
	return url.origin;
}
function mobile(value) {
	const digits = value.replace(/[^\d+]/g, "");
	if (digits.startsWith("+")) return digits;
	const bare = digits.replace(/\D/g, "");
	if (bare.length === 10) return `+91${bare}`;
	if (bare.length === 12 && bare.startsWith("91")) return `+${bare}`;
	return `+${bare}`;
}
async function readBody(response) {
	const text = await response.text();
	if (!text) return {
		status: response.status,
		body: null
	};
	try {
		return {
			status: response.status,
			body: JSON.parse(text)
		};
	} catch {
		return {
			status: response.status,
			body: text.slice(0, 240)
		};
	}
}
function failMessage(body, status) {
	if (typeof body === "string" && body) return body;
	if (body && typeof body === "object") {
		const record = body;
		for (const key of [
			"message",
			"emsg",
			"errMsg",
			"error"
		]) if (typeof record[key] === "string" && record[key]) return record[key];
		const data = record.data;
		if (data && typeof data === "object") {
			const inner = data;
			if (typeof inner.message === "string") return inner.message;
		}
	}
	return `Kotak rejected the call (${status}).`;
}
var kotakLogin_createServerFn_handler = createServerRpc({
	id: "1284812d9f586bed21c2ad1dcc1cc3c90428c44171c79e5dadf89aa1bb4b1a47",
	name: "kotakLogin",
	filename: "src/lib/kotak.functions.ts"
}, (opts) => kotakLogin.__executeServer(opts));
var kotakLogin = createServerFn({ method: "POST" }).validator((input) => loginSchema.parse(input)).handler(kotakLogin_createServerFn_handler, async ({ data }) => {
	try {
		const headers = {
			Authorization: data.accessToken,
			"neo-fin-key": "neotradeapi",
			"Content-Type": "application/json",
			Accept: "application/json"
		};
		const viewResponse = await fetch(LOGIN_URL, {
			method: "POST",
			headers,
			body: JSON.stringify({
				mobileNumber: mobile(data.mobileNumber),
				ucc: data.ucc.toUpperCase(),
				totp: data.totp
			}),
			signal: AbortSignal.timeout(15e3)
		});
		const view = await readBody(viewResponse);
		const viewData = view.body && typeof view.body === "object" ? view.body.data : void 0;
		if (!viewResponse.ok || !viewData || typeof viewData.token !== "string" || typeof viewData.sid !== "string") return {
			ok: false,
			message: failMessage(view.body, view.status)
		};
		const tradeResponse = await fetch(VALIDATE_URL, {
			method: "POST",
			headers: {
				...headers,
				sid: viewData.sid,
				Auth: viewData.token
			},
			body: JSON.stringify({ mpin: data.mpin }),
			signal: AbortSignal.timeout(15e3)
		});
		const trade = await readBody(tradeResponse);
		const tradeData = trade.body && typeof trade.body === "object" ? trade.body.data : void 0;
		if (!tradeResponse.ok || !tradeData || typeof tradeData.token !== "string" || typeof tradeData.sid !== "string" || typeof tradeData.baseUrl !== "string") return {
			ok: false,
			message: failMessage(trade.body, trade.status)
		};
		kotakOrigin(tradeData.baseUrl);
		return {
			ok: true,
			token: tradeData.token,
			sid: tradeData.sid,
			baseUrl: kotakOrigin(tradeData.baseUrl),
			name: typeof tradeData.greetingName === "string" ? tradeData.greetingName : "Desk"
		};
	} catch (error) {
		return {
			ok: false,
			message: error instanceof Error ? error.message : "Kotak login failed."
		};
	}
});
var kotakQuote_createServerFn_handler = createServerRpc({
	id: "599c173ea2ec25cb1f44bb30efc310ac55b7fd57c6ac8b8f477fbf88211630b5",
	name: "kotakQuote",
	filename: "src/lib/kotak.functions.ts"
}, (opts) => kotakQuote.__executeServer(opts));
var kotakQuote = createServerFn({ method: "POST" }).validator((input) => quoteSchema.parse(input)).handler(kotakQuote_createServerFn_handler, async ({ data }) => {
	try {
		const origin = kotakOrigin(data.baseUrl);
		const path = `/script-details/1.0/quotes/neosymbol/${encodeURI(data.neosymbol)}/all`;
		const response = await fetch(`${origin}${path}`, {
			headers: {
				Authorization: data.accessToken,
				Accept: "application/json"
			},
			signal: AbortSignal.timeout(12e3)
		});
		const parsed = await readBody(response);
		if (!response.ok) return {
			ok: false,
			message: failMessage(parsed.body, parsed.status)
		};
		const row = Array.isArray(parsed.body) ? parsed.body[0] : parsed.body;
		if (!row || typeof row !== "object") return {
			ok: false,
			message: "Kotak returned no quote."
		};
		const quote = row;
		const ohlc = quote.ohlc && typeof quote.ohlc === "object" ? quote.ohlc : {};
		const ltp = Number(quote.ltp);
		if (!Number.isFinite(ltp)) return {
			ok: false,
			message: "Quote had no last price."
		};
		return {
			ok: true,
			ltp,
			open: Number(ohlc.open) || ltp,
			high: Number(ohlc.high) || ltp,
			low: Number(ohlc.low) || ltp,
			close: Number(ohlc.close) || ltp,
			volume: Number(quote.last_volume ?? quote.volume ?? 0) || 0,
			symbol: typeof quote.display_symbol === "string" ? quote.display_symbol : data.neosymbol
		};
	} catch (error) {
		return {
			ok: false,
			message: error instanceof Error ? error.message : "Quote failed."
		};
	}
});
var kotakHistory_createServerFn_handler = createServerRpc({
	id: "5ccc76c708fdb0d08ca2ae7a5cb961ccd612644886bea1b7532f4a744ed28417",
	name: "kotakHistory",
	filename: "src/lib/kotak.functions.ts"
}, (opts) => kotakHistory.__executeServer(opts));
var kotakHistory = createServerFn({ method: "POST" }).validator((input) => historySchema.parse(input)).handler(kotakHistory_createServerFn_handler, async ({ data }) => {
	try {
		const origin = kotakOrigin(data.baseUrl);
		const url = new URL("/market-data/1.0/historical/details", origin);
		url.searchParams.set("neosymbol", data.neosymbol);
		url.searchParams.set("fromdate", data.fromdate);
		url.searchParams.set("todate", data.todate);
		url.searchParams.set("interval", "5min");
		const response = await fetch(url, {
			headers: {
				Authorization: data.accessToken,
				Accept: "application/json"
			},
			signal: AbortSignal.timeout(2e4)
		});
		const parsed = await readBody(response);
		if (!response.ok) return {
			ok: false,
			message: failMessage(parsed.body, parsed.status)
		};
		const candles = parsed.body?.data?.candles;
		if (!Array.isArray(candles)) return {
			ok: false,
			message: failMessage(parsed.body, parsed.status)
		};
		return {
			ok: true,
			candles: candles.flatMap((item) => {
				if (!Array.isArray(item) || item.length < 5) return [];
				const time = Date.parse(String(item[0]));
				if (!Number.isFinite(time)) return [];
				return [{
					time,
					open: Number(item[1]),
					high: Number(item[2]),
					low: Number(item[3]),
					close: Number(item[4]),
					volume: Number(item[5] ?? 0) || 0
				}];
			})
		};
	} catch (error) {
		return {
			ok: false,
			message: error instanceof Error ? error.message : "History failed."
		};
	}
});
var kotakOrder_createServerFn_handler = createServerRpc({
	id: "3d5e48309a3627431110703b98a86a13c4dcef45b7cdf6a5cf02251625d85e1f",
	name: "kotakOrder",
	filename: "src/lib/kotak.functions.ts"
}, (opts) => kotakOrder.__executeServer(opts));
var kotakOrder = createServerFn({ method: "POST" }).validator((input) => orderSchema.parse(input)).handler(kotakOrder_createServerFn_handler, async ({ data }) => {
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
			tt: data.transactionType
		};
		const response = await fetch(`${origin}/quick/order/rule/ms/place`, {
			method: "POST",
			headers: {
				Accept: "application/json",
				"Content-Type": "application/x-www-form-urlencoded",
				Sid: data.sid,
				Auth: data.auth,
				"neo-fin-key": "neotradeapi"
			},
			body: new URLSearchParams({ jData: JSON.stringify(jData) }),
			signal: AbortSignal.timeout(15e3)
		});
		const parsed = await readBody(response);
		const record = parsed.body && typeof parsed.body === "object" ? parsed.body : {};
		const orderNo = typeof record.nOrdNo === "string" ? record.nOrdNo : "";
		if (!response.ok || record.stat && record.stat !== "Ok" || !orderNo) return {
			ok: false,
			message: failMessage(parsed.body, parsed.status)
		};
		return {
			ok: true,
			orderNo
		};
	} catch (error) {
		return {
			ok: false,
			message: error instanceof Error ? error.message : "Order failed."
		};
	}
});
export { kotakHistory_createServerFn_handler, kotakLogin_createServerFn_handler, kotakOrder_createServerFn_handler, kotakQuote_createServerFn_handler };
