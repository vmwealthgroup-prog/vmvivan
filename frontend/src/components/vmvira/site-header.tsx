import { useState } from "react";
import { Menu, X } from "lucide-react";

const LINKS = [
  ["#live", "Live"],
  ["#engine", "Engine"],
  ["#desk", "Sample"],
  ["#pricing", "Pricing"],
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-line border-t-2 border-t-primary bg-bg/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5">
        <a href="#top" className="flex items-center gap-2 font-medium tracking-wide">
          <span className="grid size-8 place-items-center bg-primary text-sm font-semibold text-primary-fg">
            V
          </span>
          VMVIRA
        </a>
        <nav className="hidden items-center gap-6 text-sm text-muted md:flex" aria-label="Page">
          {LINKS.map(([href, label]) => (
            <a key={href} href={href} className="transition-colors duration-200 hover:text-fg">
              {label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <a
            href="/admin"
            className="hidden min-h-11 items-center px-3 text-sm text-muted transition-colors hover:text-fg md:inline-flex"
          >
            Admin
          </a>
          <a
            href="#access"
            className="hidden min-h-11 items-center bg-primary px-4 text-sm font-medium text-primary-fg transition-transform duration-150 ease-out active:scale-[0.96] md:inline-flex"
          >
            Request access
          </a>
          <button
            type="button"
            className="grid size-11 place-items-center border border-line md:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((value) => !value)}
          >
            <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>
      {open ? (
        <nav id="mobile-nav" className="border-t border-line bg-bg px-5 py-3 md:hidden" aria-label="Page">
          {LINKS.map(([href, label]) => (
            <a
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="flex min-h-12 items-center border-b border-line text-fg last:border-b-0"
            >
              {label}
            </a>
          ))}
          <a
            href="#access"
            onClick={() => setOpen(false)}
            className="mt-3 flex min-h-12 items-center justify-center bg-primary font-medium text-primary-fg"
          >
            Request access
          </a>
          <a
            href="/admin"
            onClick={() => setOpen(false)}
            className="flex min-h-12 items-center text-muted"
          >
            Admin
          </a>
        </nav>
      ) : null}
    </header>
  );
}
