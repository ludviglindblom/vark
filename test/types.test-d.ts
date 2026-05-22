import { expectType } from 'tsd'
import { parse, v } from '../src/index.js'

const config = parse(
  {
    PORT: v.number().default(3000),
    DATABASE_URL: v.string().required(),
    NODE_ENV: v.enum(['development', 'production', 'test']).default('development'),
    DEBUG: v.boolean().default(false),
    OPTIONAL_STR: v.string().optional(),
    API_URL: v.url().required(),
    PORT2: v.port().required(),
    DATA: v.json<{ a: number }>().required(),
  },
  { env: {} },
)

expectType<number>(config.PORT)
expectType<string>(config.DATABASE_URL)
expectType<'development' | 'production' | 'test'>(config.NODE_ENV)
expectType<boolean>(config.DEBUG)
expectType<string | undefined>(config.OPTIONAL_STR)
expectType<string>(config.API_URL)
expectType<number>(config.PORT2)
expectType<{ a: number }>(config.DATA)

// transform changes the inferred type
const transformed = parse(
  {
    LENGTH: v
      .string()
      .transform((s) => s.length)
      .required(),
  },
  { env: {} },
)
expectType<number>(transformed.LENGTH)
