export function price(value: number) {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function points(value: number) {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: "exceptZero",
  }).format(value);
}

export function prettyDay(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function effectLabel(effect: string, reason: string) {
  if (effect === "open_long") return "Auto buy";
  if (effect === "open_short") return "Auto sell";
  if (reason === "vwap_stop") return "VWAP stop";
  if (reason === "session_flat") return "Session flat";
  if (effect === "close_long") return "Sell to flat";
  return "Cover";
}

export function reasonLabel(reason: string) {
  if (reason === "ema20_cross_above_ema200") return "20 crossed above 200";
  if (reason === "ema20_cross_below_ema200") return "20 crossed below 200";
  if (reason === "vwap_stop") return "Close crossed session VWAP";
  if (reason === "session_flat") return "Flattened at 15:25";
  return reason;
}
