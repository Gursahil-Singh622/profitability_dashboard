create table if not exists public.driver_weekly_finances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  gross_earnings numeric(12, 2) not null default 0,
  tips numeric(12, 2) not null default 0,
  app_bonus numeric(12, 2) not null default 0,
  fixed_insurance numeric(12, 2) not null default 0,
  fixed_phone numeric(12, 2) not null default 0,
  fixed_vehicle_payment numeric(12, 2) not null default 0,
  fixed_other numeric(12, 2) not null default 0,
  fuel numeric(12, 2) not null default 0,
  maintenance numeric(12, 2) not null default 0,
  tolls_parking numeric(12, 2) not null default 0,
  car_wash numeric(12, 2) not null default 0,
  food numeric(12, 2) not null default 0,
  variable_other numeric(12, 2) not null default 0,
  online_hours numeric(8, 2) not null default 0,
  active_hours numeric(8, 2) not null default 0,
  miles numeric(10, 1) not null default 0,
  trips integer not null default 0,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start)
);

alter table public.driver_weekly_finances enable row level security;

drop policy if exists "Users can read their own weekly finances" on public.driver_weekly_finances;
drop policy if exists "Users can insert their own weekly finances" on public.driver_weekly_finances;
drop policy if exists "Users can update their own weekly finances" on public.driver_weekly_finances;
drop policy if exists "Users can delete their own weekly finances" on public.driver_weekly_finances;

create policy "Users can read their own weekly finances"
on public.driver_weekly_finances
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert their own weekly finances"
on public.driver_weekly_finances
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own weekly finances"
on public.driver_weekly_finances
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own weekly finances"
on public.driver_weekly_finances
for delete
to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.set_driver_weekly_finances_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_driver_weekly_finances_updated_at on public.driver_weekly_finances;

create trigger set_driver_weekly_finances_updated_at
before update on public.driver_weekly_finances
for each row
execute function public.set_driver_weekly_finances_updated_at();
