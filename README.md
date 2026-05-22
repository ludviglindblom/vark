# vark

> **Sharp teeth for your environment variables.**
>
> Zero-dependency, TypeScript-first env validation and config. Bite back against misconfigured environments.

[![npm version](https://img.shields.io/npm/v/vark.svg)](https://www.npmjs.com/package/vark)
[![bundle size](https://img.shields.io/bundlephobia/minzip/vark)](https://bundlephobia.com/package/vark)
[![license](https://img.shields.io/npm/l/vark.svg)](./LICENSE)

## Why vark?

- **Zero runtime dependencies.** Ever.
- **TypeScript-first.** Your config object is fully inferred from the schema.
- **Fail loud at startup.** Every misconfiguration is reported at once — no whack-a-mole.

## Install

```sh
npm i vark
# or: pnpm add vark / bun add vark
```

## Quick start

```ts
import { v, parse } from 'vark'

const config = parse({
  PORT: v.number().default(3000),
  DATABASE_URL: v.string().required(),
  NODE_ENV: v.enum(['development', 'production', 'test']).default('development'),
  DEBUG: v.boolean().default(false),
  API_URL: v.url().required(),
})

// config is fully typed:
// {
//   PORT: number
//   DATABASE_URL: string
//   NODE_ENV: 'development' | 'production' | 'test'
//   DEBUG: boolean
//   API_URL: string
// }
```

When something's off, you'll see all problems at once:

```
VarkError: 3 environment variable(s) failed validation:

  ✖ DATABASE_URL  — required but not set
  ✖ PORT          — expected number, got "not-a-number"
  ✖ NODE_ENV      — expected one of [development, production, test], got "staging"
```

## Validators

| Validator       | Returns   | Notes                                                     |
| --------------- | --------- | --------------------------------------------------------- |
| `v.string()`    | `string`  | Trims whitespace                                          |
| `v.number()`    | `number`  | Parses string → number, rejects NaN                       |
| `v.boolean()`   | `boolean` | Accepts `true/false/1/0/yes/no/on/off` (case-insensitive) |
| `v.enum([...])` | union     | `v.enum(['a','b'])` → `'a' \| 'b'`                        |
| `v.url()`       | `string`  | Validated with `URL` constructor                          |
| `v.port()`      | `number`  | Integer between 1–65535                                   |
| `v.json<T>()`   | `T`       | Parses JSON string, generic type param                    |

Chainable modifiers on every validator:

| Modifier         | Behaviour                                    |
| ---------------- | -------------------------------------------- |
| `.required()`    | Variable must be set and non-empty (default) |
| `.optional()`    | Returns `T \| undefined` if not set          |
| `.default(val)`  | Returns `T`, uses default if not set         |
| `.transform(fn)` | Apply a custom transform after validation    |

## Options

```ts
parse(schema, {
  env: MY_ENV_OBJECT, // custom env source; overrides runtime detection
  load: '.env', // optional path to a .env file to load
  override: false, // when loading, override existing env vars (default: false)
  redactErrors: false, // hide validator messages + raw values in thrown errors
})
```

### Redacting errors in production

By default, `VarkError` includes per-issue messages that echo the offending raw value (e.g. `expected number, got "not-a-number"`). That's helpful in development but a liability in production logs if env values themselves are sensitive.

When `NODE_ENV === 'production'`, vark **automatically redacts** these messages and the error lists keys only:

```
VarkError: 2 environment variable(s) failed validation:

  ✖ DATABASE_URL
  ✖ PORT
```

Force the behavior either way with `redactErrors: true | false`. `err.issues` still carries the key list programmatically — only the per-issue `message` field is dropped.

The built-in `.env` parser handles `KEY=value`, quoted values, escapes inside double quotes, inline `#` comments, multiline double-quoted values, `export` prefixes, and CRLF line endings.

## Runtime compatibility

| Runtime              | Env access                    | `.env` loading                              |
| -------------------- | ----------------------------- | ------------------------------------------- |
| Node.js ≥ 20.6       | `process.env`                 | Native `--env-file` or vark loader          |
| Node.js 18–20.5      | `process.env`                 | vark loader                                 |
| Bun                  | `process.env`                 | Auto-loaded by Bun; vark loader as fallback |
| Deno                 | `Deno.env.toObject()`         | Native `--env-file` or vark loader          |
| Vite / bundler build | `import.meta.env`             | N/A (handled by the bundler)                |
| Cloudflare Workers   | **Pass `{ env }` explicitly** | N/A (no file system)                        |
| Vercel Edge / others | **Pass `{ env }` explicitly** | N/A (no file system)                        |

`parse()` auto-detects in this order: explicit `options.env` → `process.env` → `Deno.env` → `import.meta.env` → `{}`.

**Cloudflare Workers / Vercel Edge:** environment bindings are passed into your fetch handler as the second argument, not on a global. vark cannot reach them on its own — call `parse(schema, { env })` from inside the handler:

```ts
export default {
  fetch(req: Request, env: Env) {
    const config = parse(schema, { env: env as Record<string, string> })
    // …
  },
}
```

## TypeScript

Extract the config type if you need it elsewhere:

```ts
const schema = {
  PORT: v.number().default(3000),
  DATABASE_URL: v.string().required(),
}
const config = parse(schema)
type Config = typeof config
```

Or use the `InferSchema` helper directly:

```ts
import type { InferSchema } from 'vark'
type Config = InferSchema<typeof schema>
```

## FAQ

**Why not Zod?** Zod is excellent, but it pulls a runtime dependency for what is — for env variables — a much smaller problem. vark is ~2KB gzipped and does the one job well.

**Does this replace dotenv?** Mostly. The optional `load` option parses `.env` files with zero dependencies. If you're on Node ≥ 20.6, prefer the native `--env-file` flag and skip the loader entirely.

## License

[MIT](./LICENSE) © Ludvig Lindblom
