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
          csv: true,
          continueEarly: true,
        },
      },
    }),
    U.log('hello'),
    B.script('second-script-path.ts', null, {
      env: {
        // Will add `countResult` as an env. variable
        // on the next script
        countResult: {
          match: /Count is (.+) and (.+)/,
          csv: true,
        },
      },
    }),
    B.script('last-script-path.ts', null, {
      args: {
        // Will pass `...matched[]` as arguments to the next script
        $: {
          match: /Count is (.+) and (.+)/,
          csv: true,
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
- [ ] Allow different `bin` for each script;
- [ ] Finish docs.
