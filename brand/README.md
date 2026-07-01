# Pelorus Shipping — Brand assets

Shared brand kit and the company one-pager. Logos and banners are PNG at 2× for crisp display.

## Palette
| Token | Hex | Use |
|-------|-----|-----|
| Navy  | `#0e2340` | Primary background / wordmark on light |
| Badge navy | `#0a2444` | Compass-star badge background |
| Gold  | `#b1864e` | Accent, "SHIPPING", rules |
| Gold soft | `#c6a472` | Secondary accent / highlight text |
| Gold light | `#cbb68d` | Sub-wordmark on dark |

**Type:** Figtree (wordmark & headings), Mulish (body).
**Mark:** compass star — see `logo-mark.svg` (also the site favicon).

## Files
| File | Use |
|------|-----|
| `logo-mark.svg` | Compass-star badge, vector (scales to any size) |
| `logo-badge-400.png` | Square badge — LinkedIn/company avatar (transparent bg) |
| `logo-horizontal-navy.png` | Horizontal lockup for **light** backgrounds |
| `logo-horizontal-white.png` | Horizontal lockup for **dark** backgrounds |
| `linkedin-banner-personal-1584x396.png` | LinkedIn personal profile background |
| `linkedin-banner-company-1128x191.png` | LinkedIn company page cover |
| `linkedin-banner-company-source.html` | Editable HTML source for the company banner |
| `linkedin-banner-personal-source.html` | Editable HTML source for the personal banner |
| `Pelorus-Shipping-OnePager.pdf` | Capabilities one-pager (US Letter, print-ready) |
| `onepager-source.html` | Editable HTML source for the one-pager |

## Regenerating the one-pager
Open `onepager-source.html`, edit, then print to PDF (Letter, margins none, background graphics on) — or render headless with Chrome/Playwright.

## Regenerating the LinkedIn banners
Edit the banner `*-source.html`, then render headless at **2×** and clip to the CSS size:
- Company cover → 1128×191 (output 2256×382). Keep content clear of the bottom-left logo zone (~0–296px).
- Personal background → 1584×396 (output 3168×792). Keep content centred, clear of the bottom-left profile photo.
