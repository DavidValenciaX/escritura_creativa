-- The owner may reopen and copy active URLs. Existing RLS keeps tokens private.
alter table public.share_links
  add column token text unique check (token is null or token ~ '^[a-f0-9]{64}$'),
  add column legacy_token_hash text unique check
    (legacy_token_hash is null or legacy_token_hash ~ '^[a-f0-9]{64}$');

-- Creation, upgrades and revocation go through authenticated server endpoints.
-- Clients cannot forge hashes/aliases or replace a link's target via REST.
drop policy links_owner on public.share_links;
create policy links_owner_read on public.share_links for select
  to authenticated using (owner_id = auth.uid());
