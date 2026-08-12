# Claude Build Pack — Global Household Finance & Shopping Platform

## Purpose
This folder is the approved starting context for building a commercial global household finance, budgeting, shared shopping, retailer-price, coupon, and multi-currency application.

## IMPORTANT INSTRUCTION TO CLAUDE
Read the files in numerical order before generating production code.

Do **not** build the entire application in one pass.
Do **not** invent architecture as you go.
Do **not** silently change approved requirements.
Do **not** introduce microservices during MVP.

The owner/founder controls product requirements. A software consultant/developer will review technical decisions. Claude is an implementation accelerator, not the architecture authority.

## Approved Core Stack
- TypeScript
- React Native
- Expo
- Expo Router
- Supabase
- PostgreSQL
- Supabase Auth
- Supabase Realtime / Broadcast
- Supabase Edge Functions
- Supabase Storage where appropriate
- Git + GitHub
- EAS Build / Submit / Hosting where appropriate
- iOS + Android + Web/PWA from one primary codebase

## Read Order
1. `01_MASTER_PROJECT_CONTEXT.md`
2. `02_NON_NEGOTIABLE_ARCHITECTURE_RULES.md`
3. `03_SECURITY_AUTHENTICATION_SPEC.md`
4. `04_DATABASE_MONEY_MULTICURRENCY_SPEC.md`
5. `05_GLOBALIZATION_MARKETS_OFW_SPEC.md`
6. `06_RETAIL_PRICE_COUPON_ENGINE_SPEC.md`
7. `07_PRODUCT_MODULES_AND_MVP.md`
8. `08_DEVELOPMENT_PHASES.md`
9. `09_PHASE_1_CLAUDE_BUILD_PROMPT.md`
10. `10_DEVELOPER_REVIEW_AND_GIT_WORKFLOW.md`

## First Action After Reading
Start only with **Phase 1 — Technical Foundation** using `09_PHASE_1_CLAUDE_BUILD_PROMPT.md`.

Before writing any code, Claude must:
1. Show proposed folder structure.
2. Explain important architectural choices.
3. List files to be created/changed.
4. Identify contradictions or missing foundational requirements.
5. Wait only when a truly blocking technical choice cannot be safely inferred. Otherwise make the most conservative architecture-consistent choice and document it.

## Working Project Name
Use the internal codename:

**Global Household App**

Do not create final consumer branding, logos, trademarks, or production bundle identifiers based on an unapproved public name. Final naming requires trademark/legal clearance first.
