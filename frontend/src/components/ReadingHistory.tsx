"use client"

import { useAccount, useReadContract, useWriteContract } from "wagmi"
import { fortuneProtocolAbi } from "@/lib/abi"
import { FORTUNE_CONTRACT_ADDRESS } from "@/lib/config"

function statusLabel(status: number): string {
  const labels = ["Pending", "Fulfilled", "Refunded"]
  return labels[status] || "Unknown"
}

function statusColor(status: number): string {
  if (status === 0) return "text-yellow-400"
  if (status === 1) return "text-green-400"
  return "text-zinc-500"
}

export function ReadingHistory() {
  const { address, isConnected } = useAccount()

  const { data: readingIds, refetch: refetchIds } = useReadContract({
    address: FORTUNE_CONTRACT_ADDRESS as `0x${string}`,
    abi: fortuneProtocolAbi,
    functionName: "getUserReadingIds",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })

  if (!isConnected || !address) return null

  const ids = (readingIds as bigint[]) || []

  if (ids.length === 0) {
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
        <h2 className="text-lg font-semibold text-white">Your Readings ({ids.length})</h2>
        <button onClick={() => refetchIds()} className="text-xs text-blue-400 hover:text-blue-300">Refresh</button>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {[...ids].reverse().map((id) => (
          <ReadingCard key={id.toString()} readingId={id} />
        ))}
      </div>
    </div>
  )
}

function ReadingCard({ readingId }: { readingId: bigint }) {
  const { address } = useAccount()
  const { writeContractAsync } = useWriteContract()

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

  const canRefund = r.status === 0

  const handleRefund = async () => {
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
    }
  }

  return (
    <div className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700/50 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-zinc-500">#{readingId.toString()}</span>
        <span className={`text-xs font-medium ${statusColor(r.status)}`}>{statusLabel(r.status)}</span>
      </div>

      {r.fortune && (
        <p className="text-sm text-zinc-200 italic">"{r.fortune}"</p>
      )}

      <div className="flex justify-between text-xs text-zinc-500">
        <span>Pack #{r.packId.toString()}</span>
        <span>Fee: {r.fee.toString()} wei</span>
      </div>

      {canRefund && (
        <button
          onClick={handleRefund}
          className="w-full py-1.5 mt-1 text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded transition-colors"
        >
          Claim Refund
        </button>
      )}
    </div>
  )
}
