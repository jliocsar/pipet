import { Pipet, script } from './pipet'

const env = {
  count: 0,
}

new Pipet().run(
  [
    script('scriptpath.js', env, {
      env: {
        countResult: {
          match: /Count iz (.+) and (.+)/,
          csv: true,
        },
      },
    }),
    script('scriptpath.js'),
  ],
  {
    beforeRun() {
      console.log('hehe')
    },
  },
)
