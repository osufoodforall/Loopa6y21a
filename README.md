# Loop

Independent student reuse marketplace demo. This project is separate from the Food for All platform.

## Features

- Create and edit listings with **Name**, **Price**, **Description**, and **Distance from campus center**; category is an additional optional browsing field.
- Search listings, filter by category, sort by campus distance, like items to show interest, message sellers privately, claim pickup slots, and manage your own listings.
- Listings, likes, private buyer inquiries, and scheduled pickup reservations are shared through Supabase. Visitors use accountless anonymous sign-in.
- Email opt-in posts to FormSubmit at `oliverlsantini@gmail.com`.

## Email activation

FormSubmit is a free, no-server form relay. The first submission triggers an activation message to the destination inbox. Open that message and activate the form before signups can be delivered. FormSubmit receives the submitted email and the request metadata; avoid collecting sensitive information. For production use, publish a privacy notice and consider a dedicated mailing-list service with unsubscribe management.

## Publish

The app is static HTML and runs on GitHub Pages with no build step. Enable Pages from the `master` branch and repository root. The Supabase publishable key lives in `config.js`; it is safe for browser use only while row-level security stays enabled. Never put a Supabase secret or service-role key in this repository.

Run `supabase-schema.sql` in the Supabase SQL Editor to create the tables, row-level security policies, atomic first-come pickup claim function, and Realtime publication entries. In Supabase Authentication settings, enable anonymous sign-ins so visitors can list items, like, message, and reserve pickups.
