-- Each alias points to the same share_link as its original token. This default
-- also assigns stable aliases to existing links without changing their access.
-- A random UUID contributes 122 random bits, encoded in 22 URL-safe characters.
alter table public.share_links
  add column short_code text not null
    default rtrim(translate(encode(uuid_send(gen_random_uuid()), 'base64'), '+/', '-_'), '=')
    constraint share_links_short_code_key unique
    constraint share_links_short_code_format check (short_code ~ '^[A-Za-z0-9_-]{22}$');

-- The existing owner-only SELECT policy also protects the aliases. Anonymous
-- readers resolve them through the server, which checks revoked_at every time.
