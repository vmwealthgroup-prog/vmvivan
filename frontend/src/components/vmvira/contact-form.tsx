import { useState, type FormEvent } from "react";
import { submitContactMessage } from "@/lib/admin.functions";

export function ContactForm() {
  const [name,setName]=useState(""); const [email,setEmail]=useState(""); const [subject,setSubject]=useState("Website enquiry"); const [message,setMessage]=useState(""); const [status,setStatus]=useState(""); const [busy,setBusy]=useState(false);
  async function submit(e:FormEvent){e.preventDefault();setBusy(true);setStatus("");try{await submitContactMessage({data:{name,email,subject,message}});setStatus("Message received. The VMVIRA team can review it in the admin inbox.");setName("");setEmail("");setSubject("Website enquiry");setMessage("");}catch(err){setStatus(err instanceof Error?err.message:"Could not send message.");}finally{setBusy(false);}}
  return <form onSubmit={submit} className="flex flex-col gap-3">
    <input required maxLength={120} value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" className="min-h-12 border border-line bg-bg px-4 text-fg"/>
    <input required type="email" maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email address" className="min-h-12 border border-line bg-bg px-4 text-fg"/>
    <input required maxLength={180} value={subject} onChange={e=>setSubject(e.target.value)} placeholder="Subject" className="min-h-12 border border-line bg-bg px-4 text-fg"/>
    <textarea required minLength={2} maxLength={8000} rows={5} value={message} onChange={e=>setMessage(e.target.value)} placeholder="How can we help?" className="border border-line bg-bg p-4 text-fg"/>
    <button disabled={busy} className="min-h-12 bg-primary px-5 font-medium text-primary-fg">{busy?"Sending…":"Send message"}</button>
    {status&&<p role="status" className="text-sm text-muted">{status}</p>}
  </form>;
}
