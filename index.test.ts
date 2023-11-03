import { pipet, script } from './pipet'

const env = {
  count: 0,
}

pipet(
  [
    script('scriptpath.js', env, {
      env: {
        countResult: {
          match: /Count is (.+)/,
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
