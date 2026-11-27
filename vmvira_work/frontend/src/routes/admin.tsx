import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { getAdminOverview, reviewAccessRequest, saveSiteSetting, updateAdminMessage } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin")({ component: AdminPage });

type Overview = Awaited<ReturnType<typeof getAdminOverview>>;
type Tab = "requests" | "messages" | "chats" | "website" | "audit";

function AdminPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>("requests");
  const [settingKey, setSettingKey] = useState("announcement");
  const [settingValue, setSettingValue] = useState("");
  const refresh = useCallback(async () => {
    setBusy(true); setError("");
    try { const result = await getAdminOverview(); setData(result); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to load admin data."); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  async function act(fn: () => Promise<unknown>) {
    setBusy(true); setError("");
    try { await fn(); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Action failed."); }
    finally { setBusy(false); }
  }
  return <main className="min-h-screen bg-bg px-4 py-8 text-fg sm:px-8">
    <div className="mx-auto max-w-7xl">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-6">
        <div><p className="text-xs uppercase tracking-[.25em] text-primary">VMVIRA CONTROL ROOM</p><h1 className="mt-2 font-display text-4xl">Admin console</h1><p className="mt-1 text-sm text-muted">{data?.admin.email ?? "Checking administrator session…"}</p></div>
        <div className="flex gap-2"><a href="/" className="border border-line px-4 py-2 text-sm">View website</a><button onClick={() => void refresh()} className="bg-primary px-4 py-2 text-sm font-medium text-primary-fg">Refresh</button></div>
      </header>
      {error && <div role="alert" className="my-5 border border-red-500/40 bg-red-500/10 p-4 text-sm">{error}<p className="mt-1 text-muted">For admin access, enable sign-in and add your exact account email to VMVIRA_ADMIN_EMAILS on the server.</p></div>}
      <section className="my-6 grid gap-3 sm:grid-cols-3">
        <Metric label="Pending approvals" value={data?.counts.pending ?? "—"}/><Metric label="Unread messages" value={data?.counts.unread ?? "—"}/><Metric label="Approved access" value={data?.counts.approved ?? "—"}/>
      </section>
      <nav className="mb-6 flex flex-wrap gap-2" aria-label="Admin sections">
        {([ ["requests","Approvals"],["messages","Email & messages"],["chats","AI chat transcripts"],["website","Website controls"],["audit","Audit log"] ] as [Tab,string][]).map(([id,label]) => <button key={id} onClick={() => setTab(id)} className={`border px-4 py-3 text-sm ${tab===id ? "border-primary bg-primary text-primary-fg" : "border-line text-muted"}`}>{label}</button>)}
      </nav>
      {busy && <p className="mb-3 text-xs text-muted">Updating…</p>}
      {tab === "requests" && <Panel title="Access approval queue" subtitle="Review website access requests. Decisions are stored in the database.">
        {!data?.requests.length ? <Empty/> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-line text-muted"><th className="p-3">Email</th><th className="p-3">Book</th><th className="p-3">Status</th><th className="p-3">Received</th><th className="p-3">Action</th></tr></thead><tbody>{data.requests.map((r: any) => <tr key={r.id} className="border-b border-line"><td className="p-3">{r.email}</td><td className="p-3">{r.book}</td><td className="p-3">{r.status}</td><td className="p-3">{new Date(r.created_at).toLocaleString()}</td><td className="p-3"><div className="flex gap-2"><button disabled={busy || r.status === "approved"} onClick={() => void act(() => reviewAccessRequest({data:{id:r.id,status:"approved"}}))} className="border border-primary px-3 py-2 text-primary">Approve</button><button disabled={busy || r.status === "rejected"} onClick={() => void act(() => reviewAccessRequest({data:{id:r.id,status:"rejected"}}))} className="border border-line px-3 py-2">Reject</button></div></td></tr>)}</tbody></table></div>}
      </Panel>}
      {tab === "messages" && <Panel title="Email & message inbox" subtitle="Website enquiries are saved here. This is not an external mailbox sync or outbound mail service.">
        {!data?.messages.length ? <Empty/> : <div className="space-y-3">{data.messages.map((m: any) => <article key={m.id} className="border border-line bg-surface p-4"><div className="flex flex-wrap justify-between gap-2"><div><p className="font-medium">{m.subject}</p><p className="text-sm text-muted">{m.sender_name} · {m.sender_email}</p></div><span className="text-xs uppercase text-primary">{m.status}</span></div><p className="my-3 whitespace-pre-wrap text-sm">{m.body}</p><p className="text-xs text-muted">{new Date(m.created_at).toLocaleString()}</p><label className="mt-3 block text-xs text-muted">Admin note<input defaultValue={m.admin_note} id={`note-${m.id}`} className="mt-1 min-h-10 w-full border border-line bg-bg px-3 text-sm text-fg"/></label><div className="mt-3 flex flex-wrap gap-2">{(["unread","read","archived"] as const).map(status => <button key={status} disabled={busy} onClick={() => {const note=(document.getElementById(`note-${m.id}`) as HTMLInputElement)?.value ?? ""; void act(() => updateAdminMessage({data:{id:m.id,status,note}}));}} className="border border-line px-3 py-2 text-xs">Mark {status}</button>)}</div></article>)}</div>}
      </Panel>}
      {tab === "chats" && <Panel title="Customer-care AI conversations" subtitle="Visitor chat transcripts stored in the database. Only allowlisted administrators can view this section.">
        {!data?.chats.length ? <Empty/> : <div className="space-y-3">{data.chats.map((chat: any) => <article key={chat.conversation_id} className="border border-line bg-surface p-4"><div className="flex flex-wrap justify-between gap-2 text-xs text-muted"><span>Conversation {chat.conversation_id}</span><span>{chat.message_count} messages · {new Date(chat.last_message_at).toLocaleString()}</span></div><pre className="mt-3 whitespace-pre-wrap break-words font-sans text-sm">{chat.transcript}</pre></article>)}</div>}
      </Panel>}
      {tab === "website" && <Panel title="Website settings" subtitle="Store controlled content values for future public-site components. Values are saved server-side; this export does not yet wire every homepage section to these settings.">
        <div className="grid gap-3 md:grid-cols-[220px_1fr]"><label className="text-sm text-muted">Setting key<input value={settingKey} onChange={e=>setSettingKey(e.target.value)} className="mt-1 min-h-11 w-full border border-line bg-bg px-3 text-fg"/></label><label className="text-sm text-muted">Setting value<textarea value={settingValue} onChange={e=>setSettingValue(e.target.value)} rows={5} className="mt-1 w-full border border-line bg-bg p-3 text-fg"/></label></div><button disabled={busy || !settingKey.trim()} onClick={() => void act(() => saveSiteSetting({data:{key:settingKey.trim(),value:settingValue}}))} className="mt-3 bg-primary px-5 py-3 text-sm font-medium text-primary-fg">Save setting</button>
        <h3 className="mt-8 mb-3 font-medium">Stored settings</h3>{!data?.settings.length ? <Empty/> : <div className="space-y-2">{data.settings.map((s:any)=><button key={s.setting_key} onClick={()=>{setSettingKey(s.setting_key);setSettingValue(s.setting_value);}} className="flex w-full justify-between gap-4 border border-line p-3 text-left text-sm"><span>{s.setting_key}</span><span className="max-w-[65%] truncate text-muted">{s.setting_value}</span></button>)}</div>}
      </Panel>}
      {tab === "audit" && <Panel title="Admin audit history" subtitle="Records of approval and control actions.">{!data?.logs.length ? <Empty/> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-line text-muted"><th className="p-3">Time</th><th className="p-3">Admin</th><th className="p-3">Action</th><th className="p-3">Target</th><th className="p-3">Details</th></tr></thead><tbody>{data.logs.map((l:any)=><tr key={l.id} className="border-b border-line"><td className="p-3">{new Date(l.created_at).toLocaleString()}</td><td className="p-3">{l.admin_email}</td><td className="p-3">{l.action}</td><td className="p-3">{l.target_type} / {l.target_id}</td><td className="p-3">{l.details}</td></tr>)}</tbody></table></div>}</Panel>}
      <footer className="mt-8 border-t border-line pt-4 text-xs text-muted">Protected admin APIs · server-side email allowlist · database-backed records · audit trail</footer>
    </div>
  </main>;
}
function Metric({label,value}:{label:string;value:string|number}) { return <div className="border border-line bg-surface p-5"><p className="text-xs uppercase tracking-widest text-muted">{label}</p><p className="mt-2 font-display text-4xl">{value}</p></div>; }
function Panel({title,subtitle,children}:{title:string;subtitle:string;children:ReactNode}) { return <section className="border border-line bg-surface p-5 sm:p-7"><h2 className="font-display text-2xl">{title}</h2><p className="mb-5 mt-1 text-sm text-muted">{subtitle}</p>{children}</section>; }
function Empty(){return <p className="border border-dashed border-line p-8 text-center text-sm text-muted">No records yet.</p>;}
