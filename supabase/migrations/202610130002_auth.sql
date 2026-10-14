-- Preserve internal account ids while allowing an explicit username at signup.
create or replace function public.create_profile() returns trigger language plpgsql security definer set search_path=public as $$
declare requested text;
begin
 requested := new.raw_user_meta_data->>'public_handle';
 if requested is null or requested !~ '^[a-z0-9_-]{3,40}$' then
  requested := 'autor_'||replace(new.id::text,'-','');
 end if;
 insert into profiles(id,handle,display_name) values(new.id,requested,left(coalesce(nullif(new.raw_user_meta_data->>'name',''),'Escritor'),100));
 return new;
end;
$$;

create table public.auth_attempts (
 key text primary key,
 started_at timestamptz not null default now(),
 attempts integer not null default 1
);
alter table public.auth_attempts enable row level security;
create function public.consume_auth_attempt(attempt_key text) returns boolean
language plpgsql security definer set search_path=public as $$
declare current_attempts integer;
begin
 insert into auth_attempts(key) values(attempt_key)
 on conflict(key) do update set
 attempts=case when auth_attempts.started_at < now()-interval '15 minutes' then 1 else auth_attempts.attempts+1 end,
 started_at=case when auth_attempts.started_at < now()-interval '15 minutes' then now() else auth_attempts.started_at end
 returning attempts into current_attempts;
 return current_attempts <= 30;
end;
$$;
revoke all on function public.consume_auth_attempt(text) from public, anon, authenticated;
grant execute on function public.consume_auth_attempt(text) to service_role;

