# Site Design System

## Overview

Reusable component styles and theme tokens. Uses CSS variables for light/dark themes. All class names use `site-` prefix (no xituan prefix).

## CSS Variable Standard

### Text Hierarchy (normal, hover, active)
| Variable | Use |
|----------|-----|
| `--text-primary` | Main text |
| `--text-primary-hover`, `--text-primary-active` | Interactive text |
| `--text-secondary` | Secondary text |
| `--text-tertiary` | Muted/placeholder |
| `--text-inverse` | On primary/brand bg |

### Background Hierarchy
| Variable | Use |
|----------|-----|
| `--bg-base` | Page background |
| `--bg-base-hover`, `--bg-base-active` | Interactive surfaces |
| `--bg-raised` | Card, input bg |
| `--bg-raised-hover`, `--bg-raised-active` | Raised hover states |
| `--bg-overlay` | Overlays, placeholders |

### Border
| Variable | Use |
|----------|-----|
| `--border-default` | Default border |
| `--border-hover`, `--border-active` | Interactive borders |

### Semantic States (success, error, warn, info)
Each has `-text`, `-text-hover`, `-text-active` and `-bg`, `-bg-hover`, `-bg-active`:
- `--success-*`
- `--error-*`
- `--warn-*`
- `--info-*`

### Brand / Primary
- `--color-primary`, `--color-primary-hover`, `--color-primary-active`

### Card Accents
- `--card-offer`, `--card-preorder`, `--card-product`, `--card-news`, `--card-merchant`

## Default Font Color Rule

- **Light theme**: Default text is black (`--text-primary`)
- **Dark theme / colored backgrounds**: Default text is white or light (`--text-primary`)
- **Do not use colored fonts** (e.g. primary/brand color for body text) unless specifically required (e.g. links, price highlight, logo)
- Body text, titles, descriptions use `--text-primary` / `--text-secondary` / `--text-tertiary`

## Theme Toggle

`body[data-theme='light']` | `body[data-theme='dark']`

## Class Naming

All site classes use `site-` prefix: `.site-container`, `.site-card`, `.site-section`, etc.

## Compact Scale

- Base font: 13px
- Section titles: 14px
- Card title: 12px

## Site-Card List Layout

Use **flex layout** for site-card lists (`.site-card-grid`). Card width must stay within:

| Breakpoint | Card width range |
|------------|------------------|
| Mobile (< 768px) | 140–160px (~150px) |
| Desktop (≥ 768px) | 216–253px (max 6 per row at 1600px container) |

- Container: `display: flex`, `flex-wrap: wrap`, `gap`
- Each card: `flex: 1 1 <basis>`, `min-width`, `max-width` to enforce the range
