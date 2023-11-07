<div align=center>

<img width=680 src=https://raw.githubusercontent.com/jliocsar/pipet/main/.github/logo.png>

[![npm (scoped)](https://img.shields.io/npm/v/%40jliocsar/pipet?style=for-the-badge&labelColor=4B4BB5&color=fff)](https://npmjs.com/package/@jliocsar/pipet)
[![npm package minimized gzipped size (select exports)](https://img.shields.io/bundlejs/size/%40jliocsar%2Fpipet?style=for-the-badge&labelColor=4B4BB5&color=fff)](#)
[![GitHub last commit (branch)](https://img.shields.io/github/last-commit/jliocsar/pipet/main?style=for-the-badge&labelColor=4B4BB5&color=fff)](#)

[![Read the docs](https://img.shields.io/badge/read%20the%20docs-fff?style=for-the-badge&color=4B4BB5)](https://pipet.vercel.app/)

</div>

## Introduction

🏗️ W.I.P. 🏗️

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
    B.script('1st-script-path.ts', {
      args: {
        version: {
          boolean: true,
        },
      },
    }),
    B.bin('jstr'),
    U.log('Hello world'),
    B.script('2nd-script-path.ts', {
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
    B.script('3rd-script-path.ts', {
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

```sh
# with npm
npm i -D @jliocsar/pipet

# with yarn
yarn add -D @jliocsar/pipet

# with bun
bun a -D @jliocsar/pipet
```

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

## TODO

- [ ] Finish docs.
