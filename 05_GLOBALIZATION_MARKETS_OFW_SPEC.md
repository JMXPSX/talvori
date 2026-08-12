# Globalization, Markets & Cross-Border Household Specification

## Global Product
This is not a U.S.-only app.

Country, currency, language, timezone, retailer, tax assumptions, date formats, and text direction must not be hard-coded.

## Initial Priority Markets

### Core
- United States
- Canada
- Philippines
- United Kingdom
- Australia
- Singapore
- New Zealand

### GCC / Middle East
- Saudi Arabia
- United Arab Emirates
- Qatar
- Kuwait
- Bahrain
- Oman

Retail price coverage can be beta or partial by country while the finance/household platform is available.

## Localization
Prepare from Day 1 for:
- English
- Filipino / Tagalog
- Arabic

Additional languages later.

Use locale keys, not hard-coded UI strings.

Example:

Use:
` t('budget.remaining') `

Do not hard-code:
`Budget Remaining`

## RTL
Arabic requires real RTL readiness.

Components and layouts must not assume left-to-right only.

## User Locale Model
Potential profile/settings fields:
- country_code
- locale
- language
- currency_code
- timezone

## OFW / Expat / Cross-Border Households
One household may have members in different countries.

Example:
- Member A: Saudi Arabia / SAR
- Member B: Philippines / PHP
- Household reporting currency: PHP

Potential cross-border features:
- host-country income
- home-country expenses
- remittance tracking
- money sent home
- money received
- FX history
- cross-border savings goals
- household reporting in chosen currency

Do not brand the whole application only for OFWs. The architecture should serve migrants and international families globally.

Potential onboarding question:

`Do members of your household live in different countries?`

If yes, activate cross-border-oriented UX.

## Subscription Pricing
Subscription pricing must support regional/local currencies.

Do not expose only `$4.99` globally.

Use platform regional pricing for iOS/Android and appropriate web billing/local currencies.

Do not mechanically use simple FX conversion as the only regional pricing strategy; allow purchasing-power/local-market pricing later.
