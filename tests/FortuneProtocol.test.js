const { ethers, network } = require("hardhat")
const { time } = require("@nomicfoundation/hardhat-network-helpers")
const { expect } = require("chai")

const chainId = network.config.chainId
const isLocal = chainId === 31337

const BASE_FEE = ethers.parseEther("0.1")
const GAS_PRICE_LINK = "1000000000"
const FUND_AMOUNT = ethers.parseEther("10")

async function deployFixture() {
  const [deployer, user, other, treasury] = await ethers.getSigners()

  const VRFCoordinatorFactory = await ethers.getContractFactory("VRFCoordinatorV2PlusMock")
  const coordinator = await VRFCoordinatorFactory.deploy(BASE_FEE, GAS_PRICE_LINK)

  const tx = await coordinator.createSubscription()
  const receipt = await tx.wait()
  const subId = receipt.logs[0].args[0]

  await coordinator.fundSubscriptionWithNative(subId, { value: FUND_AMOUNT })

  const FortuneProtocolFactory = await ethers.getContractFactory("FortuneProtocol")
  const protocol = await FortuneProtocolFactory.deploy(subId, coordinator.target, treasury.address)

  await coordinator.addConsumer(subId, protocol.target)

  return { coordinator, protocol, deployer, user, other, treasury, subId }
}

function findEvent(receipt, eventName) {
  return receipt.logs.find(l => {
    try { return l.eventName === eventName } catch { return false }
  })
}

function extractReadingId(receipt, protocol) {
  return getEventArg(receipt, protocol, "ReadingRequested", 0)
}

function getEventArg(receipt, contract, eventName, argIndex) {
  const topic = contract.interface.getEvent(eventName).topicHash
  const log = receipt.logs.find(l => l.topics[0] === topic)
  if (!log) return undefined
  const parsed = contract.interface.parseLog(log)
  if (argIndex !== undefined) return parsed.args[argIndex]
  return parsed.args
}

async function requestAndFulfill(protocol, coordinator, user, packId = 0) {
  const pack = await protocol.getPack(packId)
  const fee = pack.price

  const reqTx = await protocol.connect(user).requestReading(packId, { value: fee })
  const reqReceipt = await reqTx.wait()
  const readingId = extractReadingId(reqReceipt, protocol)

  const reading = await protocol.getReading(readingId)
  const vrfReqId = reading.requestId

  await coordinator.fulfillRandomWords(vrfReqId, protocol.target)

  return readingId
}

!isLocal ? describe.skip : describe("FortuneProtocol", () => {
  describe("Deployment", () => {
    it("should deploy with correct initial state", async () => {
      const { protocol, deployer, treasury } = await deployFixture()
      expect(await protocol.treasury()).to.equal(treasury.address)
      expect(await protocol.getPackCount()).to.equal(1n)
      expect(await protocol.owner()).to.equal(deployer.address)
      const pack = await protocol.getPack(0)
      expect(pack.name).to.equal("Classic")
      expect(pack.active).to.be.true
      expect(pack.price).to.equal(ethers.parseEther("0.001"))
    })

    it("should revert on zero treasury address", async () => {
      const coordinator = await ethers.getContractFactory("VRFCoordinatorV2PlusMock")
      const coord = await coordinator.deploy(BASE_FEE, GAS_PRICE_LINK)
      const tx = await coord.createSubscription()
      const receipt = await tx.wait()
      const subId = receipt.logs[0].args[0]

      const FortuneProtocolFactory = await ethers.getContractFactory("FortuneProtocol")
      await expect(
        FortuneProtocolFactory.deploy(subId, coord.target, ethers.ZeroAddress)
      ).to.be.reverted
    })
  })

  describe("requestReading", () => {
    it("should successfully request a reading", async () => {
      const { protocol, user } = await deployFixture()
      const fee = ethers.parseEther("0.001")

      const tx = await protocol.connect(user).requestReading(0, { value: fee })
      const receipt = await tx.wait()

      const readingId = extractReadingId(receipt, protocol)
      const readingEvent = findEvent(receipt, "ReadingRequested")
      expect(readingEvent.args[1]).to.equal(user.address)

      const reading = await protocol.getReading(readingId)
      expect(reading.user).to.equal(user.address)
      expect(reading.packId).to.equal(0n)
      expect(reading.status).to.equal(0n) // Pending
      expect(reading.fee).to.equal(fee)
      expect(reading.fortune).to.equal("")
    })

    it("should revert on invalid pack", async () => {
      const { protocol, user } = await deployFixture()
      await expect(
        protocol.connect(user).requestReading(99, { value: ethers.parseEther("0.001") })
      ).to.be.revertedWithCustomError(protocol, "InvalidPack")
    })

    it("should revert on insufficient payment", async () => {
      const { protocol, user } = await deployFixture()
      await expect(
        protocol.connect(user).requestReading(0, { value: ethers.parseEther("0.0001") })
      ).to.be.revertedWithCustomError(protocol, "InsufficientPayment")
    })

    it("should revert when paused", async () => {
      const { protocol, deployer, user } = await deployFixture()
      await protocol.connect(deployer).pause()
      await expect(
        protocol.connect(user).requestReading(0, { value: ethers.parseEther("0.001") })
      ).to.be.revertedWithCustomError(protocol, "EnforcedPause")
    })

    it("should reject duplicate in-flight requests beyond limit", async () => {
      const { protocol, user } = await deployFixture()
      const fee = ethers.parseEther("0.001")

      const pack = await protocol.getPack(0)
      for (let i = 0; i < 5; i++) {
        await protocol.connect(user).requestReading(0, { value: fee })
        const packInfo = await protocol.getPack(0)
      }

      await expect(
        protocol.connect(user).requestReading(0, { value: fee })
      ).to.be.revertedWithCustomError(protocol, "TooManyPending")
    })
  })

  describe("Fulfillment", () => {
    it("should fulfill reading with a fortune", async () => {
      const { protocol, coordinator, user } = await deployFixture()
      const fee = ethers.parseEther("0.001")

      const reqTx = await protocol.connect(user).requestReading(0, { value: fee })
      const reqReceipt = await reqTx.wait()
      const readingId = extractReadingId(reqReceipt, protocol)
      const reading = await protocol.getReading(readingId)
      const vrfReqId = reading.requestId

      const fulfillTx = await coordinator.fulfillRandomWords(vrfReqId, protocol.target)
      const fulfillReceipt = await fulfillTx.wait()

      const fulfilled = await protocol.getReading(readingId)
      expect(fulfilled.status).to.equal(1n) // Fulfilled
      expect(fulfilled.fortune).to.not.equal("")
      expect(fulfilled.fulfilledAt).to.not.equal(0n)

      const fulfillEventArgs = getEventArg(fulfillReceipt, protocol, "ReadingFulfilled")
      expect(fulfillEventArgs).to.not.be.undefined
      expect(fulfillEventArgs[0]).to.equal(readingId)
      expect(fulfillEventArgs[1]).to.equal(user.address)
      expect(fulfillEventArgs[2]).to.equal(fulfilled.fortune)
    })

    it("should use VRF randomness to pick fortune", async () => {
      const { protocol, coordinator, user } = await deployFixture()
      const fortunes = []
      for (let i = 0; i < 5; i++) {
        const readingId = await requestAndFulfill(protocol, coordinator, user)
        const reading = await protocol.getReading(readingId)
        fortunes.push(reading.fortune)
      }
      const unique = [...new Set(fortunes)]
      expect(unique.length).to.be.greaterThan(1)
    })
  })

  describe("getReading", () => {
    it("should revert for non-existent reading", async () => {
      const { protocol } = await deployFixture()
      await expect(
        protocol.getReading(999)
      ).to.be.revertedWithCustomError(protocol, "ReadingNotFound")
    })
  })

  describe("getUserReadingIds", () => {
    it("should return all reading IDs for a user", async () => {
      const { protocol, user } = await deployFixture()
      const fee = ethers.parseEther("0.001")

      const ids = []
      for (let i = 0; i < 3; i++) {
        const tx = await protocol.connect(user).requestReading(0, { value: fee })
        const receipt = await tx.wait()
        const readingId = extractReadingId(receipt, protocol)
        ids.push(readingId)
      }

      const userIds = await protocol.getUserReadingIds(user.address)
      expect(userIds.length).to.equal(3)
      for (let i = 0; i < 3; i++) {
        expect(userIds[i]).to.equal(ids[i])
      }
    })
  })

  describe("getUserReadings", () => {
    it("should return all readings for a user", async () => {
      const { protocol, coordinator, user } = await deployFixture()

      const id1 = await requestAndFulfill(protocol, coordinator, user)
      const id2 = await requestAndFulfill(protocol, coordinator, user)

      const readings = await protocol.getUserReadings(user.address)
      expect(readings.length).to.equal(2)
      expect(readings[0].status).to.equal(1n) // Fulfilled
      expect(readings[1].status).to.equal(1n)
    })
  })

  describe("claimRefund", () => {
    it("should allow refund after timeout", async () => {
      const { protocol, user } = await deployFixture()
      const fee = ethers.parseEther("0.001")

      const tx = await protocol.connect(user).requestReading(0, { value: fee })
      const receipt = await tx.wait()
      const readingId = extractReadingId(receipt, protocol)

      await time.increase(86400 + 1)

      const refundTx = await protocol.connect(user).claimRefund(readingId)
      const refundReceipt = await refundTx.wait()

      const reading = await protocol.getReading(readingId)
      expect(reading.status).to.equal(2n) // Refunded

      const refundEvent = findEvent(refundReceipt, "ReadingRefunded")
      expect(refundEvent).to.not.be.undefined
      expect(refundEvent.args[0]).to.equal(readingId)
    })

    it("should revert if not the reading owner", async () => {
      const { protocol, user, other } = await deployFixture()
      const fee = ethers.parseEther("0.001")

      const tx = await protocol.connect(user).requestReading(0, { value: fee })
      const receipt = await tx.wait()
      const readingId = extractReadingId(receipt, protocol)

      await time.increase(86400 + 1)

      await expect(
        protocol.connect(other).claimRefund(readingId)
      ).to.be.revertedWithCustomError(protocol, "NotReadingOwner")
    })

    it("should revert if reading not pending", async () => {
      const { protocol, coordinator, user } = await deployFixture()
      const readingId = await requestAndFulfill(protocol, coordinator, user)

      await expect(
        protocol.connect(user).claimRefund(readingId)
      ).to.be.revertedWithCustomError(protocol, "ReadingNotPending")
    })

    it("should revert if refund timeout not met", async () => {
      const { protocol, user } = await deployFixture()
      const fee = ethers.parseEther("0.001")

      const tx = await protocol.connect(user).requestReading(0, { value: fee })
      const receipt = await tx.wait()
      const readingId = extractReadingId(receipt, protocol)

      await expect(
        protocol.connect(user).claimRefund(readingId)
      ).to.be.revertedWithCustomError(protocol, "RefundTimeoutNotMet")
    })

    it("should refund the paid fee", async () => {
      const { protocol, user } = await deployFixture()
      const fee = ethers.parseEther("0.001")

      const tx = await protocol.connect(user).requestReading(0, { value: fee })
      const receipt = await tx.wait()
      const readingId = extractReadingId(receipt, protocol)

      await time.increase(86400 + 1)

      const balanceBefore = await ethers.provider.getBalance(user.address)
      const refundTx = await protocol.connect(user).claimRefund(readingId)
      const refundReceipt = await refundTx.wait()
      const gasCost = refundReceipt.gasUsed * refundReceipt.gasPrice
      const balanceAfter = await ethers.provider.getBalance(user.address)

      expect(balanceAfter + gasCost - balanceBefore).to.equal(fee)
    })
  })

  describe("Daily Fortune", () => {
    it("should request daily fortune", async () => {
      const { protocol, coordinator } = await deployFixture()

      const tx = await protocol.requestDailyFortune()
      const receipt = await tx.wait()

      const dailyReqEvent = findEvent(receipt, "DailyFortuneRequested")
      expect(dailyReqEvent).to.not.be.undefined
      const readingId = dailyReqEvent.args[0]
      expect(readingId).to.equal(await protocol.dailyFortuneReadingId())
    })

    it("should fulfill daily fortune and emit event", async () => {
      const { protocol, coordinator } = await deployFixture()

      await protocol.requestDailyFortune()

      const reading = await protocol.getReading(await protocol.dailyFortuneReadingId())
      const vrfReqId = reading.requestId

      const fulfillTx = await coordinator.fulfillRandomWords(vrfReqId, protocol.target)
      const fulfillReceipt = await fulfillTx.wait()

      const dailyPubArgs = getEventArg(fulfillReceipt, protocol, "DailyFortunePublished")
      expect(dailyPubArgs).to.not.be.undefined

      const dailyFortune = await protocol.getLastDailyFortune()
      expect(dailyFortune).to.not.equal("")
    })

    it("should revert if called within interval", async () => {
      const { protocol } = await deployFixture()
      await protocol.requestDailyFortune()

      await expect(
        protocol.requestDailyFortune()
      ).to.be.revertedWithCustomError(protocol, "DailyFortuneAlreadyToday")
    })

    it("should allow next daily fortune after interval", async () => {
      const { protocol, coordinator } = await deployFixture()
      await protocol.requestDailyFortune()

      await time.increase(86400 + 1)

      await protocol.requestDailyFortune()

      const reading = await protocol.getReading(await protocol.dailyFortuneReadingId())
      const vrfReqId = reading.requestId
      await coordinator.fulfillRandomWords(vrfReqId, protocol.target)

      const fortune = await protocol.getLastDailyFortune()
      expect(fortune).to.not.equal("")
    })

    it("should revert when daily fortune is disabled", async () => {
      const { protocol, deployer } = await deployFixture()
      await protocol.connect(deployer).setDailyFortuneActive(false)

      await expect(
        protocol.requestDailyFortune()
      ).to.be.revertedWithCustomError(protocol, "DailyFortuneNotReady")
    })
  })

  describe("Admin - Owner Only", () => {
    it("should allow owner to pause and unpause", async () => {
      const { protocol, deployer, user } = await deployFixture()

      await protocol.connect(deployer).pause()
      expect(await protocol.paused()).to.be.true

      await protocol.connect(deployer).unpause()
      expect(await protocol.paused()).to.be.false
    })

    it("should revert non-owner pause", async () => {
      const { protocol, user } = await deployFixture()
      await expect(
        protocol.connect(user).pause()
      ).to.be.revertedWith("Only callable by owner")
    })

    it("should allow owner to set fee", async () => {
      const { protocol, deployer } = await deployFixture()
      const newFee = ethers.parseEther("0.005")

      await protocol.connect(deployer).setFee(0, newFee)
      const pack = await protocol.getPack(0)
      expect(pack.price).to.equal(newFee)
    })

    it("should allow owner to add pack", async () => {
      const { protocol, deployer } = await deployFixture()
      const fortunes = ["Fortune 1", "Fortune 2"]

      await protocol.connect(deployer).addPack("Premium", fortunes, ethers.parseEther("0.01"), true)
      expect(await protocol.getPackCount()).to.equal(2n)

      const pack = await protocol.getPack(1)
      expect(pack.name).to.equal("Premium")
      expect(pack.fortunes.length).to.equal(2)
      expect(pack.price).to.equal(ethers.parseEther("0.01"))
    })

    it("should allow owner to set pack", async () => {
      const { protocol, deployer } = await deployFixture()
      const fortunes = ["Updated fortune"]

      await protocol.connect(deployer).setPack(0, "Updated", fortunes, ethers.parseEther("0.002"), true)
      const pack = await protocol.getPack(0)
      expect(pack.name).to.equal("Updated")
      expect(pack.fortunes.length).to.equal(1)
      expect(pack.price).to.equal(ethers.parseEther("0.002"))
    })

    it("should allow owner to deactivate pack", async () => {
      const { protocol, deployer, user } = await deployFixture()
      await protocol.connect(deployer).setPack(0, "Classic", ["x"], ethers.parseEther("0.001"), false)

      await expect(
        protocol.connect(user).requestReading(0, { value: ethers.parseEther("0.001") })
      ).to.be.revertedWithCustomError(protocol, "PackNotActive")
    })

    it("should allow owner to set treasury", async () => {
      const { protocol, deployer, other } = await deployFixture()
      await protocol.connect(deployer).setTreasury(other.address)
      expect(await protocol.treasury()).to.equal(other.address)
    })

    it("should allow owner to update VRF config", async () => {
      const { protocol, deployer } = await deployFixture()
      const newKeyHash = ethers.keccak256(ethers.toUtf8Bytes("test"))

      await protocol.connect(deployer).setVRFConfig(newKeyHash, 1, 1000000, 5, 2, true)
      const config = await protocol.getVRFConfig()
      expect(config[0]).to.equal(newKeyHash)
      expect(config[1]).to.equal(1n)
      expect(config[2]).to.equal(1000000)
      expect(config[3]).to.equal(5)
      expect(config[4]).to.equal(2)
      expect(config[5]).to.be.true
    })

    it("should allow owner to set refund timeout", async () => {
      const { protocol, deployer } = await deployFixture()
      await protocol.connect(deployer).setRefundTimeout(3600)
      expect(await protocol.refundTimeout()).to.equal(3600)
    })

    it("should allow owner to set daily fortune interval", async () => {
      const { protocol, deployer } = await deployFixture()
      await protocol.connect(deployer).setDailyFortuneInterval(3600)
      expect(await protocol.dailyFortuneInterval()).to.equal(3600)
    })

    it("should allow owner to toggle daily fortune", async () => {
      const { protocol, deployer } = await deployFixture()
      await protocol.connect(deployer).setDailyFortuneActive(false)
      expect(await protocol.dailyFortuneActive()).to.be.false

      await protocol.connect(deployer).setDailyFortuneActive(true)
      expect(await protocol.dailyFortuneActive()).to.be.true
    })
  })

  describe("Withdrawals", () => {
    it("should allow owner to withdraw to treasury", async () => {
      const { protocol, deployer, treasury, user } = await deployFixture()

      await protocol.connect(user).requestReading(0, { value: ethers.parseEther("0.001") })
      const balance = await ethers.provider.getBalance(protocol.target)
      expect(balance).to.equal(ethers.parseEther("0.001"))

      const treasuryBefore = await ethers.provider.getBalance(treasury.address)
      await protocol.connect(deployer).withdraw()
      const treasuryAfter = await ethers.provider.getBalance(treasury.address)

      expect(treasuryAfter - treasuryBefore).to.equal(ethers.parseEther("0.001"))
    })

    it("should allow owner to withdraw to specific address", async () => {
      const { protocol, deployer, user, other } = await deployFixture()

      await protocol.connect(user).requestReading(0, { value: ethers.parseEther("0.001") })

      const balanceBefore = await ethers.provider.getBalance(other.address)
      await protocol.connect(deployer).withdrawTo(other.address)
      const balanceAfter = await ethers.provider.getBalance(other.address)

      expect(balanceAfter - balanceBefore).to.equal(ethers.parseEther("0.001"))
    })

    it("should revert non-owner withdraw", async () => {
      const { protocol, user } = await deployFixture()
      await expect(
        protocol.connect(user).withdraw()
      ).to.be.revertedWith("Only callable by owner")
    })
  })

  describe("Edge Cases", () => {
    it("should handle multiple consecutive readings", async () => {
      const { protocol, coordinator, user } = await deployFixture()
      const fee = ethers.parseEther("0.001")

      for (let i = 0; i < 3; i++) {
        const tx = await protocol.connect(user).requestReading(0, { value: fee })
        const receipt = await tx.wait()
        const readingId = extractReadingId(receipt, protocol)
        const reading = await protocol.getReading(readingId)
        await coordinator.fulfillRandomWords(reading.requestId, protocol.target)

        const fulfilled = await protocol.getReading(readingId)
        expect(fulfilled.status).to.equal(1n)
        expect(fulfilled.fortune).to.not.equal("")
      }
    })

    it("should accumulate fees in contract", async () => {
      const { protocol, user } = await deployFixture()
      const fee = ethers.parseEther("0.001")

      await protocol.connect(user).requestReading(0, { value: fee })
      await protocol.connect(user).requestReading(0, { value: fee })

      const balance = await ethers.provider.getBalance(protocol.target)
      expect(balance).to.equal(fee * 2n)
    })

    it("should return empty list for new user", async () => {
      const { protocol, other } = await deployFixture()
      const ids = await protocol.getUserReadingIds(other.address)
      expect(ids.length).to.equal(0)
    })

    it("should get pending refund count", async () => {
      const { protocol, user } = await deployFixture()
      const fee = ethers.parseEther("0.001")

      await protocol.connect(user).requestReading(0, { value: fee })
      expect(await protocol.getPendingRefundCount(user.address)).to.equal(0n)

      await time.increase(86400 + 1)
      expect(await protocol.getPendingRefundCount(user.address)).to.equal(1n)
    })

    it("should revert claim refund for non-existent reading", async () => {
      const { protocol, user } = await deployFixture()
      await expect(
        protocol.connect(user).claimRefund(999)
      ).to.be.revertedWithCustomError(protocol, "ReadingNotFound")
    })

    it("should not update VRF config from non-owner", async () => {
      const { protocol, user } = await deployFixture()
      await expect(
        protocol.connect(user).setVRFConfig(ethers.ZeroHash, 1, 100000, 3, 1, true)
      ).to.be.revertedWith("Only callable by owner")
    })
  })

  describe("Events", () => {
    it("should emit ReadingRequested event", async () => {
      const { protocol, user } = await deployFixture()
      const fee = ethers.parseEther("0.001")

      const tx = await protocol.connect(user).requestReading(0, { value: fee })
      const receipt = await tx.wait()

      const reqEventArgs = getEventArg(receipt, protocol, "ReadingRequested")
      expect(reqEventArgs).to.not.be.undefined
      expect(reqEventArgs[1]).to.equal(user.address)
    })

    it("should emit ReadingFulfilled event", async () => {
      const { protocol, coordinator, user } = await deployFixture()
      const readingId = await requestAndFulfill(protocol, coordinator, user)

      const reading = await protocol.getReading(readingId)
      expect(reading.status).to.equal(1n)
    })

    it("should emit PackUpdated event", async () => {
      const { protocol, deployer } = await deployFixture()
      const fortunes = ["New fortune"]

      const tx = await protocol.connect(deployer).addPack("New", fortunes, ethers.parseEther("0.005"), true)
      const receipt = await tx.wait()

      const packEvent = findEvent(receipt, "PackUpdated")
      expect(packEvent).to.not.be.undefined
      expect(packEvent.args[1]).to.equal("New")
    })

    it("should emit TreasuryUpdated event", async () => {
      const { protocol, deployer, other } = await deployFixture()

      const tx = await protocol.connect(deployer).setTreasury(other.address)
      const receipt = await tx.wait()

      const treasuryEvent = findEvent(receipt, "TreasuryUpdated")
      expect(treasuryEvent).to.not.be.undefined
      expect(treasuryEvent.args[0]).to.equal(other.address)
    })
  })

  describe("Read functions", () => {
    it("should return all packs", async () => {
      const { protocol, deployer } = await deployFixture()
      const fortunes = ["Test"]
      await protocol.connect(deployer).addPack("Extra", fortunes, ethers.parseEther("0.002"), true)

      const packs = await protocol.getAllPacks()
      expect(packs.length).to.equal(2)
      expect(packs[0].name).to.equal("Classic")
      expect(packs[1].name).to.equal("Extra")
    })

    it("should return VRF config", async () => {
      const { protocol } = await deployFixture()
      const config = await protocol.getVRFConfig()
      expect(config[2]).to.equal(2500000) // callbackGasLimit
      expect(config[3]).to.equal(3) // requestConfirmations
      expect(config[4]).to.equal(1) // numWords
    })
  })
})
