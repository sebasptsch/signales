import util from "util";
import path from "path";
import readline from "readline";
import chalk from "chalk";
import figures from "figures";
import defaultTypes from "./logger-types";

import { Writable as WritableStream } from "stream";

import {
  ConstructorOptions,
  DefaultLogTypes,
  InstanceConfiguration,
  LoggerConfiguration,
  LoggerFunction,
  LoggerTypesConf,
  DefaultLoggerTypes,
  DefaultLogLevels,
  ScopeFormatter,
  Secrets,
} from "./types";

type CallSite = NodeJS.CallSite;
type WriteStream = NodeJS.WriteStream;

const defaultLogLevels = {
  debug: 0,
  info: 1,
  timer: 2,
  warn: 3,
  error: 4,
};

const { green, grey, red, underline, yellow } = chalk;

let isPreviousLogInteractive = false;

export interface AdditionalFormatObj {
  suffix?: string;
  prefix?: string;
}

export interface TimeEndResult {
  label: string;
  span: number;
}

function defaultScopeFormatter(scopes: string[]): string {
  return `[${scopes.join("::")}]`;
}

function barsScopeFormatter(scopes: string[]): string {
  return scopes.map((scope) => `[${scope}]`).join(" ");
}

class SignaleImpl<T extends string = never, L extends string = never> {
  private _interactive: boolean;
  private _config: InstanceConfiguration;
  private _customTypes: LoggerTypesConf<T, L> &
    Partial<LoggerTypesConf<DefaultLogTypes, L>>;
  private _customLogLevels: Partial<Record<DefaultLogLevels, number>> &
    Record<L, number>;
  private _logLevels: Record<string, number>;
  private _disabled: boolean;
  private _scopeName: string | string[];
  private _timers: Map<string, number>;
  private _seqTimers: Array<string>;
  private _types: Record<T, Partial<LoggerConfiguration<L>>> &
    DefaultLoggerTypes<L>;
  private _stream: WritableStream | WritableStream[];
  private _longestLabel: string;
  private _secrets: Secrets;
  private _scopeFormatter: ScopeFormatter;
  private _generalLogLevel: L | DefaultLogLevels;

  static barsScopeFormatter: ScopeFormatter = barsScopeFormatter;

  constructor(options: ConstructorOptions<T, L> = {}) {
    this._interactive = options.interactive || false;
    this._config = Object.assign({}, options.config);
    this._customTypes = Object.assign({}, options.types);
    this._customLogLevels = Object.assign({}, options.logLevels);
    this._logLevels = Object.assign(
      {},
      defaultLogLevels,
      this._customLogLevels
    );
    this._disabled = options.disabled || false;
    this._scopeName = options.scope || "";
    this._scopeFormatter = options.scopeFormatter || defaultScopeFormatter;
    this._timers = new Map();
    this._seqTimers = [];
    this._types = this._mergeTypes(defaultTypes, this._customTypes);
    this._stream = options.stream || process.stderr;
    this._longestLabel = this._getLongestLabel();
    this._secrets = options.secrets || [];
    this._generalLogLevel = this._validateLogLevel(options.logLevel);

    Object.keys(this._types).forEach((type) => {
      // @ts-ignore
      this[type] = this._logger.bind(this, type);
    });
  }

  private get _now(): number {
    return Date.now();
  }

  get scopePath(): string[] {
    return this._arrayify(this._scopeName).filter((x) => x.length !== 0);
  }

  get currentOptions(): Omit<Required<ConstructorOptions<T, L>>, "scope"> {
    return {
      config: this._config,
      disabled: this._disabled,
      types: this._customTypes,
      interactive: this._interactive,
      stream: this._stream,
      scopeFormatter: this._scopeFormatter,
      secrets: this._secrets,
      logLevels: this._customLogLevels,
      logLevel: this._generalLogLevel,
    };
  }

  get date(): string {
    const _ = new Date();
    return [_.getFullYear(), _.getMonth() + 1, _.getDate()]
      .map((n) => String(n).padStart(2, "0"))
      .join("-");
  }

  get timestamp(): string {
    const _ = new Date();
    return [_.getHours(), _.getMinutes(), _.getSeconds()]
      .map((n) => String(n).padStart(2, "0"))
      .join(":");
  }

  get filename(): string {
    const _ = Error.prepareStackTrace;
    Error.prepareStackTrace = (_error, stack) => stack;
    const stack = new Error().stack as unknown as CallSite[];
    Error.prepareStackTrace = _;

    const callers = stack.map((x) => x.getFileName());

    const firstExternalFilePath = callers.find((x) => {
      return x !== callers[0];
    });

    return firstExternalFilePath
      ? path.basename(firstExternalFilePath)
      : "anonymous";
  }

  private get _longestUnderlinedLabel(): string {
    return underline(this._longestLabel);
  }

  set configuration(configObj: InstanceConfiguration) {
    this._config = Object.assign({}, configObj);
  }

  private _arrayify<T>(x: T): T extends any[] ? T : T[] {
    // @ts-ignore
    return Array.isArray(x) ? x : [x];
  }

  private _timeSpan(then: number): number {
    return this._now - then;
  }

  private _getLongestLabel(): string {
    const { _types } = this;
    const labels = Object.keys(_types).map((x) => _types[x as T].label || "");
    return labels.reduce((x, y) => (x.length > y.length ? x : y));
  }

  private _validateLogLevel(
    level: L | DefaultLogLevels | undefined
  ): L | DefaultLogLevels {
    return level && Object.keys(this._logLevels).includes(level)
      ? level
      : "debug";
  }

  private _mergeTypes(
    standard: DefaultLoggerTypes<L>,
    custom: LoggerTypesConf<T, L>
  ): Record<T, Partial<LoggerConfiguration<L>>> & DefaultLoggerTypes<L> {
    const types: Record<T, Partial<LoggerConfiguration<L>>> &
      DefaultLoggerTypes<L> = Object.assign({}, standard) as Record<
      T,
      Partial<LoggerConfiguration<L>>
    > &
      DefaultLoggerTypes<L>;

    Object.keys(custom).forEach((type) => {
      types[type as T] = Object.assign({}, types[type as T], custom[type as T]);
    });

    return types;
  }

  private _filterSecrets(message: string): string {
    const { _secrets } = this;

    if (_secrets.length === 0) {
      return message;
    }

    let safeMessage = message;

    _secrets.forEach((secret) => {
      safeMessage = safeMessage.replace(
        new RegExp(String(secret), "g"),
        "[secure]"
      );
    });

    return safeMessage;
  }

  private _formatStream(
    stream: WritableStream | WritableStream[]
  ): WritableStream[] {
    return this._arrayify(stream);
  }

  private _formatDate(): string {
    return `[${this.date}]`;
  }

  private _formatFilename(): string {
    return `[${this.filename}]`;
  }

  private _formatScopeName(): string {
    return this._scopeFormatter(this.scopePath);
  }

  private _formatTimestamp(): string {
    return `[${this.timestamp}]`;
  }

  private _formatMessage(str: any[] | string): string {
    // @ts-ignore todo: fix type
    return util.format(...this._arrayify(str));
  }

  private _meta(): string[] {
    const meta = [];

    if (this._config.displayDate) {
      meta.push(this._formatDate());
    }

    if (this._config.displayTimestamp) {
      meta.push(this._formatTimestamp());
    }

    if (this._config.displayFilename) {
      meta.push(this._formatFilename());
    }

    if (this.scopePath.length !== 0 && this._config.displayScope) {
      meta.push(this._formatScopeName());
    }

    if (meta.length !== 0) {
      meta.push(`${figures.pointerSmall}`);
      return meta.map((item) => grey(item));
    }

    return meta;
  }

  private _hasAdditional(
    { suffix, prefix }: AdditionalFormatObj,
    args: any[]
  ): string {
    return suffix || prefix ? "" : this._formatMessage(args);
  }

  private _buildSignale(
    type: Partial<LoggerConfiguration<L>>,
    ...args: any[]
  ): string {
    let msg;
    let additional: AdditionalFormatObj = {};

    if (args.length === 1 && typeof args[0] === "object" && args[0] !== null) {
      if (args[0] instanceof Error) {
        [msg] = args;
      } else {
        const [{ prefix, message, suffix }] = args;
        additional = Object.assign({}, { suffix, prefix });
        msg = message
          ? this._formatMessage(message)
          : this._hasAdditional(additional, args);
      }
    } else {
      msg = this._formatMessage(args);
    }

    const signale = this._meta();

    if (additional.prefix) {
      if (this._config.underlinePrefix) {
        signale.push(underline(additional.prefix));
      } else {
        signale.push(additional.prefix);
      }
    }

    const colorize = type.color ? chalk[type.color] : chalk.white;

    if (this._config.displayBadge && type.badge) {
      signale.push(colorize(this._padEnd(type.badge, type.badge.length + 1)));
    }

    if (this._config.displayLabel && type.label) {
      const label = this._config.uppercaseLabel
        ? type.label.toUpperCase()
        : type.label;
      if (this._config.underlineLabel) {
        signale.push(
          colorize(
            this._padEnd(
              underline(label),
              this._longestUnderlinedLabel.length + 1
            )
          )
        );
      } else {
        signale.push(
          colorize(this._padEnd(label, this._longestLabel.length + 1))
        );
      }
    }

    if (msg instanceof Error && msg.stack) {
      const [name, ...rest] = msg.stack.split("\n");
      if (this._config.underlineMessage) {
        signale.push(underline(name));
      } else {
        signale.push(name);
      }

      signale.push(grey(rest.map((l) => l.replace(/^/, "\n")).join("")));
      return signale.join(" ");
    }

    if (this._config.underlineMessage) {
      signale.push(underline(msg));
    } else {
      signale.push(msg);
    }

    if (additional.suffix) {
      if (this._config.underlineSuffix) {
        signale.push(underline(additional.suffix));
      } else {
        signale.push(additional.suffix);
      }
    }

    return signale.join(" ");
  }

  private _write(stream: WritableStream | WriteStream, message: string) {
    const isTTY: boolean = (stream as WriteStream).isTTY || false;
    if (this._interactive && isTTY && isPreviousLogInteractive) {
      readline.moveCursor(stream, 0, -1);
      readline.clearLine(stream, 0);
      readline.cursorTo(stream, 0);
    }

    if (stream instanceof WritableStream) {
      stream.write(`${message}\n`);
    } else {
      stream.write(`${message}\n`);
    }

    isPreviousLogInteractive = this._interactive;
  }

  private _log(
    message: string,
    streams: WritableStream | WritableStream[] = this._stream,
    logLevel: string
  ) {
    if (
      this.isEnabled() &&
      this._logLevels[logLevel] >= this._logLevels[this._generalLogLevel]
    ) {
      this._formatStream(streams).forEach((stream) => {
        this._write(stream, message);
      });
    }
  }

  private _logger(type: T, ...messageObj: any[]) {
    const { stream, logLevel } = this._types[type];
    const message = this._buildSignale(this._types[type], ...messageObj);
    this._log(
      this._filterSecrets(message),
      stream,
      this._validateLogLevel(logLevel)
    );
  }

  private _padEnd(str: string, targetLength: number): string {
    str = String(str);

    if (str.length >= targetLength) {
      return str;
    }

    return str.padEnd(targetLength);
  }

  addSecrets(secrets: Secrets): void {
    if (!Array.isArray(secrets)) {
      throw new TypeError("Argument must be an array.");
    }

    this._secrets.push(...secrets);
  }

  clearSecrets(): void {
    this._secrets = [];
  }

  config(configObj: InstanceConfiguration): void {
    this.configuration = configObj;
  }

  disable(): void {
    this._disabled = true;
  }

  enable(): void {
    this._disabled = false;
  }

  isEnabled(): boolean {
    return !this._disabled;
  }

  clone<N extends string = T, R extends SignaleType<N> = SignaleType<N>>(
    options: ConstructorOptions<N>
  ): R {
    const SignaleConstructor = (this.constructor ||
      SignaleImpl) as unknown as new (options: ConstructorOptions<N>) => R;
    const newInstance = new SignaleConstructor(
      Object.assign(this.currentOptions, options)
    );
    newInstance._timers = new Map(this._timers.entries());
    newInstance._seqTimers = [...this._seqTimers];

    return newInstance;
  }

  scope<R extends SignaleType<T> = SignaleType<T>>(...name: string[]): R {
    if (name.length === 0) {
      throw new Error("No scope name was defined.");
    }

    return this.clone({
      scope: name,
    });
  }

  child<R extends SignaleType<T> = SignaleType<T>>(name: string): R {
    const newScope = this.scopePath.concat(name);

    return this.scope<R>(...newScope);
  }

  unscope(): void {
    this._scopeName = "";
  }

  time(label?: string): string {
    if (!label) {
      label = `timer_${this._timers.size}`;
      this._seqTimers.push(label);
    }

    this._timers.set(label, this._now);

    const message = this._meta();
    message.push(green(this._padEnd(this._types.start.badge, 2)));

    if (this._config.underlineLabel) {
      message.push(
        green(
          this._padEnd(
            underline(label),
            this._longestUnderlinedLabel.length + 1
          )
        )
      );
    } else {
      message.push(green(this._padEnd(label, this._longestLabel.length + 1)));
    }

    message.push("Initialized timer...");
    this._log(message.join(" "), this._stream, "timer");

    return label;
  }

  timeEnd(label?: string): TimeEndResult | undefined {
    if (!label && this._seqTimers.length) {
      label = this._seqTimers.pop();
    }

    if (label && this._timers.has(label)) {
      const span = this._timeSpan(this._timers.get(label)!);
      this._timers.delete(label);

      const message = this._meta();
      message.push(red(this._padEnd(this._types.pause.badge, 2)));

      if (this._config.underlineLabel) {
        message.push(
          red(
            this._padEnd(
              underline(label),
              this._longestUnderlinedLabel.length + 1
            )
          )
        );
      } else {
        message.push(red(this._padEnd(label, this._longestLabel.length + 1)));
      }

      message.push("Timer run for:");
      message.push(
        yellow(span < 1000 ? span + "ms" : (span / 1000).toFixed(2) + "s")
      );
      this._log(message.join(" "), this._stream, "timer");

      return { label, span };
    }
  }
}

export type SignaleType<
  T extends string = never,
  L extends string = never
> = Record<T, LoggerFunction> &
  Record<DefaultLogTypes, LoggerFunction> &
  SignaleImpl<T, L> &
  (new <T extends string = never, L extends string = never>(
    options?: ConstructorOptions<T, L>
  ) => SignaleType<T, L>);

export type SignaleConstructor<
  T extends string = never,
  L extends string = never
> = new (options?: ConstructorOptions<T, L>) => SignaleType<T, L>;

export default SignaleImpl as unknown as SignaleType;
