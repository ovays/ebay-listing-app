# ListForge AI - Agentic eBay Listing Automation Engine

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![React](https://img.shields.io/badge/React-19-087EA4)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E)
![eBay API](https://img.shields.io/badge/eBay-Sell%20Inventory%20API-E53238)

ListForge AI is a multi-agent listing automation system for creating, enriching, validating, and publishing eBay listings through an orchestrated workflow. The pipeline transforms scraped or imported product data into normalized listing records, applies classification and enrichment logic, resolves listing policies, builds eBay Inventory API payloads, and publishes listings through the required inventory item, offer, and publish sequence. State is persisted in Supabase so each listing can be recovered, retried, synchronized, or deleted without losing the publish context.

## Agent Architecture

| Agent | Purpose | Input | Output |
| --- | --- | --- | --- |
| Ingestion Agent | Collects product source data from scrape/import workflows and prepares it for validation. | Product URL, scraped HTML, imported product fields, image URLs. | Raw product record with title, description, price, category hints, and media references. |
| Classification Agent | Maps product data into eBay-oriented taxonomy and listing categories. | Raw product metadata, source category, title keywords. | Normalized category, eBay category ID, product type, and classification confidence signals. |
| Enrichment Agent | Expands sparse product data into complete listing attributes. | Classified product record, description, image set, known defaults. | Enriched listing draft with structured description, price, condition, SKU, and item specifics. |
| Policy Agent | Resolves listing policies required by eBay before offer creation. | Product draft, selected/default fulfillment policy, payment policy, return policy. | Policy set containing fulfillment, payment, and return policy IDs. |
| Listing Agent | Builds API-ready inventory and offer payloads. | Enriched listing draft, category, aspects, policies, location metadata. | eBay Inventory API payloads for inventory item and offer creation/update. |
| Publishing Agent | Executes the eBay publish sequence and handles publish-state transitions. | Inventory payload, offer payload, OAuth access token, persisted product state. | Published eBay listing, offer ID, inventory item ID, item ID, publish status. |
| Sync Agent | Reconciles local state with eBay state for retries and recovery. | Stored SKU, inventory item ID, offer ID, current Supabase publish status. | Verified inventory/offer/listing state and updated local publish metadata. |
| Deletion Agent | Removes or unpublishes listing records across eBay and local persistence boundaries. | Product record, SKU, offer/listing identifiers, auth context. | Deleted or reconciled eBay resource state and updated Supabase record. |

## Architecture Diagram

```text
Scraper
   |
   v
Classification
   |
   v
Enrichment
   |
   v
Policy
   |
   v
Listing
   |
   v
Publish
   |
   v
Sync
   |
   v
DB
```

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js App Router |
| Backend | Node.js API routes |
| Database | Supabase PostgreSQL |
| External APIs | eBay Sell Inventory API |

## Key Engineering Highlights

- OAuth 2.0 integration with token lifecycle handling and encrypted local token storage.
- Multi-step eBay listing pipeline: inventory item creation/update, offer creation/update, and offer publish.
- Policy-driven listing system for shipping, returns, and payment requirements.
- Dynamic aspect injection for item specifics such as type, brand, and category-derived attributes.
- Error handling and retry-aware state transitions for eBay API failures.
- Stateful persistence with Supabase for products, publish status, eBay IDs, and recovery paths.
- Modular agent-like architecture that separates ingestion, classification, enrichment, policy resolution, listing construction, publishing, sync, and deletion responsibilities.

## Project Structure

```text
.
+-- app
|   +-- api
|   |   +-- auth
|   |   |   +-- logout
|   |   |   +-- session
|   |   +-- delete
|   |   +-- ebay
|   |   |   +-- callback
|   |   |   +-- login
|   |   |   +-- publish
|   |   +-- export
|   |   +-- products
|   |   +-- save
|   |   +-- scrape
|   |   +-- update
|   +-- dashboard
|   +-- import
|   +-- products
|   +-- globals.css
|   +-- layout.tsx
|   +-- page.tsx
+-- lib
|   +-- auth
|   |   +-- session.ts
|   +-- ebay
|   |   +-- auth.ts
|   |   +-- oauth.ts
|   |   +-- token-store.ts
|   +-- app-url.ts
|   +-- product-validation.ts
|   +-- scraper.ts
|   +-- supabase.ts
+-- public
+-- package.json
+-- next.config.ts
+-- tsconfig.json
```

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` with the required runtime configuration:

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

EBAY_ENV=sandbox
EBAY_CLIENT_ID=
EBAY_CLIENT_SECRET=
EBAY_REDIRECT_URI=http://localhost:3000/api/ebay/callback
EBAY_SCOPE=
EBAY_TOKEN_ENCRYPTION_KEY=
AUTH_SESSION_SECRET=

EBAY_DEFAULT_FULFILLMENT_POLICY_ID=
EBAY_DEFAULT_PAYMENT_POLICY_ID=
EBAY_DEFAULT_RETURN_POLICY_ID=
EBAY_AU_MERCHANT_LOCATION_KEY=AU_DEFAULT_LOCATION
EBAY_AU_LOCATION_POSTAL_CODE=2000
```

3. Run the development server:

```bash
npm run dev
```

4. Open the app:

```text
http://localhost:3000
```

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Next.js development server. |
| `npm run build` | Build the application for production. |
| `npm run start` | Start the production server after a build. |
| `npm run lint` | Run ESLint. |
