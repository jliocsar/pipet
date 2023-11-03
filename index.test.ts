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
    script('scriptpath.js'),
  ],
  {
    afterRun() {
      console.log('hehe')
    },
  },
)
