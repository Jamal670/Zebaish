-- ============================================================================
-- Migration: Fix Analytics Trend and Payment Share RPCs
-- File: supabase/migrations/20261113_fix_analytics_trend_payment_share.sql
-- ============================================================================

drop function if exists public.get_seller_revenue_trend(int);
drop function if exists public.get_seller_payment_share(int);

-- 1) Revenue trend: month-aligned 5-day buckets (monthly for ALL), zero-filled, COD + Advanced_Full
create or replace function public.get_seller_revenue_trend(p_days int default 30)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
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

-- 2) Payment share: COD vs Online (always both rows)
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

revoke all on function public.get_seller_revenue_trend(int) from public, anon;
revoke all on function public.get_seller_payment_share(int) from public, anon;
grant execute on function public.get_seller_revenue_trend(int) to authenticated;
grant execute on function public.get_seller_payment_share(int) to authenticated;

notify pgrst, 'reload schema';

