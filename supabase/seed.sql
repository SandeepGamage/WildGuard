-- Reference data for the WildGuard LK demo (Yala / Tissamaharama area, Sri Lanka).
-- Coordinates are approximate and for demonstration only.
-- Demo users and sample incidents are created by `npm run seed:demo` in backend/
-- because Supabase Auth users cannot be created from plain SQL.
-- Tamil village names are left NULL until verified by a native speaker.

insert into public.sectors (id, name, park) values
  ('00000000-0000-4000-8000-000000000003', 'Sector 3', 'Yala National Park'),
  ('00000000-0000-4000-8000-000000000004', 'Sector 4', 'Yala National Park')
on conflict (id) do nothing;

insert into public.gn_divisions (id, name) values
  ('00000000-0000-4000-8000-0000000000a1', 'Palatupana'),
  ('00000000-0000-4000-8000-0000000000a2', 'Kirinda'),
  ('00000000-0000-4000-8000-0000000000a3', 'Yodakandiya'),
  ('00000000-0000-4000-8000-0000000000a4', 'Tissamaharama')
on conflict (id) do nothing;

insert into public.villages
  (id, name_en, name_si, name_ta, aliases, gn_division_id, sector_id, latitude, longitude)
values
  ('00000000-0000-4000-8000-0000000000b1', 'Palatupana', 'පලටුපාන', null,
   array['palatupana', 'palatupaana', 'පලටුපාන'],
   '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-000000000003', 6.2994, 81.3703),
  ('00000000-0000-4000-8000-0000000000b2', 'Kirinda', 'කිරින්ද', null,
   array['kirinda', 'kirinde', 'කිරින්ද'],
   '00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-000000000003', 6.2386, 81.3138),
  ('00000000-0000-4000-8000-0000000000b3', 'Yodakandiya', 'යෝධකණ්ඩිය', null,
   array['yodakandiya', 'yodhakandiya', 'යෝධකණ්ඩිය'],
   '00000000-0000-4000-8000-0000000000a3', '00000000-0000-4000-8000-000000000004', 6.3550, 81.3920),
  ('00000000-0000-4000-8000-0000000000b4', 'Tissamaharama', 'තිස්සමහාරාම', null,
   array['tissamaharama', 'tissa', 'තිස්සමහාරාම'],
   '00000000-0000-4000-8000-0000000000a4', '00000000-0000-4000-8000-000000000004', 6.2836, 81.2889),
  ('00000000-0000-4000-8000-0000000000b5', 'Debarawewa', 'දෙබරවැව', null,
   array['debarawewa', 'debarawava', 'දෙබරවැව'],
   '00000000-0000-4000-8000-0000000000a4', '00000000-0000-4000-8000-000000000004', 6.3080, 81.2750)
on conflict (id) do nothing;

-- Simulated collar used for the "nearby collar data" cross-check (about 380 m from Palatupana).
insert into public.collar_devices (id, code, name, latitude, longitude, last_seen_at) values
  ('00000000-0000-4000-8000-0000000000c1', 'EL-07', 'Collared elephant EL-07', 6.3028, 81.3703, now()),
  ('00000000-0000-4000-8000-0000000000c2', 'EL-12', 'Collared elephant EL-12', 6.2420, 81.3140, now())
on conflict (id) do nothing;
