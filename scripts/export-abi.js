const fs = require("fs")
const path = require("path")

const artifactPath = path.resolve(__dirname, "../artifacts/contracts/FortuneProtocol.sol/FortuneProtocol.json")
const outputPath = path.resolve(__dirname, "../frontend/src/lib/abi.ts")

const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"))

const abiCode = `export const fortuneProtocolAbi = ${JSON.stringify(artifact.abi, null, 2)} as const\n`

fs.writeFileSync(outputPath, abiCode)
console.log(`ABI exported to ${outputPath}`)
