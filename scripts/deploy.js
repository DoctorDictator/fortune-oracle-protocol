const { ethers, network, run } = require("hardhat")
const fs = require("fs")
const path = require("path")
require("dotenv").config()

function validateSepoliaEnv() {
  const required = {
    SEPOLIA_RPC_URL: process.env.SEPOLIA_RPC_URL,
    PRIVATE_KEY: process.env.PRIVATE_KEY,
    SEPOLIA_VRF_COORDINATOR: process.env.SEPOLIA_VRF_COORDINATOR,
    SEPOLIA_VRF_SUBSCRIPTION_ID: process.env.SEPOLIA_VRF_SUBSCRIPTION_ID,
    SEPOLIA_VRF_KEY_HASH: process.env.SEPOLIA_VRF_KEY_HASH,
    TREASURY_ADDRESS: process.env.TREASURY_ADDRESS,
  }

  const missing = Object.entries(required)
    .filter(([, v]) => !v)
    .map(([k]) => k)

  if (missing.length > 0) {
    throw new Error(`Missing required env vars for Sepolia: ${missing.join(", ")}`)
  }

  const defaultKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
  if (process.env.PRIVATE_KEY === defaultKey) {
    throw new Error("Cannot use Hardhat default private key for Sepolia deployment")
  }

  if (required.SEPOLIA_VRF_COORDINATOR === ethers.ZeroAddress) {
    throw new Error("Invalid SEPOLIA_VRF_COORDINATOR: cannot be zero address")
  }

  if (required.SEPOLIA_VRF_KEY_HASH === ethers.ZeroHash) {
    throw new Error("Invalid SEPOLIA_VRF_KEY_HASH: cannot be zero")
  }

  if (BigInt(required.SEPOLIA_VRF_SUBSCRIPTION_ID) === 0n) {
    throw new Error("Invalid SEPOLIA_VRF_SUBSCRIPTION_ID: cannot be zero")
  }

  if (required.TREASURY_ADDRESS === ethers.ZeroAddress) {
    throw new Error("Invalid TREASURY_ADDRESS: cannot be zero address")
  }
}

async function main() {
  const [deployer] = await ethers.getSigners()
  console.log(`Deploying FortuneProtocol on ${network.name}...`)
  console.log(`Deployer: ${deployer.address}`)

  const chainId = network.config.chainId
  const isLocal = chainId === 31337
  const isSepolia = chainId === 11155111

  let vrfCoordinatorAddress
  let subscriptionId
  let treasuryAddress
  let keyHash
  let nativePayment = true

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
    keyHash = ethers.keccak256(ethers.toUtf8Bytes("local"))
    console.log(`Key hash: ${keyHash}`)
  } else if (isSepolia) {
    validateSepoliaEnv()

    vrfCoordinatorAddress = process.env.SEPOLIA_VRF_COORDINATOR
    subscriptionId = process.env.SEPOLIA_VRF_SUBSCRIPTION_ID
    treasuryAddress = process.env.TREASURY_ADDRESS
    keyHash = process.env.SEPOLIA_VRF_KEY_HASH

    console.log(`Using Sepolia VRF Coordinator: ${vrfCoordinatorAddress}`)
    console.log(`Subscription ID: ${subscriptionId}`)
    console.log(`Treasury: ${treasuryAddress}`)
  } else {
    throw new Error(`Unsupported network: ${network.name} (chainId: ${chainId})`)
  }

  const FortuneProtocolFactory = await ethers.getContractFactory("FortuneProtocol")
  const protocol = await FortuneProtocolFactory.deploy(
    subscriptionId,
    vrfCoordinatorAddress,
    keyHash,
    treasuryAddress
  )

  const deployTx = protocol.deploymentTransaction()
  await protocol.waitForDeployment()

  const protocolAddress = await protocol.getAddress()
  console.log(`\nFortuneProtocol deployed to: ${protocolAddress}`)

  if (isLocal) {
    const VRFMockFactory = await ethers.getContractFactory("VRFCoordinatorV2PlusMock")
    const mock = VRFMockFactory.attach(vrfCoordinatorAddress)
    await mock.addConsumer(subscriptionId, protocolAddress)
    console.log("FortuneProtocol added as consumer to subscription.")
  }

  let verified = false
  if (!isLocal && isSepolia) {
    console.log("Waiting 6 blocks before verification...")
    await protocol.deploymentTransaction().wait(6)
    try {
      await run("verify:verify", {
        address: protocolAddress,
        constructorArguments: [subscriptionId, vrfCoordinatorAddress, keyHash, treasuryAddress],
      })
      console.log("Contract verified on Etherscan.")
      verified = true
    } catch (e) {
      console.error("Verification failed:", e.message)
    }
  }

  const deployment = {
    network: network.name,
    chainId: chainId,
    contractAddress: protocolAddress,
    deployer: deployer.address,
    treasury: treasuryAddress,
    vrfCoordinator: vrfCoordinatorAddress,
    subscriptionId: subscriptionId.toString(),
    keyHash: keyHash,
    nativePayment: nativePayment,
    transactionHash: deployTx ? deployTx.hash : null,
    blockNumber: deployTx ? deployTx.blockNumber : null,
    verified: verified,
    timestamp: new Date().toISOString(),
  }

  console.log("\n--- Deployment Summary ---")
  for (const [key, value] of Object.entries(deployment)) {
    console.log(`${key}: ${value}`)
  }

  const deploymentsDir = path.resolve(__dirname, "../deployments")
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true })
  }

  const fileName = isLocal ? "localhost.json" : "sepolia.json"
  const filePath = path.join(deploymentsDir, fileName)
  fs.writeFileSync(filePath, JSON.stringify(deployment, null, 2))
  console.log(`\nDeployment saved to ${filePath}`)

  // Export ABI after deployment
  try {
    const exportAbi = require("./export-abi")
    if (typeof exportAbi === "function") {
      exportAbi()
    }
  } catch (e) {
    console.log("ABI export skipped (export-abi not available as module)")
  }

  return deployment
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
