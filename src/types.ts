/* Authors: Resi Respati <https://github.com/resir014>
 *          Kingdaro <https://github.com/kingdaro>
 *          Joydip Roy <https://github.com/rjoydip>
 *          Klaus Sinani <https://github.com/klaussinani>
 *          Andrey Rublev <https://github.com/anru>
 */

import { Writable as WritableStream } from 'stream'
import { Color } from 'chalk'

export type DefaultLogTypes =
  | 'await'
  | 'complete'
  | 'debug'
  | 'error'
  | 'fatal'
  | 'alert'
  | 'fav'
  | 'info'
  | 'log'
  | 'note'
  | 'pause'
  | 'pending'
  | 'star'
  | 'start'
  | 'success'
  | 'wait'
  | 'warn'
  | 'watch'

export type ChalkColor = typeof Color
export type Secrets = (string | number)[]

export type LoggerFunction = (...message: any[]) => void

export type DefaultLogLevels = 'info' | 'timer' | 'debug' | 'warn' | 'error'
// alias for backward-compatibility
export type LogLevel = DefaultLogLevels

export interface LoggerConfiguration<L extends string = DefaultLogLevels> {
  badge: string,
  color: ChalkColor | '',
  label: string,
  logLevel?: L | DefaultLogLevels,
  stream?: WritableStream | WritableStream[],
}

export type LoggerTypesConf<T extends string, L extends string = DefaultLogLevels> = Record<T, LoggerConfiguration<L>>

export interface InstanceConfiguration {
  displayBadge?: boolean,
  displayDate?: boolean,
  displayFilename?: boolean,
  displayLabel?: boolean,
  displayScope?: boolean,
  displayTimestamp?: boolean,
  underlineLabel?: boolean,
  underlineMessage?: boolean,
  underlinePrefix?: boolean,
  underlineSuffix?: boolean,
  uppercaseLabel?: boolean,
}

export type ScopeFormatter = (scopePath: string[]) => string

export interface ConstructorOptions<T extends string, L extends string = DefaultLogLevels> {
  config?: InstanceConfiguration,
  disabled?: boolean,
  interactive?: boolean,
  logLevel?: L | DefaultLogLevels,
  logLevels?: Record<L, number>,
  scope?: string | string[],
  scopeFormatter?: ScopeFormatter,
  secrets?: Secrets,
  stream?: WritableStream | WritableStream[],
  types?: Partial<LoggerTypesConf<T, L>>,
}
