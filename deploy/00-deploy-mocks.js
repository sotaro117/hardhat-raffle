const { developmentChains, networkConfig } = require("../helper-hardhat-config")

const BASE_FEE = ethers.utils.parseEther("0.25") // premium
const GAS_PRICE_LINK = 1e9

module.exports = async (hre) => {
  const { getNamedAccounts, deployments } = hre
  const { deploy, log } = deployments
  const { deployer } = await getNamedAccounts()
  const chainId = network.config.chainId

  if (chainId == 31337) {
    // Or if(network.name)
    log("Local network detected, Deploying mocks...")
    const args = [BASE_FEE, GAS_PRICE_LINK]
    await deploy("VRFCoordinatorV2Mock", {
      from: deployer,
      log: true,
      args: args,
    })
    log("Mocks deployed!")
  }
}

module.exports.tags = ["all", "mock"]
