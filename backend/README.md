# VMVIRA backend boundary

The current production backend is implemented inside the TanStack Start server runtime in `../frontend/src/lib` and `../frontend/migrations`.

Admin capabilities added in this release:
- `admin_access_requests`: durable website access requests and approve/reject decisions.
- `admin_messages`: contact-form inbox, read/unread/archive states and private admin notes.
- `site_settings`: database-backed editable key/value settings.
- `admin_audit_log`: records admin actions.
- `src/lib/admin.functions.ts`: server-only data operations and server-side admin email allowlist checks.
- `../frontend/src/routes/api/auth/$.ts`: Better Auth GET/POST catch-all at `/api/auth/*`; `/login` uses it and returns signed-in admins to `/admin`.

This directory remains a boundary/documentation folder; no separate API server is claimed. A standalone service can be extracted later without changing the current database tables.
