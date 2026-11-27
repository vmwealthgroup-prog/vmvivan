import { createServerFn } from "@tanstack/react-start";
import { randomUUID } from "node:crypto";
import { z } from "zod";

const requestSchema = z.object({
  email: z.string().trim().email().max(254),
  book: z.enum(["nifty", "bank", "stocks", "all"]),
});
const contactSchema = z.object({
  name: z.string().trim().max(120).default(""),
  email: z.string().trim().email().max(254),
  subject: z.string().trim().min(2).max(180).default("Website enquiry"),
  message: z.string().trim().min(2).max(8000),
});
const reviewSchema = z.object({ id: z.string().min(1).max(80), status: z.enum(["approved", "rejected"]) });
const messageUpdateSchema = z.object({ id: z.string().min(1).max(80), status: z.enum(["unread", "read", "archived"]), note: z.string().max(4000).default("") });
const settingSchema = z.object({ key: z.string().regex(/^[a-z][a-z0-9_.-]{1,60}$/), value: z.string().max(12000) });

async function db() { return import("./db").then((m) => m.getSql()); }
async function adminIdentity() {
  const { getSessionUser } = await import("./auth/verify.server");
  const user = await getSessionUser();
  const allowed = (process.env.VMVIRA_ADMIN_EMAILS ?? "").split(",").map((v) => v.trim().toLowerCase()).filter(Boolean);
  if (!user?.email || !allowed.includes(user.email.toLowerCase())) {
    throw new Error("Admin access denied. Sign in with an email listed in VMVIRA_ADMIN_EMAILS.");
  }
  return user;
}
async function audit(email: string, action: string, targetType: string, targetId = "", details = "") {
  const sql = await db();
  await sql`insert into admin_audit_log (id, admin_email, action, target_type, target_id, details) values (${randomUUID()}, ${email}, ${action}, ${targetType}, ${targetId}, ${details})`;
}

export const submitAccessRequest = createServerFn({ method: "POST" }).validator((v: unknown) => requestSchema.parse(v)).handler(async ({ data }) => {
  const sql = await db();
  const email = data.email.toLowerCase();
  const rows = await sql.query<{ id: string; status: string }>(
    "insert into admin_access_requests (id,email,book) values ($1,$2,$3) on conflict (email) do update set book=excluded.book, status=case when admin_access_requests.status='approved' then 'approved' else 'pending' end returning id,status",
    [randomUUID(), email, data.book],
  );
  return { ok: true as const, status: rows[0]?.status ?? "pending" };
});

export const submitContactMessage = createServerFn({ method: "POST" }).validator((v: unknown) => contactSchema.parse(v)).handler(async ({ data }) => {
  const sql = await db();
  await sql`insert into admin_messages (id,sender_name,sender_email,subject,body) values (${randomUUID()}, ${data.name}, ${data.email.toLowerCase()}, ${data.subject}, ${data.message})`;
  return { ok: true as const };
});

export const getAdminOverview = createServerFn({ method: "GET" }).handler(async () => {
  const admin = await adminIdentity();
  const sql = await db();
  const [requests, messages, settings, logs, chats, counts] = await Promise.all([
    sql.query<Record<string, string | number | boolean | null>>("select id,email,book,status,created_at,reviewed_at from admin_access_requests order by created_at desc limit 200"),
    sql.query<Record<string, string | number | boolean | null>>("select id,sender_name,sender_email,subject,body,status,created_at,admin_note from admin_messages order by created_at desc limit 200"),
    sql.query<Record<string, string | number | boolean | null>>("select setting_key,setting_value,updated_at from site_settings order by setting_key"),
    sql.query<Record<string, string | number | boolean | null>>("select id,admin_email,action,target_type,target_id,details,created_at from admin_audit_log order by created_at desc limit 100"),
    sql.query<Record<string, string | number | boolean | null>>("select conversation_id, min(created_at) as started_at, max(created_at) as last_message_at, count(*)::int as message_count, left(string_agg(sender_role || ': ' || message, E'\n' order by created_at), 6000) as transcript from customer_chat_messages group by conversation_id order by max(created_at) desc limit 100"),
    sql.query<{ pending: number; unread: number; approved: number }>("select (select count(*) from admin_access_requests where status='pending')::int as pending, (select count(*) from admin_messages where status='unread')::int as unread, (select count(*) from admin_access_requests where status='approved')::int as approved"),
  ]);
  return { admin: { email: admin.email }, requests, messages, settings, logs, chats, counts: counts[0] ?? { pending: 0, unread: 0, approved: 0 } };
});

export const reviewAccessRequest = createServerFn({ method: "POST" }).validator((v: unknown) => reviewSchema.parse(v)).handler(async ({ data }) => {
  const admin = await adminIdentity(); const sql = await db();
  const rows = await sql.query("update admin_access_requests set status=$1, reviewed_at=now(), reviewed_by=$2 where id=$3 returning id", [data.status, admin.email, data.id]);
  if (!rows.length) throw new Error("Access request not found.");
  await audit(admin.email!, `request_${data.status}`, "access_request", data.id);
  return { ok: true as const };
});

export const updateAdminMessage = createServerFn({ method: "POST" }).validator((v: unknown) => messageUpdateSchema.parse(v)).handler(async ({ data }) => {
  const admin = await adminIdentity(); const sql = await db();
  const rows = await sql.query("update admin_messages set status=$1, admin_note=$2 where id=$3 returning id", [data.status, data.note, data.id]);
  if (!rows.length) throw new Error("Message not found.");
  await audit(admin.email!, "message_updated", "message", data.id, data.status);
  return { ok: true as const };
});

export const saveSiteSetting = createServerFn({ method: "POST" }).validator((v: unknown) => settingSchema.parse(v)).handler(async ({ data }) => {
  const admin = await adminIdentity(); const sql = await db();
  await sql.query("insert into site_settings(setting_key,setting_value,updated_by) values($1,$2,$3) on conflict(setting_key) do update set setting_value=excluded.setting_value, updated_at=now(), updated_by=excluded.updated_by", [data.key, data.value, admin.email]);
  await audit(admin.email!, "site_setting_saved", "site_setting", data.key);
  return { ok: true as const };
});

/** Public, read-only settings used by the marketing site. Never expose admin/audit data here. */
export const getPublicSiteSettings = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await db();
  const rows = await sql.query<{ setting_value: string }>("select setting_value from site_settings where setting_key='announcement' limit 1");
  return { announcement: rows[0]?.setting_value ?? "" };
});
