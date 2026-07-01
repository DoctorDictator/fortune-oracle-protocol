"use client"

import { useState } from "react"
import { useAccount, useWriteContract, useReadContract } from "wagmi"
import { fortuneProtocolAbi } from "@/lib/abi"
import { FORTUNE_CONTRACT_ADDRESS } from "@/lib/config"
import { parseEther } from "viem"

export function ReadingForm() {
  const { address, isConnected } = useAccount()
  const [packId, setPackId] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

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
    setIsLoading(true)
    try {
      const hash = await writeContractAsync({
        address: FORTUNE_CONTRACT_ADDRESS as `0x${string}`,
        abi: fortuneProtocolAbi,
        functionName: "requestReading",
    args: [packId],
        value: (pack as { price: bigint }).price,
      })
    } catch (e) {
      console.error(e)
    } finally {
      setIsLoading(false)
    }
  }

  if (!isConnected) {
    return (
      <div className="p-6 bg-zinc-900 rounded-xl border border-zinc-800 text-center text-zinc-500">
        Connect your wallet to request a fortune reading.
      </div>
    )
  }

  return (
    <div className="p-6 bg-zinc-900 rounded-xl border border-zinc-800 space-y-4">
      <h2 className="text-lg font-semibold text-white">Request a Fortune Reading</h2>

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
        disabled={isLoading || !pack || !(pack as { active: boolean }).active}
        className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg font-medium transition-colors"
      >
        {isLoading ? "Requesting..." : "🔮 Read My Fortune"}
      </button>
    </div>
  )
}
