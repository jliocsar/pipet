import { Pipet, B, U } from './pipet'

const env = {
  count: 0,
}

new Pipet().run(
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
    async beforeRun() {},
    afterRun() {
      console.log('hehe')
    },
  },
)
