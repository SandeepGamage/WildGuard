# Row Level Security policy matrix

The policies are created by `supabase/migrations/20260101000003_rls.sql` (tables) and `20260101000004_storage.sql` (storage). RLS is enabled on every table. The Express backend uses the service role (which bypasses RLS) and enforces the same rules in code; these policies protect any request that reaches the database with a user JWT.

Helper functions (`security definer`, fixed `search_path`): `current_user_role()` and `is_officer_for_division(gn_division_id)`.

| Table / object | Villager | Liaison officer | Field ranger | Anonymous |
|---|---|---|---|---|
| `profiles` | read own row | read own row | read own row | - |
| `officer_gn_divisions` | - | read own assignments | - | - |
| `sectors`, `gn_divisions`, `villages` | read | read | read | - |
| `collar_devices` | - | read | - | - |
| `community_incidents` | read own (`reporter_id = auth.uid()`) | read rows whose `gn_division_id` they are assigned to | - | - |
| `verification_records` | - (outcome is exposed by the API without notes) | read for incidents in scope | - | - |
| `notifications` | read / mark read own | read / mark read own | read / mark read own | - |
| `sms_logs` | - | - | - | - (service role only) |
| `storage: incident-photos` | read own folder `<uid>/...` | - (signed URLs from the backend) | - | - |

There are no insert/update/delete policies on incident, verification or notification-creation paths: those writes happen only through the backend (service role) and the `review_incident` / `start_incident_review` functions, which are executable by `service_role` only. Likewise `find_duplicate_incident`, `nearest_village` and `nearby_collars`.

To test a policy manually in the SQL editor:
```sql
set local role authenticated;
set local request.jwt.claims = '{"sub":"<villager uuid>","role":"authenticated"}';
select tracking_code from community_incidents;   -- only that villager's own reports
```
