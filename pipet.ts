import * as path from 'node:path'
import * as childProcess from 'node:child_process'

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

  private reduce<Scripts extends ScriptDef[]>(scripts: Scripts): void {
    // Env is accumulated (not overwritten) for each script
    // This behavior can be changed in the `buildNextScriptParams` method
    // if necessary someday
    const env: NodeJS.ProcessEnv = process.env
    // Args isn't though
    let args: string[] = []
    const length = scripts.length
    let index = 0
    while (index < length) {
      const scriptDef = scripts[index]
      if (scriptDef.env && scriptDef.env !== 'inherit') {
        Object.assign(env, this.serialize(scriptDef.env))
      }
      const scriptPath = path.resolve(this.cwd, scriptDef.script)
      const envEntries = scriptDef.next?.env
        ? Object.entries(scriptDef.next.env)
        : []
      const argsEntries = scriptDef.next?.args
        ? Object.entries(scriptDef.next.args)
        : []
      const { data } = this.spawnDeez(scriptPath, {
        env,
        args,
        signal: this.abortController.signal,
      })
      args = this.buildNextScriptParams(data!, {
        scriptPath,
        envEntries,
        env,
        argsEntries,
      }).args
      index++
    }
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
    map: NodeJS.ProcessEnv | Record<string, string>,
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

  private spawnDeez(
    modulePath: string,
    options?: childProcess.SpawnOptions & {
      args?: string[]
    },
  ) {
    const args = [modulePath].concat(options?.args ?? [])
    const { output } = childProcess.spawnSync('node', args, {
      encoding: 'utf-8',
      env: options?.env,
      signal: options?.signal,
    })
    const [data] = output.filter(Boolean)
    return { data }
  }

  private buildFromGlobalMatch(
    data: string,
    entries: [string, NextEnvDef | NextArgDef][],
  ) {
    const map: Record<string, string> = {}
    const length = entries.length
    let index = 0
    while (index < length) {
      const [key, def] = entries[index]
      const regex = def.match.global ? def.match : new RegExp(def.match, 'g')
      const match = data.matchAll(regex)
      if (!match) {
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
      if (value.required && [undefined, ''].includes(mapped)) {
        throw new PipetError(
          `Required arg "${key}" is not set after running script "${params.scriptPath}"`,
        )
      }
      if (key === '$') {
        args.push(mapped)
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
