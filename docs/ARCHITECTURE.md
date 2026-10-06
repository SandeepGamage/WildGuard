# Architecture

## System context

```
Villager (app / SMS)            Liaison officer (app)
        │                               │
        ▼                               ▼
   Expo mobile app  ──── REST + Bearer JWT ────▶  Express API  ────▶  Supabase (Postgres/PostGIS, Auth, Storage)
        │                                              │
        └── Supabase Auth (sign-in, token refresh) ────┘   service-role key lives only here
```

The mobile app talks to Supabase **only** for authentication and for uploading a photo to a one-time signed URL. Everything else goes through the Express API, which validates the JWT, loads the caller's profile and role, authorises the action and then uses the service-role client through repositories.

## Backend (MVC with service and repository layers)

```
routes/        endpoint + middleware chain only
middleware/    auth (JWT -> req.user), requireRole, validate (zod), rate limiters, error handler, request id
controllers/   thin: take validated input, call a service, send { success, data, message }
services/      use cases and business rules
repositories/  the only code that talks to Supabase (tables, RPC, storage, auth admin)
models/        row -> domain mappers and presenters (what each role is allowed to see)
validators/    reusable zod schemas
constants/     enums (roles, types, statuses...), SMS keyword dictionary and message templates
container.js   wires services to repositories (no Supabase imports)
config/        env parsing, Supabase client factory
```

Dependency direction: `routes -> controllers -> services -> repositories -> Supabase`. `container.js` receives repositories as arguments, so tests (and any future persistence layer) can substitute them without touching controllers or services.

### Services

| Service | Responsibility |
|---|---|
| `IncidentService` | Shared path for APP and SMS reports: idempotency check, location resolution, occurred-at derivation, duplicate detection, urgency, save, urgent notification |
| `OfficerService` | Queue (urgent first, duplicates grouped), incident detail, start review, verify/reject, map, history, scope checks |
| `NotificationService` | Notification records + `pushAdapter.send` (simulated adapter by default) |
| `LocationResolver` | Village by name/alias (EN/SI/TA, one-typo tolerance) or by GPS (PostGIS nearest) |
| `DuplicateDetector` | Calls the `find_duplicate_incident` SQL function (same type, 1 km, 2 h) |
| `SmsService` + `MessageParser` + `SmsResponseService` + `PendingSubmissionQueue` | SMS flow: parse, resolve place, save (or queue on database failure), reply |
| `PhotoService` | Signed upload tickets with server-chosen paths; signed read URLs |
| `AuthService` | Token verification, role/profile load, villager registration |

### UC3 flows

**Submit (app).** `POST /incidents` with `clientRequestId` -> `IncidentService.createFromApp` -> idempotency lookup -> village from list, or GPS -> nearest village (outside coverage: registered village + call-back flag) -> `capturedAt` clamped, "earlier today" = 3 h before -> PostGIS duplicate check -> insert (`DUPLICATE` linked to the original, otherwise `PENDING`) -> urgent report notifies the divisional officers.

**Submit (SMS).** `POST /sms/simulate` -> parse keyword + place -> resolve place (unknown place: sender's registered village + call-back flag; no fallback: help reply) -> same `IncidentService.submit` -> reply with tracking code in the sender's language. Invalid text: no incident, three-language format help. Database failure: acknowledged, queued, retried.

**Verify / reject.** `POST /officer/incidents/:id/verify|reject` -> `review_incident` SQL function: resolves the root report, locks it `FOR UPDATE`, checks division scope, refuses with `ALREADY_REVIEWED` (409, includes who decided) if it is no longer undecided, inserts the `verification_records` row, updates the report and its duplicates, returns the affected ids. The service then notifies reporters (in-app, or simulated SMS) and, when field action is required, the sector's field team. Notification failures are logged and never undo the saved decision.

### UC4 – Conservation Data Analytics & Hotspot Mapping

Classes follow the revised design class diagram (Fig 11):

| Design class | Code |
|---|---|
| `AnalyticsController` | `services/analytics.service.js` (`AnalyticsService`): `validateFilters`, `generateConservationReport`, `exportReport` (fetches the report by id). The Express `analytics.controller.js` stays thin |
| `AnalyticsReportService` | `services/analyticsReport.service.js`: `buildReport` -> `aggregateIncidents`, `computeConflictTrends`, `computePatrolCoverage`, top hotspots, save |
| `GISMappingService` / `HotspotCalculator` | `services/gisMapping.service.js`: Gaussian kernel density (default bandwidth 500 m) |
| `ExportEngine` + `ReportExporter` (Strategy) | `services/export/exportEngine.js`, `pdf.exporter.js` (pdfkit), `csv.exporter.js` |
| `AnalyticsRepository` | `repositories/mongo/analytics.mongo.repository.js` (`queryAnalyticsData`, `saveReport`, `findReport`) |
| `ConservationReport` | `models/conservationReport.model.js` + the `ConservationReport` collection |

UC1/UC2 data enter through `repositories/sources/pendingDataSources.js` (`PendingPatrolDataSource`, `PendingAlertDataSource`), which return empty lists until those use cases are merged. Swapping them for real sources is the only change UC4 needs: coverage gaps and the patrol KPI then light up. Park outlines live in `constants/parks.js` until a Park collection exists.

Web dashboard (`web/`, Vite + React): the Park Manager is a desk role, so UC4's user interface is a separate web app rather than part of the phone app.

| Area | Code |
|---|---|
| Pages | `pages/LoginPage.jsx`, `pages/AnalyticsPage.jsx` (filters -> report, empty/error states, export), `pages/SavedReportsPage.jsx` |
| Session | `auth/AuthContext.jsx` (`/auth/login`, `/auth/me`; only `PARK_MANAGER` is let in), `auth/RequireManager.jsx` (route guard) |
| API | `api/client.js` (`{ success, data }` envelope, `ApiError`, file download), `api/analytics.api.js` |
| Components | `FilterBar` (native date pickers, segmented report type, type chips), `KpiTiles`, `HotspotMap` (Leaflet + OpenStreetMap; one rectangle per kernel-density cell in its viridis level colour), `ConflictTrendChart` (Recharts), `TopHotspotsTable`, `ExportDialog` (native `<dialog>`), `ReportNotice` |
| i18n | `i18n/en.json`, `si.json`, `ta.json`; `npm run check:i18n` |

The dashboard pages are lazy-loaded so the sign-in page does not download the map and chart libraries.

### Status mapping

Internal statuses (`PENDING`, `DUPLICATE`, `UNDER_REVIEW`, `VERIFIED`, `REJECTED`) are never sent to villagers. They see `progress`: `RECEIVED` -> `BEING_CHECKED` (an officer opened the report) -> `OUTCOME` (verified, or politely "not confirmed"). Officer notes and identity are never included.

## Database

- Tables: `sectors`, `gn_divisions`, `villages`, `profiles`, `officer_gn_divisions`, `collar_devices`, `community_incidents`, `verification_records`, `notifications`, `sms_logs`.
- `community_incidents`: generated PostGIS `location`, GiST + btree indexes, `tracking_code` from a sequence (`C-0142` style), unique `(reporter_id, client_request_id)` for idempotency, a trigger that derives `gn_division_id`/`sector_id` from the village so clients can never choose their scope.
- Functions: `find_duplicate_incident`, `nearest_village`, `nearby_collars`, `start_incident_review`, `review_incident` (all executable by the service role only).
- Storage: private `incident-photos` bucket (5 MB, JPEG/PNG/WebP).

## Mobile

```
app/(auth)      welcome, language, sign-in, create-account
app/(villager)  Tabs: home | report (stack: categories, details) | my-reports (stack: list, confirmation, [id]) | safety
app/(liaison)   Tabs: queue (stack: list, [id], [id]/verify, [id]/reject) | map | history | profile
app/(demo)      sms-simulator (only when EXPO_PUBLIC_DEMO_MODE=true; not a tab)
src/            components (common, forms, maps, navigation, reports), hooks, api, services, contexts, validators, i18n, theme, constants, utils
```

- **Auth:** `AuthContext` owns the Supabase session; the role comes from `GET /auth/me`. `RoleGuard` redirects other roles; an unknown role is signed out.
- **Data:** TanStack Query hooks wrap the `src/api/*` modules; screens contain no data-access code. The queue and map refetch every 30 s.
- **Offline reliability:** `reportSync.core.js` saves each report to SQLite *before* any network call, then tries to send. Retry on network error, 5xx, 429 or 401; a validation rejection is marked failed and shown to the reporter. Retries run on app start, when connectivity returns (NetInfo), when the app foregrounds, and every minute. The same `clientRequestId` is reused, so retries cannot create duplicate incidents. The original capture time is preserved. A photo problem never blocks the text report.
- **Location:** `expo-location` -> nearest village client-side for the label; the server re-resolves. Permission denied / unavailable / outside coverage falls back to the village list. No coordinates are typed by hand.
- **Localisation:** every string is an i18n key (`en.json`, `si.json`, `ta.json`); `npm run check:i18n` verifies key parity and that keys used in code exist.
- **Theme:** colours, spacing, radius and typography come from `src/theme`; no raw hex values in components.

## Testing strategy

- Backend: Jest + Supertest through the real Express stack with in-memory repositories (auth, authorisation, scope, idempotency, duplicates, urgent flow, SMS, verification, concurrency, privacy, config).
- Web (`web/tests`, Vitest + Testing Library): utilities and API client, sign-in and session rules, every dashboard component (Leaflet and Recharts replaced by light stand-ins), and the full page flows against a mocked `fetch` (generate, no data, invalid filters, data source unavailable, export and export failure, saved reports).
- UC4: pure unit tests for kernel density, aggregation, trends, coverage and CSV escaping (`analytics.units.test.js`), plus HTTP tests for the role guard, filter rules, empty and failure states, privacy and exports (`analytics.test.js`).
- Mobile: Jest + React Native Testing Library for screens and components, plus direct tests of the queue logic, hooks, API client and auth context.
- Not covered by automated tests: the SQL functions and RLS policies (need a live Supabase), device-only behaviour (GPS, camera, maps).
