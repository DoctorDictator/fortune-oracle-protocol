"use client"

import { useState } from "react"
import { useAccount, useWriteContract, useReadContract } from "wagmi"
import { fortuneProtocolAbi } from "@/lib/abi"
import { FORTUNE_CONTRACT_ADDRESS } from "@/lib/config"

type TxState = "idle" | "confirming_wallet" | "submitted" | "confirmed" | "waiting_for_vrf" | "fulfilled" | "failed"

export function ReadingForm() {
  const { address, isConnected } = useAccount()
  const [packId, setPackId] = useState(0)
  const [txState, setTxState] = useState<TxState>("idle")
  const [fortune, setFortune] = useState("")
  const [errorMsg, setErrorMsg] = useState("")

  const { data: pack } = useReadContract({
    address: FORTUNE_CONTRACT_ADDRESS as `0x${string}`,
    abi: fortuneProtocolAbi,
    functionName: "getPack",
    args: [packId],
  })

  const { data: packCount } = useReadContract({
    address: FORTUNE_CONTRACT_ADDRESS as `0x${string}`,
    abi: fortuneProtocolAbi,
    functionName: "getPackCount",
  })

  const { writeContractAsync } = useWriteContract()

  const handleRequest = async () => {
    if (!address || !pack) return
    setTxState("confirming_wallet")
    setErrorMsg("")
    setFortune("")

    try {
      await writeContractAsync({
        address: FORTUNE_CONTRACT_ADDRESS as `0x${string}`,
        abi: fortuneProtocolAbi,
        functionName: "requestReading",
        args: [packId],
        value: (pack as { price: bigint }).price,
      })

      setTxState("submitted")
    } catch (e) {
      setTxState("failed")
      setErrorMsg("Transaction rejected or failed")
      console.error(e)
    }
  }

  if (!isConnected) {
    return (
      <div className="p-6 bg-zinc-900 rounded-xl border border-zinc-800 text-center text-zinc-500">
        Connect your wallet to request a fortune reading.
      </div>
    )
  }

  const stateLabel = (() => {
    switch (txState) {
      case "confirming_wallet": return "Confirm in wallet..."
      case "submitted": return "Transaction submitted"
      case "confirmed": return "Awaiting VRF response..."
      case "waiting_for_vrf": return "Waiting for Chainlink VRF..."
      case "fulfilled": return `Your fortune: "${fortune}"`
      case "failed": return `Failed: ${errorMsg}`
      default: return null
    }
  })()

  return (
    <div className="p-6 bg-zinc-900 rounded-xl border border-zinc-800 space-y-4">
      <h2 className="text-lg font-semibold text-white">Request a Fortune Reading</h2>

      {txState !== "idle" && (
        <div className={`p-3 rounded-lg text-sm ${
          txState === "fulfilled" ? "bg-green-900/30 text-green-300 border border-green-800/50" :
          txState === "failed" ? "bg-red-900/30 text-red-300 border border-red-800/50" :
          "bg-blue-900/30 text-blue-300 border border-blue-800/50"
        }`}>
          {stateLabel}
        </div>
      )}

      {packCount && Number(packCount) > 1 && (
        <div className="flex gap-2">
          {Array.from({ length: Number(packCount) }, (_, i) => (
            <button
              key={i}
              onClick={() => setPackId(i)}
              className={`px-3 py-1 rounded text-sm ${packId === i ? "bg-blue-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}
            >
              Pack {i}
            </button>
          ))}
        </div>
      )}

      {pack && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Pack:</span>
            <span className="text-white font-medium">{(pack as { name: string }).name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Fee:</span>
            <span className="text-white font-medium">{((pack as { price: bigint }).price)} wei</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">Active:</span>
            <span className={((pack as { active: boolean }).active) ? "text-green-400" : "text-red-400"}>
              {(pack as { active: boolean }).active ? "Yes" : "No"}
            </span>
          </div>
        </div>
      )}

      <button
        onClick={handleRequest}
        disabled={txState !== "idle" || !pack || !(pack as { active: boolean }).active}
        className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg font-medium transition-colors"
      >
        {txState !== "idle" ? "Requesting..." : "Read My Fortune"}
      </button>
    </div>
  )
}
