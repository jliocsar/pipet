import * as path from 'node:path'
import * as childProcess from 'node:child_process'
import * as timers from 'node:timers/promises'

type Dict<T> = {
  [key: string]: T
}
type StringIndex<T extends Dict<any>> = T[string]
type Nullable<T> = T | null
type Promiseable<T> = T | Promise<T>

type BinOptions = {
  /** @default process.cwd() */
  cwd?: string
  /** @default 'node' */
  bin?: string
  /** @default [] */
  binArgs?: string[]
}
type ValueDef = {
  match?: RegExp
  value?: string
  required?: boolean
  csv?: boolean
  abortEarly?: boolean
  continueEarly?: boolean
}
type Next = {
  args?: {
    [argKey: '$' | string]: ValueDef & {
      /** @default '--' */
      prefix?: '-' | '--' | '' | (string & {})
      /** @default '=' */
      equality?: '=' | ' ' | '' | (string & {})
      /** @default ',' */
      separator?: ',' | ' ' | '' | (string & {})
    }
  }
  env?: {
    [envKey: string]: ValueDef & {
      /** @default ',' */
      separator?: string
    }
  }
  decorateEnv?(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv
}
type NextEnvDef = StringIndex<Required<Next>['env']>
type NextArgDef = StringIndex<Required<Next>['args']>
type NextEnvEntry = [EnvKey: string, NextEnvDef]
type NextArgEntry = [EnvKey: string, NextArgDef]
type RunnableDef =
  | ((results: (1 | Error)[]) => Promise<(...args: any[]) => any>)
  | ScriptDef

export type ScriptEnv = Nullable<Dict<any> | NodeJS.ProcessEnv | 'inherit'>
export type ScriptArgs = Nullable<Next['args']>
export type ScriptDef<
  Script extends string = string,
  Env extends ScriptEnv = ScriptEnv,
  Args extends ScriptArgs = ScriptArgs,
> = BinOptions & {
  script: Script
  next?: Next
  args?: Args
  /** @default 'inherit' */
  env?: Env
}

export type Hooks = {
  /** Runs before all scripts, useful for building etc */
  beforeRun?: () => Promiseable<void>
  /** Runs after all scripts, useful for any clean up */
  afterRun?: () => Promiseable<void>
}
export type PipetOptions = Hooks & BinOptions

class PipetError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PipetError'
  }
}

export class Pipet {
  // Env is accumulated (not overwritten) for each script
  // This behavior can be changed in the `buildNextScriptParams` method
  // if necessary someday
  private readonly env: NodeJS.ProcessEnv = process.env
  private readonly abortController: AbortController

  constructor() {
    this.abortController = new AbortController()
  }

  async run<Runnables extends RunnableDef[], Options extends PipetOptions>(
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
    Options extends PipetOptions,
  >(runnables: Runnables, options?: Options) {
    const results: (1 | Error)[] = []
    // Args isn't accumulated as env
    let args: string[] = []
    for (const runnableDef of runnables) {
      if (!this.isScriptDef(runnableDef)) {
        await runnableDef(results)
        results.push(1)
        continue
      }
      const cwd = options?.cwd ?? runnableDef.cwd ?? process.cwd()
      const bin = options?.bin ?? runnableDef.bin ?? 'node'
      const binArgs = options?.binArgs ?? runnableDef.binArgs ?? []
      if (runnableDef.env && runnableDef.env !== 'inherit') {
        Object.assign(this.env, this.serialize(runnableDef.env))
      }
      const scriptPath = path.resolve(cwd, runnableDef.script)
      const envEntries = runnableDef.next?.env
        ? Object.entries(runnableDef.next.env)
        : []
      const argsEntries = runnableDef.next?.args
        ? Object.entries(runnableDef.next.args)
        : []
      let data = ''
      try {
        await this.spawn(scriptPath, bin, binArgs, {
          env: this.env,
          args,
          signal: this.abortController.signal,
          onData: chunk => {
            const {
              args: nextArgs,
              continueEarly,
              abortEarly,
            } = this.buildNextScriptParams((data += chunk), {
              scriptPath,
              envEntries,
              env: this.env,
              argsEntries,
            })
            args = nextArgs
            return { continueEarly, abortEarly }
          },
        })
        Object.assign(this.env, runnableDef.next?.decorateEnv?.(this.env) ?? {})
        results.push(1)
      } catch (error) {
        const pipetError = new PipetError((error as Error).message)
        console.error(pipetError)
        results.push(pipetError)
      }
    }
    return results
  }

  private serialize(scriptDefEnv: Omit<ScriptDef['env'], 'inherit'>) {
    const entries = Object.entries(scriptDefEnv)
    return entries.reduce<NodeJS.ProcessEnv>((env, [key, def]) => {
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
    }, {})
  }

  private checkRequiredFields(
    scriptPath: string,
    entries: (NextEnvEntry | NextArgEntry)[],
    map: NodeJS.ProcessEnv,
  ) {
    const length = entries.length
    let index = 0
    while (index < length) {
      const [key, def] = entries[index]
      if (def.required && [undefined, ''].includes(map[key])) {
        throw new PipetError(
          `Required key "${key}" is not set after running script "${scriptPath}"`,
        )
      }
      index++
    }
  }

  private spawn(
    scriptPath: string,
    bin: Required<PipetOptions>['bin'],
    binArgs: Required<PipetOptions>['binArgs'],
    options?: childProcess.SpawnOptions & {
      args?: string[]
      onData?(data: string): { continueEarly?: boolean; abortEarly?: boolean }
    },
  ) {
    return new Promise<void>((resolve, reject) => {
      try {
        const args = binArgs.concat(scriptPath, options?.args ?? [])
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
      if (!def.value && !def.match) {
        throw new PipetError(
          `Next entry "${key}" is missing a \`value\` or \`match\` property`,
        )
      }
      if (def.value) {
        if (def.csv && map[key]) {
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
      const regex = def.match!.global ? def.match! : new RegExp(def.match!, 'g')
      const match = data.matchAll(regex)
      if (!match) {
        index++
        continue
      }
      for (const [, ...value] of match) {
        const joined = value.join(def.separator ?? ',')
        if (def.csv && map[key]) {
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
      scriptPath: string
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
    this.checkRequiredFields(params.scriptPath, params.argsEntries, argsMap)
    const length = params.argsEntries.length
    let index = 0
    while (index < length) {
      const [key, value] = params.argsEntries[index]
      const mapped = argsMap[key]
      if (value.required && [undefined, null, ''].includes(mapped)) {
        throw new PipetError(
          `Required arg "${key}" is not set after running script "${params.scriptPath}"`,
        )
      }
      if (key === '$') {
        args.push(mapped!)
        index++
        continue
      }
      const prefix = value.prefix ?? '--'
      const equality = value.equality ?? '='
      args.push(`${prefix}${key}${equality}${mapped}`)
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
    this.checkRequiredFields(params.scriptPath, params.envEntries, params.env)
    return { args, continueEarly: envContinueEarly, abortEarly: envAbortEarly }
  }

  private isScriptDef(runnable: RunnableDef): runnable is ScriptDef {
    return 'script' in runnable
  }
}

/** Utility functions map */
export const U = {
  log(message: string) {
    return torn(() => process.stdout.write(message + '\n'))
  },
  tap<T>(cb: (value: T) => void | Promise<void>) {
    return torn(cb)
  },
  sleep(seconds: number) {
    return torn(() => timers.setTimeout(seconds * 1000))
  },
}

/** Builder functions map */
export const B = {
  script<Script extends string, Env extends ScriptEnv = ScriptEnv>(
    script: Script,
    env?: Env,
    next?: Next,
  ): ScriptDef<Script, Env> {
    return {
      script,
      env,
      next,
    }
  },
} as const

/** alias for `toRunnable` */
function torn<A extends any[]>(cb: (...args: A) => any) {
  return (...args: A) => cb(...args)
}
