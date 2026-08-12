# Retail Price, Branch, Coupon & Shopping Intelligence Specification

This is a signature long-term product capability.

## Core Requirement
Retail pricing must be **store/branch/address-specific** whenever the authorized data source supports it.

Do not model price only as:
`Walmart = $X`

The same retailer can have different prices at different branches.

## Required Hierarchy

`Country -> Region -> Retailer -> Store/Branch -> Product/Variant -> Price Snapshot`

## Store / Branch Model
Each physical store should support fields such as:
- retailer_store_id
- retailer_id
- store name
- street address
- city
- region/state/province
- postal code
- country
- latitude/longitude when appropriate
- currency
- physical/online capability
- timezone if relevant

## User Location Features
Users must be able to:
- use current location with permission
- manually enter address
- search by postal/ZIP code
- select a specific branch
- save multiple shopping locations
- switch saved locations

Examples:
- Home
- Work
- Spouse
- Parents
- Family abroad
- Custom location

## Price Data
Where an authorized source provides it, capture:
- regular price
- sale/promotional price
- loyalty/member price
- coupon-adjusted price
- personalized offer when authorized
- quantity requirements
- limits
- online vs in-store price
- availability/inventory if available
- observed_at timestamp
- valid_until timestamp
- source/provider
- freshness status

## Price Language
Do not claim universal guaranteed checkout pricing unless the source truly provides authoritative real-time checkout pricing.

Prefer explicit labels:
- Current listed price
- Store-specific price
- Online price
- Member price
- Promotional price
- Last updated 12 minutes ago

## Coupon Engine — Core Requirement
Support:
1. Coupon discovery
2. Matching coupon to grocery/product
3. Expiration
4. Product eligibility
5. Quantity/minimum purchase requirements
6. Usage limits
7. Loyalty/member requirement
8. Expected savings
9. Expected final price
10. Coupon status
11. Retailer-specific limitations

## Coupon Integration Levels

### Level 1 — Discovery
Display authorized coupon/deal information.

### Level 2 — Deep Link
Open the retailer's authorized website/app page so the user can clip/activate the coupon.

### Level 3 — Native Authorized Integration
Allow clipping/activation inside our app only when an official API, OAuth/account-linking mechanism, partnership, or explicit permitted integration supports it.

Never fake coupon clipping.
Never bypass retailer account protections.
Never scrape private account-only functionality in violation of terms.

## Loyalty Accounts
Architecture should allow optional retailer loyalty connections later.

Possible examples:
- Kroger/Mariano's Rewards
- Jewel-Osco for U
- Target Circle
- international loyalty programs

Use authorized OAuth/account-linking where available.
Do not store retailer passwords insecurely.

## Product Matching
Never compare only by display name.

Normalize with available identifiers and attributes:
- GTIN
- UPC
- EAN
- brand
- product name
- size
- pack count
- unit
- variant

Different retailer SKUs should map to the same master product/variant when valid.

## Unit Pricing
Support normalized value comparison:
- per ounce
- per fl oz
- per gram
- per kg
- per liter
- per piece
- per pack unit

## Basket Optimization
Eventually support:
- normal basket total
- sale-adjusted total
- coupon-adjusted total
- loyalty-adjusted total
- expected checkout total
- cheapest single-store basket
- cheapest multi-store basket
- savings vs travel/distance tradeoff

Do not implement complex routing optimization in MVP unless explicitly approved.

## Retail Connector Pattern
Do not scatter retailer-specific calls across screens.

Define a standard connector interface conceptually like:

```ts
interface RetailerConnector {
  retailerId: string;
  searchProducts(input: ProductSearchInput): Promise<NormalizedProduct[]>;
  fetchPrice(input: PriceLookupInput): Promise<NormalizedPrice[]>;
  checkAvailability?(input: AvailabilityInput): Promise<AvailabilityResult[]>;
}
```

Possible adapters later:
- WalmartConnector
- KrogerConnector
- TescoConnector
- CarrefourConnector
- LuluConnector
- MerchantFeedConnector

## Backend Access Pattern
Do NOT call many retailer APIs directly from the phone/browser.

Use:

`Mobile/Web -> Our Price API/Edge Function -> normalized cache/database -> retailer connectors -> authorized external sources`

Benefits:
- secrets protected
- rate limits controlled
- normalized output
- caching
- data freshness monitoring
- legal/data-source governance

## Data Source Rule
Retail integrations must use authorized/legitimate sources such as:
- official API
- licensed feed
- partner integration
- permitted affiliate feed
- authorized third-party dataset
- merchant-provided data

Do not base the commercial product on unauthorized scraping.
