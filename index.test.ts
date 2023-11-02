import { pipet, script } from './pipet'

const env = {
  count: 0,
}

pipet(
  [
    script('scriptpath.js', env),
    script('scriptpath.js', env, {
      env: {
        count: {
          match: /Count is (.+)/,
        },
      },
    }),
    // script('scriptpath.js'),
    // script('scriptpath.js'),
    // script('scriptpath.js'),
    // script('scriptpath.js'),
  ],
  {
    beforeRun() {
      console.log('hehe')
    },
  },
)
