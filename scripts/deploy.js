const { ethers, network, run } = require("hardhat")
require("dotenv").config()

const SEPOLIA_CONFIG = {
  vrfCoordinator: process.env.SEPOLIA_VRF_COORDINATOR || "0x9Ddf47E3f0c76cB38D5b4e4a78C7b2E5E4A5f6A7",
  subscriptionId: process.env.SEPOLIA_VRF_SUBSCRIPTION_ID,
  treasury: process.env.TREASURY_ADDRESS || process.env.PRIVATE_KEY,
}

async function main() {
  const [deployer] = await ethers.getSigners()
  console.log(`Deploying FortuneProtocol on ${network.name}...`)
  console.log(`Deployer: ${deployer.address}`)

  const chainId = network.config.chainId
  const isLocal = chainId === 31337

  let vrfCoordinatorAddress
  let subscriptionId
  let treasuryAddress

  if (isLocal) {
    console.log("Local network detected. Deploying mock coordinator...")
    const BASE_FEE = ethers.parseEther("0.1")
    const GAS_PRICE = "1000000000"

    const VRFMockFactory = await ethers.getContractFactory("VRFCoordinatorV2PlusMock")
    const mock = await VRFMockFactory.deploy(BASE_FEE, GAS_PRICE)
    vrfCoordinatorAddress = mock.target

    const tx = await mock.createSubscription()
    const receipt = await tx.wait()
    subscriptionId = receipt.logs[0].args[0]

    await mock.fundSubscriptionWithNative(subscriptionId, { value: ethers.parseEther("10") })
    console.log(`Mock coordinator deployed: ${vrfCoordinatorAddress}`)
    console.log(`Subscription ID: ${subscriptionId}`)
    treasuryAddress = deployer.address
  } else if (chainId === 11155111) {
    vrfCoordinatorAddress = SEPOLIA_CONFIG.vrfCoordinator
    if (!SEPOLIA_CONFIG.subscriptionId) {
      throw new Error("SEPOLIA_VRF_SUBSCRIPTION_ID not set in .env")
    }
    subscriptionId = SEPOLIA_CONFIG.subscriptionId
    treasuryAddress = SEPOLIA_CONFIG.treasury || deployer.address
    console.log(`Using Sepolia VRF Coordinator: ${vrfCoordinatorAddress}`)
    console.log(`Subscription ID: ${subscriptionId}`)
  } else {
    throw new Error(`Unsupported network: ${network.name} (chainId: ${chainId})`)
  }

  const FortuneProtocolFactory = await ethers.getContractFactory("FortuneProtocol")
  const protocol = await FortuneProtocolFactory.deploy(
    subscriptionId,
    vrfCoordinatorAddress,
    treasuryAddress
  )

  const confirmations = isLocal ? 1 : 3
  await protocol.waitForDeployment()

  const protocolAddress = await protocol.getAddress()
  console.log(`\nFortuneProtocol deployed to: ${protocolAddress}`)

  if (isLocal) {
    const VRFMockFactory = await ethers.getContractFactory("VRFCoordinatorV2PlusMock")
    const mock = VRFMockFactory.attach(vrfCoordinatorAddress)
    await mock.addConsumer(subscriptionId, protocolAddress)
    console.log("FortuneProtocol added as consumer to subscription.")
  }

  if (!isLocal && chainId === 11155111) {
    console.log("Waiting 6 blocks before verification...")
    await protocol.deploymentTransaction().wait(6)
    try {
      await run("verify:verify", {
        address: protocolAddress,
        constructorArguments: [subscriptionId, vrfCoordinatorAddress, treasuryAddress],
      })
      console.log("Contract verified on Etherscan.")
    } catch (e) {
      console.error("Verification failed:", e.message)
    }
  }

  console.log("\n--- Deployment Summary ---")
  console.log(`Network: ${network.name}`)
  console.log(`Contract: ${protocolAddress}`)
  console.log(`VRF Coordinator: ${vrfCoordinatorAddress}`)
  console.log(`Subscription ID: ${subscriptionId}`)
  console.log(`Treasury: ${treasuryAddress}`)
  console.log(`Deployer: ${deployer.address}`)

  return {
    network: network.name,
    contractAddress: protocolAddress,
    vrfCoordinator: vrfCoordinatorAddress,
    subscriptionId: subscriptionId.toString(),
    treasury: treasuryAddress,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
  }
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
