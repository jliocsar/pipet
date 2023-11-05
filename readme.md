<div align=center>

<img width=680 src=.github/logo.png>

![GitHub repo size](https://img.shields.io/github/repo-size/jliocsar/pipet?style=for-the-badge&labelColor=4B4BB5&color=fff)
![GitHub last commit (branch)](https://img.shields.io/github/last-commit/jliocsar/pipet/main?style=for-the-badge&labelColor=4B4BB5&color=fff)
![GitHub package.json version (branch)](https://img.shields.io/github/package-json/v/jliocsar/pipet/main?style=for-the-badge&labelColor=4B4BB5&color=fff)

</div>

## Introduction

🏗️ W.I.P. 🏗️

> _**t**erminal **pipe**_ **=** `pipet`

Pipet is a script running framework, providing an easy way to build different script input with different arguments/environment variables based on the output from the previous scripts.

It acts as a pipeline with different ways of formatting/parsing the piped input values, also allowing you to manipulate the script behavior itself (i.e. aborting the script before it finishes whenever it matches a printed value).

It's also built with TypeScript, so Pipet is really easy to learn and master.

## Usage

### Builder (`B`)

The `B` namespace exports all utility functions used for building your scripts pipeline.


#### `B.scripts`

Builds the script definition object used in the script pipeline based on the script path.

#### `B.bin`

Builds the script definition object used in the script pipeline based on a CLI binary.

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
    B.bin('my-binary', env),
    U.log('hello'),
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
    }
  },
)
```

## TODO

- [ ] npm publish;
- [ ] Finish docs.
