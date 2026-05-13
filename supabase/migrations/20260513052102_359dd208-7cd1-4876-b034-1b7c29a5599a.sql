insert into storage.buckets (id, name, public)
values ('recon-reports', 'recon-reports', false)
on conflict (id) do nothing;

create policy "Recon admins can read recon reports"
on storage.objects for select
to authenticated
using (bucket_id = 'recon-reports' and public.is_recon_admin());

create policy "Recon admins can write recon reports"
on storage.objects for insert
to authenticated
with check (bucket_id = 'recon-reports' and public.is_recon_admin());

create policy "Recon admins can update recon reports"
on storage.objects for update
to authenticated
using (bucket_id = 'recon-reports' and public.is_recon_admin());