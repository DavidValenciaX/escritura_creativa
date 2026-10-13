-- Avatares propios: archivos privados, lectura pública solo al asociarlos al perfil.
create table public.avatars (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 storage_path text not null unique,
 created_at timestamptz not null default now()
);
create index avatars_owner_created on public.avatars(owner_id, created_at);
alter table public.avatars enable row level security;
create policy avatars_owner_read on public.avatars for select using(owner_id=auth.uid());

alter table public.profiles add column avatar_upload_id uuid references public.avatars(id);
alter table public.profiles add constraint profile_single_avatar check (
 avatar_resource_id is null or avatar_upload_id is null
);
create function public.check_profile_avatar() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if new.avatar_upload_id is not null and not exists (
  select 1 from avatars where id=new.avatar_upload_id and owner_id=new.id
 ) then raise exception 'El avatar debe pertenecer a esta cuenta.'; end if;
 if new.avatar_resource_id is not null and not exists (
  select 1 from resources where id=new.avatar_resource_id and kind='image'
 ) then raise exception 'El avatar debe ser una imagen.'; end if;
 return new;
end;
$$;
create trigger profile_avatar_owner before insert or update on public.profiles
for each row execute function public.check_profile_avatar();

insert into storage.buckets(id,name,public,file_size_limit)
values('avatars','avatars',false,262144);
