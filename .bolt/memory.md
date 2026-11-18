# Project memory

## Product intent & audience

- Craftsmen/services marketplace platform connecting users with local craftsmen
- Arabic-language UI (content in Arabic, e.g. "عرض الكل")
- Key features: craftsman profiles with tabs (portfolio, reviews), search with filters/sorting (e.g. online sort), home screen with nearby craftsmen and specialties

## Brand personality & voice

- Arabic-first interface; RTL layout likely required

## Visual design & UX direction

- Tailwind CSS for styling
- App Router with client-component pattern: `*Client.tsx` files in `src/app/<route>/components/`
- Tab-based navigation on profile pages
- Custom theme color token: `text-primary`
- Components seen: cards, grids, avatars, links, filter panels

## Decisions, constraints & rationale

- Framework: Next.js 15.5.18 (App Router, `src/app/`)
- Deployment: Netlify with `@netlify/plugin-nextjs` v5.16.7; build via `netlify.toml` (`npx next build`, publish `.next`)
- `optimizePackageImports` experiment enabled
- `.env` used for environment variables
- No build cache configured (Next.js warning present)
- JSX syntax errors occurred in large client components (1000+ lines); keep JSX blocks balanced and prefer smaller components to reduce structural breakage

## Open questions & assumptions

- RTL layout handling not yet confirmed in code
- Full routing structure and feature set not fully mapped
- Backend API / data source not visible from this turn
- Visual design system beyond Tailwind defaults not yet established
- Authentication and user roles (craftsman vs. customer) not yet confirmed