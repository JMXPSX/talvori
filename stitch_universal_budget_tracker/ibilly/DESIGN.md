---
name: ibilly
colors:
  surface: '#f4fafd'
  surface-dim: '#d4dbdd'
  surface-bright: '#f4fafd'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eef5f7'
  surface-container: '#e8eff1'
  surface-container-high: '#e2e9ec'
  surface-container-highest: '#dde4e6'
  on-surface: '#161d1f'
  on-surface-variant: '#464555'
  inverse-surface: '#2b3234'
  inverse-on-surface: '#ebf2f4'
  outline: '#767586'
  outline-variant: '#c7c4d7'
  surface-tint: '#4849da'
  primary: '#4343d5'
  on-primary: '#ffffff'
  primary-container: '#5d5fef'
  on-primary-container: '#faf7ff'
  inverse-primary: '#c1c1ff'
  secondary: '#944a1c'
  on-secondary: '#ffffff'
  secondary-container: '#fe9e69'
  on-secondary-container: '#773405'
  tertiary: '#00617e'
  on-tertiary: '#ffffff'
  tertiary-container: '#2e7a98'
  on-tertiary-container: '#f1f9ff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e1e0ff'
  primary-fixed-dim: '#c1c1ff'
  on-primary-fixed: '#07006c'
  on-primary-fixed-variant: '#2e2bc2'
  secondary-fixed: '#ffdbca'
  secondary-fixed-dim: '#ffb690'
  on-secondary-fixed: '#331100'
  on-secondary-fixed-variant: '#763305'
  tertiary-fixed: '#bee9ff'
  tertiary-fixed-dim: '#8ad0f1'
  on-tertiary-fixed: '#001f2a'
  on-tertiary-fixed-variant: '#004d65'
  background: '#f4fafd'
  on-background: '#161d1f'
  surface-variant: '#dde4e6'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 48px
    fontWeight: '800'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.2'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 40px
  container-max: 1440px
---

## Brand & Style

The design system embodies a friendly, optimistic, and highly organized financial companion. It targets individuals and business owners who value clarity and ease over complex, dense financial interfaces. The brand personality is "Expertly Approachable"—professional enough to handle wealth management, yet warm enough to encourage daily engagement.

The visual style is **Corporate Modern with a Soft Bento influence**. It utilizes a clean, airy aesthetic characterized by generous whitespace, subtle depth through soft shadows, and a "bento-box" structural logic. The interface evokes a sense of calm control through the use of delicate gradients and rounded geometry, moving away from the "dry" look of traditional banking apps.

## Colors

This design system uses a palette that balances trust with vibrancy. The primary indigo-purple provides a sense of technological reliability, while the orange and soft blue are used for data visualization and accenting key financial metrics.

The color system relies heavily on **Multi-stop Gradients**. Backgrounds should often feature a very subtle, large-scale radial gradient (moving from soft purple to pale orange at less than 5% opacity) to prevent the "white-label" feel. 

- **Primary:** Used for main actions and brand presence.
- **Secondary (Orange):** Highlights "Growth" or "Warning" depending on context, and adds warmth.
- **Tertiary (Sky Blue):** Used for informational elements and secondary data points.
- **Neutral:** A deep slate for typography, ensuring high legibility against light backgrounds.

## Typography

The typography uses **Plus Jakarta Sans** exclusively to maintain a modern, friendly, and geometric look. The hierarchy is designed for high readability of numerical data.

Display and Headline styles should occasionally utilize **Gradient Fills** (Primary to Secondary) when used for marketing hero sections or large "State of Wealth" summaries. For functional UI, stick to solid neutral colors. Line heights are generous to maintain the "airy" feel of the design system.

## Layout & Spacing

The layout follows a **Fluid Bento Grid** philosophy. Content is organized into discrete, rounded tiles (containers) that reflow based on screen width.

- **Desktop:** A 12-column grid with 24px gutters. Bento tiles can span variable column widths (e.g., a "Spendometer" tile might take 4 columns, while a "Money Flow" chart takes 8).
- **Mobile:** A single-column vertical stack with 16px side margins. Bento tiles become full-width cards.
- **Rhythm:** All internal padding within tiles should follow an 8px base unit (16px, 24px, or 32px padding) to ensure consistent visual density. Use large margins between major sections to emphasize the "clean and light" feel.

## Elevation & Depth

This design system uses **Tonal Layering and Ambient Shadows** to create a sense of organized depth without looking cluttered.

- **Surface Level 0:** The global background, featuring a soft, ultra-low opacity gradient.
- **Surface Level 1 (Bento Tiles):** Pure white containers with a very soft, diffused shadow (`0px 4px 20px rgba(0,0,0,0.04)`). These tiles should have no borders.
- **Surface Level 2 (Interactive Elements):** Buttons and active inputs use subtle gradients or primary color fills to lift them from the white tiles.

Avoid harsh borders. Depth should be felt through the contrast of white cards against the tinted background and the soft shadows that make tiles feel like they are floating slightly above the canvas.

## Shapes

The shape language is defined by **large, friendly corner radii**. This softens the data-heavy nature of a budget app. 

Standard containers use `1rem` (16px) corners. Larger "Bento" sections or feature highlights can go up to `1.5rem` (24px) for a more modern, "app-like" feel on web. Small interactive elements like chips or buttons should maintain a consistent `0.5rem` (8px) radius to ensure they feel tactile and clickable.

## Components

### Buttons
Primary buttons use a horizontal gradient (Primary to Tertiary) with white text. Secondary buttons are ghost-style with a subtle 1px border or a soft-tinted background fill.

### Bento Cards
The core container of the UI. Must have white backgrounds, 16px-24px corner radius, and 24px internal padding. They should contain a single functional group (e.g., a chart, a list, or a metric).

### Input Fields
Fields should have a light-gray background (`#F1F3F9`) rather than a white background, to ensure they remain visible inside the white Bento tiles. Focus states should use a 2px Primary color ring.

### Data Visualization
Charts should use "Soft Stroke" aesthetics—rounded line caps on bar charts and smoothed curves on line graphs. Use the secondary and tertiary colors for comparison data to ensure visual separation from the primary brand color.

### Chips & Tags
Used for transaction categories. These should be pill-shaped with high-transparency background fills matching the category color, ensuring the text remains highly legible.