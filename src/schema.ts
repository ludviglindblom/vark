export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string }

type Mode =
  | { kind: 'required' }
  | { kind: 'optional' }
  | { kind: 'default'; value: unknown; transformOffset: number }

export class Validator<T> {
  /** @internal */
  readonly _baseParse: (raw: string) => ParseResult<unknown>
  /** @internal */
  readonly _mode: Mode
  /** @internal */
  readonly _transforms: ReadonlyArray<(value: unknown) => unknown>

  constructor(
    baseParse: (raw: string) => ParseResult<unknown>,
    mode: Mode = { kind: 'required' },
    transforms: ReadonlyArray<(value: unknown) => unknown> = [],
  ) {
    this._baseParse = baseParse
    this._mode = mode
    this._transforms = transforms
  }

  /** @internal */
  _parse(raw: string | undefined): ParseResult<T> {
    // Treat whitespace-only as empty so `.required()` actually means
    // "set and non-empty" across all validators.
    const isEmpty = raw === undefined || raw.trim() === ''
    if (isEmpty) {
      if (this._mode.kind === 'optional') {
        return { ok: true, value: undefined as T }
      }
      if (this._mode.kind === 'default') {
        // Apply only transforms added AFTER `.default()` was set — anything
        // before is already baked into the default value's type.
        let value: unknown = this._mode.value
        for (let i = this._mode.transformOffset; i < this._transforms.length; i++) {
          value = this._transforms[i]!(value)
        }
        return { ok: true, value: value as T }
      }
      return {
        ok: false,
        error: raw === undefined ? 'required but not set' : 'required but empty',
      }
    }

    const base = this._baseParse(raw)
    if (!base.ok) return base
    let value: unknown = base.value
    for (const t of this._transforms) value = t(value)
    return { ok: true, value: value as T }
  }

  required(): Validator<Exclude<T, undefined>> {
    return new Validator(this._baseParse, { kind: 'required' }, this._transforms) as Validator<
      Exclude<T, undefined>
    >
  }

  optional(): Validator<T | undefined> {
    return new Validator<T | undefined>(this._baseParse, { kind: 'optional' }, this._transforms)
  }

  default(value: Exclude<T, undefined>): Validator<Exclude<T, undefined>> {
    return new Validator(
      this._baseParse,
      { kind: 'default', value, transformOffset: this._transforms.length },
      this._transforms,
    ) as Validator<Exclude<T, undefined>>
  }

  transform<U>(fn: (value: T) => U): Validator<U> {
    return new Validator<U>(this._baseParse, this._mode, [
      ...this._transforms,
      fn as (value: unknown) => unknown,
    ])
  }
}

export type InferSchema<S extends Record<string, Validator<unknown>>> = {
  [K in keyof S]: S[K] extends Validator<infer T> ? T : never
}
