-- Avatar storage (§6.15 profile photo). A public-read 'avatars' bucket; each user
-- may write / replace / delete only objects under a top-level folder named after
-- their own uid (avatars/{uid}/...). Public read keeps <Image> simple across
-- web + native. RLS on storage.objects is the security boundary, as elsewhere.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Public read (bucket is public anyway; the explicit policy documents intent).
create policy "avatars_public_read"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- Writes are confined to the owner's own {uid}/ folder.
create policy "avatars_owner_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_owner_update"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_owner_delete"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
