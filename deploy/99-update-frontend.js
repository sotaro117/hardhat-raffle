const { ethers, network } = require("hardhat")
const fs = require("fs")
const {
  FRONTEND_ADDRESS_FILE,
  FRONTEND_ABI_FILE,
} = require("../helper-hardhat-config")

module.exports = async () => {
  if (process.env.UPDATE_FRONTEND) {
    updateContractAddresses()
    updateAbi()
  }
}

async function updateAbi() {
  const raffle = await ethers.getContract("Raffle")
  fs.writeFileSync(
    FRONTEND_ABI_FILE,
    raffle.interface.format(ethers.utils.FormatTypes.json) // produces abi
  )
}

async function updateContractAddresses() {
  const raffle = await ethers.getContract("Raffle")
  const chainId = network.config.chainId.toString()
  const currentAddress = JSON.parse(
    fs.readFileSync(FRONTEND_ADDRESS_FILE, "utf8")
  )
  if (chainId in currentAddress) {
    if (!currentAddress[chainId].includes(raffle.address)) {
      currentAddress[chainId].push(raffle.address)
    }
  } else {
    currentAddress[chainId] = [raffle.address]
  }
  fs.writeFileSync(FRONTEND_ADDRESS_FILE, JSON.stringify(currentAddress))
}

module.exports.tags = ["all", "frontend"]
