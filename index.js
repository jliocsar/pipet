import * as path from 'node:path';
import * as childProcess from 'node:child_process';
import * as timers from 'node:timers/promises';
/** @internal */
class InjectEnvDef {
    env;
    constructor(env) {
        this.env = env;
    }
}
/** @internal */
class InjectArgsDef {
    args;
    constructor(args) {
        this.args = args;
    }
}
export class ScriptDef {
    script;
    next;
    constructor(script, next) {
        this.script = script;
        this.next = next;
    }
}
export class BinScriptDef extends ScriptDef {
}
export class PipetError extends Error {
    constructor(message) {
        super(message);
        this.name = 'PipetError';
    }
}
export class Pipet {
    // Env is accumulated (not overwritten) for each script
    // This behavior can be changed in the `buildNextScriptParams` method
    // if necessary someday
    env;
    abortController;
    args;
    constructor() {
        this.env = process.env;
        this.args = [];
        this.abortController = new AbortController();
    }
    /**
     * Runs a series of scripts or utility functions in order.
     * @param runnables Scripts or utility functions to run
     * @param optionsOptions to pass to the scripts (overridden by the script options)
     * @returns An array of results from each script
     */
    async run(runnables, options) {
        const length = runnables.length;
        if (length < 1) {
            throw new PipetError('Need at least 1 script to run');
        }
        if (options?.initialEnv && options.initialEnv !== 'inherit') {
            Object.assign(this.env, this.serialize(options.initialEnv));
        }
        if (options?.beforeRun) {
            await options.beforeRun();
        }
        const results = await this.reduce(runnables, options);
        if (options?.afterRun) {
            await options.afterRun();
        }
        return results;
    }
    async reduce(runnables, options) {
        const length = runnables.length;
        const results = [];
        let index = 0;
        while (index < length) {
            const runnableDef = runnables[index];
            if (!(runnableDef instanceof ScriptDef)) {
                if (this.isInject(runnableDef)) {
                    if ('env' in runnableDef) {
                        Object.assign(this.env, await runnableDef.env(this.env));
                    }
                    else if (runnableDef.args) {
                        this.args = await runnableDef.args(this.args);
                    }
                    index++;
                    continue;
                }
                await runnableDef(results);
                index++;
                continue;
            }
            const envEntries = runnableDef.next?.env
                ? Object.entries(runnableDef.next.env)
                : [];
            const argsEntries = runnableDef.next?.args
                ? Object.entries(runnableDef.next.args)
                : [];
            const spawnOptions = {
                env: this.env,
                args: this.args,
                signal: this.abortController.signal,
                onData: chunk => {
                    const { args: nextArgs, continueEarly, abortEarly, } = this.buildNextScriptParams((data += chunk), {
                        label: runnableDef.script,
                        envEntries,
                        env: this.env,
                        argsEntries,
                    });
                    this.args = nextArgs;
                    return { continueEarly, abortEarly };
                },
            };
            Object.assign(spawnOptions, options);
            let data = '';
            try {
                await this.spawn(runnableDef, spawnOptions);
                results.push(1);
            }
            catch (error) {
                const pipetError = new PipetError(error.message);
                console.error(pipetError);
                results.push(pipetError);
            }
            index++;
        }
        return results;
    }
    serialize(initialEnv) {
        return Object.entries(initialEnv).reduce((env, [key, def]) => {
            if (def === undefined || def === null) {
                throw new PipetError(`Env "${key}" is \`undefined\` or \`null\``);
            }
            switch (true) {
                case def instanceof RegExp:
                    env[key] = def.source;
                    return env;
                case typeof def === 'object':
                    env[key] = JSON.stringify(def);
                    return env;
                default:
                    env[key] = def.toString();
                    return env;
            }
        }, {});
    }
    checkRequiredFields(label, entries, map) {
        const length = entries.length;
        let index = 0;
        while (index < length) {
            const [key, def] = entries[index];
            if (def.required && [undefined, ''].includes(map[key])) {
                throw new PipetError(`Required key "${key}" is not set after running script "${label}"`);
            }
            index++;
        }
    }
    spawn(scriptDef, options) {
        return new Promise((resolve, reject) => {
            try {
                const cwd = options?.cwd ?? scriptDef.cwd ?? process.cwd();
                const binArgs = options?.binArgs ?? scriptDef.binArgs ?? [];
                let bin = null;
                let args = null;
                if (scriptDef instanceof BinScriptDef) {
                    bin = scriptDef.script;
                    args = binArgs.concat(options?.args ?? []);
                }
                else {
                    bin = options?.bin ?? scriptDef.bin ?? 'node';
                    args = binArgs.concat(path.resolve(cwd, scriptDef.script), options?.args ?? []);
                }
                const child = childProcess
                    .spawn(bin, args, {
                    env: options?.env,
                    signal: options?.signal,
                })
                    .on('error', reject);
                child.stdout
                    .on('data', data => {
                    process.stdout.write(data);
                    if (data && options?.onData) {
                        const { continueEarly, abortEarly } = options.onData(data.toString());
                        if (continueEarly) {
                            return resolve();
                        }
                        if (abortEarly) {
                            child.kill();
                            return process.nextTick(resolve);
                        }
                    }
                })
                    .on('error', reject)
                    .on('close', resolve);
            }
            catch (error) {
                return reject(error);
            }
        });
    }
    buildFromGlobalMatch(data, entries) {
        const map = {};
        const length = entries.length;
        let index = 0;
        while (index < length) {
            const [key, def] = entries[index];
            if (def.value) {
                if (def.array && map[key]) {
                    map[key] += `,${def.value}`;
                }
                else {
                    map[key] = def.value;
                }
                if (def.continueEarly) {
                    return { continueEarly: true, map };
                }
                if (def.abortEarly) {
                    return { abortEarly: true, map };
                }
                index++;
                continue;
            }
            if (!def.match) {
                index++;
                continue;
            }
            const regex = def.match.global ? def.match : new RegExp(def.match, 'g');
            const match = data.matchAll(regex);
            if (!match) {
                index++;
                continue;
            }
            for (const [, ...value] of match) {
                const joined = value.join(def.separator ?? ',');
                if (def.array && map[key]) {
                    map[key] += `,${joined}`;
                }
                else {
                    map[key] = joined;
                }
                if (def.continueEarly) {
                    return { continueEarly: true, map };
                }
                if (def.abortEarly) {
                    return { abortEarly: true, map };
                }
            }
            index++;
        }
        return { map };
    }
    buildNextScriptParams(data, params) {
        const { continueEarly: argsContinueEarly, abortEarly: argsAbortEarly, map: argsMap, } = this.buildFromGlobalMatch(data, params.argsEntries);
        const args = [];
        this.checkRequiredFields(params.label, params.argsEntries, argsMap);
        const length = params.argsEntries.length;
        let index = 0;
        while (index < length) {
            const [key, value] = params.argsEntries[index];
            const mapped = argsMap[key];
            if (value.required && [undefined, null, ''].includes(mapped)) {
                throw new PipetError(`Required arg "${key}" is not set after running script "${params.label}"`);
            }
            if (key === '$') {
                args.push(mapped);
                index++;
                continue;
            }
            const prefix = value.prefix ?? '--';
            if (value.boolean) {
                args.push(`${prefix}${key}`);
            }
            else {
                const equality = value.equality ?? '=';
                args.push(`${prefix}${key}${equality}${mapped}`);
            }
            index++;
        }
        if (argsContinueEarly || argsAbortEarly) {
            return {
                args,
                continueEarly: argsContinueEarly,
                abortEarly: argsAbortEarly,
            };
        }
        const { continueEarly: envContinueEarly, abortEarly: envAbortEarly, map: env, } = this.buildFromGlobalMatch(data, params.envEntries);
        Object.assign(params.env, env);
        this.checkRequiredFields(params.label, params.envEntries, params.env);
        return { args, continueEarly: envContinueEarly, abortEarly: envAbortEarly };
    }
    isInject(runnable) {
        return runnable instanceof InjectEnvDef || runnable instanceof InjectArgsDef;
    }
}
/** Utility functions map */
export class Utility {
    /**
     * Prints a message to `stdout` between script runs.
     * @param message Message to print to `stdout`
     */
    log(message) {
        return this.torun(() => process.stdout.write(message + '\n'));
    }
    /**
     * Runs a callback for the current results on the script chain.
     */
    tap(cb) {
        return this.torun(cb);
    }
    /**
     * Sleeps for the specified number of seconds between script runs.
     * @param seconds Number of seconds to sleep
     */
    sleep(seconds) {
        return this.torun(() => timers.setTimeout(seconds * 1000));
    }
    /** alias for `toRunnable` */
    torun(cb) {
        return (...args) => cb(...args);
    }
}
/** Builder functions map */
export class Builder {
    /**
     * Decorates the environment variables passed to the next script.
     * @param env Async callback that receives the accumulated environment variables
     * @returns The decorated environment variables
     */
    decorateEnv(env) {
        return new InjectEnvDef(env);
    }
    /**
     * Decorates the arguments passed to the next script.
     * @param args Async callback that receives the accumulated arguments
     * @returns The decorated arguments
     */
    decorateArgs(args) {
        return new InjectArgsDef(args);
    }
    /**
     * Builds a script definition for a binary.
     * @param bin The binary to run
     * @param env Environment variables to pass to the binary
     * @param next Options to pass to the next script
     * @returns The script definition
     */
    bin(bin, next) {
        return new BinScriptDef(bin, next);
    }
    /**
     * Builds a script definition.
     * @param script The script path
     * @param env Environment variables to pass to the script
     * @param next Options to pass to the next script
     * @returns The script definition
     */
    script(script, next) {
        return new ScriptDef(script, next);
    }
}
export const B = new Builder();
export const U = new Utility();
