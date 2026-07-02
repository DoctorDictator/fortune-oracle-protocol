"use client"

import { useState, useEffect, useCallback } from "react"
import { useAccount, useReadContract, useWriteContract } from "wagmi"
import { fortuneProtocolAbi } from "@/lib/abi"
import { FORTUNE_CONTRACT_ADDRESS } from "@/lib/config"

const PAGE_SIZE = 10
const REFUND_TIMEOUT = 86400n

function computeStatus(reading: {
  status: number
  requestedAt: bigint
  fortune: string
  now: bigint
}): { label: string; color: string } {
  const refundable = reading.status === 0 && reading.now >= reading.requestedAt + REFUND_TIMEOUT

  if (reading.status === 2) return { label: "Refunded", color: "text-zinc-500" }
  if (reading.status === 1) return { label: "Fulfilled", color: "text-green-400" }
  if (refundable) return { label: "Refundable", color: "text-orange-400" }
  if (reading.status === 0 && reading.fortune !== "") return { label: "Waiting for VRF", color: "text-yellow-400" }
  return { label: "Pending", color: "text-yellow-400" }
}

function useNow(): bigint {
  const [now, setNow] = useState<bigint>(0n)
  useEffect(() => {
    const timer = setInterval(() => setNow(BigInt(Math.floor(Date.now() / 1000))), 10000)
    return () => clearInterval(timer)
  }, [])
  return now
}

export function ReadingHistory() {
  const { address, isConnected } = useAccount()
  const [offset, setOffset] = useState(0)
  const [allIds, setAllIds] = useState<bigint[]>([])
  const [total, setTotal] = useState(0)

  const { refetch: fetchPage } = useReadContract({
    address: FORTUNE_CONTRACT_ADDRESS as `0x${string}`,
    abi: fortuneProtocolAbi,
    functionName: "getUserReadingIdsPage",
    args: address ? [address, BigInt(offset), BigInt(PAGE_SIZE)] : undefined,
    query: { enabled: false },
  })

  const loadPage = useCallback(async () => {
    if (!address) return
    const { data } = await fetchPage()
    if (!data) return
    const [ids, totalCount] = data as [bigint[], bigint]
    setAllIds(ids)
    setTotal(Number(totalCount))
  }, [address, fetchPage])

  useEffect(() => {
    if (!address) return
    const timer = setTimeout(() => loadPage(), 0)
    return () => clearTimeout(timer)
  }, [address, loadPage])

  const loadMore = async () => {
    const newOffset = offset + PAGE_SIZE
    setOffset(newOffset)
    const { data } = await fetchPage()
    if (!data) return
    const [ids] = data as [bigint[], bigint]
    setAllIds(prev => [...prev, ...ids])
  }

  if (!isConnected || !address) return null

  if (allIds.length === 0) {
    return (
      <div className="p-6 bg-zinc-900 rounded-xl border border-zinc-800">
        <h2 className="text-lg font-semibold text-white mb-2">Your Readings</h2>
        <p className="text-zinc-500 text-sm">No readings yet. Request your first fortune above!</p>
      </div>
    )
  }

  return (
    <div className="p-6 bg-zinc-900 rounded-xl border border-zinc-800 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Your Readings ({total})</h2>
        <button onClick={loadPage} className="text-xs text-blue-400 hover:text-blue-300">Refresh</button>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {[...allIds].reverse().map((id) => (
          <ReadingCard key={id.toString()} readingId={id} />
        ))}
      </div>

      {allIds.length < total && (
        <button
          onClick={loadMore}
          className="w-full py-2 text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors"
        >
          Load More ({total - allIds.length} remaining)
        </button>
      )}
    </div>
  )
}

function ReadingCard({ readingId }: { readingId: bigint }) {
  const { address } = useAccount()
  const { writeContractAsync } = useWriteContract()
  const [refunding, setRefunding] = useState(false)
  const now = useNow()

  const { data: reading, refetch } = useReadContract({
    address: FORTUNE_CONTRACT_ADDRESS as `0x${string}`,
    abi: fortuneProtocolAbi,
    functionName: "getReading",
    args: [readingId],
    query: { enabled: !!address },
  })

  if (!reading) return <div className="h-16 bg-zinc-800 rounded-lg animate-pulse" />

  const r = reading as {
    user: `0x${string}`
    packId: number
    status: number
    fee: bigint
    requestId: bigint
    requestedAt: bigint
    fulfilledAt: bigint
    fortune: string
  }

  const statusInfo = computeStatus({ ...r, now })
  const canRefund = r.status === 0 && now >= r.requestedAt + REFUND_TIMEOUT

  const handleRefund = async () => {
    setRefunding(true)
    try {
      await writeContractAsync({
        address: FORTUNE_CONTRACT_ADDRESS as `0x${string}`,
        abi: fortuneProtocolAbi,
        functionName: "claimRefund",
        args: [readingId],
      })
      refetch()
    } catch (e) {
      console.error(e)
    } finally {
      setRefunding(false)
    }
  }

  return (
    <div className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700/50 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-zinc-500">#{readingId.toString()}</span>
        <span className={`text-xs font-medium ${statusInfo.color}`}>{statusInfo.label}</span>
      </div>

      {r.fortune && (
        <p className="text-sm text-zinc-200 italic">&ldquo;{r.fortune}&rdquo;</p>
      )}

      <div className="flex justify-between text-xs text-zinc-500">
        <span>Pack #{r.packId.toString()}</span>
        <span>Fee: {r.fee.toString()} wei</span>
      </div>

      {r.requestedAt > 0n && (
        <div className="text-xs text-zinc-600">
          Requested: {new Date(Number(r.requestedAt) * 1000).toLocaleString()}
        </div>
      )}

      {canRefund && (
        <button
          onClick={handleRefund}
          disabled={refunding}
          className="w-full py-1.5 mt-1 text-xs bg-orange-700 hover:bg-orange-600 disabled:bg-zinc-700 text-white rounded transition-colors"
        >
          {refunding ? "Processing..." : "Claim Refund"}
        </button>
      )}
    </div>
  )
}
