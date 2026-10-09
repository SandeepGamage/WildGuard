# API reference (`/api/v1`)

All responses use one envelope.

```json
{ "success": true, "data": {}, "message": "OK" }
```
```json
{ "success": false, "error": { "code": "INCIDENT_ALREADY_REVIEWED", "message": "This report has already been reviewed.", "details": {} } }
```

Protected endpoints need `Authorization: Bearer <Supabase access token>`. The backend determines identity and role itself; any `role`, `reporterId`, `officerId`, `status`, `trackingCode` or `verifiedAt` in a request body is ignored.

Common errors: `400 VALIDATION_FAILED` (with `details.issues[]`), `401 UNAUTHENTICATED`, `403 FORBIDDEN_ROLE` / `OUT_OF_SCOPE` / `PROFILE_NOT_FOUND` / `ACCOUNT_DISABLED`, `404`, `409`, `413 PAYLOAD_TOO_LARGE`, `429 RATE_LIMITED`, `500 INTERNAL_ERROR` (generic, with `requestId`; no stack traces).

## Public

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | Liveness |
| GET | `/villages` | Active villages `{ id, nameEn, nameSi, nameTa, latitude, longitude }` |
| POST | `/auth/register` | Strict rate limit. Body `{ fullName, phone, villageId, password (8-72), language, consent: true }`. Always creates a `VILLAGER`. `409 PHONE_ALREADY_REGISTERED` |
| POST | `/sms/simulate` | Only when `SMS_SIMULATOR_ENABLED` (default on outside production). Body `{ phone, message }` |

### POST /sms/simulate

```json
{ "phone": "0771234567", "message": "ALIYA PALATUPANA" }
```
```json
{ "success": true, "data": { "accepted": true, "reply": "Report C-0153 received. An officer will check it. Stay away from the elephant.", "trackingCode": "C-0153", "queued": false, "callBackRequired": false, "duplicate": false, "incidentId": "..." }, "message": "Report accepted." }
```
Invalid text returns `accepted: false` and a reply with the format and an example in English, Sinhala and Tamil; no incident is created. Unknown place from a registered sender: accepted with the registered village and `callBackRequired: true`. Database failure: `accepted: true, queued: true, trackingCode: null`.

## Any signed-in user

| Method | Path | Notes |
|---|---|---|
| GET | `/auth/me` | `{ id, fullName, phone, role, language, registeredVillageId, divisions[], divisionIds[] }` |
| GET | `/notifications?limit&offset` | Own notifications (and sector broadcasts for rangers) |
| PATCH | `/notifications/:id/read` | Only the recipient can mark a notification read |

## Villager (`VILLAGER`)

| Method | Path | Notes |
|---|---|---|
| POST | `/incidents` | Create a report (see below). `201` when created, `200` when the same `clientRequestId` was already received |
| POST | `/incidents/photo-upload` | Body `{ contentType: image/jpeg\|png\|webp, sizeBytes <= 5242880 }` -> `{ bucket, path, token, maxBytes }`. Upload with `supabase.storage.from(bucket).uploadToSignedUrl(path, token, file)`, then send `photoPath` with the report |
| GET | `/incidents/mine?limit&offset` | Own reports only |
| GET | `/incidents/:id` | Own report only (`404` otherwise); includes a signed `photoUrl` |

### POST /incidents

```json
{
  "clientRequestId": "uuid generated on the phone",
  "incidentType": "ELEPHANT_NEAR_VILLAGE | CROP_DAMAGE | PROPERTY_DAMAGE | PERSON_INJURED | SNARE_POACHING | OTHER_ANIMAL",
  "villageId": "uuid",
  "latitude": 6.2995, "longitude": 81.3705,
  "elephantCountBand": "1 | 2_5 | 6_PLUS",
  "occurredWhen": "NOW | EARLIER_TODAY",
  "capturedAt": "ISO time the reporter tapped Send",
  "photoPath": "<userId>/<uuid>.jpg"
}
```
Either `villageId` or both coordinates are required. `PERSON_INJURED` is stored as `URGENT` and notifies the divisional officers. Response (villager view): `{ id, trackingCode, incidentType, urgency, village, occurredAt, createdAt, source, elephantCountBand, progress: RECEIVED|BEING_CHECKED|OUTCOME, outcome, photoUrl }`.

## Community Liaison Officer (`COMMUNITY_LIAISON_OFFICER`)

All results are limited to the officer's assigned GN divisions; other reports return `403 OUT_OF_SCOPE`.

| Method | Path | Notes |
|---|---|---|
| GET | `/officer/queue` | `{ items[], counts: { pending, urgent, verified } }`; urgent first, duplicates folded into the original (`groupedCount`), `callBackRequired` |
| GET | `/officer/incidents/:id` | Detail: map position, reporter (name, masked and full phone), related reports, `nearbyCollars`, signed `photoUrl`, latest verification. A duplicate id resolves to its original |
| POST | `/officer/incidents/:id/review` | Marks the group "being checked" (villagers see the progress) |
| POST | `/officer/incidents/:id/verify` | Body `{ method: CALL_REPORTER\|SITE_VISIT\|PHOTO_REVIEW\|SENSOR_DATA, notes?, fieldActionRequired }` -> `{ incidentId, status, fieldActionRequired, markerState, reportsUpdated, fieldTeamNotified }` |
| POST | `/officer/incidents/:id/reject` | Body `{ reason: DUPLICATE_OR_RESOLVED\|INSUFFICIENT_EVIDENCE\|INCORRECT_LOCATION\|OTHER, notes? }` - **reason is required** |
| GET | `/officer/map` | Active markers `{ markerState: UNVERIFIED\|ACTION_NEEDED\|VERIFIED, groupedCount, latitude, longitude, ... }` (rejected excluded; no reporter details) |
| GET | `/officer/history?decision&limit&offset` | The officer's own decisions (audit trail) |

`409 INCIDENT_ALREADY_REVIEWED` carries `details: { status, reviewedByName, reviewedAt }`; nothing is overwritten.

## Park Manager (`PARK_MANAGER`) – UC4 analytics

Only verified, non-duplicate community reports are counted. Collar alerts (UC2) raised in the period are counted and added to the heatmap; alerts closed as false alarms or stored without a position are left out. Patrol tracks and patrol incidents (UC1) are read through the patrol data source. Reporter ids and phone numbers never appear in a report or an export.

| Method | Path | Notes |
|---|---|---|
| GET | `/analytics/parks` | `[{ id, name, block, boundary[], sectors[] }]` for the filter bar |
| POST | `/analytics/reports` | Body `{ dateFrom: YYYY-MM-DD, dateTo: YYYY-MM-DD, parkId, reportType?: INCIDENT_SUMMARY\|HOTSPOT_MAP\|PATROL_COVERAGE\|HUMAN_WILDLIFE_CONFLICT, incidentTypes?: [...], bandwidthMetres?: 100-5000 }`. `201` -> report `{ id, park, generatedAt, filter, stats, trends, coverage, heatmap, topHotspots, landmarks }`; `200` -> `{ empty: true, filter }` when nothing matches (A2) |
| GET | `/analytics/reports?limit` | The manager's saved reports, newest first |
| GET | `/analytics/reports/:id` | A saved report (`404 REPORT_NOT_FOUND`) |
| GET | `/analytics/reports/:id/export?format=PDF\|CSV&sections=KPI_SUMMARY,HOTSPOT_MAP,COVERAGE_GAPS,CONFLICT_TRENDS,INCIDENT_LIST` | File download (`Content-Disposition: attachment`). The report is fetched by id on the server; `sections` defaults to all but the incident list |

Filter rules (E1) return `400 VALIDATION_FAILED` with field-level issues, e.g. `{ field: "body.dateTo", message: "\"To\" date is before \"From\" date." }`: dates in order, range of at most 3 years, a known park. `503 DATA_SOURCE_UNAVAILABLE` when the database cannot be read (E2). `500 EXPORT_FAILED` when a file cannot be produced (E3).

`heatmap`: Gaussian kernel density on a 250 m grid over the park outline, in incidents per km². Each returned cell has a `level` 0-4 matching `classBreaks` (5, 20, 40, 60 and 80 % of the peak), which both the dashboard and the PDF draw with the same viridis ramp.
