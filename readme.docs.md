## Introduction

🏗️ W.I.P. 🏗️

> _**t**erminal **pipe**_ **=** `pipet`

Pipet is a script running framework, providing an easy way to build different script input with different arguments/environment variables based on the output from the previous scripts.

It acts as a pipeline with different ways of formatting/parsing the piped input values, also allowing you to manipulate the script behavior itself (i.e. aborting the script before it finishes whenever it matches a printed value).

It's also built with TypeScript, so Pipet is really easy to learn and master.

## Installation

The easiest way to use Pipet is installing it globally, so it's then available in all of your scripts:

```sh
# with npm
npm i -g @jliocsar/pipet

# with yarn
yarn global add @jliocsar/pipet

# with bun
bun a -g @jliocsar/pipet
```

If you want to install it as a dependency for a single project, skip the global flag and add it to your `devDependencies`.
