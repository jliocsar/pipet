<div align=center>

<img width=680 src=.github/logo.png>

![GitHub repo size](https://img.shields.io/github/repo-size/jliocsar/pipet?style=for-the-badge&labelColor=4B4BB5&color=fff)
![GitHub last commit (branch)](https://img.shields.io/github/last-commit/jliocsar/pipet/main?style=for-the-badge&labelColor=4B4BB5&color=fff)
![GitHub package.json version (branch)](https://img.shields.io/github/package-json/v/jliocsar/pipet/main?style=for-the-badge&labelColor=4B4BB5&color=fff)

</div>

## Introduction

🏗️ W.I.P. 🏗️

## Example

```js
import { Pipet, B, U } from '@jliocsar/pipet'

const env = {
  count: 0,
}

const pipet = new Pipet()

pipet.run(
  [
    B.script('scriptpath.js', env, {
      args: {
        'count-result': {
          match: /Count is (.+) and (.+)/,
          csv: true,
          continueEarly: true,
        },
      },
    }),
    U.log('hello'),
    B.script('scriptpath.js', null, {
      env: {
        countResult: {
          match: /Count is (.+) and (.+)/,
          csv: true,
        },
      },
    }),
    B.script('scriptpath.js', env),
    B.script('scriptpath.js', null, {
      args: {
        $: {
          match: /Count is (.+) and (.+)/,
          csv: true,
          separator: ' ',
        },
      },
    }),
    B.script('scriptpath.js', env),
  ],
  {
    binArgs: ['--title=hello'],
    afterRun() {
      console.log('hehe')
    },
  },
)
```
