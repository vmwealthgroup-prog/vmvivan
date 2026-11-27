# VMVIRA

VMVIRA is a TanStack Start full-stack application. The frontend and server runtime are in `frontend/`; database migrations are in `frontend/migrations/`.

## Run locally

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:8080`.

## Admin console

Open `/admin`. If you are not signed in, use its **Sign in** link (or open `/login`) and continue with Google/Gmail; successful sign-in returns to the console. Admin access is enforced on the server; hiding the route is not used as security.

1. Configure direct Google OAuth (`VITE_AUTH_ENABLED=true`, `GOOGLE_CLIENT_ID`, and `GOOGLE_CLIENT_SECRET`) in the server environment. Register `https://your-domain/api/auth/callback/google` as an authorized redirect URI in Google Cloud. For local development, also register `http://localhost:8080/api/auth/callback/google` and `http://127.0.0.1:8080/api/auth/callback/google`.
2. Set `VMVIRA_ADMIN_EMAILS` on the server to a comma-separated allowlist of exact sign-in email addresses.
3. Configure a persistent Postgres database with `DATABASE_URL` before production. The no-URL PGLite fallback is in-memory and resets when the process restarts; it is for local preview only.
4. Deploy and sign in using an allowlisted account.

Never put `VMVIRA_ADMIN_EMAILS`, database credentials, OAuth secrets, or mail-provider secrets in `VITE_*` variables or client code.
See [`frontend/.env.example`](./frontend/.env.example) for the required variable names and placeholder values.
The Google OAuth consent screen app name is configured in Google Cloud; set it to **VMVIRA**. Direct Google sign-in requires a stable, registered callback URL; dynamic live-preview hostnames are not supported by a standard Google OAuth client.

Authentication requests are handled by the same-origin `/api/auth/*` endpoints through the [TanStack Start auth route](./frontend/src/routes/api/auth/$.ts). Deploy the server runtime with the frontend; a static-only frontend cannot serve these endpoints.

## Admin features

- Access request queue: approve or reject access requests submitted on the public site.
- Email & messages: contact form submissions stored in the database, with status and internal note controls.
- Website controls: database-backed key/value settings. The current homepage does not yet consume every setting automatically; the console states this limitation.
- Audit log: records administrative actions.

The contact form stores enquiries. It does not connect to Gmail/Outlook, receive external mailbox messages, or send outbound replies. Configure a transactional email provider and inbound mail webhook separately before advertising those capabilities.

## Verification

From `frontend/`, run `npm run typecheck`, `npm test`, `npm run lint`, `npm run check:auth`, and `npm run build`. Production deployments need `DATABASE_URL` so the build can apply pending migrations; without it, the local PGLite fallback is used and database data is not persistent.

## AI customer-care chat

The public website includes a floating **Chat with us** widget. The browser calls a server function; provider API keys and model endpoints remain server-side. Conversations are saved in `customer_chat_messages` and visible to allowlisted administrators at `/admin` → **AI chat transcripts**.

Configure these variables in the server environment (not in `VITE_*` variables):

- `CUSTOMER_AI_PROVIDER`: `ollama`, `groq`, `openrouter`, or `gemini` (informational provider label).
- `CUSTOMER_AI_BASE_URL`: OpenAI-compatible API base URL.
- `CUSTOMER_AI_API_KEY`: provider key; for local Ollama, `ollama` is a placeholder.
- `CUSTOMER_AI_MODEL`: model name available from that provider.

Examples:

```env
# Local development with Ollama
CUSTOMER_AI_PROVIDER=ollama
CUSTOMER_AI_BASE_URL=http://127.0.0.1:11434/v1
CUSTOMER_AI_API_KEY=ollama
CUSTOMER_AI_MODEL=qwen2.5:7b

# Hosted Groq example
# CUSTOMER_AI_PROVIDER=groq
# CUSTOMER_AI_BASE_URL=https://api.groq.com/openai/v1
# CUSTOMER_AI_API_KEY=your-server-side-groq-key
# CUSTOMER_AI_MODEL=your-enabled-groq-model
```

For hosted deployments, `127.0.0.1` refers to the deployed app container, not your personal PC. Use Ollama only when Ollama is running on the same server or is reachable over a private network. Apply database migrations with `npm run db:migrate` after setting `DATABASE_URL`. The assistant is configured for website support only; it must not give personalized investment advice, stock tips, or trading guarantees.
