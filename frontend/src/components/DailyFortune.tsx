"use client"

import { useReadContract, useWriteContract } from "wagmi"
import { fortuneProtocolAbi } from "@/lib/abi"
import { FORTUNE_CONTRACT_ADDRESS } from "@/lib/config"
import { useState } from "react"

export function DailyFortune() {
  const [isRequesting, setIsRequesting] = useState(false)
  const { writeContractAsync } = useWriteContract()

  const { data: lastFortune, refetch: refetchFortune } = useReadContract({
    address: FORTUNE_CONTRACT_ADDRESS as `0x${string}`,
    abi: fortuneProtocolAbi,
    functionName: "getLastDailyFortune",
  })

  const { data: lastTime } = useReadContract({
    address: FORTUNE_CONTRACT_ADDRESS as `0x${string}`,
    abi: fortuneProtocolAbi,
    functionName: "lastDailyFortuneTime",
  })

  const { data: interval } = useReadContract({
    address: FORTUNE_CONTRACT_ADDRESS as `0x${string}`,
    abi: fortuneProtocolAbi,
    functionName: "dailyFortuneInterval",
  })

  const { data: active } = useReadContract({
    address: FORTUNE_CONTRACT_ADDRESS as `0x${string}`,
    abi: fortuneProtocolAbi,
    functionName: "dailyFortuneActive",
  })

  const now = Math.floor(Date.now() / 1000)
  const isReady = active && (!lastTime || Number(lastTime) + Number(interval || 86400n) <= now)

  const handleRequest = async () => {
    setIsRequesting(true)
    try {
      await writeContractAsync({
        address: FORTUNE_CONTRACT_ADDRESS as `0x${string}`,
        abi: fortuneProtocolAbi,
        functionName: "requestDailyFortune",
      })
      setTimeout(() => refetchFortune(), 2000)
    } catch (e) {
      console.error(e)
    } finally {
      setIsRequesting(false)
    }
  }

  return (
    <div className="p-6 bg-gradient-to-br from-zinc-900 to-purple-950 rounded-xl border border-purple-900/50 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Daily Fortune</h2>
        {lastFortune && (
          <span className="text-xs text-purple-400">Updated daily</span>
        )}
      </div>

      {lastFortune ? (
        <div className="p-4 bg-purple-900/20 rounded-lg border border-purple-800/30">
          <p className="text-base text-purple-200 italic text-center">"{lastFortune}"</p>
        </div>
      ) : (
        <p className="text-sm text-zinc-500 text-center">No daily fortune yet.</p>
      )}

      {isReady && (
        <button
          onClick={handleRequest}
          disabled={isRequesting}
          className="w-full py-2 bg-purple-700 hover:bg-purple-600 disabled:bg-zinc-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {isRequesting ? "Requesting..." : "🌅 Request Today's Fortune"}
        </button>
      )}

      {lastTime && (
        <p className="text-xs text-zinc-500 text-center">
          Last requested: {new Date(Number(lastTime) * 1000).toLocaleDateString()}
        </p>
      )}
    </div>
  )
}
