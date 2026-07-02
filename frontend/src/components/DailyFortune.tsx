"use client"

import { useReadContract, useWriteContract } from "wagmi"
import { fortuneProtocolAbi } from "@/lib/abi"
import { FORTUNE_CONTRACT_ADDRESS } from "@/lib/config"
import { useState, useEffect } from "react"

function useCountdown(targetTimestamp: number): { countdown: string; isReady: boolean } {
  const [state, setState] = useState<{ countdown: string; isReady: boolean }>({
    countdown: "",
    isReady: targetTimestamp <= 0,
  })

  useEffect(() => {
    if (targetTimestamp <= 0) return
    const update = () => {
      const now = Math.floor(Date.now() / 1000)
      if (now >= targetTimestamp) {
        setState({ countdown: "Available now!", isReady: true })
        return
      }
      const remaining = targetTimestamp - now
      const hrs = Math.floor(remaining / 3600)
      const mins = Math.floor((remaining % 3600) / 60)
      const secs = remaining % 60
      setState({ countdown: `${hrs}h ${mins}m ${secs}s`, isReady: false })
    }
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [targetTimestamp])

  return state
}

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

  const { data: readingId } = useReadContract({
    address: FORTUNE_CONTRACT_ADDRESS as `0x${string}`,
    abi: fortuneProtocolAbi,
    functionName: "dailyFortuneReadingId",
  })

  const { data: dailyReading } = useReadContract({
    address: FORTUNE_CONTRACT_ADDRESS as `0x${string}`,
    abi: fortuneProtocolAbi,
    functionName: "getReading",
    args: readingId ? [readingId] : undefined,
    query: { enabled: !!readingId && readingId > 0n },
  })

  const intervalSec = Number(interval || 86400n)
  const lastTimeSec = Number(lastTime || 0n)
  const nextAvailable = lastTime ? lastTimeSec + intervalSec : 0
  const { countdown, isReady } = useCountdown(nextAvailable)

  const dailyReadingData = dailyReading as {
    status: number
    fortune: string
    requestedAt: bigint
  } | undefined
  const dailyPending = dailyReadingData && dailyReadingData.status === 0

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

      {dailyPending && (
        <div className="p-3 bg-yellow-900/20 rounded-lg border border-yellow-800/30">
          <p className="text-sm text-yellow-300 text-center">Fortune request pending, waiting for VRF...</p>
        </div>
      )}

      {lastFortune && !dailyPending ? (
        <div className="p-4 bg-purple-900/20 rounded-lg border border-purple-800/30">
          <p className="text-base text-purple-200 italic text-center">&ldquo;{lastFortune}&rdquo;</p>
        </div>
      ) : !dailyPending ? (
        <p className="text-sm text-zinc-500 text-center">No daily fortune yet.</p>
      ) : null}

      {countdown && !isReady && (
        <div className="text-center">
          <p className="text-xs text-zinc-500">Next fortune available in:</p>
          <p className="text-sm text-purple-300 font-mono">{countdown}</p>
        </div>
      )}

      {active && isReady && (
        <button
          onClick={handleRequest}
          disabled={isRequesting}
          className="w-full py-2 bg-purple-700 hover:bg-purple-600 disabled:bg-zinc-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {isRequesting ? "Requesting..." : "Request Today's Fortune"}
        </button>
      )}

      {lastTime && (
        <p className="text-xs text-zinc-500 text-center">
          Last requested: {new Date(lastTimeSec * 1000).toLocaleDateString()}
        </p>
      )}
    </div>
  )
}
