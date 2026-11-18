-- Loop demo schema for Supabase. Run in SQL Editor after reviewing.
create extension if not exists pgcrypto;

create table if not exists public.loop_listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 90),
  price numeric(10,2) not null check (price >= 0),
  description text not null check (char_length(description) between 1 and 500),
  distance_miles numeric(6,2) not null check (distance_miles >= 0),
  category text not null default 'Other',
  pickup_at timestamptz,
  pickup_claimed_by uuid references auth.users(id),
  pickup_claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((pickup_claimed_by is null) = (pickup_claimed_at is null))
);

create table if not exists public.loop_listing_likes (
  listing_id uuid not null references public.loop_listings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (listing_id, user_id)
);

create table if not exists public.loop_inquiries (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.loop_listings(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  seller_id uuid not null references auth.users(id) on delete cascade,
  message text not null check (char_length(message) between 1 and 1500),
  created_at timestamptz not null default now()
);

alter table public.loop_listings enable row level security;
alter table public.loop_listing_likes enable row level security;
alter table public.loop_inquiries enable row level security;

create policy "Listings are visible to everyone" on public.loop_listings for select using (true);
create policy "Signed-in users can post listings" on public.loop_listings for insert to authenticated with check (auth.uid() = seller_id);
create policy "Sellers can edit their listings" on public.loop_listings for update to authenticated using (auth.uid() = seller_id) with check (auth.uid() = seller_id);
create policy "Sellers can remove their listings" on public.loop_listings for delete to authenticated using (auth.uid() = seller_id);

create policy "Like counts and own likes are visible" on public.loop_listing_likes for select to authenticated using (true);
create policy "Users can like as themselves" on public.loop_listing_likes for insert to authenticated with check (auth.uid() = user_id);
create policy "Users can remove their own likes" on public.loop_listing_likes for delete to authenticated using (auth.uid() = user_id);

create policy "Buyers and sellers can read inquiries" on public.loop_inquiries for select to authenticated using (auth.uid() = buyer_id or auth.uid() = seller_id);
create policy "Buyers can send inquiries" on public.loop_inquiries for insert to authenticated with check (auth.uid() = buyer_id and buyer_id <> seller_id);

-- Atomic claim: only one buyer can claim a scheduled pickup. The conditional
-- update succeeds for the first request; later requests receive no row.
create or replace function public.claim_loop_pickup(p_listing_id uuid)
returns public.loop_listings
language plpgsql
security definer
set search_path = public
as $$
declare claimed public.loop_listings;
begin
  update public.loop_listings
     set pickup_claimed_by = auth.uid(), pickup_claimed_at = now(), updated_at = now()
   where id = p_listing_id
     and seller_id <> auth.uid()
     and pickup_at is not null
     and pickup_at > now()
     and pickup_claimed_by is null
  returning * into claimed;
  return claimed;
end;
$$;
grant execute on function public.claim_loop_pickup(uuid) to authenticated;
revoke execute on function public.claim_loop_pickup(uuid) from public, anon;

create index if not exists loop_listings_created_at_idx on public.loop_listings(created_at desc);
create index if not exists loop_listings_pickup_at_idx on public.loop_listings(pickup_at) where pickup_at is not null;
