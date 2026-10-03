-- Migration 2: PostGIS lookups and the atomic verification workflow

-- ---------------------------------------------------------------------------
-- Duplicate detection (UC3.1 step 4 / A4): same type, within radius and window.
-- Only undecided root reports can absorb duplicates.
-- ---------------------------------------------------------------------------
create or replace function public.find_duplicate_incident(
  p_incident_type incident_type,
  p_latitude double precision,
  p_longitude double precision,
  p_occurred_at timestamptz,
  p_radius_m integer default 1000,
  p_window_minutes integer default 120
)
returns uuid
language sql
stable
as $$
  select i.id
  from public.community_incidents i
  where i.incident_type = p_incident_type
    and i.duplicate_of_id is null
    and i.status in ('PENDING', 'UNDER_REVIEW')
    and i.occurred_at between p_occurred_at - make_interval(mins => p_window_minutes)
                          and p_occurred_at + make_interval(mins => p_window_minutes)
    and st_dwithin(
      i.location,
      st_setsrid(st_makepoint(p_longitude, p_latitude), 4326)::geography,
      p_radius_m
    )
  order by i.occurred_at asc
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Gazetteer fallback: nearest active village to a GPS fix.
-- ---------------------------------------------------------------------------
create or replace function public.nearest_village(
  p_latitude double precision,
  p_longitude double precision,
  p_max_distance_m integer default 20000
)
returns table (id uuid, distance_m double precision)
language sql
stable
as $$
  select v.id,
         st_distance(v.location, st_setsrid(st_makepoint(p_longitude, p_latitude), 4326)::geography)
  from public.villages v
  where v.is_active
    and st_dwithin(
      v.location,
      st_setsrid(st_makepoint(p_longitude, p_latitude), 4326)::geography,
      p_max_distance_m
    )
  order by v.location <-> st_setsrid(st_makepoint(p_longitude, p_latitude), 4326)::geography
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Simulated collar / camera cross-check data near a report.
-- ---------------------------------------------------------------------------
create or replace function public.nearby_collars(
  p_latitude double precision,
  p_longitude double precision,
  p_radius_m integer default 2000
)
returns table (id uuid, code text, name text, distance_m double precision, last_seen_at timestamptz)
language sql
stable
as $$
  select c.id,
         c.code,
         c.name,
         st_distance(c.location, st_setsrid(st_makepoint(p_longitude, p_latitude), 4326)::geography),
         c.last_seen_at
  from public.collar_devices c
  where c.is_active
    and st_dwithin(
      c.location,
      st_setsrid(st_makepoint(p_longitude, p_latitude), 4326)::geography,
      p_radius_m
    )
  order by c.location <-> st_setsrid(st_makepoint(p_longitude, p_latitude), 4326)::geography;
$$;

-- ---------------------------------------------------------------------------
-- Mark a report group as being checked by an officer (idempotent).
-- ---------------------------------------------------------------------------
create or replace function public.start_incident_review(p_incident_id uuid, p_officer_id uuid)
returns jsonb
language plpgsql
as $$
declare
  v_target uuid;
  v_root public.community_incidents%rowtype;
begin
  select coalesce(duplicate_of_id, id) into v_target
  from public.community_incidents where id = p_incident_id;

  if v_target is null then
    return jsonb_build_object('ok', false, 'code', 'INCIDENT_NOT_FOUND');
  end if;

  select * into v_root from public.community_incidents where id = v_target for update;

  if not exists (
    select 1 from public.officer_gn_divisions
    where officer_id = p_officer_id and gn_division_id = v_root.gn_division_id
  ) then
    return jsonb_build_object('ok', false, 'code', 'OUT_OF_SCOPE');
  end if;

  if v_root.status = 'PENDING' then
    update public.community_incidents set status = 'UNDER_REVIEW' where id = v_target;
  end if;

  if v_root.status in ('PENDING', 'UNDER_REVIEW') then
    update public.community_incidents
       set review_started_at = coalesce(review_started_at, now())
     where id = v_target or duplicate_of_id = v_target;
  end if;

  return jsonb_build_object('ok', true, 'incident_id', v_target);
end;
$$;

-- ---------------------------------------------------------------------------
-- Atomic verification / rejection.
-- The root incident row is locked (FOR UPDATE) so two officers cannot both
-- decide the same report: the loser receives ALREADY_REVIEWED and nothing is
-- overwritten. Everything below happens in one transaction.
-- ---------------------------------------------------------------------------
create or replace function public.review_incident(
  p_incident_id uuid,
  p_officer_id uuid,
  p_decision verification_decision,
  p_method verification_method,
  p_notes text,
  p_rejection_reason rejection_reason,
  p_field_action boolean
)
returns jsonb
language plpgsql
as $$
declare
  v_target uuid;
  v_root public.community_incidents%rowtype;
  v_prev record;
  v_field_action boolean;
  v_record_id uuid;
  v_ids uuid[];
  v_reporters uuid[];
begin
  select coalesce(duplicate_of_id, id) into v_target
  from public.community_incidents where id = p_incident_id;

  if v_target is null then
    return jsonb_build_object('ok', false, 'code', 'INCIDENT_NOT_FOUND');
  end if;

  select * into v_root from public.community_incidents where id = v_target for update;

  if not exists (
    select 1 from public.officer_gn_divisions
    where officer_id = p_officer_id and gn_division_id = v_root.gn_division_id
  ) then
    return jsonb_build_object('ok', false, 'code', 'OUT_OF_SCOPE');
  end if;

  if v_root.status not in ('PENDING', 'UNDER_REVIEW') then
    select vr.verified_at, p.full_name as officer_name
      into v_prev
      from public.verification_records vr
      join public.profiles p on p.id = vr.officer_id
     where vr.incident_id = v_target
     order by vr.verified_at desc
     limit 1;

    return jsonb_build_object(
      'ok', false,
      'code', 'ALREADY_REVIEWED',
      'status', v_root.status,
      'reviewed_by_name', v_prev.officer_name,
      'reviewed_at', v_prev.verified_at
    );
  end if;

  v_field_action := (p_decision = 'VERIFIED') and coalesce(p_field_action, false);

  insert into public.verification_records (
    incident_id, officer_id, decision, method, notes, rejection_reason, field_action_required
  ) values (
    v_target, p_officer_id, p_decision, p_method, p_notes, p_rejection_reason, v_field_action
  ) returning id into v_record_id;

  update public.community_incidents
     set status = p_decision::text::incident_status,
         field_action_required = v_field_action,
         call_back_required = false
   where id = v_target
      or (duplicate_of_id = v_target and status = 'DUPLICATE');

  select array_agg(id), array_remove(array_agg(distinct reporter_id), null)
    into v_ids, v_reporters
    from public.community_incidents
   where id = v_target or duplicate_of_id = v_target;

  return jsonb_build_object(
    'ok', true,
    'verification_record_id', v_record_id,
    'incident_id', v_target,
    'status', p_decision::text,
    'field_action_required', v_field_action,
    'sector_id', v_root.sector_id,
    'gn_division_id', v_root.gn_division_id,
    'tracking_code', v_root.tracking_code,
    'affected_incident_ids', to_jsonb(v_ids),
    'reporter_ids', to_jsonb(coalesce(v_reporters, '{}'::uuid[]))
  );
end;
$$;

-- Only the backend (service role) may call these functions through the API.
-- Without this, any signed-in user could invoke them via PostgREST RPC.
revoke all on function public.review_incident(uuid, uuid, verification_decision, verification_method, text, rejection_reason, boolean) from public, anon, authenticated;
revoke all on function public.start_incident_review(uuid, uuid) from public, anon, authenticated;
revoke all on function public.find_duplicate_incident(incident_type, double precision, double precision, timestamptz, integer, integer) from public, anon, authenticated;
revoke all on function public.nearest_village(double precision, double precision, integer) from public, anon, authenticated;
revoke all on function public.nearby_collars(double precision, double precision, integer) from public, anon, authenticated;

grant execute on function public.review_incident(uuid, uuid, verification_decision, verification_method, text, rejection_reason, boolean) to service_role;
grant execute on function public.start_incident_review(uuid, uuid) to service_role;
grant execute on function public.find_duplicate_incident(incident_type, double precision, double precision, timestamptz, integer, integer) to service_role;
grant execute on function public.nearest_village(double precision, double precision, integer) to service_role;
grant execute on function public.nearby_collars(double precision, double precision, integer) to service_role;
