/// <reference types="node" />
type Dict<T> = {
    [key: string]: T;
};
type Nullable<T> = T | null;
type Promiseable<T> = T | Promise<T>;
/** @internal */
declare const BIN: unique symbol;
/** @internal */
declare const INJECT: unique symbol;
export type BinOptions = {
    /** @default process.cwd() */
    cwd?: string;
    /** @default 'node' */
    bin?: string;
    /** @default [] */
    binArgs?: string[];
};
export type ValueDef = {
    match?: RegExp;
    value?: string;
    required?: boolean;
    array?: boolean;
    abortEarly?: boolean;
    continueEarly?: boolean;
};
export type InjectEnvDef<Env extends ScriptEnv = ScriptEnv> = {
    /** @internal */
    readonly [INJECT]: true;
    env: (env: NodeJS.ProcessEnv) => Promiseable<Env>;
};
export type InjectArgsDef<Args extends string[] = string[]> = {
    /** @internal */
    readonly [INJECT]: true;
    args: (args: string[]) => Promiseable<Args>;
};
export type ArgDef = Omit<ValueDef, 'array'> & {
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
    decorateEnv?(env: NodeJS.ProcessEnv): Promiseable<NodeJS.ProcessEnv>;
};
type RunnableDef = ((results: (1 | Error)[]) => Promise<(...args: any[]) => any>) | ScriptDef | InjectEnvDef | InjectArgsDef;
export type ScriptEnv = Nullable<Dict<any> | NodeJS.ProcessEnv | 'inherit'>;
export type ScriptArgs = Nullable<NextDef['args']>;
export type ScriptDef<Script extends string = string, Env extends ScriptEnv = ScriptEnv, Args extends ScriptArgs = ScriptArgs> = BinOptions & {
    /** @internal */
    readonly [BIN]?: boolean;
    script: Script;
    next?: NextDef;
    args?: Args;
    /** @default 'inherit' */
    env?: Env;
};
export type Hooks = {
    /** Runs before all scripts, useful for building etc */
    beforeRun?: () => Promiseable<void>;
    /** Runs after all scripts, useful for any clean up */
    afterRun?: () => Promiseable<void>;
};
export type RunOptions = Hooks & BinOptions;
export declare class Pipet {
    private readonly env;
    private readonly abortController;
    private args;
    constructor();
    run<Runnables extends RunnableDef[], Options extends RunOptions>(runnables: Runnables, options?: Options): Promise<(Error | 1)[]>;
    private reduce;
    private serialize;
    private checkRequiredFields;
    private spawn;
    private buildFromGlobalMatch;
    private buildNextScriptParams;
    private isScriptDef;
    private isInject;
}
declare class Utility {
    log(message: string): () => any;
    tap<T>(cb: (value: T) => void | Promise<void>): (value: T) => any;
    sleep(seconds: number): () => any;
    /** alias for `toRunnable` */
    private torun;
}
declare class Builder {
    decorateEnv<Env extends ScriptEnv = ScriptEnv>(env: (env: NodeJS.ProcessEnv) => Promiseable<Env>): InjectEnvDef<Env>;
    decorateArgs<Args extends string[] = string[]>(args: (args: string[]) => Promiseable<Args>): InjectArgsDef<Args>;
    bin<Bin extends string, Env extends ScriptEnv = ScriptEnv>(bin: Bin, env?: Env, next?: NextDef): ScriptDef<Bin, Env>;
    script<Script extends string, Env extends ScriptEnv = ScriptEnv>(script: Script, env?: Env, next?: NextDef): ScriptDef<Script, Env>;
}
/** Builder functions map */
export declare const B: Builder;
/** Utility functions map */
export declare const U: Utility;
export {};
