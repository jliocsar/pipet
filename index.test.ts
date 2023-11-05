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
          abortEarly: true,
        },
      },
    }),
    U.log('Hello world'),
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
    U.tap(console.log),
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
