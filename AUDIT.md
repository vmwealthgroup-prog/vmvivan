# VMVIRA source audit and admin extension

## Existing application
- Rebranded user-facing application source to VMVIRA.
- Organized source under `frontend/` and documented the current backend boundary under `backend/`.
- The application is TanStack Start full-stack; server functions, authentication and database access are implemented inside `frontend/src`, not in a separate API process.

## Admin extension added
- `/admin` control-room route with approvals, enquiry inbox, website settings and audit log.
- `/login` sign-in page and same-origin Better Auth GET/POST catch-all at `/api/auth/*`.
- Google/Gmail is the only configured OAuth sign-in provider.
- Better Auth schema migration is enabled at `frontend/migrations/0001_auth.sql`, matching its canonical source under `migrations/auth/`.
- Server-side admin authorization checks the signed-in user's email against the server-only `VMVIRA_ADMIN_EMAILS` allowlist. An unlisted or unsigned-in user is denied by the data functions.
- Public access requests now submit to the server and persist in `admin_access_requests` rather than browser local storage.
- Public contact form submissions persist in `admin_messages`.
- Admin can approve/reject access requests, update message status and internal notes, save site settings, and review audit events.
- The `announcement` setting is read by the public homepage and displayed as an announcement banner.
- Added migration `0002_admin_centre.sql` and `.env.example` deployment configuration.

## Important production requirements / limitations
- Configure real authentication, `VMVIRA_ADMIN_EMAILS`, and persistent Postgres `DATABASE_URL` before production. The PGLite fallback is in-memory and resets on process restart.
- The admin inbox stores website enquiries. It does not connect to an external Gmail/Outlook mailbox, receive inbound mail, or send outbound replies. An email provider and inbound webhook are not configured in this source.
- Only the `announcement` site setting is currently wired to the public homepage; other settings are stored and visible in the admin console but need a corresponding public component to take effect.
- No admin account or password is hardcoded or created. Admins must authenticate through the configured existing sign-in provider and be listed in the server allowlist.
- Validation completed: `npm run typecheck`, `npm test`, `npm run lint`, `npm run check:auth`, and `npm run build` from `frontend/`. The build applies pending migrations when `DATABASE_URL` is configured; production deployment still requires verifying the configured database and OAuth credentials.

## Customer-care chat addition

- Added a floating public customer-care chat widget and server-side OpenAI-compatible chat proxy.
- Supports Ollama and compatible hosted endpoints (Groq, OpenRouter, Gemini) through environment configuration.
- Provider keys are read only by server code; they are not embedded in the frontend.
- Chat transcripts are persisted in `customer_chat_messages` and exposed only through the allowlisted `/admin` overview.
- Added migration `0003_customer_care_chat.sql`.
- Runtime provider availability, deployment secrets, database migration, and live browser behavior must be verified in the target environment before production use.
