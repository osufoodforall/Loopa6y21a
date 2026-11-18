# Loop

Independent student reuse marketplace demo. This project is separate from the Food for All platform.

## Features

- Create and edit listings with **Name**, **Price**, **Description**, and **Distance from campus center**; category is an additional optional browsing field.
- Search listings, filter by category, sort by campus distance, save favorites, and remove your own listings.
- Listings and favorites persist in the current browser with local storage.
- Email opt-in posts to FormSubmit at `oliverlsantini@gmail.com`.

## Email activation

FormSubmit is a free, no-server form relay. The first submission triggers an activation message to the destination inbox. Open that message and activate the form before signups can be delivered. FormSubmit receives the submitted email and the request metadata; avoid collecting sensitive information. For production use, publish a privacy notice and consider a dedicated mailing-list service with unsubscribe management.

## Publish

The app is static HTML and can run on GitHub Pages with no build step. Set the repository's Pages source to the root directory containing `index.html`.
