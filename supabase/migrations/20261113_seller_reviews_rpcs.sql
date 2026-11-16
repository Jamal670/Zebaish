-- ============================================================================
-- Migration: Seller Reviews RPCs & Rating Breakdown
-- File: supabase/migrations/20261113_seller_reviews_rpcs.sql
--
-- Notes:
-- - Derives seller from auth.uid() via public.sellers.id = auth.uid() (never trusts client seller_id).
-- - Reviews link to orders via reviews.order_item_id -> order_items.id -> orders.id (order_item_id is nullable).
-- - Fallback customer name: orders.customer_name -> users.first_name/last_name -> 'Customer'.
-- - Fallback product title: order_items.product_title -> products.title.
-- - Status filter: v_visible = array['Pending', 'Approved'] (since new reviews start as 'Pending'
--   and no admin moderation workflow sets 'Approved' in this frontend, both are included so
--   reviews remain visible while 'Rejected' reviews are excluded).
-- ============================================================================

create or replace function public.current_seller_id()
returns uuid language sql stable security definer set search_path = public as $$
  select s.id from public.sellers s where s.id = auth.uid() limit 1
$$;
revoke all on function public.current_seller_id() from public, anon;
grant execute on function public.current_seller_id() to authenticated;

-- Index serving both the reviews list (seller + status, newest first) and the breakdown
create index if not exists idx_reviews_seller_status_created
  on public.reviews (seller_id, status, created_at desc);

create or replace function public.get_seller_review_breakdown(p_product_id uuid default null)
returns table (rating int, review_count int)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_seller  uuid := public.current_seller_id();
  v_visible text[] := array['Pending', 'Approved'];
begin
  if v_seller is null then raise exception 'not a seller' using errcode = '42501'; end if;
  return query
  select g.r, coalesce(c.n, 0)::int
  from generate_series(1, 5) as g(r)
  left join (
    select rv.rating as rt, count(*) as n
    from public.reviews rv
    where rv.seller_id = v_seller
      and rv.status = any (v_visible)
      and (p_product_id is null or rv.product_id = p_product_id)
    group by rv.rating
  ) c on c.rt = g.r
  order by g.r;
end $$;

create or replace function public.get_seller_reviews(
  p_product_id uuid default null, p_limit int default 50, p_offset int default 0)
returns table (
  id uuid, rating int, review text, created_at timestamptz, product_id uuid,
  product_title text, order_id uuid, customer_name text, total_count bigint)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_seller  uuid := public.current_seller_id();
  v_visible text[] := array['Pending', 'Approved'];
begin
  if v_seller is null then raise exception 'not a seller' using errcode = '42501'; end if;
  return query
  select r.id, r.rating, r.review, r.created_at, r.product_id,
         coalesce(oi.product_title, p.title)::text,
         oi.order_id,
         coalesce(o.customer_name,
                  nullif(trim(concat_ws(' ', u.first_name, u.last_name)), ''),
                  'Customer')::text,
         count(*) over ()
  from public.reviews r
  join public.products p          on p.id  = r.product_id
  left join public.order_items oi on oi.id = r.order_item_id
  left join public.orders o       on o.id  = oi.order_id
  left join public.users u        on u.id  = r.user_id
  where r.seller_id = v_seller
    and r.status = any (v_visible)
    and (p_product_id is null or r.product_id = p_product_id)
  order by r.created_at desc, r.id desc
  limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
end $$;

revoke all on function public.get_seller_review_breakdown(uuid)       from public, anon;
revoke all on function public.get_seller_reviews(uuid, int, int)      from public, anon;
grant execute on function public.get_seller_review_breakdown(uuid)    to authenticated;
grant execute on function public.get_seller_reviews(uuid, int, int)   to authenticated;

