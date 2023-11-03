import * as path from 'node:path'
import * as childProcess from 'node:child_process'

type Next = {
  env?: {
    [envKey: string]: {
      match: RegExp
      required?: boolean
      csv?: boolean
    }
  }
}
type NextEnvEntry = [EnvKey: string, Required<Next>['env'][string]]

export type ScriptEnv =
  | Record<string, any>
  | NodeJS.ProcessEnv
  | 'inherit'
  | null
export type ScriptDef<
  Script extends string = string,
  Env extends ScriptEnv = ScriptEnv,
> = {
  script: Script
  next?: Next
  /** @default 'inherit' */
  env?: Env
}

export type Hooks = {
  beforeRun?: () => void | Promise<void>
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
    return this.reduce(scripts)
  }

  private reduce<Scripts extends ScriptDef[]>(scripts: Scripts): void {
    const scriptDef = scripts.shift()
    if (!scriptDef) {
      return
    }
    const env: NodeJS.ProcessEnv = process.env
    if (scriptDef.env && scriptDef.env !== 'inherit') {
      Object.assign(env, scriptDef.env)
    }
    const scriptPath = path.resolve(this.cwd, scriptDef.script)
    const entries = scriptDef.next?.env
      ? Object.entries(scriptDef.next.env)
      : []
    return this.fork(
      scriptPath,
      error => {
        if (error) {
          throw new Error(error.message)
        }
        this.checkRequired(scriptPath, entries, env)
        return this.reduce(scripts)
      },
      {
        env,
        stdio: 'pipe',
        signal: this.abortController.signal,
        onData: this.buildOnDataHandler(entries, env),
      },
    )
  }

  private checkRequired(
    scriptPath: string,
    entries: NextEnvEntry[],
    env: NodeJS.ProcessEnv,
  ) {
    for (const [key, def] of entries) {
      if (def.required && !env[key]) {
        throw new PipetError(
          `Required env "${key}" is not set after running script "${scriptPath}"`,
        )
      }
    }
  }

  private fork(
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

  private buildOnDataHandler(entries: NextEnvEntry[], env: NodeJS.ProcessEnv) {
    return (message: string) => {
      process.stdout.write(message)
      for (const [key, def] of entries) {
        const regex = def.match.global ? def.match : new RegExp(def.match, 'g')
        const match = message.matchAll(regex)
        if (!match) {
          continue
        }
        for (const [, ...value] of match) {
          const joined = value.join(',')
          if (def.csv && env[key]) {
            env[key] += `,${joined}`
          } else {
            env[key] = joined
          }
        }
      }
    }
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
