# Product Discovery

<cite>
**Referenced Files in This Document**
- [page.tsx](file://app/shop/page.tsx)
- [CollectionPage.tsx](file://components/CollectionPage.tsx)
- [FiltersDrawer.tsx](file://components/FiltersDrawer.tsx)
- [SearchModal.tsx](file://components/SearchModal.tsx)
- [ProductCard.tsx](file://components/ProductCard.tsx)
- [types.ts](file://types.ts)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)

## Introduction
This document explains the product discovery system for the Zebaish storefront, focusing on the shop page architecture, category navigation, collection browsing, advanced filtering, search modal behavior, product card presentation, and responsive grid layout strategies. The goal is to make the implementation clear for both technical and non-technical readers while providing precise references to source files.

## Project Structure
The product discovery flow centers around a Next.js client-side shop route that composes reusable UI components:
- Shop route orchestrates URL-based category and brand selection and wires up global cart/wishlist actions.
- CollectionPage renders the product listing toolbar, filters, sorting, grid layout, and infinite scroll.
- FiltersDrawer provides an advanced filter panel with accordion sections for brands, fabrics, price range, sizes, ratings, and more.
- SearchModal offers a full-screen search experience with real-time results and popular suggestions.
- ProductCard displays product visuals, pricing, badges, quick actions, and reseller information.
- types.ts defines shared data models including Product and FilterOptions.

```mermaid
graph TB
ShopRoute["Shop Route<br/>app/shop/page.tsx"] --> CollectionPage["Collection Page<br/>components/CollectionPage.tsx"]
CollectionPage --> FiltersDrawer["Filters Drawer<br/>components/FiltersDrawer.tsx"]
CollectionPage --> ProductCard["Product Card<br/>components/ProductCard.tsx"]
NavbarOrHeader["Global Header / Nav<br/>(external)"] --> SearchModal["Search Modal<br/>components/SearchModal.tsx"]
SearchModal --> ProductCard
Types["Shared Types<br/>types.ts"] --> CollectionPage
Types --> FiltersDrawer
Types --> ProductCard
```

**Diagram sources**
- [page.tsx:10-61](file://app/shop/page.tsx#L10-L61)
- [CollectionPage.tsx:10-22](file://components/CollectionPage.tsx#L10-L22)
- [FiltersDrawer.tsx:7-14](file://components/FiltersDrawer.tsx#L7-L14)
- [SearchModal.tsx:6-10](file://components/SearchModal.tsx#L6-L10)
- [ProductCard.tsx:7-16](file://components/ProductCard.tsx#L7-L16)
- [types.ts:15-65](file://types.ts#L15-L65)
- [types.ts:226-239](file://types.ts#L226-L239)

**Section sources**
- [page.tsx:10-61](file://app/shop/page.tsx#L10-L61)
- [CollectionPage.tsx:10-22](file://components/CollectionPage.tsx#L10-L22)
- [FiltersDrawer.tsx:7-14](file://components/FiltersDrawer.tsx#L7-L14)
- [SearchModal.tsx:6-10](file://components/SearchModal.tsx#L6-L10)
- [ProductCard.tsx:7-16](file://components/ProductCard.tsx#L7-L16)
- [types.ts:15-65](file://types.ts#L15-L65)
- [types.ts:226-239](file://types.ts#L226-L239)

## Core Components
- Shop Route: Reads query parameters for category and brand, maps them into props for CollectionPage, and handles navigation to product pages and reseller stores. It also updates URL state when selecting a brand.
- CollectionPage: Manages local filter state, sorting, grid columns, active filter chips, and infinite scroll. It fetches paginated products via a query hook and aggregates results for continuous loading.
- FiltersDrawer: Provides accordion-style filter sections (brand, fabric, price range, size, rating), with apply/clear actions and local state synced to parent filters.
- SearchModal: Implements a modal overlay with a text input, real-time filtering across title/category/fabric, and popular search suggestions. Selecting a result navigates to the product detail.
- ProductCard: Renders product image(s), hover effects, discount/badge logic, quick view/add-to-cart/wishlist actions, price display, reseller link, and rating/review count.

**Section sources**
- [page.tsx:10-61](file://app/shop/page.tsx#L10-L61)
- [CollectionPage.tsx:24-101](file://components/CollectionPage.tsx#L24-L101)
- [FiltersDrawer.tsx:49-108](file://components/FiltersDrawer.tsx#L49-L108)
- [SearchModal.tsx:12-28](file://components/SearchModal.tsx#L12-L28)
- [ProductCard.tsx:18-87](file://components/ProductCard.tsx#L18-L87)

## Architecture Overview
The product discovery architecture follows a unidirectional data flow:
- User interactions (filters, sort, grid columns, search) update local state or URL params.
- CollectionPage composes these states into query parameters and triggers data fetching.
- Results are aggregated for infinite scroll and rendered as ProductCard instances.
- Global actions (quick view, add to cart, wishlist toggle) are lifted to the app context and passed down as callbacks.

```mermaid
sequenceDiagram
participant User as "User"
participant Shop as "Shop Route"
participant Coll as "CollectionPage"
participant FD as "FiltersDrawer"
participant SM as "SearchModal"
participant PC as "ProductCard"
User->>Shop : Visit /shop?category=...&brand=...
Shop->>Coll : Render with categoryTitle & brandFilter
User->>FD : Open filters, adjust options
FD-->>Coll : Apply filters (brands, fabrics, price, size, rating)
Coll->>Coll : Update filters, reset page, re-fetch
User->>SM : Open search, type query
SM-->>SM : Real-time filter by title/category/fabric
SM-->>PC : Select product -> navigate to product page
User->>PC : Hover -> Quick View / Add to Bag
PC-->>Shop : Callbacks propagate to app context
```

**Diagram sources**
- [page.tsx:10-61](file://app/shop/page.tsx#L10-L61)
- [CollectionPage.tsx:24-101](file://components/CollectionPage.tsx#L24-L101)
- [FiltersDrawer.tsx:49-108](file://components/FiltersDrawer.tsx#L49-L108)
- [SearchModal.tsx:12-28](file://components/SearchModal.tsx#L12-L28)
- [ProductCard.tsx:18-87](file://components/ProductCard.tsx#L18-L87)

## Detailed Component Analysis

### Shop Page Architecture and Category Navigation
- Query-driven category and brand selection:
  - Reads `category` and `brand` from URL search params.
  - Defaults to a broad category if none provided.
  - Updates URL when selecting a brand, ensuring shareable links and back-button support.
- Navigation handlers:
  - Product selection routes to `/product/[id]`.
  - Reseller selection formats store slug and navigates to the reseller storefront.
  - Home navigation resets to root.

```mermaid
flowchart TD
Start(["Visit /shop"]) --> ReadParams["Read 'category' and 'brand' from URL"]
ReadParams --> DefaultCategory{"Brand present?"}
DefaultCategory --> |Yes| SetBrand["Set brandFilter prop"]
DefaultCategory --> |No| SetAll["Use default category"]
SetBrand --> RenderColl["Render CollectionPage"]
SetAll --> RenderColl
RenderColl --> HandleSelectProduct["Navigate to product detail"]
RenderColl --> HandleSelectReseller["Navigate to reseller store"]
RenderColl --> HandleSelectBrand["Update URL with brand + category"]
```

**Diagram sources**
- [page.tsx:10-47](file://app/shop/page.tsx#L10-L47)
- [page.tsx:49-61](file://app/shop/page.tsx#L49-L61)

**Section sources**
- [page.tsx:10-61](file://app/shop/page.tsx#L10-L61)

### Collection Browsing and Infinite Scroll
- State management:
  - Local state tracks accumulated products, current page, filters, sort order, and grid column count.
  - Brand filter prop syncs into local filters.
- Data fetching:
  - Uses a query hook to fetch paginated products with stale caching.
  - Aggregates new pages without duplicates for seamless infinite scroll.
- Sorting and grid:
  - Sort options include featured, newest, price ascending/descending, best discount, and most popular.
  - Grid switcher supports 2, 3, or 4 columns with responsive defaults.
- Active filters:
  - Displays removable chips for each active filter dimension.
  - Provides a “Clear All” action to reset filters.

```mermaid
flowchart TD
Init["Initialize state<br/>filters, sortBy, gridCols, page"] --> Fetch["Query products with params"]
Fetch --> Aggregate["Aggregate products (no duplicates)"]
Aggregate --> Display["Render product grid"]
Display --> ScrollCheck{"Near bottom?"}
ScrollCheck --> |Yes| LoadMore["Increment page and fetch next batch"]
ScrollCheck --> |No| Idle["Idle"]
LoadMore --> Aggregate
UserFilter["Apply filters/sort"] --> ResetPage["Reset page and accumulatedProducts"]
ResetPage --> Fetch
```

**Diagram sources**
- [CollectionPage.tsx:24-101](file://components/CollectionPage.tsx#L24-L101)
- [CollectionPage.tsx:107-121](file://components/CollectionPage.tsx#L107-L121)
- [CollectionPage.tsx:126-131](file://components/CollectionPage.tsx#L126-L131)
- [CollectionPage.tsx:439-512](file://components/CollectionPage.tsx#L439-L512)
- [CollectionPage.tsx:657-677](file://components/CollectionPage.tsx#L657-L677)

**Section sources**
- [CollectionPage.tsx:24-101](file://components/CollectionPage.tsx#L24-L101)
- [CollectionPage.tsx:107-121](file://components/CollectionPage.tsx#L107-L121)
- [CollectionPage.tsx:126-131](file://components/CollectionPage.tsx#L126-L131)
- [CollectionPage.tsx:439-512](file://components/CollectionPage.tsx#L439-L512)
- [CollectionPage.tsx:657-677](file://components/CollectionPage.tsx#L657-L677)

### Advanced Filtering System
- Filter dimensions supported:
  - Brands: multi-select checkboxes.
  - Fabrics: multi-select checkboxes.
  - Price Range: slider controlling upper bound with formatted currency labels.
  - Size: multi-select buttons.
  - Reseller Rating: minimum star threshold selection.
  - Additional fields exist in FilterOptions (stitching statuses, piece counts, colors, occasions, discount ranges, stock availability, categories).
- Interaction model:
  - Accordion sections expand/collapse.
  - Local state mirrors parent filters until Apply is clicked.
  - Clear All resets all filter fields to defaults.
- Integration:
  - Parent component receives updated filters and recomputes queries.

```mermaid
classDiagram
class FiltersDrawer {
+boolean isOpen
+FilterOptions filters
+onApplyFilters(newFilters)
+onClearFilters()
-toggleSection(section)
-toggleArrayFilter(key, value)
-handleApply()
-handleClear()
}
class FilterOptions {
+string[] brands
+string[] stitchingStatuses
+string[] pieceCounts
+string[] fabrics
+string[] colors
+string[] occasions
+string[] sizes
+[number,number] priceRange
+string[] discountRanges
+number minResellerRating
+boolean inStockOnly
+string[] categories
}
FiltersDrawer --> FilterOptions : "uses"
```

**Diagram sources**
- [FiltersDrawer.tsx:7-14](file://components/FiltersDrawer.tsx#L7-L14)
- [FiltersDrawer.tsx:49-108](file://components/FiltersDrawer.tsx#L49-L108)
- [types.ts:226-239](file://types.ts#L226-L239)

**Section sources**
- [FiltersDrawer.tsx:49-108](file://components/FiltersDrawer.tsx#L49-L108)
- [types.ts:226-239](file://types.ts#L226-L239)

### Search Modal Implementation
- Behavior:
  - Full-screen modal with backdrop blur and close-on-backdrop click.
  - Auto-focused input field.
  - Real-time filtering over a combined product set based on title, category, and fabric.
  - Popular searches displayed when input is empty; clicking a suggestion populates the query.
  - Result items show thumbnail, category, title, and price; clicking selects the product and closes the modal.
- Integration:
  - Accepts onSelectProduct callback to navigate to product details.

```mermaid
sequenceDiagram
participant User as "User"
participant SM as "SearchModal"
participant App as "App Context"
User->>SM : Open modal
User->>SM : Type query
SM->>SM : Filter products by title/category/fabric
alt No results
SM-->>User : Show "No products found" message
else Results exist
SM-->>User : Display result cards
User->>SM : Click result
SM-->>App : onSelectProduct(product)
SM-->>User : Close modal
end
```

**Diagram sources**
- [SearchModal.tsx:12-28](file://components/SearchModal.tsx#L12-L28)
- [SearchModal.tsx:30-57](file://components/SearchModal.tsx#L30-L57)
- [SearchModal.tsx:59-114](file://components/SearchModal.tsx#L59-L114)

**Section sources**
- [SearchModal.tsx:12-28](file://components/SearchModal.tsx#L12-L28)
- [SearchModal.tsx:30-57](file://components/SearchModal.tsx#L30-L57)
- [SearchModal.tsx:59-114](file://components/SearchModal.tsx#L59-L114)

### Product Card Component
- Visuals:
  - Aspect-ratio image container with optional hover image overlay.
  - Single clean badge pill showing either discount percentage or a custom badge (deduplicated to avoid overlap).
  - Wishlist button toggles state and visual indicator.
- Actions:
  - Desktop hover overlay exposes Quick View and Add to Bag.
  - Mobile floating Add to Bag icon for quick access.
  - Clicking image or title navigates to product detail unless overridden by onSelectProduct.
- Pricing and metadata:
  - Computes surplus selling price and retail price to determine discount display.
  - Shows currency-formatted prices with strikethrough for original retail when discounted.
  - Displays reseller name with clickable link to reseller store.
  - Shows average rating and review count.

```mermaid
flowchart TD
Enter["Render ProductCard"] --> ComputePrices["Compute surplusPrice & retailPrice"]
ComputePrices --> BadgeLogic["Determine single badge (discount vs custom)"]
BadgeLogic --> RenderImage["Render image + hover image"]
RenderImage --> RenderActions["Render wishlist + quick actions"]
RenderActions --> RenderMeta["Render brand, title, price, reseller, rating"]
RenderMeta --> Interact{"User interaction"}
Interact --> |Click Image| Navigate["Navigate to product detail"]
Interact --> |Hover Desktop| Overlay["Show Quick View / Add to Bag"]
Interact --> |Mobile Add| Cart["Add to cart"]
Interact --> |Wishlist| Toggle["Toggle wishlist"]
```

**Diagram sources**
- [ProductCard.tsx:18-87](file://components/ProductCard.tsx#L18-L87)
- [ProductCard.tsx:89-195](file://components/ProductCard.tsx#L89-L195)
- [ProductCard.tsx:197-267](file://components/ProductCard.tsx#L197-L267)

**Section sources**
- [ProductCard.tsx:18-87](file://components/ProductCard.tsx#L18-L87)
- [ProductCard.tsx:89-195](file://components/ProductCard.tsx#L89-L195)
- [ProductCard.tsx:197-267](file://components/ProductCard.tsx#L197-L267)

### Responsive Grid Layout and Mobile Optimization
- Grid configuration:
  - Controlled by gridCols state with values 2, 3, or 4.
  - Tailwind classes map to responsive breakpoints:
    - 2 columns on small screens.
    - 3 columns on medium screens.
    - 4 columns on large screens.
- Toolbar responsiveness:
  - Filter button adapts sizing across breakpoints.
  - Grid switcher hidden on mobile; sort dropdown remains accessible.
- Product card optimizations:
  - Lazy loading images except for priority items.
  - Fallback placeholder image on load errors.
  - Mobile-specific floating Add to Bag button.
  - Compact typography and spacing for smaller screens.

```mermaid
flowchart TD
Config["gridCols state"] --> MapClasses["Map to Tailwind grid classes"]
MapClasses --> Small["Small: 2 columns"]
MapClasses --> Medium["Medium: 3 columns"]
MapClasses --> Large["Large: 4 columns"]
Small --> Cards["Render ProductCards"]
Medium --> Cards
Large --> Cards
Cards --> MobileOpt["Mobile optimizations:<br/>lazy images, fallbacks, floating add button"]
```

**Diagram sources**
- [CollectionPage.tsx:38-39](file://components/CollectionPage.tsx#L38-L39)
- [CollectionPage.tsx:351-437](file://components/CollectionPage.tsx#L351-L437)
- [CollectionPage.tsx:657-677](file://components/CollectionPage.tsx#L657-L677)
- [ProductCard.tsx:96-120](file://components/ProductCard.tsx#L96-L120)
- [ProductCard.tsx:182-194](file://components/ProductCard.tsx#L182-L194)

**Section sources**
- [CollectionPage.tsx:38-39](file://components/CollectionPage.tsx#L38-L39)
- [CollectionPage.tsx:351-437](file://components/CollectionPage.tsx#L351-L437)
- [CollectionPage.tsx:657-677](file://components/CollectionPage.tsx#L657-L677)
- [ProductCard.tsx:96-120](file://components/ProductCard.tsx#L96-L120)
- [ProductCard.tsx:182-194](file://components/ProductCard.tsx#L182-L194)

## Dependency Analysis
- Component coupling:
  - Shop Route depends on CollectionPage and global app context for cart/wishlist.
  - CollectionPage depends on FiltersDrawer, ProductCard, and query hooks for data.
  - FiltersDrawer depends on FilterOptions type and provides filtered state to parent.
  - SearchModal depends on product data and invokes onSelectProduct callback.
  - ProductCard depends on Product type and seller service utilities for slug formatting.
- External integrations:
  - Query hooks fetch paginated products and manage caching.
  - Seller service utility formats store slugs for navigation.

```mermaid
graph LR
ShopRoute["Shop Route"] --> CollectionPage
CollectionPage --> FiltersDrawer
CollectionPage --> ProductCard
CollectionPage --> QueryHooks["useCollectionProductsQuery"]
SearchModal --> ProductCard
ProductCard --> SellerService["formatStoreSlug"]
Types["types.ts"] --> CollectionPage
Types --> FiltersDrawer
Types --> ProductCard
```

**Diagram sources**
- [page.tsx:10-61](file://app/shop/page.tsx#L10-L61)
- [CollectionPage.tsx:1-8](file://components/CollectionPage.tsx#L1-L8)
- [FiltersDrawer.tsx:1-4](file://components/FiltersDrawer.tsx#L1-L4)
- [SearchModal.tsx:1-4](file://components/SearchModal.tsx#L1-L4)
- [ProductCard.tsx:1-5](file://components/ProductCard.tsx#L1-L5)
- [types.ts:15-65](file://types.ts#L15-L65)
- [types.ts:226-239](file://types.ts#L226-L239)

**Section sources**
- [page.tsx:10-61](file://app/shop/page.tsx#L10-L61)
- [CollectionPage.tsx:1-8](file://components/CollectionPage.tsx#L1-L8)
- [FiltersDrawer.tsx:1-4](file://components/FiltersDrawer.tsx#L1-L4)
- [SearchModal.tsx:1-4](file://components/SearchModal.tsx#L1-L4)
- [ProductCard.tsx:1-5](file://components/ProductCard.tsx#L1-L5)
- [types.ts:15-65](file://types.ts#L15-L65)
- [types.ts:226-239](file://types.ts#L226-L239)

## Performance Considerations
- Infinite scroll:
  - Accumulates products without duplicates using a Set of IDs to ensure O(1) lookup during aggregation.
  - Debounces scroll events implicitly via passive listeners and checks isLoading/isFetching flags to prevent redundant requests.
- Caching:
  - Query results use staleTime to reduce network calls and improve perceived performance.
- Rendering efficiency:
  - ProductCard uses React.memo to minimize re-renders when props do not change.
  - Wishlist lookups use a precomputed Set for O(1) membership checks.
- Image optimization:
  - Lazy loading for non-priority images and fallback placeholders reduce initial payload and improve LCP.
- Responsive design:
  - Tailwind utility classes provide efficient responsive layouts without heavy media queries.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
- Empty product listings:
  - Verify filter combinations are not too restrictive; use “Clear All” or “Reset All Filters”.
  - Check that categoryTitle and brandFilter props are correctly passed from the shop route.
- Infinite scroll not loading more:
  - Ensure hasMore flag is true and that isLoading/isFetching are not blocking further requests.
  - Confirm window scroll thresholds and event listener registration.
- Search modal not returning results:
  - Validate that product data includes title, category, and fabric fields.
  - Ensure onSelectProduct callback is wired to navigate to product detail.
- Incorrect pricing or badge display:
  - Confirm surplus_selling_price and original_retail_price fields are populated.
  - Check discountPercentage calculation and badge deduplication logic.

**Section sources**
- [CollectionPage.tsx:616-654](file://components/CollectionPage.tsx#L616-L654)
- [CollectionPage.tsx:107-121](file://components/CollectionPage.tsx#L107-L121)
- [SearchModal.tsx:21-28](file://components/SearchModal.tsx#L21-L28)
- [ProductCard.tsx:38-87](file://components/ProductCard.tsx#L38-L87)

## Conclusion
The Zebaish product discovery system combines a robust shop route, a flexible collection browsing interface, an advanced filter drawer, a real-time search modal, and a rich product card component. It leverages responsive grid layouts, infinite scroll, and efficient state management to deliver a performant and user-friendly shopping experience. By adhering to the documented patterns and leveraging the referenced components, developers can extend and maintain the discovery features effectively.

[No sources needed since this section summarizes without analyzing specific files]