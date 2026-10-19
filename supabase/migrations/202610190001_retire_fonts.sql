-- Existing texts are normalized to Lora by the app when opened or saved.
alter table public.documents alter column appearance set default
  '{"paper":"cream","titleFont":"lora","bodyFont":"lora","fontSize":18,"lineHeight":1.8,"ink":"#34312d"}'::jsonb;

update public.resources set hidden = true
where kind = 'font' and builtin_key in ('caveat', 'kalam', 'patrick');
