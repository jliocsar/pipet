## Introduction

🏗️ W.I.P. 🏗️

> _**t**erminal **pipe**_ **=** `pipet`

Pipet is a zero dependency script-running framework; it provides an easy way to build different script inputs with different arguments/environment variables based on the output from previous scripts (or just pure JS/TS). It supports any kind of binary/executable, meaning you can use scripts for any language you'd like.

It acts as a pipeline with different ways of formatting/parsing the piped input values, also allowing you to manipulate the script behavior itself (i.e. aborting the script before it finishes whenever it matches a printed value).

It's also built with TypeScript, so Pipet is really easy to learn and master.

## Example

```js
import { Pipet, B, U } from '@jliocsar/pipet'

const env = {
  count: 0,
}

const pipet = new Pipet()

pipet.run(
  [
    B.script('first-script-path.ts', env, {
      args: {
        // Will pass `--count-result=...` to the next script
        'count-result': {
          match: /Count is (.+) and (.+)/,
          array: true,
          continueEarly: true,
        },
      },
    }),
    B.decorateArgs(async args => args.concat('--another-argument')),
    B.bin('my-binary', env),
    U.log('hello'),
    B.decorateEnv(async env => {
      env.countResult = '420'
    }),
    B.script('second-script-path.ts', null, {
      env: {
        // Will add `countResult` as an env. variable
        // on the next script
        countResult: {
          match: /countResult is (.+)/,
        },
      },
    }),
    U.tap(console.log),
    B.script('last-script-path.py', null, {
      bin: 'python',
      args: {
        // Will pass `...matched[]` as arguments to the next script
        $: {
          match: /countResult is (.+) and (.+)/,
          array: true,
          separator: ' ',
        },
      },
    }),
  ],
  {
    bin: 'tsx', // Default is 'node'
    binArgs: ['--your-bin-arg'],
    async beforeRun() {
      // ... your build
    },
    async afterRun() {
      // ... clean up effect
    }
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
