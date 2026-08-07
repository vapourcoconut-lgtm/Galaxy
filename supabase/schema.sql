create table if not exists public.user_workbench (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state_data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by text
);

create or replace function public.set_user_workbench_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_user_workbench_updated_at
on public.user_workbench;

create trigger set_user_workbench_updated_at
before insert or update on public.user_workbench
for each row
execute function public.set_user_workbench_updated_at();

alter table public.user_workbench enable row level security;

drop policy if exists "Users can read their own workbench" on public.user_workbench;
create policy "Users can read their own workbench"
on public.user_workbench
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own workbench" on public.user_workbench;
create policy "Users can insert their own workbench"
on public.user_workbench
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own workbench" on public.user_workbench;
create policy "Users can update their own workbench"
on public.user_workbench
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

grant select, insert, update on public.user_workbench to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'user_workbench'
  ) then
    alter publication supabase_realtime add table public.user_workbench;
  end if;
end $$;
