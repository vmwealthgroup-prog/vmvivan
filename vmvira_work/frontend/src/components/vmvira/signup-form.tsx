import { useId, useState, type FormEvent } from "react";
import { z } from "zod";
import { submitAccessRequest } from "@/lib/admin.functions";

const BOOKS = [
  { id: "nifty", label: "Nifty 50" },
  { id: "bank", label: "Bank Nifty" },
  { id: "stocks", label: "Stocks" },
  { id: "all", label: "All three" },
] as const;

const schema = z.object({
  email: z.string().trim().email("Use a full email address."),
  book: z.enum(["nifty", "bank", "stocks", "all"]),
});

type BookId = (typeof BOOKS)[number]["id"];

type Lead = { email: string; book: BookId; at: string };

export function SignupForm({ idPrefix }: { idPrefix: string }) {
  const reactId = useId();
  const fieldId = `${idPrefix}-${reactId}`;
  const [email, setEmail] = useState("");
  const [book, setBook] = useState<BookId>("all");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<Lead | null>(null);
  const [sending, setSending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = schema.safeParse({ email, book });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the email.");
      return;
    }
    setSending(true);
    try {
      await submitAccessRequest({ data: parsed.data });
      setError("");
      setSaved({ ...parsed.data, at: new Date().toISOString() });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not submit your request. Please try again.");
    } finally {
      setSending(false);
    }
  }

  if (saved) {
    const label = BOOKS.find((item) => item.id === saved.book)?.label ?? "the book";
    return (
      <div className="border border-line bg-surface px-5 py-6" role="status">
        <p className="font-display text-3xl text-fg italic">You’re on the list.</p>
        <p className="mt-2 text-muted">
          {saved.email} · {label}. Your request has been saved securely. The VMVIRA team will review it.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor={fieldId} className="text-sm text-muted">
          Work email
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id={fieldId}
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (error) setError("");
            }}
            placeholder="you@desk.in"
            className="min-h-12 w-full border border-line bg-bg px-4 text-fg placeholder:text-faint"
          />
          <button
            type="submit"
            disabled={sending}
            className="min-h-12 shrink-0 bg-primary px-5 font-medium text-primary-fg transition-transform duration-150 ease-out active:scale-[0.96]"
          >
            {sending ? "Submitting…" : "Request access"}
          </button>
        </div>
        {error ? (
          <p className="text-sm text-fg" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <fieldset>
        <legend className="mb-2 text-sm text-muted">Book you want automated</legend>
        <div className="flex flex-wrap gap-2">
          {BOOKS.map((item) => {
            const pressed = book === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={pressed}
                onClick={() => setBook(item.id)}
                className={
                  pressed
                    ? "min-h-11 border border-primary bg-primary px-4 text-sm text-primary-fg"
                    : "min-h-11 border border-line px-4 text-sm text-fg"
                }
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </fieldset>
    </form>
  );
}
