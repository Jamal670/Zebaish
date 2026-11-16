-- ============================================================================
-- Migration: Seller Analytics RPCs (KPIs, Trend, City, Payment Share)
-- File: supabase/migrations/20261113_seller_analytics_rpcs.sql
--
-- Notes:
-- - Derives seller from auth.uid() via public.sellers.id = auth.uid() (never trusts client seller_id).
-- - Date window: analytics_window_start(p_days, p_tz) in Asia/Karachi (7d, 30d, 90d, null for ALL).
-- - EXCLUDED_FROM_REVENUE = ('Cancelled', 'Refund').
-- - Graph A: 5-day calendar-month-aligned buckets for 7d/30d/90d, monthly for ALL (zero-filled).
-- - Graph B: Normalizes cities with regexp_replace and initcap, ranked by revenue desc (Top 6).
-- - Graph C: Grouped into COD vs Online, always zero-filled.
-- ============================================================================

-- Re-usable helper to get authenticated seller's ID
create or replace function public.current_seller_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select s.id from public.sellers s where s.id = auth.uid() limit 1;
$$;
revoke all on function public.current_seller_id() from public, anon;
grant execute on function public.current_seller_id() to authenticated;

-- Date window calculation helper
create or replace function public.analytics_window_start(
  p_days integer,
  p_tz text default 'Asia/Karachi'
)
returns timestamptz
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_days is null then
    return null;
  end if;
  return (((now() at time zone p_tz)::date - (p_days - 1))::timestamp) at time zone p_tz;
end;
$$;
revoke all on function public.analytics_window_start(integer, text) from public, anon;
grant execute on function public.analytics_window_start(integer, text) to authenticated;

-- Composite index for fast seller date range queries
create index if not exists idx_seller_orders_seller_created
  on public.seller_orders (seller_id, created_at desc);

-- ----------------------------------------------------------------------------
-- 1. KPI Summary RPC
-- ----------------------------------------------------------------------------
create or replace function public.get_seller_analytics_kpis(
  p_days integer default 30,
  p_tz text default 'Asia/Karachi'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_seller uuid := public.current_seller_id();
  v_start  timestamptz := public.analytics_window_start(p_days, p_tz);
  v_total_revenue numeric := 0;
  v_total_orders bigint := 0;
  v_avg_order_val numeric := 0;
  v_pending_orders bigint := 0;
  v_cancelled_orders bigint := 0;
  v_active_listings bigint := 0;
  v_sold_out bigint := 0;
  v_avg_rating numeric := 0;
  v_reviews_count bigint := 0;
begin
  if v_seller is null then
    raise exception 'not a seller' using errcode = '42501';
  end if;

  -- Orders & Revenue within window
  select
    coalesce(round(sum(seller_total) filter (where status not in ('Cancelled', 'Refund'))::numeric, 2), 0),
    count(*),
    coalesce(round(avg(seller_total) filter (where status not in ('Cancelled', 'Refund'))::numeric, 2), 0),
    count(*) filter (where status in ('Pending', 'Confirmed', 'Processing')),
    count(*) filter (where status = 'Cancelled')
  into
    v_total_revenue,
    v_total_orders,
    v_avg_order_val,
    v_pending_orders,
    v_cancelled_orders
  from public.seller_orders
  where seller_id = v_seller
    and (v_start is null or created_at >= v_start);

  -- Current inventory state (snapshot, not restricted by date range)
  select
    count(*) filter (where lower(status) = 'active'),
    count(*) filter (where lower(status) in ('sold out', 'sold_out') or quantity = 0),
    coalesce(round((sum(average_rating * review_count)::numeric / nullif(sum(review_count), 0)), 2), 0),
    coalesce(sum(review_count), 0)
  into
    v_active_listings,
    v_sold_out,
    v_avg_rating,
    v_reviews_count
  from public.products
  where seller_id = v_seller;

  -- Fallback to sellers.average_rating if product review aggregation is 0
  if v_avg_rating = 0 then
    select coalesce(round(s.average_rating::numeric, 1), 0)
      into v_avg_rating
    from public.sellers s
    where s.id = v_seller;
  end if;

  return jsonb_build_object(
    'total_revenue', v_total_revenue,
    'total_orders', v_total_orders,
    'avg_order_value', v_avg_order_val,
    'pending_fulfillment', v_pending_orders,
    'cancelled_orders', v_cancelled_orders,
    'active_listings', v_active_listings,
    'sold_out_products', v_sold_out,
    'avg_rating', v_avg_rating,
    'approved_reviews_count', v_reviews_count
  );
end $$;

revoke all on function public.get_seller_analytics_kpis(integer, text) from public, anon;
grant execute on function public.get_seller_analytics_kpis(integer, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 2. Revenue Trend RPC (5-Day Calendar Month Buckets or Monthly for ALL)
-- ----------------------------------------------------------------------------
create or replace function public.get_seller_revenue_trend(
  p_days integer default 30,
  p_tz text default 'Asia/Karachi'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_seller     uuid := public.current_seller_id();
  v_today      date := (now() at time zone p_tz)::date;
  v_start_ts   timestamptz := public.analytics_window_start(p_days, p_tz);
  v_start_date date;
  v_result     jsonb;
begin
  if v_seller is null then
    raise exception 'not a seller' using errcode = '42501';
  end if;

  if v_start_ts is null then
    -- ALL range: find earliest seller order or default to 5 months ago
    select coalesce(min((created_at at time zone p_tz)::date), (v_today - interval '5 months')::date)
      into v_start_date
    from public.seller_orders
    where seller_id = v_seller;
  else
    v_start_date := (v_start_ts at time zone p_tz)::date;
  end if;

  if p_days is null then
    -- Monthly buckets for ALL
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'date', to_char(m.m_start, 'Mon YYYY'),
        'revenue', coalesce(round(sum(so.seller_total)::numeric, 2), 0),
        'cod', coalesce(round(sum(so.seller_total) filter (where upper(trim(coalesce(so.payment_method, 'COD'))) = 'COD')::numeric, 2), 0),
        'online', coalesce(round(sum(so.seller_total) filter (where upper(trim(coalesce(so.payment_method, 'COD'))) <> 'COD')::numeric, 2), 0),
        'orders', count(so.id)
      ) order by m.m_start
    ), '[]'::jsonb)
    into v_result
    from (
      select date_trunc('month', d)::date as m_start,
             (date_trunc('month', d) + interval '1 month - 1 day')::date as m_end
      from generate_series(
        date_trunc('month', v_start_date)::timestamp,
        date_trunc('month', v_today)::timestamp,
        interval '1 month'
      ) as d
    ) m
    left join public.seller_orders so
      on so.seller_id = v_seller
      and (so.created_at at time zone p_tz)::date >= m.m_start
      and (so.created_at at time zone p_tz)::date <= m.m_end
      and so.status not in ('Cancelled', 'Refund')
    group by m.m_start, m.m_end;

  else
    -- 5-day calendar-month-aligned buckets (1-5, 6-10, 11-15, 16-20, 21-25, 26-end)
    with months as (
      select date_trunc('month', d)::date as m_start
      from generate_series(
        date_trunc('month', v_start_date)::timestamp,
        date_trunc('month', v_today)::timestamp,
        interval '1 month'
      ) as d
    ),
    all_buckets as (
      select
        m_start as b_start,
        m_start + 4 as b_end
      from months
      union all
      select
        m_start + 5 as b_start,
        m_start + 9 as b_end
      from months
      union all
      select
        m_start + 10 as b_start,
        m_start + 14 as b_end
      from months
      union all
      select
        m_start + 15 as b_start,
        m_start + 19 as b_end
      from months
      union all
      select
        m_start + 20 as b_start,
        m_start + 24 as b_end
      from months
      union all
      select
        m_start + 25 as b_start,
        (m_start + interval '1 month - 1 day')::date as b_end
      from months
    ),
    filtered_buckets as (
      select
        b_start,
        b_end,
        case
          when p_days = 7 then to_char(b_start, 'Mon DD')
          else to_char(b_start, 'Mon DD') || ' - ' || to_char(b_end, 'Mon DD')
        end as label
      from all_buckets
      where b_end >= v_start_date
        and b_start <= v_today
    )
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'date', b.label,
        'revenue', coalesce(round(sum(so.seller_total)::numeric, 2), 0),
        'cod', coalesce(round(sum(so.seller_total) filter (where upper(trim(coalesce(so.payment_method, 'COD'))) = 'COD')::numeric, 2), 0),
        'online', coalesce(round(sum(so.seller_total) filter (where upper(trim(coalesce(so.payment_method, 'COD'))) <> 'COD')::numeric, 2), 0),
        'orders', count(so.id)
      ) order by b.b_start
    ), '[]'::jsonb)
    into v_result
    from filtered_buckets b
    left join public.seller_orders so
      on so.seller_id = v_seller
      and (so.created_at at time zone p_tz)::date >= b.b_start
      and (so.created_at at time zone p_tz)::date <= b.b_end
      and so.status not in ('Cancelled', 'Refund')
    group by b.b_start, b.b_end, b.label;
  end if;

  return v_result;
end $$;

revoke all on function public.get_seller_revenue_trend(integer, text) from public, anon;
grant execute on function public.get_seller_revenue_trend(integer, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 3. Revenue by City RPC (Top 6 Normalized Cities, excluding Cancelled/Refund)
-- ----------------------------------------------------------------------------
create or replace function public.get_seller_revenue_by_city(
  p_days integer default 30,
  p_tz text default 'Asia/Karachi'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_seller uuid := public.current_seller_id();
  v_start  timestamptz := public.analytics_window_start(p_days, p_tz);
  v_result jsonb;
begin
  if v_seller is null then
    raise exception 'not a seller' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'city', r.city_display,
      'revenue', r.revenue,
      'orders', r.orders
    )
  ), '[]'::jsonb)
  into v_result
  from (
    select
      initcap(lower(regexp_replace(trim(o.city), '\s+', ' ', 'g'))) as city_display,
      round(sum(so.seller_total)::numeric, 2) as revenue,
      count(distinct so.id)::int as orders
    from public.seller_orders so
    join public.orders o on o.id = so.order_id
    where so.seller_id = v_seller
      and (v_start is null or so.created_at >= v_start)
      and so.status not in ('Cancelled', 'Refund')
      and o.city is not null
      and trim(o.city) <> ''
    group by lower(regexp_replace(trim(o.city), '\s+', ' ', 'g'))
    order by revenue desc, orders desc
    limit 6
  ) r;

  return v_result;
end $$;

revoke all on function public.get_seller_revenue_by_city(integer, text) from public, anon;
grant execute on function public.get_seller_revenue_by_city(integer, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 4. Payment Method Share RPC (COD vs Online, Always Zero-Filled)
-- ----------------------------------------------------------------------------
create or replace function public.get_seller_payment_share(
  p_days integer default 30,
  p_tz text default 'Asia/Karachi'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_seller uuid := public.current_seller_id();
  v_start  timestamptz := public.analytics_window_start(p_days, p_tz);
  v_cod_count bigint := 0;
  v_cod_amount numeric := 0;
  v_online_count bigint := 0;
  v_online_amount numeric := 0;
  v_total_count bigint := 0;
  v_cod_pct numeric := 0;
  v_online_pct numeric := 0;
begin
  if v_seller is null then
    raise exception 'not a seller' using errcode = '42501';
  end if;

  select
    count(distinct so.id) filter (where upper(trim(coalesce(so.payment_method, 'COD'))) = 'COD'),
    coalesce(round(sum(so.seller_total) filter (where upper(trim(coalesce(so.payment_method, 'COD'))) = 'COD')::numeric, 2), 0),
    count(distinct so.id) filter (where upper(trim(coalesce(so.payment_method, 'COD'))) <> 'COD'),
    coalesce(round(sum(so.seller_total) filter (where upper(trim(coalesce(so.payment_method, 'COD'))) <> 'COD')::numeric, 2), 0)
  into
    v_cod_count,
    v_cod_amount,
    v_online_count,
    v_online_amount
  from public.seller_orders so
  where so.seller_id = v_seller
    and (v_start is null or so.created_at >= v_start)
    and so.status not in ('Cancelled', 'Refund');

  v_total_count := v_cod_count + v_online_count;

  if v_total_count > 0 then
    v_cod_pct := round((v_cod_count::numeric / v_total_count::numeric) * 100);
    v_online_pct := 100 - v_cod_pct;
  end if;

  return jsonb_build_array(
    jsonb_build_object(
      'name', 'Cash on Delivery (COD)',
      'value', v_cod_pct,
      'count', v_cod_count,
      'amount', v_cod_amount,
      'color', '#f59e0b'
    ),
    jsonb_build_object(
      'name', 'Online (Bank/EasyPaisa)',
      'value', v_online_pct,
      'count', v_online_count,
      'amount', v_online_amount,
      'color', '#10b981'
    )
  );
end $$;

revoke all on function public.get_seller_payment_share(integer, text) from public, anon;
grant execute on function public.get_seller_payment_share(integer, text) to authenticated;

