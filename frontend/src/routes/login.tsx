import { createFileRoute, Link } from "@tanstack/react-router";
import { SignInButtons } from "@/lib/auth/gates";
import { authEnabled } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const { user, isPending } = useCurrentUserState();

  return (
    <main className="grid min-h-screen place-items-center bg-bg px-4 py-12 text-fg">
      <section className="w-full max-w-lg border border-line bg-surface p-6 sm:p-8">
        <p className="text-xs uppercase tracking-[.25em] text-primary">VMVIRA CONTROL ROOM</p>
        <h1 className="mt-3 font-display text-4xl">Administrator sign-in</h1>
        <p className="mt-3 text-sm text-muted">
          Sign in with Google using an email on the server-side admin allowlist.
        </p>

        {!authEnabled ? (
          <p role="alert" className="mt-6 border border-line p-4 text-sm">
            Sign-in is disabled. Enable VITE_AUTH_ENABLED and configure the server authentication
            credentials before accessing the admin console.
          </p>
        ) : isPending ? (
          <p className="mt-6 text-sm text-muted">Checking your session…</p>
        ) : user ? (
          <div className="mt-6 space-y-4">
            <p className="text-sm">Signed in as {user.primaryEmail ?? user.displayName ?? "your account"}.</p>
            <Link to="/admin" className="inline-flex min-h-11 items-center bg-primary px-4 text-sm font-medium text-primary-fg">
              Continue to admin
            </Link>
          </div>
        ) : (
          <div className="mt-6">
            <SignInButtons callbackURL="/admin" />
          </div>
        )}

        <Link to="/" className="mt-8 inline-block text-sm text-muted underline underline-offset-4">
          Back to website
        </Link>
      </section>
    </main>
  );
}
