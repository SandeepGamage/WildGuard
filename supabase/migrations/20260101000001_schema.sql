-- WildGuard LK - UC3 Community Conflict & Sightings Reporting
-- Migration 1: extensions, enums, tables, indexes, triggers

create extension if not exists postgis;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enumerations
-- ---------------------------------------------------------------------------
create type user_role as enum ('VILLAGER', 'COMMUNITY_LIAISON_OFFICER', 'FIELD_RANGER');
create type app_language as enum ('en', 'si', 'ta');
create type incident_type as enum (
  'ELEPHANT_NEAR_VILLAGE',
  'CROP_DAMAGE',
  'PROPERTY_DAMAGE',
  'PERSON_INJURED',
  'SNARE_POACHING',
  'OTHER_ANIMAL'
);
create type incident_source as enum ('APP', 'SMS');
create type incident_status as enum ('PENDING', 'DUPLICATE', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED');
create type incident_urgency as enum ('NORMAL', 'URGENT');
create type verification_decision as enum ('VERIFIED', 'REJECTED');
create type verification_method as enum ('CALL_REPORTER', 'SITE_VISIT', 'PHOTO_REVIEW', 'SENSOR_DATA');
create type rejection_reason as enum (
  'DUPLICATE_OR_RESOLVED',
  'INSUFFICIENT_EVIDENCE',
  'INCORRECT_LOCATION',
  'OTHER'
);
create type notification_type as enum ('URGENT_INCIDENT', 'INCIDENT_OUTCOME', 'FIELD_ACTION');
create type sms_direction as enum ('INBOUND', 'OUTBOUND');
create type sms_log_status as enum ('ACCEPTED', 'REJECTED_FORMAT', 'FAILED');

-- ---------------------------------------------------------------------------
-- Generic helpers
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Geographic reference data
-- ---------------------------------------------------------------------------
create table public.sectors (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  park text not null
);

create table public.gn_divisions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table public.villages (
  id uuid primary key default gen_random_uuid(),
  name_en text not null,
  name_si text,
  name_ta text,
  aliases text[] not null default '{}',
  gn_division_id uuid not null references public.gn_divisions (id),
  sector_id uuid not null references public.sectors (id),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  location geography (point, 4326) generated always as (
    st_setsrid(st_makepoint(longitude, latitude), 4326)::geography
  ) stored,
  is_active boolean not null default true
);

create index villages_gn_division_idx on public.villages (gn_division_id);
create index villages_location_gix on public.villages using gist (location);

-- ---------------------------------------------------------------------------
-- Profiles (identity and credentials live in Supabase Auth)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 120),
  phone text unique,
  role user_role not null default 'VILLAGER',
  language app_language not null default 'en',
  registered_village_id uuid references public.villages (id),
  sector_id uuid references public.sectors (id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- A liaison officer is responsible for one or more GN divisions.
create table public.officer_gn_divisions (
  officer_id uuid not null references public.profiles (id) on delete cascade,
  gn_division_id uuid not null references public.gn_divisions (id) on delete cascade,
  primary key (officer_id, gn_division_id)
);

-- Simulated collar / camera data used for evidence cross-checks (UC2 data).
create table public.collar_devices (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  latitude double precision not null,
  longitude double precision not null,
  location geography (point, 4326) generated always as (
    st_setsrid(st_makepoint(longitude, latitude), 4326)::geography
  ) stored,
  last_seen_at timestamptz not null default now(),
  is_active boolean not null default true
);

create index collar_devices_location_gix on public.collar_devices using gist (location);

-- ---------------------------------------------------------------------------
-- Community incidents
-- ---------------------------------------------------------------------------
create sequence public.incident_tracking_seq start with 150;

create table public.community_incidents (
  id uuid primary key default gen_random_uuid(),
  tracking_code text not null unique
    default ('C-' || lpad(nextval('public.incident_tracking_seq')::text, 4, '0')),
  client_request_id uuid,
  reporter_id uuid references public.profiles (id),
  reporter_phone text,
  source incident_source not null,
  incident_type incident_type not null,
  status incident_status not null default 'PENDING',
  urgency incident_urgency not null default 'NORMAL',
  village_id uuid references public.villages (id),
  gn_division_id uuid references public.gn_divisions (id),
  sector_id uuid references public.sectors (id),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  location geography (point, 4326) generated always as (
    st_setsrid(st_makepoint(longitude, latitude), 4326)::geography
  ) stored,
  raw_location_text text,
  elephant_count_band text check (elephant_count_band in ('1', '2_5', '6_PLUS')),
  occurred_when text not null default 'NOW' check (occurred_when in ('NOW', 'EARLIER_TODAY')),
  occurred_at timestamptz not null default now(),
  photo_path text,
  duplicate_of_id uuid references public.community_incidents (id),
  call_back_required boolean not null default false,
  field_action_required boolean not null default false,
  review_started_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint community_incidents_idempotency unique (reporter_id, client_request_id),
  constraint community_incidents_duplicate_status
    check ((duplicate_of_id is null) or status in ('DUPLICATE', 'VERIFIED', 'REJECTED')),
  constraint community_incidents_not_self_duplicate check (duplicate_of_id is distinct from id)
);

create index community_incidents_reporter_idx on public.community_incidents (reporter_id);
create index community_incidents_status_idx on public.community_incidents (status);
create index community_incidents_urgency_idx on public.community_incidents (urgency);
create index community_incidents_created_at_idx on public.community_incidents (created_at desc);
create index community_incidents_village_idx on public.community_incidents (village_id);
create index community_incidents_gn_division_idx on public.community_incidents (gn_division_id);
create index community_incidents_duplicate_of_idx on public.community_incidents (duplicate_of_id);
create index community_incidents_location_gix on public.community_incidents using gist (location);
create index community_incidents_dedupe_idx
  on public.community_incidents (incident_type, occurred_at)
  where duplicate_of_id is null;

create trigger community_incidents_touch_updated_at
  before update on public.community_incidents
  for each row execute function public.touch_updated_at();

-- Derive geographic scope (and village coordinates for village-only reports)
-- on the server so clients can never choose their own GN division or sector.
create or replace function public.set_incident_scope()
returns trigger
language plpgsql
as $$
declare
  v_village public.villages%rowtype;
begin
  if new.village_id is not null then
    select * into v_village from public.villages where id = new.village_id;
    if found then
      new.gn_division_id := v_village.gn_division_id;
      new.sector_id := v_village.sector_id;
      new.latitude := coalesce(new.latitude, v_village.latitude);
      new.longitude := coalesce(new.longitude, v_village.longitude);
    end if;
  end if;
  return new;
end;
$$;

create trigger community_incidents_set_scope
  before insert on public.community_incidents
  for each row execute function public.set_incident_scope();

-- ---------------------------------------------------------------------------
-- Verification audit trail
-- ---------------------------------------------------------------------------
create table public.verification_records (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.community_incidents (id),
  officer_id uuid not null references public.profiles (id),
  decision verification_decision not null,
  method verification_method,
  notes text check (char_length(notes) <= 1000),
  rejection_reason rejection_reason,
  field_action_required boolean not null default false,
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint verification_rejection_needs_reason
    check (decision <> 'REJECTED' or rejection_reason is not null),
  constraint verification_verified_needs_method
    check (decision <> 'VERIFIED' or method is not null)
);

create index verification_records_incident_idx on public.verification_records (incident_id);
create index verification_records_officer_idx on public.verification_records (officer_id, verified_at desc);

-- ---------------------------------------------------------------------------
-- Notifications and SMS log
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid references public.profiles (id) on delete cascade,
  target_sector_id uuid references public.sectors (id),
  incident_id uuid references public.community_incidents (id) on delete cascade,
  notification_type notification_type not null,
  title text not null,
  body text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_has_target check (recipient_id is not null or target_sector_id is not null)
);

create index notifications_recipient_idx on public.notifications (recipient_id, created_at desc);
create index notifications_sector_idx on public.notifications (target_sector_id, created_at desc);

create table public.sms_logs (
  id uuid primary key default gen_random_uuid(),
  direction sms_direction not null,
  phone text not null,
  message text not null,
  parsed_type incident_type,
  parsed_location text,
  incident_id uuid references public.community_incidents (id),
  status sms_log_status not null,
  created_at timestamptz not null default now()
);

create index sms_logs_phone_idx on public.sms_logs (phone, created_at desc);
