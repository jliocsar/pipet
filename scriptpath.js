console.log(
  `Count is ${process.env.count} and ${Number(process.env.count) + 1}`,
)
console.log(`Args is ${JSON.stringify(process.argv)}`)
console.log(`execArgv is ${JSON.stringify(process.execArgv)}`)
console.log(`Env is ${JSON.stringify(process.env.countResult)}`)
