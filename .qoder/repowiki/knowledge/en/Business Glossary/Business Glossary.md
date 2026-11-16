---
kind: business_term
name: Business Glossary
category: business_term
scope:
    - '**'
---

### department
- Definition：Top-level category in the product taxonomy, stored as a self-referencing `categories` row whose `parent_id` is null; on edit screens it is displayed read-only and auto-populated from the embedded parent category returned by the PostgREST query.
- Aliases：dept、parent category

### reseller
- Definition：A seller/vendor who operates a storefront within the Zebish marketplace; has a dedicated dashboard under `/reseller/dashboard` with sections for listings, orders, reviews, payouts/wallet, analytics, and settings.
- Aliases：seller、store owner

### listing
- Definition：A product entry created and managed by a reseller in the reseller dashboard; supports variants/options and is persisted via the `create_product_with_variants` / `update_product_with_changes` RPCs.
- Aliases：product listing、product

### draft
- Definition：A product/listing lifecycle state indicating an incomplete or unpublished listing; backed by a database migration allowing inactive status and a backfill from draft to inactive.
- Aliases：draft listing

### payout
- Definition：A commission payout processed for a reseller, tracked in the wallet module with associated receipts and verification workflows.
- Aliases：commission payout
