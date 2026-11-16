-- ============================================================================
-- Migration: Single-RPC Seller Dashboard Metrics & Charts
-- File: supabase/migrations/20261112_get_seller_dashboard.sql
--
-- Notes:
-- - Derives seller from auth.uid() via public.sellers.id = auth.uid() (never trusts client seller_id).
-- - EXCLUDED_FROM_REVENUE = ('Cancelled', 'Refund') (mirrored in lib/seller/dashboard-types.ts).
-- - 7-day window uses 7 calendar days including today in Asia/Karachi (today - 6 at 00:00).
-- - Uses sellers.average_rating (column present on public.sellers).
-- - Daily Order Volume counts seller_orders rows per day (matches UI "Orders" label; no order_items join needed).
-- - Recent Orders returns latest 3 seller_orders joined with orders (order_number, customer_name, city)
--   and seller-scoped order_items (brand, product_title). No customer email/phone/address is exposed.
-- ============================================================================

create index if not exists idx_seller_orders_seller_created
  on public.seller_orders (seller_id, created_at desc);

create index if not exists idx_order_items_order_seller
  on public.order_items (order_id, seller_id);

create or replace function public.get_seller_dashboard(p_tz text default 'Asia/Karachi')
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_seller     uuid;
  v_today      date := (now() at time zone p_tz)::date;
  v_from       timestamptz := ((v_today - 6)::timestamp) at time zone p_tz;
  v_excluded   text[] := array['Cancelled', 'Refund']; -- EXCLUDED_FROM_REVENUE
  v_overview   jsonb;
  v_week       jsonb;
  v_daily      jsonb;
  v_status     jsonb;
  v_recent     jsonb;
  v_rating     numeric;
  v_listings   int;
  v_commission numeric;
begin
  -- Derive seller from auth.uid(); sellers.id is the FK/PK linked to auth.users(id)
  select s.id, coalesce(round(s.average_rating::numeric, 1), 0)
    into v_seller, v_rating
  from public.sellers s
  where s.id = auth.uid()
  limit 1;

  if v_seller is null then
    raise exception 'not a seller' using errcode = '42501';
  end if;

  -- Overall all-time metrics from seller_orders
  select jsonb_build_object(
    'total_revenue',    coalesce(round(sum(seller_total) filter (where status <> all (v_excluded))::numeric, 2), 0),
    'pending_dispatch', count(*) filter (where status in ('Pending', 'Confirmed', 'Processing')),
    'delivered_orders', count(*) filter (where status in ('Shipped', 'Delivered'))
  ) into v_overview
  from public.seller_orders
  where seller_id = v_seller;

  -- Trailing 7 calendar days (including today in p_tz)
  select jsonb_build_object(
    'revenue',             coalesce(round(sum(seller_total) filter (where status <> all (v_excluded))::numeric, 2), 0),
    'orders',              count(*) filter (where status <> all (v_excluded)),
    'avg_order_value',     coalesce(round(avg(seller_total) filter (where status <> all (v_excluded))::numeric, 2), 0),
    'pending_fulfillment', count(*) filter (where status in ('Pending', 'Confirmed', 'Processing'))
  ) into v_week
  from public.seller_orders
  where seller_id = v_seller
    and created_at >= v_from;

  -- Daily revenue & order volume (7 zero-filled calendar days in p_tz)
  select jsonb_agg(
    jsonb_build_object(
      'date',    to_char(d.day, 'YYYY-MM-DD'),
      'revenue', coalesce(x.revenue, 0),
      'orders',  coalesce(x.orders, 0)
    ) order by d.day
  )
  into v_daily
  from (select (v_today - 6 + g)::date as day from generate_series(0, 6) g) d
  left join (
    select
      (created_at at time zone p_tz)::date as day,
      round(sum(seller_total)::numeric, 2) as revenue,
      count(*) as orders
    from public.seller_orders
    where seller_id = v_seller
      and created_at >= v_from
      and status <> all (v_excluded)
    group by 1
  ) x on x.day = d.day;

  -- 7-day order status breakdown across all 7 allowed statuses (zero-filled)
  select jsonb_object_agg(st.status, coalesce(c.n, 0))
    into v_status
  from unnest(array['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Refund']) as st(status)
  left join (
    select status, count(*) as n
    from public.seller_orders
    where seller_id = v_seller
      and created_at >= v_from
    group by status
  ) c on c.status = st.status;

  -- Unpaid payable commission across monthly cycles
  select coalesce(round(sum(commission_remaining)::numeric, 2), 0)
    into v_commission
  from public.seller_commission_monthly_cycles
  where seller_id = v_seller
    and status <> 'Paid';

  -- Active product listings count
  select count(*)
    into v_listings
  from public.products
  where seller_id = v_seller
    and status = 'active';

  -- Latest 3 orders for this seller (joined inside SECURITY DEFINER so orders RLS is not exposed)
  select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc), '[]'::jsonb)
    into v_recent
  from (
    select
      so.id,
      so.status,
      round(coalesce(so.seller_total, 0)::numeric, 2) as seller_total,
      so.payment_method,
      so.created_at,
      so.dispatch_deadline,
      o.order_number,
      o.customer_name,
      o.city,
      coalesce(oi.brand, '') as brand,
      case
        when coalesce(oi.item_count, 0) > 1
          then coalesce(oi.product_title, '') || ' (+' || (oi.item_count - 1)::text || ' more)'
        else coalesce(oi.product_title, '')
      end as product_title
    from public.seller_orders so
    join public.orders o on o.id = so.order_id
    left join lateral (
      select
        min(i.brand) filter (where i.brand is not null) as brand,
        min(i.product_title) as product_title,
        count(*)::int as item_count
      from public.order_items i
      where i.order_id = so.order_id
        and i.seller_id = v_seller
    ) oi on true
    where so.seller_id = v_seller
    order by so.created_at desc
    limit 3
  ) r;

  return jsonb_build_object(
    'overview',         v_overview || jsonb_build_object(
      'avg_rating',         v_rating,
      'active_listings',    v_listings,
      'payable_commission', v_commission
    ),
    'last7',            v_week,
    'daily',            coalesce(v_daily, '[]'::jsonb),
    'status_breakdown', v_status,
    'recent_orders',    v_recent
  );
end $$;

revoke all on function public.get_seller_dashboard(text) from public, anon;
grant execute on function public.get_seller_dashboard(text) to authenticated;

