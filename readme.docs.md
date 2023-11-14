## Introduction

> _**t**erminal **pipe**_ **=** `pipet`

Pipet is a zero dependency script-running framework; it provides an easy way to build different script inputs with different arguments/environment variables based on the output from previous scripts (or just pure JS/TS). It supports any kind of binary/executable, meaning you can use scripts for any language you'd like.

It acts as a pipeline with different ways of formatting/parsing the piped input values, also allowing you to manipulate the script behavior itself (i.e. aborting the script before it finishes whenever it matches a printed value).

It's also built with TypeScript, so Pipet is really easy to learn and master.

## Example

```js
const { Pipet, B, U } = require('@jliocsar/pipet')

const initialEnv = {
  count: 0,
}

new Pipet().run(
  [
    B.script('1st-script-path.js', {
      args: {
        version: {
          boolean: true,
        },
      },
    }),
    B.bin('jstr'),
    U.log('Hello world'),
    B.script('2nd-script-path.ts', {
      bin: 'tsx', // default is `"node"`
      args: {
        countResult: {
          match: /Count is (.+) and (.+)/,
          array: true,
        },
      },
    }),
    B.decorateEnv(env => {
      env.count = '20'
      return env
    }),
    B.decorateArgs(args => {
      console.log({ args })
      return args.concat('--title=hello')
    }),
    B.script('3rd-script-path.js', {
      bin: 'bun',
      binArgs: ['run', '--bun'],
      env: {
        countResult: {
          match: /Count is (.+) and (.+)/,
          array: true,
        },
      },
    }),
    U.tap(console.log),
    B.script('last-script.py', {
      bin: 'python',
      args: {
        $: {
          match: /Count is (.+) and (.+)/,
          array: true,
          separator: ' ',
        },
      },
    }),
  ],
  {
    initialEnv,
    binArgs: ['--title=hello'],
    async beforeRun() {
      // run any setup effect (like building)
    },
    async afterRun() {
      // run any clean up effect
    },
  },
)
```

## Installation

The easiest way to use Pipet is installing it globally, so it's then available in all of your scripts:

```sh
# with npm
npm i -g @jliocsar/pipet

# with yarn
yarn global add @jliocsar/pipet

# with bun
bun a -g @jliocsar/pipet
```

If you want to install it as a dependency for a single project, skip the global flag and add it to your `devDependencies`.
