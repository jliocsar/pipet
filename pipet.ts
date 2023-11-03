import * as path from 'node:path'
import * as childProcess from 'node:child_process'

type Next = {
  args?: {
    [argKey: string]: {
      match: RegExp
      required?: boolean
      csv?: boolean
      /** @default '--' */
      prefix?: '-' | '--' | ''
      /** @default '=' */
      equality?: '=' | ' ' | ''
    }
  }
  env?: {
    [envKey: string]: {
      match: RegExp
      required?: boolean
      csv?: boolean
    }
  }
}
type NextEnvDef = Required<Next>['env'][string]
type NextArgDef = Required<Next>['args'][string]
type NextEnvEntry = [EnvKey: string, NextEnvDef]
type NextArgEntry = [EnvKey: string, NextArgDef]

export type ScriptEnv =
  | Record<string, any>
  | NodeJS.ProcessEnv
  | 'inherit'
  | null
export type ScriptArgs = Next['args'] | null
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

export type Hooks = {
  beforeRun?: () => void | Promise<void>
  afterRun?: () => void | Promise<void>
}
export type PipetOptions = Hooks

class PipetError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PipetError'
  }
}

export class Pipet {
  constructor(
    private readonly cwd = process.cwd(),
    private readonly abortController = new AbortController(),
  ) {}

  async run<Scripts extends ScriptDef[]>(
    scripts: Scripts,
    options?: PipetOptions,
  ) {
    const length = scripts.length
    if (length < 1) {
      throw new PipetError('Need at least 1 script to run')
    }
    if (options?.beforeRun) {
      await options.beforeRun()
    }
    this.reduce(scripts)
    if (options?.afterRun) {
      await options.afterRun()
    }
  }

  private reduce<Scripts extends ScriptDef[]>(
    scripts: Scripts,
    env: NodeJS.ProcessEnv = {},
  ): void {
    const scriptDef = scripts.shift()
    if (!scriptDef) {
      return
    }
    const args: string[] = []
    if (scriptDef.env === 'inherit') {
      Object.assign(env, process.env)
    } else if (scriptDef.env) {
      Object.assign(env, this.serialize(scriptDef.env))
    }
    const scriptPath = path.resolve(this.cwd, scriptDef.script)
    const envEntries = scriptDef.next?.env
      ? Object.entries(scriptDef.next.env)
      : []
    const argsEntries = scriptDef.next?.args
      ? Object.entries(scriptDef.next.args)
      : []
    return this.spawnDeez(
      scriptPath,
      error => {
        if (error) {
          throw new Error(error.message)
        }
        console.log({ args })
        return this.reduce(scripts, env)
      },
      {
        env,
        stdio: 'pipe',
        signal: this.abortController.signal,
        onData: this.buildOnDataHandler({
          scriptPath,
          envEntries,
          env,
          argsEntries,
          args,
        }),
      },
    )
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

  private checkRequiredEnv(
    scriptPath: string,
    entries: NextEnvEntry[],
    env: NodeJS.ProcessEnv,
  ) {
    for (const [key, def] of entries) {
      if (def.required && [undefined, ''].includes(env[key])) {
        throw new PipetError(
          `Required env "${key}" is not set after running script "${scriptPath}"`,
        )
      }
    }
  }

  private checkRequiredArgs(
    scriptPath: string,
    entries: NextArgEntry[],
    args: Record<string, string>,
  ) {
    for (const [key, def] of entries) {
      if (def.required && !args[key]) {
        throw new PipetError(
          `Required arg "${key}" was not passed after running script "${scriptPath}"`,
        )
      }
    }
  }

  private spawnDeez(
    modulePath: string,
    callback: (err?: Error) => void,
    options?: childProcess.ForkOptions & {
      onData?: (message: string) => any
    },
  ) {
    const child = childProcess.fork(modulePath, options)
    const onData = options?.onData
    let data = Buffer.alloc(0)
    if (onData) {
      child.stdout!.on('data', buffer => {
        data = Buffer.concat([data, buffer])
      })
    }
    child
      .on('exit', () => {
        onData?.(data.toString('utf-8'))
        callback()
      })
      .on('error', error => {
        callback(error)
      })
  }

  private buildFromGlobalMatch(
    data: string,
    entries: [string, NextEnvDef | NextArgDef][],
  ) {
    const map: Record<string, string> = {}
    for (const [key, def] of entries) {
      const regex = def.match.global ? def.match : new RegExp(def.match, 'g')
      const match = data.matchAll(regex)
      if (!match) {
        continue
      }
      for (const [, ...value] of match) {
        const joined = value.join(',')
        if (def.csv && map[key]) {
          map[key] += `,${joined}`
        } else {
          map[key] = joined
        }
      }
    }
    return map
  }

  private buildOnDataHandler(params: {
    scriptPath: string
    envEntries: NextEnvEntry[]
    env: NodeJS.ProcessEnv
    argsEntries: NextArgEntry[]
    args: string[]
  }) {
    return (data: string) => {
      process.stdout.write(data)
      const argsMap = this.buildFromGlobalMatch(data, params.argsEntries)
      this.checkRequiredArgs(params.scriptPath, params.argsEntries, argsMap)
      Object.assign(
        params.env,
        this.buildFromGlobalMatch(data, params.envEntries),
      )
      this.checkRequiredEnv(params.scriptPath, params.envEntries, params.env)
      for (const [key, value] of params.argsEntries) {
        const mapped = argsMap[key]
        if (value.required && [undefined, ''].includes(mapped)) {
          throw new PipetError(
            `Required arg "${key}" is not set after running script "${params.scriptPath}"`,
          )
        }
        const prefix = value.prefix ?? '--'
        const equality = value.equality ?? '='
        params.args.push(`${prefix}${this.toDashCase(key)}${equality}${mapped}`)
      }
    }
  }

  private toDashCase(value: string) {
    return value.replace(/([A-Z])/g, '-$1').toLowerCase()
  }
}

export function script<
  Script extends string,
  Env extends ScriptEnv = ScriptEnv,
>(script: Script, env?: Env, next?: Next): ScriptDef<Script, Env> {
  return {
    script,
    env,
    next,
  }
}
