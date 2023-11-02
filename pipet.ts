import * as path from 'node:path'
import * as childProcess from 'node:child_process'

import type { ScriptDef, PipetOptions, ScriptEnv, Next } from './types'

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

function buildOnDataHandler(scriptDef: ScriptDef) {
  return (message: string) => {
    console.log(message)
  }
}

type NextEnvEntry = Required<Next>['env'][string]
const nextEnvMap = new WeakMap<Next, [EnvKey: string, NextEnvEntry][]>()

function reduce<Scripts extends ScriptDef[]>(scripts: Scripts): void {
  const scriptDef = scripts.shift()
  if (!scriptDef) {
    return
  }
  let env = process.env
  if (scriptDef.env && scriptDef.env !== 'inherit') {
    env = Object.assign(scriptDef.env, env)
  }
  const scriptPath = path.resolve(cwd, scriptDef.script)
  let nextEnvEntries: any[] = []
  if (scriptDef.next?.env && nextEnvMap.has(scriptDef.next.env)) {
    nextEnvEntries = Object.entries(nextEnvMap.get(scriptDef.next.env)!)
  }
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
      onData: buildOnDataHandler(nextEnvEntries),
      stdio: 'pipe',
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
