/// <reference types="node" />
type Dict<T> = {
    [key: string]: T;
};
type Nullable<T> = T | null;
type Promiseable<T> = T | Promise<T>;
declare const BIN: unique symbol;
declare const INJECT: unique symbol;
type BinOptions = {
    /** @default process.cwd() */
    cwd?: string;
    /** @default 'node' */
    bin?: string;
    /** @default [] */
    binArgs?: string[];
};
type ValueDef = {
    match?: RegExp;
    value?: string;
    required?: boolean;
    array?: boolean;
    abortEarly?: boolean;
    continueEarly?: boolean;
};
type InjectEnvDef<Env extends ScriptEnv = ScriptEnv> = {
    [INJECT]: true;
    env: (env: NodeJS.ProcessEnv) => Env;
};
type InjectArgsDef<Args extends string[] = string[]> = {
    [INJECT]: true;
    args: (args: string[]) => Args;
};
type ArgDef = Omit<ValueDef, 'array'> & {
    /** @default '--' */
    prefix?: '-' | '--' | '' | (string & {});
    /** @default '=' */
    equality?: '=' | ' ' | '' | (string & {});
    /** @default ',' */
    separator?: ',' | ' ' | '' | (string & {});
} & ({
    boolean?: true;
    array?: never;
} | {
    boolean?: never;
    array?: true;
});
type NextDef = {
    args?: {
        [argKey: '$' | string]: ArgDef;
    };
    env?: {
        [envKey: string]: ValueDef & {
            /** @default ',' */
            separator?: string;
        };
    };
    decorateEnv?(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv;
};
type RunnableDef = ((results: (1 | Error)[]) => Promise<(...args: any[]) => any>) | ScriptDef | InjectEnvDef | InjectArgsDef;
export type ScriptEnv = Nullable<Dict<any> | NodeJS.ProcessEnv | 'inherit'>;
export type ScriptArgs = Nullable<NextDef['args']>;
export type ScriptDef<Script extends string = string, Env extends ScriptEnv = ScriptEnv, Args extends ScriptArgs = ScriptArgs> = BinOptions & {
    readonly [BIN]?: boolean;
    script: Script;
    next?: NextDef;
    args?: Args;
    /** @default 'inherit' */
    env?: Env;
};
export type PipetHooks = {
    /** Runs before all scripts, useful for building etc */
    beforeRun?: () => Promiseable<void>;
    /** Runs after all scripts, useful for any clean up */
    afterRun?: () => Promiseable<void>;
};
export type PipetOptions = PipetHooks & BinOptions;
export declare class Pipet {
    private readonly env;
    private readonly abortController;
    private args;
    constructor();
    run<Runnables extends RunnableDef[], Options extends PipetOptions>(runnables: Runnables, options?: Options): Promise<(Error | 1)[]>;
    private reduce;
    private serialize;
    private checkRequiredFields;
    private spawn;
    private buildFromGlobalMatch;
    private buildNextScriptParams;
    private isScriptDef;
    private isInject;
}
/** Utility functions map */
export declare const U: {
    readonly log: (message: string) => () => any;
    readonly tap: <T>(cb: (value: T) => void | Promise<void>) => (value: T) => any;
    readonly sleep: (seconds: number) => () => any;
};
/** Builder functions map */
export declare const B: {
    readonly decorateEnv: <Env extends ScriptEnv = ScriptEnv>(env: (env: NodeJS.ProcessEnv) => Env) => InjectEnvDef<Env>;
    readonly decorateArgs: <Args extends string[] = string[]>(args: (args: string[]) => Args) => InjectArgsDef<Args>;
    readonly bin: <Bin extends string, Env_1 extends ScriptEnv = ScriptEnv>(bin: Bin, env?: Env_1 | undefined, next?: NextDef) => ScriptDef<Bin, Env_1, ScriptArgs>;
    readonly script: <Script extends string, Env_2 extends ScriptEnv = ScriptEnv>(script: Script, env?: Env_2 | undefined, next?: NextDef) => ScriptDef<Script, Env_2, ScriptArgs>;
};
export {};
