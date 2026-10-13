-- 1. In Authentication > Users create email/password users with Auto Confirm enabled.
-- 2. Replace these sample emails with those Auth users' emails, then run this script.
-- Do not run against unrelated data. Use a dedicated Supabase project for this app.
begin;
do $$
declare
  family uuid;
  member record;
  account uuid;
begin
  insert into public.families(name) values ('うちの家族') returning id into family;
  for member in select * from (values
    ('me@example.com', '自分', '#2563eb', '👦'),
    ('mother@example.com', '母', '#b45309', '👩'),
    ('father@example.com', '父', '#7c3aed', '👨'),
    ('sister@example.com', '妹', '#be185d', '👧')
  ) as members(email, name, color, avatar) loop
    select id into account from auth.users where lower(email) = lower(member.email);
    if account is null then raise exception 'Authにメールアドレス % がありません。', member.email; end if;
    insert into public.profiles(id, family_id, name, color, avatar)
      values (account, family, member.name, member.color, member.avatar);
  end loop;
end;
$$;
commit;
