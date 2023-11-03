import { Pipet, B, U } from './pipet'

const env = {
  count: 0,
}

new Pipet().run(
  [
    B.script('scriptpath.js', env, {
      args: {
        countResult: {
          match: /Count is (.+) and (.+)/,
          csv: true,
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
