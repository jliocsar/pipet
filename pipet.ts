import * as path from 'node:path'
import * as childProcess from 'node:child_process'

export type Next = {
  env?: {
    [envKey: string]: {
      match: RegExp
      required?: boolean
      csv?: boolean
    }
  }
}
export type NextEnvDef = Record<string, Required<Next>['env'][string]>

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

const cwd = process.cwd()
const { signal } = new AbortController()

function fork(
  modulePath: string,
  callback: (err?: Error) => void,
  options?: childProcess.ForkOptions & {
    onData?: (message: string) => any
  },
) {
  const child = childProcess.fork(modulePath, options)
  const onData = options?.onData
  let data = ''
  if (onData) {
    child.stdout!.on('data', buffer => {
      data += buffer.toString()
    })
  }
  child
    .on('exit', () => {
      onData?.(data)
      callback()
    })
    .on('error', error => {
      callback(error)
    })
}

function buildOnDataHandler(
  nextEnvDef: NextEnvDef = {},
  env: NodeJS.ProcessEnv,
) {
  const entries = Object.entries(nextEnvDef)
  return (message: string) => {
    process.stdout.write(message)
    for (const [key, def] of entries) {
      const regex = def.match.global ? def.match : new RegExp(def.match, 'g')
      const match = message.matchAll(regex)
      if (!match) {
        continue
      }
      for (const [, value] of match) {
        if (def.csv && env[key]) {
          env[key] += `,${value}`
        } else {
          env[key] = value
        }
      }
    }
  }
}

function reduce<Scripts extends ScriptDef[]>(scripts: Scripts): void {
  const scriptDef = scripts.shift()
  if (!scriptDef) {
    return
  }
  const env: NodeJS.ProcessEnv = process.env
  if (scriptDef.env && scriptDef.env !== 'inherit') {
    Object.assign(env, scriptDef.env)
  }
  const scriptPath = path.resolve(cwd, scriptDef.script)
  return fork(
    scriptPath,
    error => {
      if (error) {
        throw new Error(error.message)
      }
      return reduce(scripts)
    },
    {
      env,
      signal,
      stdio: 'pipe',
      onData: buildOnDataHandler(scriptDef.next?.env, env),
    },
  )
}

export async function pipet<Scripts extends ScriptDef[]>(
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
  return reduce(scripts)
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
