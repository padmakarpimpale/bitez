create extension if not exists "uuid-ossp";
create extension if not exists "cube" cascade;
create extension if not exists "earthdistance" cascade;

create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name varchar(255) not null,
  phone_number varchar(50) unique not null,
  postal_code char(6) not null,
  hdb_block varchar(20) not null,
  latitude numeric(10, 7) not null,
  longitude numeric(10, 7) not null,
  created_at timestamptz default now()
);

create table public.merchants (
  id uuid primary key default uuid_generate_v4(),
  name varchar(255) not null,
  description text,
  address text not null,
  latitude numeric(10, 7) not null,
  longitude numeric(10, 7) not null,
  is_active boolean default true
);

create table public.order_hubs (
  id uuid primary key default uuid_generate_v4(),
  host_id uuid references public.profiles(id) on delete restrict not null,
  merchant_id uuid references public.merchants(id) on delete restrict not null,
  cutoff_time timestamptz not null,
  void_deck_notes text not null,
  base_delivery_fee numeric(6, 2) not null,
  current_split_fee numeric(6, 2) not null,
  status varchar(50) default 'OPEN',
  created_at timestamptz default now(),
  constraint chk_hub_status check (status in ('OPEN', 'LOCKED', 'ARRIVED', 'CANCELLED'))
);

create table public.sub_orders (
  id uuid primary key default uuid_generate_v4(),
  hub_id uuid references public.order_hubs(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete restrict not null,
  cart_items jsonb not null,
  items_total_price numeric(6, 2) not null,
  order_status varchar(50) default 'RESERVED',
  created_at timestamptz default now(),
  constraint chk_sub_status check (order_status in ('RESERVED', 'COLLECTED', 'CANCELLED'))
);

create index idx_profiles_geo on public.profiles using gist (ll_to_earth(latitude, longitude));
create index idx_hubs_status_cutoff on public.order_hubs (status, cutoff_time);
create index idx_sub_orders_hub on public.sub_orders (hub_id);

create or replace function public.recalculate_delivery_split()
returns trigger as $$
declare
  v_participant_count int;
  v_base_fee numeric(6, 2);
  v_new_split numeric(6, 2);
  v_hub_id uuid;
begin
  if (TG_OP = 'DELETE') then
    v_hub_id := OLD.hub_id;
  else
    v_hub_id := NEW.hub_id;
  end if;

  select base_delivery_fee into v_base_fee from public.order_hubs where id = v_hub_id;

  select count(distinct user_id) + 1 into v_participant_count
  from public.sub_orders
  where hub_id = v_hub_id and order_status = 'RESERVED';

  v_new_split := round((v_base_fee / v_participant_count), 2);

  update public.order_hubs
  set current_split_fee = v_new_split
  where id = v_hub_id;

  return coalesce(NEW, OLD);
end;
$$ language plpgsql;

create trigger trigger_sync_split_fee
after insert or update or delete on public.sub_orders
for each row execute function public.recalculate_delivery_split();

alter table public.profiles enable row level security;
alter table public.merchants enable row level security;
alter table public.order_hubs enable row level security;
alter table public.sub_orders enable row level security;

create policy "profiles own read" on public.profiles for select using (auth.uid() = id);
create policy "profiles own write" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "active merchants readable" on public.merchants for select using (is_active = true);
create policy "hubs readable" on public.order_hubs for select using (true);
create policy "hosts create hubs" on public.order_hubs for insert with check (auth.uid() = host_id);
create policy "hosts update hubs" on public.order_hubs for update using (auth.uid() = host_id);
create policy "sub orders readable" on public.sub_orders for select using (true);
create policy "users create own sub orders" on public.sub_orders for insert with check (auth.uid() = user_id);
create policy "users update own sub orders" on public.sub_orders for update using (auth.uid() = user_id);
