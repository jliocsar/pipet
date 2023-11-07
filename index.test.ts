import { Pipet, B, U } from '.'

const initialEnv = {
  count: 0,
}

new Pipet().run(
  [
    B.script('scriptpath.js', {
      args: {
        version: {
          boolean: true,
        },
      },
    }),
    B.bin('jstr'),
    U.log('Hello world'),
    B.script('scriptpath.js', {
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
    B.script('scriptpath.js', {
      env: {
        countResult: {
          match: /Count is (.+) and (.+)/,
          array: true,
        },
      },
    }),
    B.script('scriptpath.js'),
    B.script('scriptpath.js', {
      args: {
        $: {
          match: /Count is (.+) and (.+)/,
          array: true,
          separator: ' ',
        },
      },
    }),
    U.tap(console.log),
    B.script('scriptpath.js'),
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
