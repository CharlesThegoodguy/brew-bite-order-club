create extension if not exists pgcrypto;

do $$
begin
  create type public.payment_status as enum (
    'PENDING',
    'PAID',
    'FAILED',
    'EXPIRED',
    'CANCELLED',
    'REFUNDED'
  );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.order_status as enum (
    'PENDING',
    'CONFIRMED',
    'PREPARING',
    'READY',
    'COMPLETED',
    'CANCELLED'
  );
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  product_name text not null check (length(btrim(product_name)) > 0),
  description text,
  category text not null default 'Kopi',
  price numeric(12, 2) not null check (price >= 0),
  image_url text,
  stock integer check (stock is null or stock >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.products
  add column if not exists category text not null default 'Kopi';

do $$
begin
  alter table public.products
    add constraint products_category_check
    check (category in ('Kopi', 'Dessert', 'Bundling'));
exception
  when duplicate_object then null;
end
$$;

insert into public.products (
  id,
  product_name,
  description,
  category,
  price,
  image_url,
  stock,
  is_active
)
values
  ('10000000-0000-4000-8000-000000000001', 'Kopi Americano', 'Kopi · 1 gelas', 'Kopi', 8000, null, null, true),
  ('10000000-0000-4000-8000-000000000002', 'Americano Cranberry', 'Americano & cranberry · 1 gelas', 'Kopi', 12000, null, null, true),
  ('10000000-0000-4000-8000-000000000003', 'Kopi Susu Gula Aren', 'Kopi susu gula aren · 1 gelas', 'Kopi', 10000, null, null, true),
  ('10000000-0000-4000-8000-000000000004', 'Dessert Oreo', 'Dessert Oreo · 1 cup', 'Dessert', 8000, null, null, true),
  ('10000000-0000-4000-8000-000000000005', 'Paket SKS', 'Americano + Dessert Oreo', 'Bundling', 14000, null, null, true),
  ('10000000-0000-4000-8000-000000000006', 'Paket EPRT', 'Americano Cranberry + Dessert Oreo', 'Bundling', 18000, null, null, true),
  ('10000000-0000-4000-8000-000000000007', 'Paket TAK', 'Kopi Susu Gula Aren + Dessert Oreo', 'Bundling', 16000, null, null, true)
on conflict (id) do nothing;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'admin' check (role = 'admin'),
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_name text not null,
  customer_whatsapp text not null,
  total_amount numeric(12, 2) not null default 0 check (total_amount >= 0),
  order_status public.order_status not null default 'PENDING',
  payment_status public.payment_status not null default 'PENDING',
  payment_method text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  product_category text check (product_category is null or product_category in ('Kopi', 'Dessert', 'Bundling')),
  product_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  subtotal numeric(12, 2) not null check (subtotal >= 0),
  created_at timestamptz not null default now(),
  check (subtotal = unit_price * quantity)
);

alter table public.order_items
  add column if not exists product_category text;

do $$
begin
  alter table public.order_items
    add constraint order_items_product_category_check
    check (product_category is null or product_category in ('Kopi', 'Dessert', 'Bundling'));
exception
  when duplicate_object then null;
end
$$;

update public.order_items oi
set product_category = p.category
from public.products p
where oi.product_id = p.id
  and oi.product_category is null;

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  payment_reference text,
  payment_method text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  payment_status public.payment_status not null default 'PENDING',
  transaction_date timestamptz not null default now(),
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists order_items_order_id_idx on public.order_items (order_id);
create index if not exists payments_order_id_idx on public.payments (order_id);
create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists products_active_idx on public.products (is_active);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select exists (
    select 1
    from public.admin_users a
    where a.user_id = auth.uid()
      and a.role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

create or replace function public.sync_order_payment_summary()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status public.payment_status;
begin
  v_status := new.payment_status;
  if new.payment_status = 'PAID' and not new.verified then
    v_status := 'PENDING';
  end if;

  update public.orders
  set payment_status = v_status,
      paid_at = case
        when v_status = 'PAID' then coalesce(paid_at, new.transaction_date)
        else paid_at
      end
  where id = new.order_id;

  return new;
end;
$$;

drop trigger if exists payments_sync_order_summary on public.payments;
create trigger payments_sync_order_summary
after insert or update of payment_status, verified, transaction_date
on public.payments
for each row execute function public.sync_order_payment_summary();

create or replace function public.create_order(
  p_customer_name text,
  p_customer_whatsapp text,
  p_items jsonb,
  p_payment_method text,
  p_notes text default null
)
returns table (order_id uuid, order_number text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order_id uuid := gen_random_uuid();
  v_order_number text;
  v_item jsonb;
  v_product_id uuid;
  v_quantity integer;
  v_product public.products%rowtype;
  v_subtotal numeric(12, 2);
  v_total numeric(12, 2) := 0;
begin
  if p_customer_name is null or length(btrim(p_customer_name)) = 0 then
    raise exception 'Customer name is required.';
  end if;

  if p_customer_whatsapp is null or length(btrim(p_customer_whatsapp)) = 0 then
    raise exception 'Customer WhatsApp is required.';
  end if;

  if p_payment_method is null or length(btrim(p_payment_method)) = 0 then
    raise exception 'Payment method is required.';
  end if;

  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0
     or jsonb_array_length(p_items) > 50 then
    raise exception 'Order must contain between 1 and 50 items.';
  end if;

  v_order_number := 'BB-' ||
    to_char(now() at time zone 'UTC', 'YYYYMMDD') ||
    '-' ||
    upper(replace(v_order_id::text, '-', ''));

  insert into public.orders (
    id,
    order_number,
    customer_name,
    customer_whatsapp,
    total_amount,
    payment_method,
    notes
  )
  values (
    v_order_id,
    v_order_number,
    btrim(p_customer_name),
    btrim(p_customer_whatsapp),
    0,
    btrim(p_payment_method),
    nullif(btrim(coalesce(p_notes, '')), '')
  );

  for v_item in
    select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'Each order item must be an object.';
    end if;

    v_product_id := (v_item ->> 'product_id')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;

    if v_product_id is null or v_quantity is null or v_quantity < 1 or v_quantity > 100 then
      raise exception 'Each item must have a product_id and quantity from 1 to 100.';
    end if;

    select p.*
    into v_product
    from public.products p
    where p.id = v_product_id
      and p.is_active
    for update;

    if not found then
      raise exception 'Product % is not available.', v_product_id;
    end if;

    if v_product.stock is not null then
      if v_product.stock < v_quantity then
        raise exception 'Insufficient stock for product %.', v_product_id;
      end if;

      update public.products
      set stock = stock - v_quantity
      where id = v_product_id;
    end if;

    v_subtotal := v_product.price * v_quantity;
    v_total := v_total + v_subtotal;

    insert into public.order_items (
      order_id,
      product_id,
      product_category,
      product_name,
      quantity,
      unit_price,
      subtotal
    )
    values (
      v_order_id,
      v_product.id,
      v_product.category,
      v_product.product_name,
      v_quantity,
      v_product.price,
      v_subtotal
    );
  end loop;

  update public.orders
  set total_amount = v_total
  where id = v_order_id;

  insert into public.payments (
    order_id,
    payment_method,
    amount,
    payment_status
  )
  values (
    v_order_id,
    btrim(p_payment_method),
    v_total,
    'PENDING'
  );

  return query select v_order_id, v_order_number;
end;
$$;

revoke all on function public.create_order(text, text, jsonb, text, text) from public;
grant execute on function public.create_order(text, text, jsonb, text, text) to anon, authenticated;

alter table public.products enable row level security;
alter table public.admin_users enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;

revoke all on public.products, public.admin_users, public.orders, public.order_items, public.payments
from anon, authenticated;

grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;
grant select on public.admin_users, public.orders, public.order_items, public.payments to authenticated;
grant update on public.orders, public.payments to authenticated;
grant delete on public.orders to authenticated;
grant insert on public.payments to authenticated;

drop policy if exists products_read_active_or_admin on public.products;
create policy products_read_active_or_admin
on public.products for select
to anon, authenticated
using (is_active or public.is_admin());

drop policy if exists products_admin_manage on public.products;
create policy products_admin_manage
on public.products for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists admin_users_read_self_or_admin on public.admin_users;
create policy admin_users_read_self_or_admin
on public.admin_users for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists orders_admin_read on public.orders;
create policy orders_admin_read
on public.orders for select
to authenticated
using (public.is_admin());

drop policy if exists orders_admin_update on public.orders;
create policy orders_admin_update
on public.orders for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists orders_admin_delete on public.orders;
create policy orders_admin_delete
on public.orders for delete
to authenticated
using (public.is_admin());

drop policy if exists order_items_admin_read on public.order_items;
create policy order_items_admin_read
on public.order_items for select
to authenticated
using (public.is_admin());

drop policy if exists payments_admin_read on public.payments;
create policy payments_admin_read
on public.payments for select
to authenticated
using (public.is_admin());

drop policy if exists payments_admin_insert on public.payments;
create policy payments_admin_insert
on public.payments for insert
to authenticated
with check (public.is_admin());

drop policy if exists payments_admin_update on public.payments;
create policy payments_admin_update
on public.payments for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Create the first Auth user in Supabase, then replace the email below and run:
-- insert into public.admin_users (user_id, role)
-- select id, 'admin' from auth.users where lower(email) = lower('admin@example.com')
-- on conflict (user_id) do nothing;
