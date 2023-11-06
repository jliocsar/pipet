import { Pipet, B, U } from '.'

const env = {
  count: 0,
}

new Pipet().run(
  [
    B.script('scriptpath.js', env, {
      args: {
        version: {
          boolean: true,
        },
      },
    }),
    B.bin('jstr'),
    U.log('Hello world'),
    B.script('scriptpath.js', null, {
      env: {
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
      return ['--title=hello']
    }),
    B.script('scriptpath.js', null, {
      env: {
        countResult: {
          match: /Count is (.+) and (.+)/,
          array: true,
        },
      },
    }),
    B.script('scriptpath.js', env),
    B.script('scriptpath.js', null, {
      args: {
        $: {
          match: /Count is (.+) and (.+)/,
          array: true,
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
