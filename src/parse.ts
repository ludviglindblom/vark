import { VarkError, type VarkIssue } from './errors.js'
import type { InferSchema } from './schema.js'
import { Validator } from './schema.js'
import { loadEnvFile } from './loader.js'

export interface ParseOptions {
  /** Explicit env source. Overrides runtime detection. */
  env?: Record<string, string | undefined>
  /** Path to a .env file to load before parsing. */
  load?: string
  /** If true, .env values override existing env vars. Default: false. */
  override?: boolean
  /**
   * If true, the thrown `VarkError` will only contain keys — no per-issue
   * messages and no raw env values. Useful to keep secrets out of logs in
   * production. Defaults to `true` when `NODE_ENV === 'production'`, else `false`.
   */
  redactErrors?: boolean
}

declare const Deno:
  | {
      env: { toObject(): Record<string, string> }
    }
  | undefined

function resolveEnv(options?: ParseOptions): Record<string, string | undefined> {
  if (options?.env) return options.env
  if (typeof process !== 'undefined' && process.env) {
    return process.env as Record<string, string | undefined>
  }
  if (typeof Deno !== 'undefined' && Deno?.env) {
    try {
      return Deno.env.toObject()
    } catch {
      /* permission denied */
    }
  }
  try {
    // @ts-expect-error — import.meta.env exists in Vite/Workers
    const metaEnv = import.meta.env as Record<string, string | undefined> | undefined
    if (metaEnv) return metaEnv
  } catch {
    /* not available */
  }
  return {}
}

export function parse<S extends Record<string, Validator<unknown>>>(
  schema: S,
  options?: ParseOptions,
): InferSchema<S> {
  let env = resolveEnv(options)

  if (options?.load) {
    const loaded = loadEnvFile(options.load)
    if (options.override) {
      env = { ...env, ...loaded }
    } else {
      env = { ...loaded, ...env }
    }
  }

  const issues: VarkIssue[] = []
  const result: Record<string, unknown> = {}

  for (const key of Object.keys(schema)) {
    const validator = schema[key]!
    const raw = env[key]
    const parsed = validator._parse(raw)
    if (parsed.ok) {
      result[key] = parsed.value
    } else {
      issues.push({ key, message: parsed.error })
    }
  }

  if (issues.length > 0) {
    const redact =
      options?.redactErrors ??
      (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production')
    throw new VarkError(redact ? issues.map((i) => ({ key: i.key })) : issues)
  }

  return result as InferSchema<S>
}
