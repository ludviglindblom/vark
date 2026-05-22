import { describe, expect, it } from 'vitest'
import { parse } from '../src/parse.js'
import { v } from '../src/validators.js'
import { VarkError } from '../src/errors.js'

describe('parse', () => {
  it('returns a typed config object on success', () => {
    const config = parse(
      {
        PORT: v.number().default(3000),
        DATABASE_URL: v.string().required(),
        NODE_ENV: v.enum(['development', 'production', 'test']).default('development'),
        DEBUG: v.boolean().default(false),
      },
      { env: { DATABASE_URL: 'postgres://localhost/db', PORT: '8080' } },
    )
    expect(config).toEqual({
      PORT: 8080,
      DATABASE_URL: 'postgres://localhost/db',
      NODE_ENV: 'development',
      DEBUG: false,
    })
  })

  it('aggregates all errors into a single VarkError', () => {
    expect(() =>
      parse(
        {
          DATABASE_URL: v.string().required(),
          PORT: v.number(),
          NODE_ENV: v.enum(['development', 'production']),
        },
        { env: { PORT: 'not-a-number', NODE_ENV: 'staging' } },
      ),
    ).toThrow(VarkError)

    try {
      parse(
        {
          DATABASE_URL: v.string().required(),
          PORT: v.number(),
          NODE_ENV: v.enum(['development', 'production']),
        },
        { env: { PORT: 'not-a-number', NODE_ENV: 'staging' } },
      )
    } catch (e) {
      expect(e).toBeInstanceOf(VarkError)
      const err = e as VarkError
      expect(err.issues).toHaveLength(3)
      expect(err.issues.map((i) => i.key).sort()).toEqual(['DATABASE_URL', 'NODE_ENV', 'PORT'])
      expect(err.message).toContain('3 environment variable(s) failed validation')
    }
  })

  it('applies defaults when missing', () => {
    const config = parse({ X: v.string().default('hello') }, { env: {} })
    expect(config.X).toBe('hello')
  })

  it('returns undefined for optional missing values', () => {
    const config = parse({ X: v.string().optional() }, { env: {} })
    expect(config.X).toBeUndefined()
  })

  it('uses process.env by default', () => {
    process.env.VARK_TEST_VALUE = 'from-process-env'
    try {
      const config = parse({ VARK_TEST_VALUE: v.string().required() })
      expect(config.VARK_TEST_VALUE).toBe('from-process-env')
    } finally {
      delete process.env.VARK_TEST_VALUE
    }
  })

  it('redacts issue messages when redactErrors: true', () => {
    try {
      parse(
        { SECRET_TOKEN: v.string().required(), PORT: v.number() },
        { env: { PORT: 'not-a-number' }, redactErrors: true },
      )
    } catch (e) {
      const err = e as VarkError
      expect(err.issues.every((i) => i.message === undefined)).toBe(true)
      expect(err.message).not.toContain('not-a-number')
      expect(err.message).toContain('SECRET_TOKEN')
      expect(err.message).toContain('PORT')
    }
  })

  it('auto-redacts when NODE_ENV is production', () => {
    const prev = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    try {
      parse({ X: v.number() }, { env: { X: 'oops' } })
    } catch (e) {
      const err = e as VarkError
      expect(err.message).not.toContain('oops')
    } finally {
      if (prev === undefined) delete process.env.NODE_ENV
      else process.env.NODE_ENV = prev
    }
  })

  it('does not redact when redactErrors: false even in production', () => {
    const prev = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    try {
      parse({ X: v.number() }, { env: { X: 'oops' }, redactErrors: false })
    } catch (e) {
      const err = e as VarkError
      expect(err.message).toContain('oops')
    } finally {
      if (prev === undefined) delete process.env.NODE_ENV
      else process.env.NODE_ENV = prev
    }
  })

  it('prefers explicit env over process.env', () => {
    process.env.VARK_TEST_VALUE = 'process'
    try {
      const config = parse(
        { VARK_TEST_VALUE: v.string().required() },
        { env: { VARK_TEST_VALUE: 'explicit' } },
      )
      expect(config.VARK_TEST_VALUE).toBe('explicit')
    } finally {
      delete process.env.VARK_TEST_VALUE
    }
  })

  it('rejects whitespace-only values for required string', () => {
    expect(() => parse({ X: v.string().required() }, { env: { X: '   ' } })).toThrow(VarkError)
  })

  it('rejects Infinity and -Infinity for v.number()', () => {
    expect(() => parse({ X: v.number() }, { env: { X: 'Infinity' } })).toThrow(VarkError)
    expect(() => parse({ X: v.number() }, { env: { X: '-Infinity' } })).toThrow(VarkError)
    expect(() => parse({ X: v.number() }, { env: { X: '1e500' } })).toThrow(VarkError)
  })

  it('applies post-default transforms to default values', () => {
    // .default() before .transform() — transform must apply to default
    const config = parse(
      { X: v.string().default('hi').transform((s) => s.length) },
      { env: {} },
    )
    expect(config.X).toBe(2)
  })

  it('does not re-apply pre-default transforms to default values', () => {
    // .transform() before .default() — default value already has post-transform type
    const config = parse(
      { X: v.string().transform((s) => s.length).default(5) },
      { env: {} },
    )
    expect(config.X).toBe(5)
  })

  it('applies transforms normally when env value is present (default unused)', () => {
    const config = parse(
      { X: v.string().default('hi').transform((s) => s.length) },
      { env: { X: 'hello' } },
    )
    expect(config.X).toBe(5)
  })
})
