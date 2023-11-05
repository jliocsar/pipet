<div align=center>

<img width=680 src=https://raw.githubusercontent.com/jliocsar/pipet/main/.github/logo.png>

![npm (scoped)](https://img.shields.io/npm/v/%40jliocsar/pipet?style=for-the-badge&labelColor=4B4BB5&color=fff)
![npm package minimized gzipped size (select exports)](https://img.shields.io/bundlejs/size/%40jliocsar%2Fpipet?style=for-the-badge&labelColor=4B4BB5&color=fff)
![GitHub last commit (branch)](https://img.shields.io/github/last-commit/jliocsar/pipet/main?style=for-the-badge&labelColor=4B4BB5&color=fff)

</div>

## Introduction

🏗️ W.I.P. 🏗️

> _**t**erminal **pipe**_ **=** `pipet`

Pipet is a script running framework, providing an easy way to build different script input with different arguments/environment variables based on the output from the previous scripts.

It acts as a pipeline with different ways of formatting/parsing the piped input values, also allowing you to manipulate the script behavior itself (i.e. aborting the script before it finishes whenever it matches a printed value).

It's also built with TypeScript, so Pipet is really easy to learn and master.

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

## Usage

### Builder (`B`)

The `B` namespace exports all utility functions used for building your scripts pipeline.


#### `B.scripts`

Builds the script definition object used in the script pipeline based on the script path.

#### `B.bin`

Builds the script definition object used in the script pipeline based on a CLI binary.

#### `B.decorateEnv`

Exposes an async injector function to decorate the env. variables of the next scripts.

#### `B.decorateArgs`

Exposes an async injector function to decorate the args array of the next script.

### Utilities (`U`)

The `U` namespace exports all utility functions that can be used during your pipeline process (i.e. logging something before affecting the script environment).

#### `U.log`

Logs a message to the terminal between scripts in the pipeline.

#### `U.tap`

Runs a side-effect on the accumulated array of results.

#### `U.sleep`

Sleeps N seconds between scripts run.

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

## TODO

- [ ] Finish docs.
