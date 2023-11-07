/// <reference types="node" />
/** @internal */
type Dict<T> = {
    [key: string]: T;
};
/** @internal */
type Nullable<T> = T | null;
/** @internal */
type Promiseable<T> = T | Promise<T>;
export type BinOptions = {
    /**
     * The default current working directory in which to run scripts.
     * @default process.cwd()
     */
    cwd?: string;
    /**
     * The default binary to run scripts with.
     * @default 'node'
     */
    bin?: string;
    /**
     * The default binary arguments to pass to the binary.
     * @default []
     */
    binArgs?: string[];
};
export type ValueDef = {
    /**
     * A match to search for in the output of the previous script.
     *
     * This is a regular expression that will be run with the `g` flag.
     */
    match?: RegExp;
    /**
     * The value to set the environment variable to.
     *
     * If `match` is set, this will be ignored.
     */
    value?: string;
    /**
     * Aborts the script if the value is not found.
     */
    required?: boolean;
    /**
     * Matches all value from `match` into a comma separated string.
     *
     * If `array` isn't set to `true`, only the last match will be used.
     */
    array?: boolean;
    /**
     * Aborts the script if the value was found.
     */
    abortEarly?: boolean;
    /**
     * Continues to the next script if the value was found.
     */
    continueEarly?: boolean;
};
/** @internal */
declare class InjectEnvDef<Env extends ScriptEnv = ScriptEnv> {
    readonly env: (env: NodeJS.ProcessEnv) => Promiseable<Env>;
    constructor(env: (env: NodeJS.ProcessEnv) => Promiseable<Env>);
}
/** @internal */
declare class InjectArgsDef<Args extends string[] = string[]> {
    readonly args: (args: string[]) => Promiseable<Args>;
    constructor(args: (args: string[]) => Promiseable<Args>);
}
export type ArgDef = Omit<ValueDef, 'array'> & {
    /**
     * Prefix used for the argument.
     * @default '--'
     */
    prefix?: '-' | '--' | '' | (string & {});
    /**
     * Equality sign used for the argument.
     * @default '='
     */
    equality?: '=' | ' ' | '' | (string & {});
    /**
     * Separator used in the array value.
     * @default ','
     */
    separator?: ',' | ' ' | '' | (string & {});
} & ({
    /**
     * Whether the argument is a boolean flag.
     *
     * This can't be used with `array`.
     */
    boolean?: true;
    array?: never;
} | {
    boolean?: never;
    /**
     * Whether the argument is an array.
     *
     * This can't be used with `boolean`.
     */
    array?: true;
});
export type NextDef = BinOptions & {
    /**
     * Arguments definition for the next script.
     */
    args?: {
        [argKey: '$' | string]: ArgDef;
    };
    /**
     * Environment variables definition for the next script.
     */
    env?: {
        [envKey: string]: ValueDef & {
            /** @default ',' */
            separator?: string;
        };
    };
};
export type RunnableDef = ((results: (1 | Error)[]) => Promise<(...args: any[]) => any>) | ((ScriptDef | BinScriptDef) & BinOptions) | InjectEnvDef | InjectArgsDef;
export type ScriptEnv = Nullable<Dict<any> | NodeJS.ProcessEnv | 'inherit'>;
export declare class ScriptDef<Script extends string = string> {
    readonly script: Script;
    readonly next?: NextDef | undefined;
    constructor(script: Script, next?: NextDef | undefined);
}
export declare class BinScriptDef<Bin extends string = string> extends ScriptDef<Bin> {
}
export type Hooks = {
    /** Runs before all scripts, useful for building steps */
    beforeRun?: () => Promiseable<void>;
    /** Runs after all scripts, useful for any clean up effect */
    afterRun?: () => Promiseable<void>;
};
export type RunOptions<Env extends ScriptEnv = ScriptEnv> = Hooks & BinOptions & {
    /** @default 'inherit' */
    initialEnv?: Env;
};
export declare class PipetError extends Error {
    constructor(message: string);
}
export declare class Pipet {
    private readonly env;
    private readonly abortController;
    private args;
    constructor();
    /**
     * Runs a series of scripts or utility functions in order.
     * @param runnables Scripts or utility functions to run
     * @param optionsOptions to pass to the scripts (overridden by the script options)
     * @returns An array of results from each script
     */
    run<Runnables extends RunnableDef[], Options extends RunOptions>(runnables: Runnables, options?: Options): Promise<(Error | 1)[]>;
    private reduce;
    private serialize;
    private checkRequiredFields;
    private spawn;
    private buildFromGlobalMatch;
    private buildNextScriptParams;
    private isInject;
}
/** Utility functions map */
export declare class Utility {
    /**
     * Prints a message to `stdout` between script runs.
     * @param message Message to print to `stdout`
     */
    log(message: string): () => any;
    /**
     * Runs a callback for the current results on the script chain.
     */
    tap<T>(cb: (value: T) => void | Promise<void>): (value: T) => any;
    /**
     * Sleeps for the specified number of seconds between script runs.
     * @param seconds Number of seconds to sleep
     */
    sleep(seconds: number): () => any;
    /** alias for `toRunnable` */
    private torun;
}
/** Builder functions map */
export declare class Builder {
    /**
     * Decorates the environment variables passed to the next script.
     * @param env Async callback that receives the accumulated environment variables
     * @returns The decorated environment variables
     */
    decorateEnv<Env extends ScriptEnv = ScriptEnv>(env: (env: NodeJS.ProcessEnv) => Promiseable<Env>): InjectEnvDef<Env>;
    /**
     * Decorates the arguments passed to the next script.
     * @param args Async callback that receives the accumulated arguments
     * @returns The decorated arguments
     */
    decorateArgs<Args extends string[] = string[]>(args: (args: string[]) => Promiseable<Args>): InjectArgsDef<Args>;
    /**
     * Builds a script definition for a binary.
     * @param bin The binary to run
     * @param env Environment variables to pass to the binary
     * @param next Options to pass to the next script
     * @returns The script definition
     */
    bin<Bin extends string>(bin: Bin, next?: NextDef): BinScriptDef<Bin>;
    /**
     * Builds a script definition.
     * @param script The script path
     * @param env Environment variables to pass to the script
     * @param next Options to pass to the next script
     * @returns The script definition
     */
    script<Script extends string>(script: Script, next?: NextDef): ScriptDef<Script>;
}
export declare const B: Builder;
export declare const U: Utility;
export {};
