-- Row-level security verification. Run with scripts/verify-rls.sh.
\set ON_ERROR_STOP 1
\set QUIET 1

insert into organizations (id, name) values ('00000000-0000-0000-0000-0000000000a1', 'Fictional Org');
insert into people (id, auth_user_id, name, email) values
  ('00000000-0000-0000-0000-00000000aaaa', '10000000-0000-0000-0000-000000000001', 'Ava Editor', 'ava@example.com'),
  ('00000000-0000-0000-0000-00000000bbbb', '10000000-0000-0000-0000-000000000002', 'Ben Other', 'ben@example.com'),
  ('00000000-0000-0000-0000-00000000cccc', '10000000-0000-0000-0000-000000000003', 'Cy Admin', 'cy@example.com');
insert into projects (id, organization_id, code, name, sector, phase) values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'P1', 'Project One', 'healing', 'strategy'),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000a1', 'P2', 'Project Two', 'learning', 'strategy');
insert into project_members values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000aaaa', 'editor', now()),
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000cccc', 'project_admin', now()),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000bbbb', 'project_admin', now());
insert into project_state (project_id, data) values
  ('20000000-0000-0000-0000-000000000001', '{"secret":"p1"}'),
  ('20000000-0000-0000-0000-000000000002', '{"secret":"p2"}');
insert into audit_events (project_id, actor_id, action, summary) values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000cccc', 'test', 'seed');

create function pg_temp.check(label text, ok boolean) returns void language plpgsql as $$
begin
  if not ok then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end $$;

-- ---- As Ava (editor on P1 only) -------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', false);
select pg_temp.check('member sees only own project', (select array_agg(code) from projects) = array['P1']);
select pg_temp.check('cross-project state is invisible', (select count(*) from project_state where project_id = '20000000-0000-0000-0000-000000000002') = 0);
select pg_temp.check('own project state is readable', (select data->>'secret' from project_state) = 'p1');
select pg_temp.check('editor cannot read audit log', (select count(*) from audit_events) = 0);
select pg_temp.check('people visibility limited to teammates', (select count(*) from people) = 2);

do $$ begin
  begin update project_state set data = '{"secret":"hacked"}'; raise exception 'FAIL: direct state write allowed';
  exception when insufficient_privilege then raise notice 'PASS: direct state writes are denied'; end;
  begin insert into project_members values ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000aaaa', 'project_admin', now()); raise exception 'FAIL: self-join allowed';
  exception when insufficient_privilege then raise notice 'PASS: cannot add self to another project'; end;
  begin insert into audit_events (action) values ('forged'); raise exception 'FAIL: audit forge allowed';
  exception when insufficient_privilege then raise notice 'PASS: cannot write audit log'; end;
end $$;

-- ---- As Cy (project admin on P1) -----------------------------------------
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', false);
select pg_temp.check('admin reads audit log', (select count(*) from audit_events) = 1);

-- ---- Anonymous ------------------------------------------------------------
reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $$ begin
  begin perform count(*) from projects; raise exception 'FAIL: anon can read';
  exception when insufficient_privilege then raise notice 'PASS: anonymous access denied'; end;
end $$;

-- ---- Integrity (even for privileged roles) --------------------------------
reset role;
do $$ begin
  begin update audit_events set summary = 'x'; raise exception 'FAIL: audit mutable';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
    raise notice 'PASS: audit log is append-only';
  end;
  begin
    delete from project_members where project_id = '20000000-0000-0000-0000-000000000002';
    set constraints all immediate;
    raise exception 'FAIL: removed last admin';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
    raise notice 'PASS: last administrator cannot be removed';
  end;
end $$;
select pg_temp.check('storage path must be inside the project folder', not exists (select 1 from source_files));
do $$ begin
  begin
    insert into source_files (project_id, source_id, storage_path, mime_type, size_bytes, uploaded_by)
    values ('20000000-0000-0000-0000-000000000001', 's', '20000000-0000-0000-0000-000000000002/s/x.pdf', 'application/pdf', 10, '00000000-0000-0000-0000-00000000aaaa');
    raise exception 'FAIL: cross-project storage path accepted';
  exception when check_violation then raise notice 'PASS: cross-project storage path rejected'; end;
  begin
    insert into source_files (project_id, source_id, storage_path, mime_type, size_bytes, uploaded_by)
    values ('20000000-0000-0000-0000-000000000001', 's', '20000000-0000-0000-0000-000000000001/s/x.exe', 'application/x-msdownload', 10, '00000000-0000-0000-0000-00000000aaaa');
    raise exception 'FAIL: executable accepted';
  exception when check_violation then raise notice 'PASS: disallowed file type rejected'; end;
end $$;
\echo 'ALL RLS CHECKS PASSED'
