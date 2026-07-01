"use client"

import { useAccount, useConnect, useDisconnect } from "wagmi"
import { injected } from "wagmi/connectors"

export function WalletConnect() {
  const { address, isConnected, chain } = useAccount()
  const { connect } = useConnect()
  const { disconnect } = useDisconnect()

  if (isConnected) {
    return (
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${chain?.id === 11155111 ? "bg-green-400" : "bg-yellow-400"}`} />
          <span className="text-sm text-zinc-400">
            {chain?.id === 11155111 ? "Sepolia" : chain?.id === 31337 ? "Hardhat" : `Chain ${chain?.id}`}
          </span>
        </div>
        <span className="text-sm font-mono text-zinc-300">
          {address?.slice(0, 6)}...{address?.slice(-4)}
        </span>
        <button onClick={() => disconnect()} className="text-sm text-red-400 hover:text-red-300 transition-colors">
          Disconnect
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => connect({ connector: injected() })}
      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
    >
      Connect Wallet
    </button>
  )
}
