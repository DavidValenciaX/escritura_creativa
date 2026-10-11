create function public.publish_document(doc uuid,expected_revision integer,make_public boolean) returns public.publications
language plpgsql security invoker set search_path=public as $$
 declare draft documents; published publications;
 begin
 select * into draft from documents where id=doc and owner_id=auth.uid() for update;
 if draft.id is null then raise exception 'not found'; end if;
 if draft.revision<>expected_revision then raise exception 'revision_conflict' using errcode='40001'; end if;
 insert into publications(document_id,owner_id,title,written_on,content,appearance,signature,is_public)
 values(draft.id,draft.owner_id,draft.title,draft.written_on,draft.content,draft.appearance,draft.signature,make_public)
 on conflict(document_id) do update set title=excluded.title,written_on=excluded.written_on,content=excluded.content,
 appearance=excluded.appearance,signature=excluded.signature,is_public=excluded.is_public,updated_at=now()
 returning * into published; return published;
 end;
$$;
create function public.reorder_notebook(book uuid,ordered_ids uuid[]) returns void
language plpgsql security invoker set search_path=public as $$
 declare expected integer;
 begin
 if not exists(select 1 from notebooks where id=book and owner_id=auth.uid()) then raise exception 'forbidden'; end if;
 perform id from documents where notebook_id=book and owner_id=auth.uid() for update;
 select count(*) into expected from documents where notebook_id=book and owner_id=auth.uid();
 if expected<>cardinality(ordered_ids) or expected<>(select count(distinct id) from unnest(ordered_ids) id)
 or exists(select 1 from unnest(ordered_ids) id where not exists(select 1 from documents d where d.id=id and d.notebook_id=book and d.owner_id=auth.uid())) then raise exception 'invalid order'; end if;
 update documents d set position=o.ordinality-1,revision=d.revision+1,updated_at=now() from unnest(ordered_ids) with ordinality as o(id,ordinality) where d.id=o.id;
 end;
$$;
revoke all on function public.publish_document(uuid,integer,boolean) from public,anon;
grant execute on function public.publish_document(uuid,integer,boolean) to authenticated;
revoke all on function public.reorder_notebook(uuid,uuid[]) from public,anon;
grant execute on function public.reorder_notebook(uuid,uuid[]) to authenticated;
