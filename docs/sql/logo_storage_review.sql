-- PREPARATION ONLY. Inspect policies first; permissive policies combine with OR.
-- Do not run against an unknown bucket or delete policies belonging to other apps.
select id, name, public, file_size_limit, allowed_mime_types from storage.buckets;
select policyname, roles, cmd, qual, with_check from pg_policies
where schemaname = 'storage' and tablename = 'objects';

-- After confirming the bucket name and removing conflicting permissive policies,
-- adapt/review the following changes in staging before production:
/*
update storage.buckets set public = false, file_size_limit = 1048576,
 allowed_mime_types = array['image/png','image/jpeg','image/webp','image/svg+xml']
where id = 'kadi-compnies-logo';
create policy kadi_logos_read_own on storage.objects for select to authenticated
using (bucket_id = 'kadi-compnies-logo' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy kadi_logos_insert_own on storage.objects for insert to authenticated
with check (bucket_id = 'kadi-compnies-logo' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy kadi_logos_delete_own on storage.objects for delete to authenticated
using (bucket_id = 'kadi-compnies-logo' and (storage.foldername(name))[1] = (select auth.uid())::text);
-- No UPDATE policy is required: logo uploads use a new unique path with upsert=false.
*/
