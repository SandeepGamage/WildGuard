-- Migration 3: Row Level Security
-- The Express backend uses the service role (which bypasses RLS) and enforces
-- authorisation in code. These policies are the second line of defence for any
-- request that reaches the database with a user JWT (e.g. supabase-js on a device).

-- Helper functions run as the definer so policies do not recurse through RLS.
create or replace function public.current_user_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and is_active;
$$;

create or replace function public.is_officer_for_division(p_gn_division_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.officer_gn_divisions og
    join public.profiles p on p.id = og.officer_id
    where og.officer_id = auth.uid()
      and og.gn_division_id = p_gn_division_id
      and p.is_active
      and p.role = 'COMMUNITY_LIAISON_OFFICER'
  );
$$;

alter table public.sectors enable row level security;
alter table public.gn_divisions enable row level security;
alter table public.villages enable row level security;
alter table public.profiles enable row level security;
alter table public.officer_gn_divisions enable row level security;
alter table public.collar_devices enable row level security;
alter table public.community_incidents enable row level security;
alter table public.verification_records enable row level security;
alter table public.notifications enable row level security;
alter table public.sms_logs enable row level security;

-- Reference data: readable by any signed-in user, writable only by the backend.
create policy sectors_read on public.sectors for select to authenticated using (true);
create policy gn_divisions_read on public.gn_divisions for select to authenticated using (true);
create policy villages_read on public.villages for select to authenticated using (is_active);

-- Profiles: a user reads only their own profile. Role changes are backend-only.
create policy profiles_read_own on public.profiles
  for select to authenticated using (id = auth.uid());

create policy officer_divisions_read_own on public.officer_gn_divisions
  for select to authenticated using (officer_id = auth.uid());

-- Collar data: liaison officers only.
create policy collar_devices_officer_read on public.collar_devices
  for select to authenticated
  using (public.current_user_role() = 'COMMUNITY_LIAISON_OFFICER');

-- Incidents: villagers see their own reports; officers see reports inside their
-- assigned GN divisions. Inserts/updates/deletes happen only through the backend.
create policy incidents_read_own on public.community_incidents
  for select to authenticated using (reporter_id = auth.uid());

create policy incidents_read_officer_scope on public.community_incidents
  for select to authenticated
  using (public.is_officer_for_division(gn_division_id));

-- Verification evidence: officers in scope only. Villagers get outcome data
-- through the backend, which never returns internal notes.
create policy verification_read_officer_scope on public.verification_records
  for select to authenticated
  using (
    exists (
      select 1 from public.community_incidents i
      where i.id = verification_records.incident_id
        and public.is_officer_for_division(i.gn_division_id)
    )
  );

-- Notifications: the recipient reads and marks their own notifications as read.
create policy notifications_read_own on public.notifications
  for select to authenticated using (recipient_id = auth.uid());

create policy notifications_mark_read_own on public.notifications
  for update to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

-- sms_logs has no policies: deny-all for clients, service role only.
