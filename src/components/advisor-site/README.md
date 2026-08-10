# Crestwell advisor site template

A single-page marketing site for one independent travel advisor. Everything advisor-specific
lives in one config file — no component edits, no CMS, no backend.

## Launch a new advisor site

1. Copy the project.
2. Edit `src/config/advisor.ts` only: name, title, agency, `agentId`, bio, poster headline,
   phone, email, location, `quoteBase`, `stats`, `trips`, `networkLinks`.
3. Drop the advisor headshot at `public/advisor.jpg` (square, ~400×400, full color).
4. Deploy.

## Quote links

Never hard-code a quote URL. Use the helper:

```ts
import { quoteUrl } from "@/config/advisor";

quoteUrl();                                        // ?agent=<agentId>
quoteUrl({ destination: "Alaska", trip: "7-Day" }); // + &destination=&trip= (URL-encoded)
```

## Files

| File | Purpose |
| --- | --- |
| `src/config/advisor.ts` | The only file to edit per advisor |
| `src/pages/AdvisorSite.tsx` | All seven sections in order |
| `src/components/advisor-site/advisor-site.css` | Modernist tokens and component classes, scoped to `.advisor-site` |

## Design system (Modernist)

Flat, architectural, Swiss. Alignment and rules organize the page — no shadows, no rounded
corners, no gradients.

- Background `#f3f2f2`, surface `#eae9e9`, ink `#201e1d`, accent `#ec3013`,
  deep accent `#ae1800`, muted `#605d5d` — all as CSS variables (`--as-*`)
- Section boundaries: 2px rules; internal cell rules: 1px
- Archivo 400 / 600 / 800; headings 800, leading 1.12, tight tracking
- Radius 0 everywhere; spacing scale 4 / 8 / 12 / 16 / 24 / 32
- Everything flush left, including button labels
- Accent appears only on primary buttons, kickers, and the one red poster band
- Focus ring on every interactive element: 2px accent outline, 2px offset