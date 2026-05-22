export interface VarkIssue {
  key: string
  /** Detailed message. Omitted when error details are redacted (e.g. in production). */
  message?: string
}

export class VarkError extends Error {
  readonly issues: readonly VarkIssue[]

  constructor(issues: readonly VarkIssue[]) {
    super(formatMessage(issues))
    this.name = 'VarkError'
    this.issues = issues
    Object.setPrototypeOf(this, VarkError.prototype)
  }
}

function formatMessage(issues: readonly VarkIssue[]): string {
  const header = `${issues.length} environment variable(s) failed validation:`
  const width = Math.max(...issues.map((i) => i.key.length), 0)
  const lines = issues.map((i) =>
    i.message ? `  ✖ ${i.key.padEnd(width)}  — ${i.message}` : `  ✖ ${i.key}`,
  )
  return [header, '', ...lines].join('\n')
}
