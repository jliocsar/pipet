export type Next = {
  env?: {
    [envKey: string]: {
      match: RegExp
      type?: 'string' | 'number' | 'boolean' | 'regexp'
      array?: boolean
      required?: boolean
    }
  }
}

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
