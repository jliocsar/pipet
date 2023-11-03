import { Pipet, script } from './pipet'

const env = {
  count: 0,
}

new Pipet().run(
  [
    script('scriptpath.js', env, {
      args: {
        countResult: {
          match: /Count is (.+) and (.+)/,
          csv: true,
        },
      },
    }),
    script('scriptpath.js', null, {
      env: {
        countResult: {
          match: /Count is (.+) and (.+)/,
          csv: true,
        },
      },
    }),
    script('scriptpath.js', null, {
      args: {
        $: {
          match: /Count is (.+) and (.+)/,
          csv: true,
          separator: ' ',
        },
      },
    }),
    script('scriptpath.js', env),
  ],
  {
    afterRun() {
      console.log('hehe')
    },
  },
)
