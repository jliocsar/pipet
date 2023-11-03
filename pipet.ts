import * as path from 'node:path'
import * as childProcess from 'node:child_process'

type Dict<T> = {
  [key: string]: T
}
type StringIndex<T extends Dict<any>> = T[string]
type Nullable<T> = T | null
type Promiseable<T> = T | Promise<T>

type Next = {
  args?: {
    [argKey: '$' | string]: {
      match: RegExp
      required?: boolean
      csv?: boolean
      /** @default '--' */
      prefix?: '-' | '--' | '' | (string & {})
      /** @default '=' */
      equality?: '=' | ' ' | '' | (string & {})
      /** @default ',' */
      separator?: ',' | ' ' | '' | (string & {})
    }
  }
  env?: {
    [envKey: string]: {
      match: RegExp
      required?: boolean
      csv?: boolean
      /** @default ',' */
      separator?: string
    }
  }
}
type NextEnvDef = StringIndex<Required<Next>['env']>
type NextArgDef = StringIndex<Required<Next>['args']>
type NextEnvEntry = [EnvKey: string, NextEnvDef]
type NextArgEntry = [EnvKey: string, NextArgDef]
type RunnableDef = (() => (...args: any[]) => any) | ScriptDef

export type ScriptEnv = Nullable<Dict<any> | NodeJS.ProcessEnv | 'inherit'>
export type ScriptArgs = Nullable<Next['args']>
export type ScriptDef<
  Script extends string = string,
  Env extends ScriptEnv = ScriptEnv,
  Args extends ScriptArgs = ScriptArgs,
> = {
  script: Script
  next?: Next
  args?: Args
  /** @default 'inherit' */
  env?: Env
}

export type RunHooks = {
  /** Runs before all scripts, useful for building etc */
  beforeRun?: () => Promiseable<void>
  /** Runs after all scripts, useful for any clean up */
  afterRun?: () => Promiseable<void>
}
export type PipetOptions = RunHooks & {
  /** @default process.cwd() */
  cwd?: string
  /** @default 'node' */
  bin?: string
  /** @default [] */
  binArgs?: string[]
}

class PipetError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PipetError'
  }
}

export class Pipet {
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
    const results = this.reduce(runnables, options)
    if (options?.afterRun) {
      await options.afterRun()
    }
    return results
  }

  private reduce<Runnables extends RunnableDef[], Options extends PipetOptions>(
    runnables: Runnables,
    options?: Options,
  ) {
    const cwd = options?.cwd ?? process.cwd()
    const bin = options?.bin ?? 'node'
    const binArgs = options?.binArgs ?? []
    // Env is accumulated (not overwritten) for each script
    // This behavior can be changed in the `buildNextScriptParams` method
    // if necessary someday
    const env: NodeJS.ProcessEnv = process.env
    // Args isn't though
    let args: string[] = []
    return runnables.reduce<(1 | Error)[]>((results, runnableDef) => {
      if (!this.isScriptDef(runnableDef)) {
        runnableDef()
        results.push(1)
        return results
      }
      if (runnableDef.env && runnableDef.env !== 'inherit') {
        Object.assign(env, this.serialize(runnableDef.env))
      }
      const scriptPath = path.resolve(cwd, runnableDef.script)
      const envEntries = runnableDef.next?.env
        ? Object.entries(runnableDef.next.env)
        : []
      const argsEntries = runnableDef.next?.args
        ? Object.entries(runnableDef.next.args)
        : []
      const { data, error } = this.spawn(scriptPath, bin, binArgs, {
        env,
        args,
        signal: this.abortController.signal,
      })
      if (error) {
        results.push(error as Error)
        return results
      }
      args = this.buildNextScriptParams(data!, {
        scriptPath,
        envEntries,
        env,
        argsEntries,
      }).args
      results.push(1)
      return results
    }, [])
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
    },
  ) {
    try {
      const args = binArgs.concat(scriptPath, options?.args ?? [])
      const { output } = childProcess.spawnSync(bin, args, {
        encoding: 'utf-8',
        env: options?.env,
        signal: options?.signal,
      })
      const [data] = output.filter(Boolean)
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
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
      const regex = def.match.global ? def.match : new RegExp(def.match, 'g')
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
      }
      index++
    }
    return map
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
    process.stdout.write(data)
    const argsMap = this.buildFromGlobalMatch(data, params.argsEntries)
    const args: string[] = []
    this.checkRequiredFields(params.scriptPath, params.argsEntries, argsMap)
    Object.assign(
      params.env,
      this.buildFromGlobalMatch(data, params.envEntries),
    )
    this.checkRequiredFields(params.scriptPath, params.envEntries, params.env)
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
      args.push(`${prefix}${this.toDashCase(key)}${equality}${mapped}`)
      index++
    }
    return { args }
  }

  private isScriptDef(runnable: RunnableDef): runnable is ScriptDef {
    return 'script' in runnable
  }

  private toDashCase(value: string) {
    return value.replace(/([A-Z])/g, '-$1').toLowerCase()
  }
}

/** Utility functions map */
export const U = {
  log(message: string) {
    return torn(process.stdout.write.bind(process.stdout, message + '\n'))
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
function torn(cb: (...args: any[]) => any) {
  return () => cb()
}
