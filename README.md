# DormLoop

Independent student reuse marketplace demo. This project is separate from the Food for All platform.

## Features

- Create and edit listings with **Name**, **Price**, **Description**, and **Distance from campus center**; category is an additional optional browsing field.
- Search listings, filter by category, sort by campus distance, and like items to show interest.
- Buyers request an item; the seller confirms availability to reserve it for that buyer or marks it unavailable to close and remove it from the marketplace.
- After confirmation, buyer and seller use a private conversation to arrange a public pickup location, time, and any price details. Only one request can reserve a listing.
- Listings, likes, requests, and messages are shared through Supabase. Visitors use accountless anonymous sign-in.
- Email opt-in posts to FormSubmit at `oliverlsantini@gmail.com`.

## Email activation

FormSubmit is a free, no-server form relay. The first submission triggers an activation message to the destination inbox. Open that message and activate the form before signups can be delivered. FormSubmit receives the submitted email and the request metadata; avoid collecting sensitive information. For production use, publish a privacy notice and consider a dedicated mailing-list service with unsubscribe management.

This is not per-student email verification, and the marketplace does not send transaction emails when an item is requested or reserved. Listing requests and pickup coordination happen inside the app through private Supabase messages.

## Publish

The app is static HTML and runs on GitHub Pages with no build step. Enable Pages from the `master` branch and repository root. The Supabase publishable key lives in `config.js`; it is safe for browser use only while row-level security stays enabled. Never put a Supabase secret or service-role key in this repository.

For a new project, run `supabase-schema.sql`, then `supabase-selling-flow-migration.sql`, then `supabase-listing-edit-migration.sql` in the Supabase SQL Editor. For the existing DormLoop project, run the selling-flow migration if it has not already been applied, followed by the listing-edit migration. The edit RPC keeps row ownership checks while allowing sellers to change only listing details. In Supabase Authentication settings, enable anonymous sign-ins so visitors can list, like, request, and message.

The request and seller response use database functions that update the listing and request together. This prevents two buyers from reserving the same item during simultaneous requests.
