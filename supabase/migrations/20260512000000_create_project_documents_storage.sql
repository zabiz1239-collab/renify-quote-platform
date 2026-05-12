insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-documents',
  'project-documents',
  false,
  52428800,
  array['application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Project document uploads" on storage.objects;
drop policy if exists "Project document reads" on storage.objects;
drop policy if exists "Project document updates" on storage.objects;
drop policy if exists "Project document deletes" on storage.objects;

create policy "Project document uploads"
on storage.objects
for insert
to anon, authenticated
with check (bucket_id = 'project-documents');

create policy "Project document reads"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'project-documents');

create policy "Project document updates"
on storage.objects
for update
to anon, authenticated
using (bucket_id = 'project-documents')
with check (bucket_id = 'project-documents');

create policy "Project document deletes"
on storage.objects
for delete
to anon, authenticated
using (bucket_id = 'project-documents');
