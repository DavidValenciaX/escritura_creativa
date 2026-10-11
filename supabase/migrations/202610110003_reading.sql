create function public.read_notebook(book uuid) returns setof public.publications
language sql stable security definer set search_path=public as $$
 select p.* from publications p join documents d on d.id=p.document_id
 where d.notebook_id=book and public.can_read_notebook(book) and public.can_read_publication(p.document_id)
 order by d.position,d.created_at;
$$;
revoke all on function public.read_notebook(uuid) from public,anon;
grant execute on function public.read_notebook(uuid) to authenticated;
-- Backfill profiles if the migration is installed after accounts already exist.
insert into profiles(id,handle,display_name)
select id,'autor_'||replace(id::text,'-',''),coalesce(raw_user_meta_data->>'name','Escritor') from auth.users
on conflict(id) do nothing;
