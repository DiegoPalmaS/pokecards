create table if not exists public.pokedex_progress (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  caught_ids integer[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.pokedex_progress enable row level security;

drop policy if exists "public can read progress" on public.pokedex_progress;
drop policy if exists "owner can insert progress" on public.pokedex_progress;
drop policy if exists "owner can update progress" on public.pokedex_progress;

create policy "public can read progress"
on public.pokedex_progress
for select
to anon, authenticated
using (true);

create policy "owner can insert progress"
on public.pokedex_progress
for insert
to authenticated
with check (auth.uid() = owner_id);

create policy "owner can update progress"
on public.pokedex_progress
for update
to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);
