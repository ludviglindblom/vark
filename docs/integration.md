# Using vark in web apps

A copy-paste playbook for wiring `@ludviglindblom/vark` into the most common web app starters: vanilla React (Vite), Next.js, and Svelte / SvelteKit. JavaScript-only variants are at the bottom.

## Mental model

- vark validates env vars **once at startup** and throws a single aggregated `VarkError` listing every misconfiguration.
- Run validation on the **server or build step**. Anything that reaches the browser bundle is public — never validate secrets there.
- `parse()` auto-detects an env source in this order: explicit `options.env` → `process.env` → `Deno.env` → `import.meta.env` → `{}`. In bundler-driven frameworks it is clearest to pass `{ env }` explicitly.

## Install

```sh
npm i @ludviglindblom/vark
# pnpm add @ludviglindblom/vark
# bun add @ludviglindblom/vark
```

## The shared pattern

Define the schema and call `parse()` in **one module** and import the typed `env` everywhere else. The framework sections below differ only in *where* that module lives and *how* env values reach it.

```ts
// src/env.ts
import { v, parse } from '@ludviglindblom/vark'

export const env = parse({
  DATABASE_URL: v.string().required(),
  PORT: v.port().default(3000),
  NODE_ENV: v.enum(['development', 'production', 'test']).default('development'),
})
```

---

## Vanilla React (Vite)

Vite only exposes env vars prefixed with `VITE_` to client code, via `import.meta.env`. `.env`, `.env.local`, `.env.production` are loaded by Vite itself — do **not** use vark's `load` option.

```ts
// src/env.ts
import { v, parse } from '@ludviglindblom/vark'

export const env = parse(
  {
    VITE_API_URL: v.url().required(),
    VITE_ENABLE_ANALYTICS: v.boolean().default(false),
  },
  { env: import.meta.env as Record<string, string> },
)
```

```tsx
// src/App.tsx
import { env } from './env'

export function App() {
  return <a href={env.VITE_API_URL}>API</a>
}
```

If you also have Node-side scripts in the same repo (seed scripts, build tooling), give them their own `env.node.ts` with non-prefixed keys — `parse()` auto-detects `process.env` there.

---

## Next.js

Validate on the server. Anything you want available in the browser must be prefixed `NEXT_PUBLIC_`. Next loads `.env*` files itself; skip vark's `load` option.

Recommended layout: one server module, one optional client module.

```ts
// src/env.server.ts — imported only from server code
import 'server-only'
import { v, parse } from '@ludviglindblom/vark'

export const env = parse({
  DATABASE_URL: v.string().required(),
  STRIPE_SECRET_KEY: v.string().required(),
  NODE_ENV: v.enum(['development', 'production', 'test']).default('development'),
})
```

```ts
// src/env.client.ts — safe to import from client components
import { v, parse } from '@ludviglindblom/vark'

export const env = parse({
  NEXT_PUBLIC_API_URL: v.url().required(),
  NEXT_PUBLIC_POSTHOG_KEY: v.string().optional(),
})
```

### Fail-fast at boot

Import the server env module from `instrumentation.ts` so a bad config kills the process before serving traffic:

```ts
// instrumentation.ts
export async function register() {
  await import('./src/env.server')
}
```

### App Router

Import `env` from `src/env.server.ts` inside Server Components, Route Handlers, or Server Actions. Import `src/env.client.ts` from Client Components.

### Pages Router

Import the server module from `getServerSideProps`, API routes, or `next.config.js`. The instrumentation hook above works for both routers.

### Edge runtime / middleware

`process.env` is available but read-only and limited to inlined keys. Pass it explicitly:

```ts
export const env = parse(schema, { env: process.env as Record<string, string> })
```

Prefer running the boot-time validation in a node-runtime entry (`instrumentation.ts`) rather than an edge function.

---

## Svelte / SvelteKit

### Plain Svelte + Vite

Identical to the React/Vite section — `VITE_` prefix, `import.meta.env`.

### SvelteKit

SvelteKit already segregates env access into virtual modules. Use those as the *source* and pipe them through vark for validation and types.

| Module                  | When values are known | Visible to client | Required prefix |
| ----------------------- | --------------------- | ----------------- | --------------- |
| `$env/static/private`   | Build time            | No                | none            |
| `$env/static/public`    | Build time            | Yes               | `PUBLIC_`       |
| `$env/dynamic/private`  | Runtime               | No                | none            |
| `$env/dynamic/public`   | Runtime               | Yes               | `PUBLIC_`       |

Use `static` when values are baked at build time, `dynamic` when an adapter (Node, Vercel, etc.) reads them at runtime.

```ts
// src/lib/server/env.ts — server-only
import { env as runtime } from '$env/dynamic/private'
import { v, parse } from '@ludviglindblom/vark'

export const env = parse(
  {
    DATABASE_URL: v.string().required(),
    SESSION_SECRET: v.string().required(),
    PORT: v.port().default(3000),
  },
  { env: runtime as Record<string, string> },
)
```

```ts
// src/lib/env.public.ts — safe in client + server
import { env as pub } from '$env/static/public'
import { v, parse } from '@ludviglindblom/vark'

export const env = parse(
  {
    PUBLIC_API_URL: v.url().required(),
    PUBLIC_SENTRY_DSN: v.string().optional(),
  },
  { env: pub as Record<string, string> },
)
```

Putting the server module under `src/lib/server/` (or naming files `*.server.ts`) lets SvelteKit error if anything tries to import it from client code.

For fail-fast boot, import the server env module from `src/hooks.server.ts`:

```ts
// src/hooks.server.ts
import './lib/server/env'
```

---

## JavaScript (no TypeScript)

vark is published with both ESM and CJS builds and works the same at runtime in plain JS — you just lose inferred types.

```js
// src/env.js
import { v, parse } from '@ludviglindblom/vark'

export const env = parse({
  DATABASE_URL: v.string().required(),
  PORT: v.port().default(3000),
})
```

CommonJS:

```js
const { v, parse } = require('@ludviglindblom/vark')

const env = parse({
  DATABASE_URL: v.string().required(),
  PORT: v.port().default(3000),
})

module.exports = { env }
```

Recover editor autocomplete with a JSDoc annotation:

```js
/** @type {{ DATABASE_URL: string, PORT: number }} */
export const env = parse({
  DATABASE_URL: v.string().required(),
  PORT: v.port().default(3000),
})
```

Everything in the React, Next, and SvelteKit sections above applies — just rename `.ts` → `.js` and drop the `as Record<string, string>` casts (use a plain object pass-through if your tooling complains about the shape, e.g. `{ env: /** @type {Record<string,string>} */ (import.meta.env) }`).

---

## Troubleshooting

- **Variable is `undefined` in the browser** — missing required prefix (`VITE_`, `NEXT_PUBLIC_`, `PUBLIC_`). Bundlers strip non-prefixed vars from client code.
- **`VarkError` thrown at build, not runtime** — that's the design: misconfiguration is caught at import time. To defer, wrap `parse()` in a function and call it later.
- **Production error messages look bare** — when `NODE_ENV=production`, vark auto-redacts per-issue messages and shows keys only. Force either way with `redactErrors: true | false`.
- **Cloudflare Workers / Vercel Edge** — env bindings arrive as the fetch handler's `env` argument, not on a global. Call `parse(schema, { env })` from inside the handler. See the runtime table in the README.
