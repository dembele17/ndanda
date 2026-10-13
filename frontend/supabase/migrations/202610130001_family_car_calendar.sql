begin;

create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 50),
  created_at timestamptz not null default now()
);

-- Only a trusted administrator enrolls members through the SQL editor.
-- An Auth account alone does not grant access to family data.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  family_id uuid not null references public.families(id),
  name text not null check (char_length(btrim(name)) between 1 and 30),
  color text not null default '#2563eb' check (color ~ '^#[0-9a-fA-F]{6}$'),
  avatar text not null default '🧑' check (avatar in ('👦','👩','👨','👧','🧑','👵','👴','🐱','🐶','🌷')),
  created_at timestamptz not null default now(),
  unique (id, family_id)
);
create index profiles_family_id_idx on public.profiles(family_id);

create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id),
  user_id uuid not null,
  date date not null check (date between date '1900-01-01' and date '9998-12-31'),
  start_time time not null check (start_time < time '24:00' and extract(second from start_time) = 0),
  end_time time not null check (extract(second from end_time) = 0),
  purpose text not null check (
    char_length(purpose) <= 100 and (
      purpose in ('🛒 買い物','🏫 通学','💼 通勤','🏔️ 旅行','🚗 ドライブ','🍽️ 外食','🏥 病院')
      or purpose ~ '^📦 その他：[^[:space:]]'
    )
  ),
  memo text not null default '' check (char_length(memo) <= 1000),
  -- Internal Auth identity used solely for write permissions. user_id is the car user.
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (user_id, family_id) references public.profiles(id, family_id),
  foreign key (created_by, family_id) references public.profiles(id, family_id),
  check (start_time < end_time)
  -- Intentionally no exclusion/unique constraint on time: overlapping plans are allowed.
);
create index schedules_family_date_idx on public.schedules(family_id, date, start_time);
create index schedules_created_by_idx on public.schedules(created_by);

create function public.current_family_id() returns uuid
language sql stable security definer set search_path = ''
as $$ select p.family_id from public.profiles p where p.id = (select auth.uid()) $$;
revoke all on function public.current_family_id() from public, anon;
grant execute on function public.current_family_id() to authenticated;

alter table public.families enable row level security;
alter table public.profiles enable row level security;
alter table public.schedules enable row level security;

revoke all on public.families, public.profiles, public.schedules from anon, authenticated;
grant select on public.families, public.profiles, public.schedules to authenticated;
grant update (name, color, avatar) on public.profiles to authenticated;
grant insert (family_id, user_id, date, start_time, end_time, purpose, memo) on public.schedules to authenticated;
grant update (user_id, date, start_time, end_time, purpose, memo) on public.schedules to authenticated;
grant delete on public.schedules to authenticated;

create policy family_read on public.families for select to authenticated
  using (id = (select public.current_family_id()));
create policy profiles_family_read on public.profiles for select to authenticated
  using (family_id = (select public.current_family_id()));
create policy profiles_own_update on public.profiles for update to authenticated
  using (id = (select auth.uid()) and family_id = (select public.current_family_id()))
  with check (id = (select auth.uid()) and family_id = (select public.current_family_id()));
create policy schedules_family_read on public.schedules for select to authenticated
  using (family_id = (select public.current_family_id()));
create policy schedules_family_insert on public.schedules for insert to authenticated
  with check (created_by = (select auth.uid()) and family_id = (select public.current_family_id()));
create policy schedules_own_update on public.schedules for update to authenticated
  using (created_by = (select auth.uid()) and family_id = (select public.current_family_id()))
  with check (created_by = (select auth.uid()) and family_id = (select public.current_family_id()));
create policy schedules_own_delete on public.schedules for delete to authenticated
  using (created_by = (select auth.uid()) and family_id = (select public.current_family_id()));

create function public.touch_schedule() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.id is distinct from old.id or new.family_id is distinct from old.family_id
    or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at then
    raise exception '予定のアクセス制御情報は変更できません。';
  end if;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
revoke all on function public.touch_schedule() from public, anon, authenticated;
create trigger schedules_touch before update on public.schedules
  for each row execute function public.touch_schedule();

-- Serialize each family's writes so simultaneous inserts also receive a warning.
-- SECURITY INVOKER keeps every query and write subject to the caller's RLS.
create function public.save_schedule(
  p_user_id uuid, p_date date, p_start_time time, p_end_time time,
  p_purpose text, p_memo text default '', p_id uuid default null,
  p_acknowledged_ids uuid[] default '{}', p_expected_updated_at timestamptz default null
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  family uuid := public.current_family_id();
  existing public.schedules%rowtype;
  conflicting_plans jsonb;
begin
  if auth.uid() is null or family is null then
    raise exception '家族メンバーとしてログインしてください。' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(family::text, 0));
  if p_id is not null then
    select * into existing from public.schedules where id = p_id;
    if not found or existing.created_by <> auth.uid() then
      return jsonb_build_object('error', 'この予定を編集する権限がありません。');
    end if;
    if p_expected_updated_at is null or existing.updated_at is distinct from p_expected_updated_at then
      return jsonb_build_object('error', 'この予定は更新されています。画面を更新し、詳細から開き直してください。');
    end if;
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id and family_id = family) then
    return jsonb_build_object('error', '家族の使用者を選択してください。');
  end if;
  select coalesce(jsonb_agg(to_jsonb(s) order by s.start_time), '[]'::jsonb) into conflicting_plans
    from public.schedules s
    where s.family_id = family and s.date = p_date and (p_id is null or s.id <> p_id)
      and s.start_time < p_end_time and s.end_time > p_start_time;
  if exists (
    select 1 from jsonb_array_elements(conflicting_plans) x
    where not ((x->>'id')::uuid = any(coalesce(p_acknowledged_ids, '{}'::uuid[])))
  ) then
    return jsonb_build_object('conflicts', conflicting_plans);
  end if;
  if p_id is null then
    insert into public.schedules (family_id, user_id, date, start_time, end_time, purpose, memo)
      values (family, p_user_id, p_date, p_start_time, p_end_time, p_purpose, coalesce(p_memo, ''));
  else
    update public.schedules set user_id = p_user_id, date = p_date,
      start_time = p_start_time, end_time = p_end_time, purpose = p_purpose, memo = coalesce(p_memo, '')
      where id = p_id and created_by = auth.uid();
    if not found then return jsonb_build_object('error', '予定を編集できませんでした。'); end if;
  end if;
  return jsonb_build_object('success', true);
end;
$$;
revoke all on function public.save_schedule(uuid, date, time, time, text, text, uuid, uuid[], timestamptz) from public, anon;
grant execute on function public.save_schedule(uuid, date, time, time, text, text, uuid, uuid[], timestamptz) to authenticated;

commit;
