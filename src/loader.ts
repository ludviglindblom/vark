import { readFileSync } from 'node:fs'

function readFileSyncSafe(path: string): string {
  try {
    return readFileSync(path, 'utf8')
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e)
    throw new Error(`vark: cannot load env file "${path}" — ${reason}`)
  }
}

/**
 * Parse the contents of a .env file. Handles:
 *  - KEY=value
 *  - Quoted values: KEY="value", KEY='value'
 *  - Comments: # ...
 *  - Inline comments after unquoted values
 *  - Multiline double-quoted values
 *  - Blank lines
 *  - export KEY=value
 */
export function parseEnvString(input: string): Record<string, string> {
  const out: Record<string, string> = {}
  const src = input.replace(/\r\n?/g, '\n')
  let i = 0
  const lineOf = (pos: number): number => {
    let line = 1
    for (let j = 0; j < pos && j < src.length; j++) if (src[j] === '\n') line++
    return line
  }

  while (i < src.length) {
    // Skip whitespace/newlines/comments at the start of a line
    while (i < src.length && (src[i] === ' ' || src[i] === '\t' || src[i] === '\n')) i++
    if (i >= src.length) break
    if (src[i] === '#') {
      while (i < src.length && src[i] !== '\n') i++
      continue
    }

    // Optional `export `
    if (src.slice(i, i + 7) === 'export ') i += 7
    while (i < src.length && (src[i] === ' ' || src[i] === '\t')) i++

    // Read key
    const keyStart = i
    while (i < src.length) {
      const c = src[i]!
      if (
        (c >= 'A' && c <= 'Z') ||
        (c >= 'a' && c <= 'z') ||
        (c >= '0' && c <= '9') ||
        c === '_' ||
        c === '.'
      ) {
        i++
      } else {
        break
      }
    }
    const key = src.slice(keyStart, i)
    if (!key) {
      // Skip to next line
      while (i < src.length && src[i] !== '\n') i++
      continue
    }

    while (i < src.length && (src[i] === ' ' || src[i] === '\t')) i++
    if (src[i] !== '=') {
      while (i < src.length && src[i] !== '\n') i++
      continue
    }
    i++ // skip '='
    while (i < src.length && (src[i] === ' ' || src[i] === '\t')) i++

    // Read value
    let value: string
    const first = src[i]
    if (first === '"' || first === "'") {
      const quote = first
      const quoteStart = i
      i++
      const valueStart = i
      while (i < src.length && src[i] !== quote) {
        if (src[i] === '\\' && i + 1 < src.length) {
          i += 2
        } else {
          i++
        }
      }
      if (i >= src.length) {
        const qName = quote === '"' ? 'double' : 'single'
        throw new Error(
          `vark: unterminated ${qName}-quoted value for "${key}" starting at line ${lineOf(quoteStart)}`,
        )
      }
      const rawValue = src.slice(valueStart, i)
      i++ // closing quote
      value = quote === '"' ? unescapeDoubleQuoted(rawValue) : rawValue
      // Consume rest of line including inline comment
      while (i < src.length && src[i] !== '\n') i++
    } else {
      const valueStart = i
      // Walk to end-of-line, but a `#` only starts an inline comment if it
      // is preceded by whitespace (or appears immediately at the value start,
      // i.e. an empty value followed by a comment).
      while (i < src.length && src[i] !== '\n') {
        if (src[i] === '#') {
          const prev = i > valueStart ? src[i - 1] : ' '
          if (prev === ' ' || prev === '\t') break
        }
        i++
      }
      let end = i
      // If we stopped at a comment, skip to EOL
      if (i < src.length && src[i] === '#') {
        while (i < src.length && src[i] !== '\n') i++
      }
      while (end > valueStart && (src[end - 1] === ' ' || src[end - 1] === '\t')) end--
      value = src.slice(valueStart, end)
    }

    out[key] = value
  }

  return out
}

function unescapeDoubleQuoted(s: string): string {
  return s.replace(/\\([nrt"'\\$])/g, (_, c) => {
    switch (c) {
      case 'n':
        return '\n'
      case 'r':
        return '\r'
      case 't':
        return '\t'
      default:
        return c
    }
  })
}

export function loadEnvFile(path: string): Record<string, string> {
  const content = readFileSyncSafe(path)
  return parseEnvString(content)
}
