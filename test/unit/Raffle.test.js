const { assert, expect } = require("chai")
const { network, deployments, ethers, getNamedAccounts } = require("hardhat")
const { developmentChains } = require("../../helper-hardhat-config")

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("Raffle", function () {
      let raffle, vrfCoordinatorV2Mock, entranceFee, deployer, interval

      beforeEach(async function () {
        deployer = (await getNamedAccounts()).deployer
        await deployments.fixture(["all"])
        raffle = await ethers.getContract("Raffle", deployer)
        vrfCoordinatorV2Mock = await ethers.getContract(
          "VRFCoordinatorV2Mock",
          deployer
        )
        const subscriptionId = await raffle.getSubscriptionId()
        vrfCoordinatorV2Mock.addConsumer(subscriptionId, raffle.address)
        entranceFee = await raffle.getEntranceFee()
        interval = await raffle.getInterval()
      })

      describe("constructor", function () {
        it("initializes the raffle correctly", async function () {
          const raffleState = await raffle.getRaffleState()
          assert.equal(raffleState.toString(), "0") // open = 0; calculating = 1
        })
      })

      describe("enterRaffle", function () {
        it("reverts when you dont pay enough", async function () {
          await expect(raffle.enterRaffle()).to.be.reverted
        })
        it("records players when they enter", async function () {
          await raffle.enterRaffle({ value: entranceFee })
          const playerFromContract = await raffle.getPlayer(0)
          assert.equal(deployer, playerFromContract)
        })
        it("emits event on enter", async function () {
          await expect(raffle.enterRaffle({ value: entranceFee })).to.emit(
            raffle,
            "RaffleEnter"
          )
        })
        it("doesnt allow entrance when raffle is calculating", async function () {
          await raffle.enterRaffle({ value: entranceFee })
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ])
          // await network.provider.send("evm_mine", [])
          await network.provider.request({ method: "evm_mine", params: [] })
          // pretend to be a Chainlink Keeper
          await raffle.performUpkeep([])
          await expect(
            raffle.enterRaffle({ value: entranceFee })
          ).to.be.revertedWith("Raffle__NotOpen")
        })
      })

      describe("checkUpkeep", function () {
        it("returns false if people havent sent", async function () {
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ])
          await network.provider.request({ method: "evm_mine", params: [] })
          const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([])
          assert(!upkeepNeeded)
        })
        it("returns false if raffle isnt open", async function () {
          await raffle.enterRaffle({ value: entranceFee })
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ])
          await network.provider.request({ method: "evm_mine", params: [] })
          await raffle.performUpkeep([])
          const raffleState = await raffle.getRaffleState()
          const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([])
          assert.equal(raffleState.toString(), "1")
          assert(!upkeepNeeded)
        })
        it("returns false if enough time has not passed", async function () {
          await raffle.enterRaffle({ value: entranceFee })
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() - 5,
          ])
          await network.provider.send("evm_mine", [])
          const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x")
          assert(!upkeepNeeded)
        })
      })

      describe("performUpkeep", function () {
        it("it can only run if checkupkeep is true", async function () {
          await raffle.enterRaffle({ value: entranceFee })
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ])
          await network.provider.request({ method: "evm_mine", params: [] })
          const tx = await raffle.performUpkeep([])
          assert(tx)
        })
        it("reverts when checkupkeep is false", async function () {
          await expect(raffle.performUpkeep([])).to.be.reverted
        })
        it("updates the raffle state, emits an event, and calls the vrf coordinator v2", async function () {
          await raffle.enterRaffle({ value: entranceFee })
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ])
          await network.provider.request({ method: "evm_mine", params: [] })
          const txResponse = await raffle.performUpkeep([])
          const txReceipt = await txResponse.wait(1)
          const requestId = txReceipt.events[1].args.requestId
          const raffleState = await raffle.getRaffleState()
          assert(requestId.toNumber() > 0)
          assert(raffleState == "1")
        })
      })

      describe("fullfillrandomwords", function () {
        beforeEach(async function () {
          await raffle.enterRaffle({ value: entranceFee })
          await network.provider.send("evm_increaseTime", [
            interval.toNumber() + 1,
          ])
          await network.provider.send("evm_mine", [])
        })
        it("can only be called after performUpkeep", async function () {
          await expect(
            vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.address)
          ).to.be.reverted
        })
        it("picks a winner, resets the raffle and sends money", async function () {
          const additionalEntrants = 3
          const startingIndex = 1
          const accounts = await ethers.getSigners()
          for (
            let i = startingIndex;
            i < startingIndex + additionalEntrants;
            i++
          ) {
            const accountConnectedRaffle = raffle.connect(accounts[i])
            await accountConnectedRaffle.enterRaffle({ value: entranceFee })
          }
          const startingTimeStamp = await raffle.getLastTimeStamp()

          // performUpkeep (mock being Chainlink Keepers)
          // fulfillRandomWords (mock being the Chainlink VRF)
          // Have to wait for the fulfillRandomWords to be called

          await new Promise(async (resolve, reject) => {
            raffle.once("WinnerPicked", async () => {
              try {
                const recentWinner = await raffle.getRecentWinner()
                const raffleState = await raffle.getRaffleState()
                const endingTimeStamp = await raffle.getLastTimeStamp()
                const numPlayers = await raffle.getNumberOfPlayers()
                const winnerEndingBalance = await accounts[1].getBalance()
                assert.equal(numPlayers.toString(), "0")
                assert.equal(raffleState.toString(), "0")
                assert(endingTimeStamp > startingTimeStamp)
                assert.equal(
                  winnerEndingBalance.toString(),
                  winnerStartingBalance.add(
                    entranceFee
                      .mul(additionalEntrants)
                      .add(entranceFee)
                      .toString()
                  )
                )
              } catch (e) {
                reject(e)
              }
              resolve()
            })
            // setting up listener
            // below fire the event, and the listener will pick it up, and resolve
            const tx = await raffle.performUpkeep("0x")
            const txReceipt = await tx.wait(1)
            const winnerStartingBalance = await accounts[1].getBalance()
            await vrfCoordinatorV2Mock.fulfillRandomWords(
              txReceipt.events[1].args.requestId,
              raffle.address
            )
          })
        })
      })
    })
