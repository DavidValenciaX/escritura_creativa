-- Run once in the Supabase SQL editor or with `supabase db push`.
create extension if not exists pgcrypto;
create table public.profiles (
 id uuid primary key references auth.users on delete cascade,
 handle text unique not null check (handle ~ '^[a-z0-9_-]{3,40}$'),
 display_name text not null default 'Escritor', bio text not null default '', avatar_resource_id uuid,
 created_at timestamptz not null default now()
);
create table public.admins (user_id uuid primary key references auth.users on delete cascade);
create table public.notebooks (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users on delete cascade,
 title text not null check(length(title) between 1 and 160), description text not null default '', created_at timestamptz not null default now()
);
create table public.documents (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users on delete cascade,
 notebook_id uuid references public.notebooks on delete set null,
 title text not null default 'Sin título' check(length(title)<=200), written_on date not null default (now() at time zone 'America/Bogota')::date,
 content jsonb not null default '{"type":"doc","content":[{"type":"paragraph"}]}',
 appearance jsonb not null default '{"paper":"cream","titleFont":"caveat","bodyFont":"lora","fontSize":18,"lineHeight":1.8,"ink":"#34312d"}',
 signature text not null default '', position integer not null default 0,
 revision integer not null default 1, updated_at timestamptz not null default now(), created_at timestamptz not null default now(),
 check (octet_length(content::text)<=1000000)
);
create table public.publications (
 document_id uuid primary key references public.documents on delete cascade,
 owner_id uuid not null references auth.users on delete cascade,
 title text not null, written_on date not null, content jsonb not null, appearance jsonb not null, signature text not null,
 is_public boolean not null default false, published_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.grants (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users on delete cascade,
 document_id uuid references public.documents on delete cascade, notebook_id uuid references public.notebooks on delete cascade,
 recipient_email text not null check(recipient_email=lower(trim(recipient_email)) and length(recipient_email)<=254),
 created_at timestamptz not null default now(), check(num_nonnulls(document_id,notebook_id)=1)
);
create unique index grants_document_unique on public.grants(document_id,recipient_email) where document_id is not null;
create unique index grants_notebook_unique on public.grants(notebook_id,recipient_email) where notebook_id is not null;
create table public.share_links (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users on delete cascade,
 document_id uuid references public.documents on delete cascade, notebook_id uuid references public.notebooks on delete cascade,
 token_hash text unique not null, revoked_at timestamptz, created_at timestamptz not null default now(),
 check(num_nonnulls(document_id,notebook_id)=1)
);
create table public.resources (
 id uuid primary key default gen_random_uuid(), owner_id uuid references auth.users on delete set null,
 kind text not null check(kind in ('paper','font','image')), name text not null check(length(name) between 1 and 120),
 author text not null, source text not null, license text not null, description text not null default '', tags text[] not null default '{}',
 storage_path text unique, builtin_key text, hidden boolean not null default false,
 created_at timestamptz not null default now(), check(num_nonnulls(storage_path,builtin_key)=1)
);
alter table public.profiles add constraint profile_avatar_fk foreign key (avatar_resource_id) references public.resources;
create table public.media (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users on delete cascade,
 document_id uuid not null references public.documents on delete cascade, storage_path text unique not null,
 mime text not null, created_at timestamptz not null default now()
);
create table public.favorites (
 user_id uuid not null references auth.users on delete cascade, document_id uuid not null references public.publications on delete cascade,
 created_at timestamptz not null default now(), primary key(user_id,document_id)
);
create table public.reports (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
 document_id uuid references public.publications on delete cascade, resource_id uuid references public.resources on delete cascade,
 reason text not null check(length(reason) between 5 and 1000), status text not null default 'open' check(status in ('open','resolved')),
 created_at timestamptz not null default now(), check(num_nonnulls(document_id,resource_id)=1)
);
create function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.admins where user_id=auth.uid());
$$;
create function public.owns_target(doc uuid, book uuid) returns boolean language sql stable security definer set search_path=public as $$
 select case when doc is not null then exists(select 1 from documents where id=doc and owner_id=auth.uid())
 else exists(select 1 from notebooks where id=book and owner_id=auth.uid()) end;
$$;
create function public.can_read_publication(doc uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from publications p join documents d on d.id=p.document_id
 where p.document_id=doc and (p.is_public or p.owner_id=auth.uid() or exists(
 select 1 from grants g where (g.document_id=doc or g.notebook_id=d.notebook_id)
 and g.recipient_email=lower(auth.jwt()->>'email') and auth.uid() is not null)));
$$;
create function public.can_read_notebook(book uuid) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from notebooks where id=book and owner_id=auth.uid()) or exists(
 select 1 from grants where notebook_id=book and recipient_email=lower(auth.jwt()->>'email') and auth.uid() is not null);
$$;
create function public.create_profile() returns trigger language plpgsql security definer set search_path=public as $$
 begin insert into profiles(id,handle,display_name) values(new.id,'autor_'||replace(new.id::text,'-',''),coalesce(new.raw_user_meta_data->>'name','Escritor')); return new; end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.create_profile();
-- Optimistic concurrency: a stale browser cannot overwrite a newer revision.
create function public.save_document(doc uuid, expected_revision integer, payload jsonb) returns public.documents language plpgsql security invoker set search_path=public as $$
 declare saved documents;
 begin
 update documents set title=payload->>'title',written_on=(payload->>'written_on')::date,content=payload->'content',appearance=payload->'appearance',signature=payload->>'signature',
 notebook_id=nullif(payload->>'notebook_id','')::uuid,position=(payload->>'position')::integer,revision=revision+1,updated_at=now()
 where id=doc and owner_id=auth.uid() and revision=expected_revision returning * into saved;
 if saved.id is null then raise exception 'revision_conflict' using errcode='40001'; end if;
 return saved;
 end;
$$;
-- Constrain direct client updates too, including ownership and notebook membership.
create function public.check_document_owner() returns trigger language plpgsql security definer set search_path=public as $$
 declare moved boolean:=false;
 begin
 if TG_OP='UPDATE' then
  if new.owner_id<>old.owner_id then raise exception 'owner cannot change'; end if;
  if new.revision<=old.revision then new.revision=old.revision+1; end if;
  new.updated_at=now();
 end if;
 if new.notebook_id is not null and not exists(select 1 from notebooks where id=new.notebook_id and owner_id=new.owner_id) then raise exception 'invalid notebook'; end if;
 if new.notebook_id is not null then
  if TG_OP='INSERT' then moved=true; elsif new.notebook_id is distinct from old.notebook_id then moved=true; end if;
  if moved then
   perform id from notebooks where id=new.notebook_id for update;
   select coalesce(max(position)+1,0) into new.position from documents where notebook_id=new.notebook_id;
  end if;
 end if;
 return new;
 end;
$$;
create trigger document_owner before insert or update on documents for each row execute function public.check_document_owner();
create function public.check_publication_owner() returns trigger language plpgsql security definer set search_path=public as $$
 begin if not exists(select 1 from documents where id=new.document_id and owner_id=new.owner_id) then raise exception 'invalid publication owner'; end if; return new; end;
$$;
create trigger publication_owner before insert or update on publications for each row execute function public.check_publication_owner();
alter table profiles enable row level security;
alter table admins enable row level security;
alter table notebooks enable row level security;
alter table documents enable row level security;
alter table publications enable row level security;
alter table grants enable row level security;
alter table share_links enable row level security;
alter table resources enable row level security;
alter table media enable row level security;
alter table favorites enable row level security;
alter table reports enable row level security;
create policy profiles_read on profiles for select using(true);
create policy profiles_edit on profiles for update using(id=auth.uid()) with check(id=auth.uid());
create policy notebooks_read on notebooks for select using(owner_id=auth.uid() or public.can_read_notebook(id));
create policy notebooks_create on notebooks for insert with check(owner_id=auth.uid());
create policy notebooks_edit on notebooks for update using(owner_id=auth.uid()) with check(owner_id=auth.uid());
create policy notebooks_delete on notebooks for delete using(owner_id=auth.uid());
create policy documents_owner on documents for all using(owner_id=auth.uid()) with check(owner_id=auth.uid());
create policy publications_read on publications for select using(owner_id=auth.uid() or public.can_read_publication(document_id));
create policy publications_create on publications for insert with check(owner_id=auth.uid() and public.owns_target(document_id,null));
create policy publications_edit on publications for update using(owner_id=auth.uid()) with check(owner_id=auth.uid() and public.owns_target(document_id,null));
create policy publications_delete on publications for delete using(owner_id=auth.uid());
create policy grants_read on grants for select using(owner_id=auth.uid() or (auth.uid() is not null and recipient_email=lower(auth.jwt()->>'email')));
create policy grants_insert on grants for insert with check(owner_id=auth.uid() and public.owns_target(document_id,notebook_id));
create policy grants_delete on grants for delete using(owner_id=auth.uid());
create policy links_owner on share_links for all using(owner_id=auth.uid()) with check(owner_id=auth.uid() and public.owns_target(document_id,notebook_id));
create policy resources_read on resources for select using(not hidden or owner_id=auth.uid() or public.is_admin());
-- Uploads and moderation go through validated server routes. No direct writes.
create policy media_owner on media for select using(owner_id=auth.uid());
create policy favorites_read on favorites for select using(user_id=auth.uid());
create policy favorites_insert on favorites for insert with check(user_id=auth.uid() and exists(select 1 from publications where document_id=favorites.document_id and is_public));
create policy favorites_delete on favorites for delete using(user_id=auth.uid());
create policy reports_read on reports for select using(user_id=auth.uid() or public.is_admin());
create policy reports_admin on reports for update using(public.is_admin()) with check(public.is_admin());
create index documents_owner_updated on documents(owner_id,updated_at desc);
create index documents_notebook_position on documents(notebook_id,position);
create index publications_public_date on publications(published_at desc) where is_public;
create index grants_email on grants(recipient_email);
create index resources_kind_date on resources(kind,created_at desc);
create index media_document on media(document_id);
create index reports_open on reports(created_at) where status='open';
insert into storage.buckets(id,name,public,file_size_limit) values('personal','personal',false,10485760),('community','community',false,10485760);
-- Authenticated clients have no direct bucket access. Validated routes use the server key.
-- In particular, readers cannot enumerate personal files or access unpublished images.
alter publication supabase_realtime add table public.publications;
revoke all on function public.create_profile() from public;
revoke all on function public.check_document_owner() from public;
revoke all on function public.check_publication_owner() from public;
revoke all on function public.save_document(uuid,integer,jsonb) from public,anon;
grant execute on function public.save_document(uuid,integer,jsonb) to authenticated;
