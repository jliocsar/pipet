if (process.env.countResult) {
  console.log(`Count result is ${process.env.countResult}`)
} else {
  console.log(`Count is ${process.env.count}`)
  console.log(`Count is ${Number(process.env.count) + 1}`)
}
