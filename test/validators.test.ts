import { describe, expect, it } from 'vitest'
import { v } from '../src/validators.js'

describe('v.string', () => {
  it('trims whitespace', () => {
    expect(v.string()._parse('  hello  ')).toEqual({ ok: true, value: 'hello' })
  })
  it('errors on missing required', () => {
    const missing = v.string()._parse(undefined)
    expect(missing).toEqual({ ok: false, error: 'required but not set' })
    const empty = v.string()._parse('')
    expect(empty).toEqual({ ok: false, error: 'required but empty' })
  })
  it('optional returns undefined when missing', () => {
    expect(v.string().optional()._parse(undefined)).toEqual({ ok: true, value: undefined })
    expect(v.string().optional()._parse('')).toEqual({ ok: true, value: undefined })
  })
  it('default returns default when missing', () => {
    expect(v.string().default('fallback')._parse(undefined)).toEqual({
      ok: true,
      value: 'fallback',
    })
  })
})

describe('v.number', () => {
  it('parses numbers', () => {
    expect(v.number()._parse('42')).toEqual({ ok: true, value: 42 })
    expect(v.number()._parse('3.14')).toEqual({ ok: true, value: 3.14 })
    expect(v.number()._parse('-7')).toEqual({ ok: true, value: -7 })
  })
  it('rejects NaN', () => {
    const r = v.number()._parse('abc')
    expect(r.ok).toBe(false)
  })
})

describe('v.boolean', () => {
  it.each(['true', 'TRUE', '1', 'yes', 'on', 'Y'])('parses %s as true', (raw) => {
    expect(v.boolean()._parse(raw)).toEqual({ ok: true, value: true })
  })
  it.each(['false', 'FALSE', '0', 'no', 'off', 'N'])('parses %s as false', (raw) => {
    expect(v.boolean()._parse(raw)).toEqual({ ok: true, value: false })
  })
  it('rejects garbage', () => {
    expect(v.boolean()._parse('maybe').ok).toBe(false)
  })
})

describe('v.enum', () => {
  it('accepts listed values', () => {
    const validator = v.enum(['dev', 'prod'])
    expect(validator._parse('dev')).toEqual({ ok: true, value: 'dev' })
  })
  it('rejects unlisted values', () => {
    const validator = v.enum(['dev', 'prod'])
    const r = validator._parse('staging')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('expected one of')
  })
})

describe('v.url', () => {
  it('accepts valid urls', () => {
    expect(v.url()._parse('https://example.com').ok).toBe(true)
    expect(v.url()._parse('postgres://user:pass@host:5432/db').ok).toBe(true)
  })
  it('rejects invalid urls', () => {
    expect(v.url()._parse('not a url').ok).toBe(false)
  })
})

describe('v.port', () => {
  it('accepts ports 1-65535', () => {
    expect(v.port()._parse('1').ok).toBe(true)
    expect(v.port()._parse('80').ok).toBe(true)
    expect(v.port()._parse('65535').ok).toBe(true)
  })
  it('rejects out of range', () => {
    expect(v.port()._parse('0').ok).toBe(false)
    expect(v.port()._parse('65536').ok).toBe(false)
    expect(v.port()._parse('80.5').ok).toBe(false)
    expect(v.port()._parse('abc').ok).toBe(false)
  })
})

describe('v.json', () => {
  it('parses JSON', () => {
    expect(v.json()._parse('{"a":1}')).toEqual({ ok: true, value: { a: 1 } })
    expect(v.json()._parse('[1,2,3]')).toEqual({ ok: true, value: [1, 2, 3] })
  })
  it('rejects invalid JSON', () => {
    expect(v.json()._parse('{a:1}').ok).toBe(false)
  })
})

describe('modifiers', () => {
  it('transform applies after parse', () => {
    const validator = v.string().transform((s) => s.toUpperCase())
    expect(validator._parse('hello')).toEqual({ ok: true, value: 'HELLO' })
  })
  it('chained transforms compose', () => {
    const validator = v
      .string()
      .transform((s) => s.length)
      .transform((n) => n * 2)
    expect(validator._parse('abc')).toEqual({ ok: true, value: 6 })
  })
  it('required overrides previous optional', () => {
    const validator = v.string().optional().required()
    expect(validator._parse(undefined).ok).toBe(false)
  })
})
