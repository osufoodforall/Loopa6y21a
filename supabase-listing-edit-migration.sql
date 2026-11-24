-- Secure seller listing edits through a narrow RPC instead of direct table updates.
create or replace function public.update_loop_listing(
  p_listing_id uuid,
  p_name text,
  p_price numeric,
  p_description text,
  p_distance_miles numeric,
  p_category text
)
returns public.loop_listings
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_listing public.loop_listings;
begin
  update public.loop_listings
     set name = p_name,
         price = p_price,
         description = p_description,
         distance_miles = p_distance_miles,
         category = p_category
   where id = p_listing_id
     and seller_id = auth.uid()
     and sale_status = 'available'
  returning * into updated_listing;

  return updated_listing;
end;
$$;

revoke all on function public.update_loop_listing(uuid, text, numeric, text, numeric, text) from public, anon;
grant execute on function public.update_loop_listing(uuid, text, numeric, text, numeric, text) to authenticated;
revoke update on public.loop_listings from authenticated;
revoke update (name, price, description, distance_miles, category, pickup_at) on public.loop_listings from authenticated;
