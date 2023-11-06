import * as path from 'node:path'
import * as childProcess from 'node:child_process'
import * as timers from 'node:timers/promises'

/** @internal */
type Dict<T> = {
  [key: string]: T
}
/** @internal */
type StringIndex<T extends Dict<any>> = T[string]
/** @internal */
type Nullable<T> = T | null
/** @internal */
type Promiseable<T> = T | Promise<T>

/** @internal */
const BIN = Symbol('BIN')
/** @internal */
const INJECT = Symbol('INJECT')

export type BinOptions = {
  /**
   * The default current working directory in which to run scripts.
   * @default process.cwd()
   */
  cwd?: string
  /**
   * The default binary to run scripts with.
   * @default 'node'
   */
  bin?: string
  /**
   * The default binary arguments to pass to the binary.
   * @default []
   */
  binArgs?: string[]
}
export type ValueDef = {
  /**
   * A match to search for in the output of the previous script.
   *
   * This is a regular expression that will be run with the `g` flag.
   */
  match?: RegExp
  /**
   * The value to set the environment variable to.
   *
   * If `match` is set, this will be ignored.
   */
  value?: string
  /**
   * Aborts the script if the value is not found.
   */
  required?: boolean
  /**
   * Matches all value from `match` into a comma separated string.
   *
   * If `array` isn't set to `true`, only the last match will be used.
   */
  array?: boolean
  /**
   * Aborts the script if the value was found.
   */
  abortEarly?: boolean
  /**
   * Continues to the next script if the value was found.
   */
  continueEarly?: boolean
}
/** @internal */
type InjectEnvDef<Env extends ScriptEnv = ScriptEnv> = {
  readonly [INJECT]: true
  env: (env: NodeJS.ProcessEnv) => Promiseable<Env>
}
/** @internal */
type InjectArgsDef<Args extends string[] = string[]> = {
  readonly [INJECT]: true
  args: (args: string[]) => Promiseable<Args>
}
export type ArgDef = Omit<ValueDef, 'array'> & {
  /**
   * Prefix used for the argument.
   * @default '--'
   */
  prefix?: '-' | '--' | '' | (string & {})
  /**
   * Equality sign used for the argument.
   * @default '='
   */
  equality?: '=' | ' ' | '' | (string & {})
  /**
   * Separator used in the array value.
   * @default ','
   */
  separator?: ',' | ' ' | '' | (string & {})
} & (
    | {
        /**
         * Whether the argument is a boolean flag.
         *
         * This can't be used with `array`.
         */
        boolean?: true
        array?: never
      }
    | {
        boolean?: never
        /**
         * Whether the argument is an array.
         *
         * This can't be used with `boolean`.
         */
        array?: true
      }
  )
export type NextDef = {
  /**
   * Arguments definition for the next script.
   */
  args?: {
    [argKey: '$' | string]: ArgDef
  }
  /**
   * Environment variables definition for the next script.
   */
  env?: {
    [envKey: string]: ValueDef & {
      /** @default ',' */
      separator?: string
    }
  }
}
/** @internal */
type NextEnvDef = StringIndex<Required<NextDef>['env']>
/** @internal */
type NextArgDef = StringIndex<Required<NextDef>['args']>
/** @internal */
type NextEnvEntry = [EnvKey: string, NextEnvDef]
/** @internal */
type NextArgEntry = [EnvKey: string, NextArgDef]
export type RunnableDef =
  | ((results: (1 | Error)[]) => Promise<(...args: any[]) => any>)
  | ScriptDef
  | InjectEnvDef
  | InjectArgsDef

export type ScriptEnv = Nullable<Dict<any> | NodeJS.ProcessEnv | 'inherit'>
export type ScriptArgs = Nullable<NextDef['args']>
export type ScriptDef<
  Script extends string = string,
  Env extends ScriptEnv = ScriptEnv,
  Args extends ScriptArgs = ScriptArgs,
> = BinOptions & {
  /** @internal */
  readonly [BIN]?: boolean
  script: Script
  next?: NextDef
  args?: Args
  /** @default 'inherit' */
  env?: Env
}

export type Hooks = {
  /** Runs before all scripts, useful for building steps */
  beforeRun?: () => Promiseable<void>
  /** Runs after all scripts, useful for any clean up effect */
  afterRun?: () => Promiseable<void>
}
export type RunOptions = Hooks & BinOptions
type SpawnOptions<Options extends RunOptions> = childProcess.SpawnOptions &
  Options & {
    args?: string[]
    onData?(data: string): { continueEarly?: boolean; abortEarly?: boolean }
  }

export class PipetError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PipetError'
  }
}

export class Pipet {
  // Env is accumulated (not overwritten) for each script
  // This behavior can be changed in the `buildNextScriptParams` method
  // if necessary someday
  private readonly env: NodeJS.ProcessEnv
  private readonly abortController: AbortController
  private args: string[]

  constructor() {
    this.env = process.env
    this.args = []
    this.abortController = new AbortController()
  }

  /**
   * Runs a series of scripts or utility functions in order.
   * @param runnables Scripts or utility functions to run
   * @param optionsOptions to pass to the scripts (overridden by the script options)
   * @returns An array of results from each script
   */
  async run<Runnables extends RunnableDef[], Options extends RunOptions>(
    runnables: Runnables,
    options?: Options,
  ) {
    const length = runnables.length
    if (length < 1) {
      throw new PipetError('Need at least 1 script to run')
    }
    if (options?.beforeRun) {
      await options.beforeRun()
    }
    const results = await this.reduce(runnables, options)
    if (options?.afterRun) {
      await options.afterRun()
    }
    return results
  }

  private async reduce<
    Runnables extends RunnableDef[],
    Options extends RunOptions,
  >(runnables: Runnables, options?: Options) {
    const length = runnables.length
    const results: (1 | Error)[] = []
    let index = 0
    while (index < length) {
      const runnableDef = runnables[index]
      if (!this.isScriptDef(runnableDef)) {
        if (this.isInject(runnableDef)) {
          if ('env' in runnableDef) {
            Object.assign(this.env, await runnableDef.env(this.env))
          } else if (runnableDef.args) {
            this.args = await runnableDef.args(this.args)
          }
          index++
          continue
        }
        await runnableDef(results)
        index++
        continue
      }
      if (runnableDef.env && runnableDef.env !== 'inherit') {
        Object.assign(this.env, this.serialize(runnableDef.env))
      }
      const envEntries = runnableDef.next?.env
        ? Object.entries(runnableDef.next.env)
        : []
      const argsEntries = runnableDef.next?.args
        ? Object.entries(runnableDef.next.args)
        : []
      const spawnOptions = <SpawnOptions<Options>>{
        env: this.env,
        args: this.args,
        signal: this.abortController.signal,
        onData: chunk => {
          const {
            args: nextArgs,
            continueEarly,
            abortEarly,
          } = this.buildNextScriptParams((data += chunk), {
            label: runnableDef.script,
            envEntries,
            env: this.env,
            argsEntries,
          })
          this.args = nextArgs
          return { continueEarly, abortEarly }
        },
      }
      Object.assign(spawnOptions, options)
      let data = ''
      try {
        await this.spawn(runnableDef, spawnOptions)
        results.push(1)
      } catch (error) {
        const pipetError = new PipetError((error as Error).message)
        console.error(pipetError)
        results.push(pipetError)
      }
      index++
    }
    return results
  }

  private serialize(scriptDefEnv: Omit<ScriptDef['env'], 'inherit'>) {
    return Object.entries(scriptDefEnv).reduce<NodeJS.ProcessEnv>(
      (env, [key, def]) => {
        if (def === undefined || def === null) {
          throw new PipetError(`Env "${key}" is \`undefined\` or \`null\``)
        }
        switch (true) {
          case def instanceof RegExp:
            env[key] = (def as RegExp).source
            return env
          case typeof def === 'object':
            env[key] = JSON.stringify(def)
            return env
          default:
            env[key] = def.toString()
            return env
        }
      },
      {},
    )
  }

  private checkRequiredFields(
    label: string,
    entries: (NextEnvEntry | NextArgEntry)[],
    map: NodeJS.ProcessEnv,
  ) {
    const length = entries.length
    let index = 0
    while (index < length) {
      const [key, def] = entries[index]
      if (def.required && [undefined, ''].includes(map[key])) {
        throw new PipetError(
          `Required key "${key}" is not set after running script "${label}"`,
        )
      }
      index++
    }
  }

  private spawn<Options extends RunOptions>(
    scriptDef: ScriptDef,
    options?: childProcess.SpawnOptions &
      Options & {
        args?: string[]
        onData?(data: string): { continueEarly?: boolean; abortEarly?: boolean }
      },
  ) {
    return new Promise<void>((resolve, reject) => {
      try {
        const cwd = options?.cwd ?? scriptDef.cwd ?? process.cwd()
        const binArgs = options?.binArgs ?? scriptDef.binArgs ?? []
        let bin = null
        let args = null
        if (scriptDef[BIN]) {
          bin = scriptDef.script
          args = binArgs.concat(options?.args ?? [])
        } else {
          bin = options?.bin ?? scriptDef.bin ?? 'node'
          args = binArgs.concat(
            path.resolve(cwd, scriptDef.script),
            options?.args ?? [],
          )
        }

        const child = childProcess
          .spawn(bin, args, {
            env: options?.env,
            signal: options?.signal,
          })
          .on('error', reject)
        child.stdout
          .on('data', data => {
            process.stdout.write(data)
            if (data && options?.onData) {
              const { continueEarly, abortEarly } = options.onData(
                data.toString(),
              )
              if (continueEarly) {
                return resolve()
              }
              if (abortEarly) {
                child.kill()
                return process.nextTick(resolve)
              }
            }
          })
          .on('error', reject)
          .on('close', resolve)
      } catch (error) {
        return reject(error)
      }
    })
  }

  private buildFromGlobalMatch(
    data: string,
    entries: [string, NextEnvDef | NextArgDef][],
  ) {
    const map: NodeJS.ProcessEnv = {}
    const length = entries.length
    let index = 0
    while (index < length) {
      const [key, def] = entries[index]
      if (def.value) {
        if (def.array && map[key]) {
          map[key] += `,${def.value}`
        } else {
          map[key] = def.value
        }
        if (def.continueEarly) {
          return { continueEarly: true, map }
        }
        if (def.abortEarly) {
          return { abortEarly: true, map }
        }
        index++
        continue
      }
      if (!def.match) {
        index++
        continue
      }
      const regex = def.match.global ? def.match : new RegExp(def.match!, 'g')
      const match = data.matchAll(regex)
      if (!match) {
        index++
        continue
      }
      for (const [, ...value] of match) {
        const joined = value.join(def.separator ?? ',')
        if (def.array && map[key]) {
          map[key] += `,${joined}`
        } else {
          map[key] = joined
        }
        if (def.continueEarly) {
          return { continueEarly: true, map }
        }
        if (def.abortEarly) {
          return { abortEarly: true, map }
        }
      }
      index++
    }
    return { map }
  }

  private buildNextScriptParams(
    data: string,
    params: {
      label: string
      envEntries: NextEnvEntry[]
      env: NodeJS.ProcessEnv
      argsEntries: NextArgEntry[]
    },
  ) {
    const {
      continueEarly: argsContinueEarly,
      abortEarly: argsAbortEarly,
      map: argsMap,
    } = this.buildFromGlobalMatch(data, params.argsEntries)
    const args: string[] = []
    this.checkRequiredFields(params.label, params.argsEntries, argsMap)
    const length = params.argsEntries.length
    let index = 0
    while (index < length) {
      const [key, value] = params.argsEntries[index]
      const mapped = argsMap[key]
      if (value.required && [undefined, null, ''].includes(mapped)) {
        throw new PipetError(
          `Required arg "${key}" is not set after running script "${params.label}"`,
        )
      }
      if (key === '$') {
        args.push(mapped!)
        index++
        continue
      }
      const prefix = value.prefix ?? '--'
      if (value.boolean) {
        args.push(`${prefix}${key}`)
      } else {
        const equality = value.equality ?? '='
        args.push(`${prefix}${key}${equality}${mapped}`)
      }
      index++
    }
    if (argsContinueEarly || argsAbortEarly) {
      return {
        args,
        continueEarly: argsContinueEarly,
        abortEarly: argsAbortEarly,
      }
    }
    const {
      continueEarly: envContinueEarly,
      abortEarly: envAbortEarly,
      map: env,
    } = this.buildFromGlobalMatch(data, params.envEntries)
    Object.assign(params.env, env)
    this.checkRequiredFields(params.label, params.envEntries, params.env)
    return { args, continueEarly: envContinueEarly, abortEarly: envAbortEarly }
  }

  private isScriptDef(runnable: RunnableDef): runnable is ScriptDef {
    return 'script' in runnable
  }

  private isInject(
    runnable: RunnableDef,
  ): runnable is InjectEnvDef | InjectArgsDef {
    return INJECT in runnable
  }
}

/** Utility functions map */
export class Utility {
  /**
   * Prints a message to `stdout` between script runs.
   * @param message Message to print to `stdout`
   */
  log(message: string) {
    return this.torun(() => process.stdout.write(message + '\n'))
  }

  /**
   * Runs a callback for the current results on the script chain.
   */
  tap<T>(cb: (value: T) => void | Promise<void>) {
    return this.torun(cb)
  }

  /**
   * Sleeps for the specified number of seconds between script runs.
   * @param seconds Number of seconds to sleep
   */
  sleep(seconds: number) {
    return this.torun(() => timers.setTimeout(seconds * 1000))
  }

  /** alias for `toRunnable` */
  private torun<A extends any[]>(cb: (...args: A) => any) {
    return (...args: A) => cb(...args)
  }
}

/** Builder functions map */
export class Builder {
  /**
   * Decorates the environment variables passed to the next script.
   * @param env Async callback that receives the accumulated environment variables
   * @returns The decorated environment variables
   */
  decorateEnv<Env extends ScriptEnv = ScriptEnv>(
    env: (env: NodeJS.ProcessEnv) => Promiseable<Env>,
  ): InjectEnvDef<Env> {
    return {
      [INJECT]: true,
      env,
    }
  }

  /**
   * Decorates the arguments passed to the next script.
   * @param args Async callback that receives the accumulated arguments
   * @returns The decorated arguments
   */
  decorateArgs<Args extends string[] = string[]>(
    args: (args: string[]) => Promiseable<Args>,
  ): InjectArgsDef<Args> {
    return {
      [INJECT]: true,
      args,
    }
  }

  /**
   * Builds a script definition for a binary.
   * @param bin The binary to run
   * @param env Environment variables to pass to the binary
   * @param next Options to pass to the next script
   * @returns The script definition
   */
  bin<Bin extends string, Env extends ScriptEnv = ScriptEnv>(
    bin: Bin,
    env?: Env,
    next?: NextDef,
  ): ScriptDef<Bin, Env> {
    return {
      [BIN]: true,
      script: bin,
      env,
      next,
    }
  }

  /**
   * Builds a script definition.
   * @param script The script path
   * @param env Environment variables to pass to the script
   * @param next Options to pass to the next script
   * @returns The script definition
   */
  script<Script extends string, Env extends ScriptEnv = ScriptEnv>(
    script: Script,
    env?: Env,
    next?: NextDef,
  ): ScriptDef<Script, Env> {
    return {
      script,
      env,
      next,
    }
  }
}

export const B = new Builder()
export const U = new Utility()
