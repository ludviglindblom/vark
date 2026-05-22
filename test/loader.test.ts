import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadEnvFile, parseEnvString } from '../src/loader.js'
import { parse } from '../src/parse.js'
import { v } from '../src/validators.js'

describe('parseEnvString', () => {
  it('parses simple KEY=value', () => {
    expect(parseEnvString('FOO=bar\nBAZ=qux')).toEqual({ FOO: 'bar', BAZ: 'qux' })
  })

  it('handles double-quoted values', () => {
    expect(parseEnvString('FOO="hello world"')).toEqual({ FOO: 'hello world' })
  })

  it('handles single-quoted values without escape', () => {
    expect(parseEnvString("FOO='a\\nb'")).toEqual({ FOO: 'a\\nb' })
  })

  it('processes escapes inside double quotes', () => {
    expect(parseEnvString('FOO="a\\nb\\tc"')).toEqual({ FOO: 'a\nb\tc' })
  })

  it('ignores comments and blank lines', () => {
    const src = `# comment\n\nFOO=bar\n# another\nBAZ=qux\n`
    expect(parseEnvString(src)).toEqual({ FOO: 'bar', BAZ: 'qux' })
  })

  it('strips inline comments from unquoted values', () => {
    expect(parseEnvString('FOO=bar # inline')).toEqual({ FOO: 'bar' })
  })

  it('keeps # inside quoted values', () => {
    expect(parseEnvString('FOO="bar # not a comment"')).toEqual({ FOO: 'bar # not a comment' })
  })

  it('keeps # in unquoted values when not preceded by whitespace', () => {
    expect(parseEnvString('FOO=bar#hash')).toEqual({ FOO: 'bar#hash' })
    expect(parseEnvString('URL=https://example.com/#anchor')).toEqual({
      URL: 'https://example.com/#anchor',
    })
  })

  it('treats # as inline comment when preceded by whitespace', () => {
    expect(parseEnvString('FOO=bar # comment')).toEqual({ FOO: 'bar' })
    expect(parseEnvString('FOO=bar\t# tabbed')).toEqual({ FOO: 'bar' })
  })

  it('supports multiline double-quoted values', () => {
    expect(parseEnvString('FOO="line1\nline2"')).toEqual({ FOO: 'line1\nline2' })
  })

  it('supports export prefix', () => {
    expect(parseEnvString('export FOO=bar')).toEqual({ FOO: 'bar' })
  })

  it('handles CRLF line endings', () => {
    expect(parseEnvString('FOO=bar\r\nBAZ=qux\r\n')).toEqual({ FOO: 'bar', BAZ: 'qux' })
  })

  it('trims trailing whitespace on unquoted values', () => {
    expect(parseEnvString('FOO=bar   ')).toEqual({ FOO: 'bar' })
  })
})

describe('loadEnvFile + parse integration', () => {
  let dir: string
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'vark-'))
  })
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('loads a .env file from disk', () => {
    const path = join(dir, '.env')
    writeFileSync(path, 'X=hello\nY=42\n')
    expect(loadEnvFile(path)).toEqual({ X: 'hello', Y: '42' })
  })

  it('does not override existing env by default', () => {
    const path = join(dir, '.env.no-override')
    writeFileSync(path, 'VARK_LOADER_TEST=from-file\n')
    process.env.VARK_LOADER_TEST = 'from-process'
    try {
      const config = parse({ VARK_LOADER_TEST: v.string() }, { load: path })
      expect(config.VARK_LOADER_TEST).toBe('from-process')
    } finally {
      delete process.env.VARK_LOADER_TEST
    }
  })

  it('overrides existing env when override: true', () => {
    const path = join(dir, '.env.override')
    writeFileSync(path, 'VARK_LOADER_TEST=from-file\n')
    process.env.VARK_LOADER_TEST = 'from-process'
    try {
      const config = parse({ VARK_LOADER_TEST: v.string() }, { load: path, override: true })
      expect(config.VARK_LOADER_TEST).toBe('from-file')
    } finally {
      delete process.env.VARK_LOADER_TEST
    }
  })

  it("unescapes \\' inside double-quoted values", () => {
    expect(parseEnvString(`FOO="say \\'hi\\'"`)).toEqual({ FOO: "say 'hi'" })
  })
})

describe('parseEnvString — unterminated quotes', () => {
  it('throws with line number on unterminated double quote', () => {
    expect(() => parseEnvString('A=ok\nB="oops\n')).toThrow(
      /unterminated double-quoted value for "B" starting at line 2/,
    )
  })

  it('throws with line number on unterminated single quote at EOF', () => {
    expect(() => parseEnvString("FOO='unterminated")).toThrow(
      /unterminated single-quoted value for "FOO" starting at line 1/,
    )
  })

  it('does not throw on properly closed quotes spanning multiple lines', () => {
    expect(parseEnvString('FOO="line1\nline2"\n')).toEqual({ FOO: 'line1\nline2' })
  })
})
