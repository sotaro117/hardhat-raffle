const { run } = require("hardhat")

async function verify(
  contractAddress,
  args /* args is necessary if you have "constructor" */
) {
  console.log("Verifying...")
  try {
    await run("verify:verify", {
      address: contractAddress,
      constructorArguments: args,
    })
  } catch (err) {
    if (err.message.toLowerCase().includes("already exist")) {
      console.log(err)
    }
  }
}

module.exports = { verify }
