import { useEffect, useState } from "react";
import { getPublicSiteSettings } from "@/lib/admin.functions";

export function SiteAnnouncement() {
  const [message, setMessage] = useState("");
  useEffect(() => { let active = true; void getPublicSiteSettings().then((data) => { if (active) setMessage(data.announcement); }).catch(() => undefined); return () => { active = false; }; }, []);
  if (!message.trim()) return null;
  return <div role="status" className="border-b border-primary/40 bg-primary/10 px-4 py-2 text-center text-sm text-fg">{message}</div>;
}
