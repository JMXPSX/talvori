# UI Registry

> **Adapted to Expo / React Native.** Catalog of reusable primitives in `components/ui/`,
> exported from the barrel `@/components/ui`. **Check here before building a new component** —
> reuse an existing primitive rather than introducing a variant. **Update this file after every
> new primitive is built.** (Design system: **Talvori** — see `ui-tokens.md`.)

## How to use

```ts
import { Button, Card, Text, CurrencyField } from '@/components/ui';
```

All primitives consume `components/theme.ts` tokens, so the whole app reskins from there.
Screens compose these primitives — they don't restyle from scratch.

## Components

| Component | File | Purpose | Key exports |
|-----------|------|---------|-------------|
| `Text` | `Text.tsx` | Typographic text; `variant` selects a `typography` token; script-aware via `lib/fonts.ts` | `TextProps` |
| `Screen` | `Screen.tsx` | Page canvas (background token, safe areas, scroll) | `ScreenProps` |
| `Button` | `Button.tsx` | Actions; `variant` = primary / secondary / ghost | `ButtonProps`, `ButtonVariant` |
| `TextField` | `TextField.tsx` | Text input; field-fill, focus, web focus ring | `TextFieldProps` |
| `CurrencyField` | `CurrencyField.tsx` | Money input in major units; converts at boundary via `lib/money.ts` | `CurrencyFieldProps` |
| `Card` | `Card.tsx` | Borderless white bento tile, ambient shadow | `CardProps` |
| `EmptyState` | `EmptyState.tsx` | Empty-list placeholder + single action | `EmptyStateProps` |
| `Donut` | `Donut.tsx` | Category spending donut; colored by `chartSeries` | `DonutProps`, `DonutSegment` |
| `ProgressBar` | `ProgressBar.tsx` | Budget/goal meter; `ProgressState` drives color | `ProgressBarProps`, `ProgressState` |
| `ProgressRing` | `ProgressRing.tsx` | Circular progress (goals) | `ProgressRingProps` |
| `Chip` | `Chip.tsx` | Pill for filters/tags/status (premium pill, coupon match) | `ChipProps` |
| `ListRow` | `ListRow.tsx` | Tappable row: title / supporting / trailing value | `ListRowProps` |
| `ActionSheet` | `ActionSheet.tsx` | Confirm/menu sheet; **the `Alert.alert` replacement** (native Alert on iOS/Android, token-styled modal on web) | `useActionSheet`, `ActionSheetDialog`, `ActionSheetAction`, `ActionSheetOptions` |
| `ErrorNotice` | `ErrorNotice.tsx` | Renders a normalized `AppError` with optional retry | `ErrorNoticeProps` |
| `SideNav` | `SideNav.tsx` | Web/desktop side navigation | `SideNav`, `SIDEBAR_WIDTH`, `SideNavProps`, `SideNavItem` |
| `BottomTabBar` | `BottomTabBar.tsx` | Native bottom tab bar | `BottomTabBarProps` |
| `Bento` | `Bento.tsx` | Tiled layout + width caps | `BentoRow`, `BentoPage`, `CONTENT_MAX_WIDTH`, `FORM_MAX_WIDTH`, `BentoRowProps`, `BentoPageProps` |

## Conventions

- Use `useActionSheet` for **every** confirm/destructive action; render `sheet.element`.
- Money is displayed via `Text variant="moneyMin"` (or larger) with tabular figures.
- New primitives: add the file to `components/ui/`, export from `components/ui/index.ts`, and
  add a row here in the same change.
