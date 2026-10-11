create unique index resources_builtin_unique on public.resources(builtin_key) where builtin_key is not null;
alter table public.profiles add constraint profile_name_length check(length(display_name) between 1 and 100);
alter table public.profiles add constraint profile_bio_length check(length(bio)<=1000);
alter table public.notebooks add constraint notebook_description_length check(length(description)<=1000);
alter table public.documents add constraint signature_length check(length(signature)<=500);
create table public.blocked_publications(document_id uuid primary key references public.documents on delete cascade,moderator_id uuid references auth.users on delete set null,created_at timestamptz not null default now());
alter table public.blocked_publications enable row level security;
-- Only the server's admin-only moderation route writes or reads this table.
create function public.prevent_blocked_publication() returns trigger language plpgsql security definer set search_path=public as $$
 begin if new.is_public and exists(select 1 from blocked_publications where document_id=new.document_id) then raise exception 'publication blocked by moderation'; end if;return new;end;
$$;
create trigger publications_moderated before insert or update on public.publications for each row execute function public.prevent_blocked_publication();
revoke all on function public.prevent_blocked_publication() from public;
