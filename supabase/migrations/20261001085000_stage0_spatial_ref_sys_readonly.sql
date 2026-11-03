-- Stage 0: close write access to the PostGIS reference table for API roles.
-- Independent of the app (it never writes this table), so applied on its own.

-- ------------------------------------------------------------- spatial_ref_sys
-- PostGIS reference table (the public EPSG list). Enabling RLS on an
-- extension table breaks extension upgrades, so it is not done.
--
-- Revoking is not possible either: the table and its grants belong to
-- supabase_admin, and REVOKE from postgres silently removes nothing (verified:
-- relacl still shows anon=arwdDxtm/supabase_admin afterwards). postgres does
-- hold the TRIGGER privilege, so writes by the API roles are refused by a
-- trigger instead. Reading stays open: it is public reference data, PUBLIC
-- already has SELECT, and ST_Transform needs it for every role.
create or replace function public.spatial_ref_sys_readonly()
returns trigger language plpgsql as $$
begin
  if current_user in ('anon', 'authenticated') then
    raise exception 'spatial_ref_sys is read-only for API roles';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists spatial_ref_sys_readonly_rows on public.spatial_ref_sys;
create trigger spatial_ref_sys_readonly_rows
  before insert or update or delete on public.spatial_ref_sys
  for each row execute function public.spatial_ref_sys_readonly();

drop trigger if exists spatial_ref_sys_readonly_truncate on public.spatial_ref_sys;
create trigger spatial_ref_sys_readonly_truncate
  before truncate on public.spatial_ref_sys
  for each statement execute function public.spatial_ref_sys_readonly();
