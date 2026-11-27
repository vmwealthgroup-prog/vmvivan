export type PlanId = "observer" | "desk" | "floor";

export type WaitlistEntry = {
  email: string;
  plan: PlanId;
  markets: string[];
  at: string;
};

const KEY = "VMVIRA-waitlist";

export function readWaitlist(): WaitlistEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isEntry);
  } catch {
    return [];
  }
}

export function saveWaitlist(entry: WaitlistEntry): { ok: true } | { ok: false; reason: "duplicate" } {
  const all = readWaitlist();
  if (all.some((item) => item.email.toLowerCase() === entry.email.toLowerCase())) {
    return { ok: false, reason: "duplicate" };
  }
  all.unshift(entry);
  window.localStorage.setItem(KEY, JSON.stringify(all.slice(0, 20)));
  return { ok: true };
}

function isEntry(value: unknown): value is WaitlistEntry {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.email === "string" && typeof row.plan === "string" && Array.isArray(row.markets);
}
