import { Validator, type ParseResult } from './schema.js'

function ok<T>(value: T): ParseResult<T> {
  return { ok: true, value }
}
function fail(error: string): ParseResult<never> {
  return { ok: false, error }
}

function string(): Validator<string> {
  return new Validator<string>((raw) => ok(raw.trim()))
}

function number(): Validator<number> {
  return new Validator<number>((raw) => {
    const n = Number(raw.trim())
    if (!Number.isFinite(n)) return fail(`expected number, got "${raw}"`)
    return ok(n)
  })
}

const TRUE_VALUES = new Set(['true', '1', 'yes', 'y', 'on'])
const FALSE_VALUES = new Set(['false', '0', 'no', 'n', 'off'])

function boolean(): Validator<boolean> {
  return new Validator<boolean>((raw) => {
    const v = raw.trim().toLowerCase()
    if (TRUE_VALUES.has(v)) return ok(true)
    if (FALSE_VALUES.has(v)) return ok(false)
    return fail(`expected boolean, got "${raw}"`)
  })
}

function enumValidator<const T extends readonly [string, ...string[]]>(
  values: T,
): Validator<T[number]> {
  const set = new Set<string>(values)
  return new Validator<T[number]>((raw) => {
    const v = raw.trim()
    if (set.has(v)) return ok(v as T[number])
    return fail(`expected one of [${values.join(', ')}], got "${raw}"`)
  })
}

function url(): Validator<string> {
  return new Validator<string>((raw) => {
    const v = raw.trim()
    try {
      new URL(v)
      return ok(v)
    } catch {
      return fail(`expected URL, got "${raw}"`)
    }
  })
}

function port(): Validator<number> {
  return new Validator<number>((raw) => {
    const n = Number(raw.trim())
    if (!Number.isInteger(n) || n < 1 || n > 65535) {
      return fail(`expected port (integer 1-65535), got "${raw}"`)
    }
    return ok(n)
  })
}

function json<T = unknown>(): Validator<T> {
  return new Validator<T>((raw) => {
    try {
      return ok(JSON.parse(raw) as T)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'parse error'
      return fail(`expected JSON, got "${raw}" (${msg})`)
    }
  })
}

export const v = {
  string,
  number,
  boolean,
  enum: enumValidator,
  url,
  port,
  json,
}
