-- Migration 4: private incident photo bucket
-- Objects are stored as <reporter_uuid>/<random>.<ext>. Uploads use signed upload
-- URLs issued by the backend; viewing uses short-lived signed URLs. The bucket is
-- never public.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'incident-photos',
  'incident-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- A reporter may read back only objects inside their own folder.
create policy incident_photos_read_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'incident-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- No insert/update/delete policies: clients cannot write directly.
