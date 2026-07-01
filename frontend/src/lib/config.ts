import { http, createConfig } from "wagmi"
import { sepolia, hardhat } from "wagmi/chains"

export const FORTUNE_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "0x0"

export const config = createConfig({
  chains: [sepolia, hardhat],
  transports: {
    [sepolia.id]: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || "https://rpc.sepolia.org"),
    [hardhat.id]: http("http://127.0.0.1:8545"),
  },
})
