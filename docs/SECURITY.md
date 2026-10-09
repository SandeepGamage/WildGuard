# Security

## Authentication

- Passwords live only in **Supabase Auth**; there is no password table and no hard-coded account.
- The app signs in with Supabase and sends the access token as `Authorization: Bearer <token>`. `authMiddleware` validates it with Supabase (`auth.getUser`) on every protected request, then loads the caller's `profiles` row. A valid Supabase user without a profile, or an inactive profile, is refused.
- Mobile numbers map to a pseudo-email (`<number>@<PHONE_LOGIN_EMAIL_DOMAIN>`) so no SMS/email provider is needed. Registration goes through the backend, which creates the auth user as confirmed and the profile as `VILLAGER`.

## Authorisation (defence in depth)

| Layer | Control |
|---|---|
| Mobile navigation | `RoleGuard` redirects other roles (UX only) |
| Backend | `requireRole(...)` on every route group; the role comes from the database, never from the request |
| Backend | Ownership: villagers only read their own incidents (`404` otherwise, no existence leak) |
| Backend + SQL | GN-division scope: officers only see/decide reports in `officer_gn_divisions`; checked in services **and** inside `review_incident` / `start_incident_review` |
| Database | Row Level Security on every table (`supabase/migrations/..._rls.sql`, `supabase/policies/README.md`) |
| Database | Workflow and lookup functions are executable by `service_role` only |

The Express API uses the service-role client, which bypasses RLS. RLS is the second line of defence for any request that reaches the database with a user JWT.

## Secrets

- `SUPABASE_SERVICE_ROLE_KEY` and any database credentials exist only in `backend/.env`. The mobile bundle receives only `EXPO_PUBLIC_*` values (URL and anon key).
- `.gitignore` ignores `.env` and `.env.*` except `.env.example` (verified with `git check-ignore`).
- Tokens, passwords and request bodies are never logged; the logger receives identifiers and codes only.

## HTTP hardening

`helmet`, `x-powered-by` removed, CORS allow-list from `CORS_ORIGINS` (native apps send no Origin), 100 kB JSON limit, a general rate limit and a stricter one for registration and the SMS gateway, centralised error handler with generic `500` responses (stack traces and database messages never reach clients), `X-Request-Id` for support.

## Input validation

Zod validates params, query and body on the backend (authoritative) and the same rules are applied client-side. Unknown body fields are stripped. Server-derived, never client-trusted: reporter, officer, role, status, tracking code, verified-at, GN division, sector, occurred-at window.

## Race conditions and replays

- **Verification:** `review_incident` locks the root report row (`FOR UPDATE`) in one transaction. The second officer gets `409 INCIDENT_ALREADY_REVIEWED` with the first officer's name and the current status; nothing is overwritten.
- **Submission:** a unique `(reporter_id, client_request_id)` constraint makes retries idempotent; the service and repository both handle the replay.

## Privacy

- The map and queue APIs return no reporter details. Officer detail includes the reporter's name, a masked phone for display and the full number only for the tap-to-call action, and only to officers in scope.
- Villagers never receive internal status, officer identity or notes; a rejection is shown as a polite "not confirmed".
- Photos are stored in a **private** bucket under `<reporter id>/<random>.<ext>`. Uploads use one-time signed upload URLs issued by the backend (type and size validated; bucket also enforces 5 MB and JPEG/PNG/WebP). Reads use one-hour signed URLs for the owner or an in-scope officer. A report may only reference a photo in the reporter's own folder.

## Honest communication

Before verification the app says the report was received and will be checked; it never states that police, rangers or an emergency team were dispatched or notified. Only verified reports with "field action needed" trigger the (simulated) field-team notification.

## Known gaps

- RLS policies and SQL functions are syntax-checked but were not executed against a live database in this environment.
- Forgot-password is not implemented (no email/SMS provider).
- The SMS simulator endpoint is unauthenticated by design (it stands in for a telecom gateway). It is rate-limited and disabled by default in production; a real gateway webhook must verify the provider's signature.
- The in-memory SMS retry queue is lost on process restart.
