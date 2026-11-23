-- One item, one reservation selling flow for the existing Loop project.
-- Run once in the Supabase SQL Editor after deploying the app update.

alter table public.loop_listings
  add column if not exists sale_status text not null default 'available',
  add column if not exists request_buyer_id uuid references auth.users(id) on delete set null;
alter table public.loop_listings add constraint loop_listings_sale_status_check
  check (sale_status in ('available', 'requested', 'reserved', 'unavailable'));

create table if not exists public.loop_requests (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null unique references public.loop_listings(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  seller_id uuid not null references auth.users(id) on delete cascade,
  message text not null check (char_length(message) between 1 and 1500),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'unavailable')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (buyer_id <> seller_id)
);

alter table public.loop_inquiries add column if not exists sender_id uuid references auth.users(id) on delete cascade;
alter table public.loop_requests enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.loop_listings to anon, authenticated;
grant insert, delete on public.loop_listings to authenticated;
revoke update on public.loop_listings from authenticated;
grant update (name, price, description, distance_miles, category, pickup_at) on public.loop_listings to authenticated;
grant select, insert, delete on public.loop_listing_likes to authenticated;
grant select on public.loop_requests to authenticated;
grant select, insert on public.loop_inquiries to authenticated;

drop policy if exists "Requests are visible to participants" on public.loop_requests;
create policy "Requests are visible to participants" on public.loop_requests for select to authenticated
  using (auth.uid() = buyer_id or auth.uid() = seller_id);

drop policy if exists "Buyers can send inquiries" on public.loop_inquiries;
drop policy if exists "Participants can send pickup messages" on public.loop_inquiries;
create policy "Participants can send pickup messages" on public.loop_inquiries for insert to authenticated with check (
  auth.uid() = sender_id and buyer_id <> seller_id and
  exists (select 1 from public.loop_requests r where r.listing_id = loop_inquiries.listing_id
    and r.buyer_id = loop_inquiries.buyer_id and r.seller_id = loop_inquiries.seller_id and r.status = 'accepted')
);

create or replace function public.request_loop_item(p_listing_id uuid, p_message text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_seller uuid;
  new_request_id uuid;
begin
  if auth.uid() is null or char_length(trim(p_message)) not between 1 and 1500 then
    raise exception 'Sign in and include a short message with your request.';
  end if;
  update public.loop_listings
     set sale_status = 'requested', request_buyer_id = auth.uid()
   where id = p_listing_id and sale_status = 'available' and seller_id <> auth.uid()
   returning seller_id into current_seller;
  if not found then return null; end if;
  insert into public.loop_requests(listing_id, buyer_id, seller_id, message)
    values (p_listing_id, auth.uid(), current_seller, trim(p_message)) returning id into new_request_id;
  return new_request_id;
end;
$$;
revoke all on function public.request_loop_item(uuid, text) from public, anon;
grant execute on function public.request_loop_item(uuid, text) to authenticated;

create or replace function public.respond_loop_request(p_request_id uuid, p_available boolean)
returns public.loop_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  current_request public.loop_requests;
begin
  update public.loop_requests
     set status = case when p_available then 'accepted' else 'unavailable' end
   where id = p_request_id and seller_id = auth.uid() and status = 'pending'
   returning * into current_request;
  if not found then return null; end if;
  update public.loop_listings
     set sale_status = case when p_available then 'reserved' else 'unavailable' end
   where id = current_request.listing_id and request_buyer_id = current_request.buyer_id;
  return current_request;
end;
$$;
revoke all on function public.respond_loop_request(uuid, boolean) from public, anon;
grant execute on function public.respond_loop_request(uuid, boolean) to authenticated;

-- Preserve any scheduled pickups that were already claimed before this flow.
update public.loop_listings
   set sale_status = 'reserved', request_buyer_id = pickup_claimed_by
 where pickup_claimed_by is not null and sale_status = 'available';
insert into public.loop_requests(listing_id, buyer_id, seller_id, message, status)
select id, pickup_claimed_by, seller_id, 'Existing scheduled pickup reservation', 'accepted'
  from public.loop_listings where pickup_claimed_by is not null
on conflict (listing_id) do nothing;

alter publication supabase_realtime add table public.loop_requests;
