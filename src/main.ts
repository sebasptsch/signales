import Signale from './signale'
import type { SignaleConstructor, SignaleType } from './signale'
import type {
  ConstructorOptions,
  DefaultLogTypes,
  LogLevel,
  InstanceConfiguration,
  LoggerFunction,
  LoggerTypesConf,
  ScopeFormatter, DefaultLogLevels,
} from './types'

export type SignaleEntrypoint = typeof Signale & { Signale: SignaleConstructor}

const signale: SignaleEntrypoint = Object.assign(new Signale(), {
  Signale,
})

const Signales: typeof Signale = Signale

export {
  signale,
  signale as signales,
  Signale,
  Signales,
}

// utility type
export type SignaleConstructorOptions<T extends string = DefaultLogTypes, L extends string = DefaultLogLevels> = ConstructorOptions<T, L>

// re-export types
export {
  SignaleType,
  LogLevel,
  InstanceConfiguration,
  LoggerFunction,
  LoggerTypesConf,
  ScopeFormatter
}

export default signale
