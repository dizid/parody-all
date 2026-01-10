# Parody Everything

AI-powered parody site generator that transforms any website URL into satirical comedy gold.

## Tech Stack

- Vue 3 (Composition API)
- TypeScript
- Vite
- Tailwind CSS v4
- Pinia (state management)
- Vue Router
- Clerk (authentication)
- Stripe (payments)
- Neon (serverless PostgreSQL)
- Netlify Functions (backend)
- Anthropic Claude API (AI generation)

## Development

```bash
npm run dev      # Start dev server
npm run build    # Build for production
npm run preview  # Preview production build
```

## Project Structure

```
src/
  components/         # Reusable Vue components
    parody/           # Parody-specific components (header, footer, cards)
  views/              # Page views (Home, Generate, Dashboard, Login, Parody)
  composables/        # Vue composables (useAuth, etc.)
  types/              # TypeScript type definitions
  lib/                # Utility libraries
  router/             # Vue Router configuration
netlify/
  functions/          # Serverless backend functions
    generate-parody-background.ts  # Claude AI generation (background)
    create-checkout.ts             # Stripe checkout
    stripe-webhook.ts              # Stripe webhooks
    get-parody.ts                  # Fetch parody data
    list-parodies.ts               # List user's parodies
    get-profile.ts                 # User profile data
```

## Code Style

- Variables/functions: camelCase
- Components: PascalCase
- Files: kebab-case
- Use TypeScript strict mode
- Use Vue 3 Composition API with `<script setup>`
- Keep components focused and modular

## Preferences

- Act like a senior developer
- Write complete, working code - no mocks, stubs, or TODOs
- Use clear comments only when logic isn't self-evident
- Keep existing working code intact when adding features
- Prefer editing existing files over creating new ones
- Use the Supabase and Stripe MCP servers for database/payment operations

## Domain Rules

### Parody Generation

- Satirical content should feel "too real" not "random nonsense"
- Use ironic truthfulness - exaggerate real problems, not invent absurd ones
- Parody names should hint at the main joke (Amazon → Scamazon, Uber → Goober)
- Products/services reframe user complaints as "features"
- Reviews mix obviously fake 5-stars with relatable 1-star complaints
- Never generate content that could be mistaken for the real site
- Always include clear parody indicators

### Data Model

- Parodies stored in Neon PostgreSQL
- Status flow: pending → generating → complete (or failed)
- Parodies expire after 7 days
- Users authenticated via Clerk
- Credits/subscriptions managed via Stripe
