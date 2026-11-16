-- 0) Drop EVERY overload of the four analytics functions (removes stale/broken versions)
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('get_seller_analytics_kpis', 'get_seller_revenue_trend',
                        'get_seller_revenue_by_city', 'get_seller_payment_share')
  loop
    execute 'drop function if exists ' || r.sig::text;
  end loop;
end $$;

create index if not exists idx_seller_orders_seller_created
  on public.seller_orders (seller_id, created_at desc);

-- window start: N calendar days incl. today in Asia/Karachi; NULL = ALL
create or replace function public.analytics_window_start(p_days int, p_tz text default 'Asia/Karachi')
returns timestamptz language sql stable as $$
  select case when p_days is null then null
              else (((now() at time zone p_tz)::date - (p_days - 1))::timestamp) at time zone p_tz end
$$;

-- 1) KPIs
create or replace function public.get_seller_analytics_kpis(p_days int default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_seller uuid := public.current_seller_id();
  v_from   timestamptz;
  v_excl   text[] := array['Cancelled','Refund'];
  v_orders jsonb; v_products jsonb;
begin
  if v_seller is null then raise exception 'not a seller' using errcode = '42501'; end if;
  if p_days is not null and p_days not in (7, 30, 90) then
    raise exception 'invalid range' using errcode = '22023';
  end if;
  v_from := public.analytics_window_start(p_days);

  select jsonb_build_object(
    'total_revenue',       coalesce(sum(seller_total) filter (where status <> all (v_excl)), 0),
    'total_orders',        count(*),
    'pending_fulfillment', count(*) filter (where status in ('Pending','Confirmed','Processing')),
    'cancelled_orders',    count(*) filter (where status = 'Cancelled'),
    'avg_order_value',     coalesce(round(avg(seller_total) filter (where status <> all (v_excl)), 2), 0)
  ) into v_orders
  from public.seller_orders
  where seller_id = v_seller and (v_from is null or created_at >= v_from);

  select jsonb_build_object(
    'active_listings',   count(*) filter (where status = 'active'),
    'sold_out_products', count(*) filter (where status = 'sold_out'),
    'avg_rating',        round(sum(average_rating * review_count)::numeric / nullif(sum(review_count), 0), 2)
  ) into v_products
  from public.products where seller_id = v_seller;

  return v_orders || v_products;
end $$;

-- 2) Revenue trend: month-aligned 5-day buckets (monthly for ALL), zero-filled, COD + Advanced_Full
create or replace function public.get_seller_revenue_trend(p_days int default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_seller uuid := public.current_seller_id();
  v_tz     text := 'Asia/Karachi';
  v_today  date := (now() at time zone 'Asia/Karachi')::date;
  v_from   timestamptz;
  v_start  date;
  v_result jsonb;
begin
  if v_seller is null then raise exception 'not a seller' using errcode = '42501'; end if;
  if p_days is not null and p_days not in (7, 30, 90) then
    raise exception 'invalid range' using errcode = '22023';
  end if;

  v_from := public.analytics_window_start(p_days);
  if p_days is not null then
    v_start := v_today - (p_days - 1);
  else
    select min((so.created_at at time zone v_tz)::date) into v_start
    from public.seller_orders so where so.seller_id = v_seller;
    if v_start is null then return '[]'::jsonb; end if;
  end if;

  select coalesce(
           jsonb_agg(
             jsonb_build_object('bucket_start', x.bucket_start, 'cod', x.cod, 'advanced_full', x.adv)
             order by x.bucket_start),
           '[]'::jsonb)
  into v_result
  from (
    select b.bucket_start, sum(b.cod) as cod, sum(b.adv) as adv
    from (
      select
        case when p_days is null
             then date_trunc('month', d.dt::timestamp)::date
             else date_trunc('month', d.dt::timestamp)::date
                  + (least((extract(day from d.dt)::int - 1) / 5, 5) * 5)
        end as bucket_start,
        coalesce(a.cod, 0) as cod,
        coalesce(a.adv, 0) as adv
      from (select v_start + g as dt from generate_series(0, v_today - v_start) as g) d
      left join (
        select (so.created_at at time zone v_tz)::date as dt,
               sum(so.seller_total) filter (where so.payment_method = 'COD')           as cod,
               sum(so.seller_total) filter (where so.payment_method = 'Advanced_Full') as adv
        from public.seller_orders so
        where so.seller_id = v_seller
          and (v_from is null or so.created_at >= v_from)
          and so.payment_method in ('COD', 'Advanced_Full')
          and so.status <> all (array['Cancelled', 'Refund'])
        group by 1
      ) a on a.dt = d.dt
    ) b
    group by b.bucket_start
  ) x;

  return v_result;
end $$;

-- 3) Revenue by city (top 6, normalized city names)
create or replace function public.get_seller_revenue_by_city(p_days int default 30)
returns table (city text, order_count int, revenue numeric)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_seller uuid := public.current_seller_id();
  v_from   timestamptz;
begin
  if v_seller is null then raise exception 'not a seller' using errcode = '42501'; end if;
  if p_days is not null and p_days not in (7, 30, 90) then
    raise exception 'invalid range' using errcode = '22023';
  end if;
  v_from := public.analytics_window_start(p_days);

  return query
  select initcap(g.k)::text, g.n::int, g.rev
  from (
    select lower(regexp_replace(trim(o.city), '\s+', ' ', 'g')) as k,
           count(*) as n, sum(so.seller_total) as rev
    from public.seller_orders so
    join public.orders o on o.id = so.order_id
    where so.seller_id = v_seller
      and (v_from is null or so.created_at >= v_from)
      and so.status <> all (array['Cancelled', 'Refund'])
    group by 1
  ) g
  order by g.rev desc, g.n desc, g.k
  limit 6;
end $$;

-- 4) Payment share: COD vs Online (always both rows)
create or replace function public.get_seller_payment_share(p_days int default 30)
returns table (payment_type text, order_count int)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_seller uuid := public.current_seller_id();
  v_from   timestamptz;
  v_cod    int := 0;
  v_online int := 0;
begin
  if v_seller is null then raise exception 'not a seller' using errcode = '42501'; end if;
  if p_days is not null and p_days not in (7, 30, 90) then
    raise exception 'invalid range' using errcode = '22023';
  end if;
  v_from := public.analytics_window_start(p_days);

  select count(*) filter (where so.payment_method = 'COD')::int,
         count(*) filter (where so.payment_method <> 'COD')::int
  into v_cod, v_online
  from public.seller_orders so
  where so.seller_id = v_seller
    and (v_from is null or so.created_at >= v_from)
    and so.status <> all (array['Cancelled', 'Refund']);

  return query
    select 'COD'::text,    coalesce(v_cod, 0)
    union all
    select 'Online'::text, coalesce(v_online, 0);
end $$;

revoke all on function public.analytics_window_start(int, text)  from public, anon;
revoke all on function public.get_seller_analytics_kpis(int)     from public, anon;
revoke all on function public.get_seller_revenue_trend(int)      from public, anon;
revoke all on function public.get_seller_revenue_by_city(int)    from public, anon;
revoke all on function public.get_seller_payment_share(int)      from public, anon;
grant execute on function public.get_seller_analytics_kpis(int)  to authenticated;
grant execute on function public.get_seller_revenue_trend(int)   to authenticated;
grant execute on function public.get_seller_revenue_by_city(int) to authenticated;
grant execute on function public.get_seller_payment_share(int)   to authenticated;

notify pgrst, 'reload schema';

