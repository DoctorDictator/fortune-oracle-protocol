"use client"

import { useState } from "react"
import { useAccount, useReadContract, useWriteContract } from "wagmi"
import { fortuneProtocolAbi } from "@/lib/abi"
import { FORTUNE_CONTRACT_ADDRESS } from "@/lib/config"
import { parseEther } from "viem"

export function AdminPanel() {
  const { address } = useAccount()

  const { data: owner, isLoading: ownerLoading } = useReadContract({
    address: FORTUNE_CONTRACT_ADDRESS as `0x${string}`,
    abi: fortuneProtocolAbi,
    functionName: "owner",
  })

  const { data: paused } = useReadContract({
    address: FORTUNE_CONTRACT_ADDRESS as `0x${string}`,
    abi: fortuneProtocolAbi,
    functionName: "paused",
  })

  const { data: treasury } = useReadContract({
    address: FORTUNE_CONTRACT_ADDRESS as `0x${string}`,
    abi: fortuneProtocolAbi,
    functionName: "treasury",
  })

  const isOwner = address?.toLowerCase() === (owner as string)?.toLowerCase()
  const { writeContractAsync } = useWriteContract()
  const [newFee, setNewFee] = useState("")
  const [newPackName, setNewPackName] = useState("")
  const [newPackFortunes, setNewPackFortunes] = useState("")
  const [newPackPrice, setNewPackPrice] = useState("")

  if (ownerLoading) {
    return (
      <div className="p-6 bg-zinc-900 rounded-xl border border-amber-900/50">
        <div className="h-5 w-32 bg-zinc-800 rounded animate-pulse mb-4" />
        <div className="h-4 w-48 bg-zinc-800 rounded animate-pulse" />
      </div>
    )
  }

  if (!isOwner) return null

  const handlePauseToggle = async () => {
    try {
      await writeContractAsync({
        address: FORTUNE_CONTRACT_ADDRESS as `0x${string}`,
        abi: fortuneProtocolAbi,
        functionName: paused ? "unpause" : "pause",
      })
    } catch (e) { console.error(e) }
  }

  const handleSetFee = async () => {
    if (!newFee) return
    try {
      const feeWei = parseEther(newFee)
      await writeContractAsync({
        address: FORTUNE_CONTRACT_ADDRESS as `0x${string}`,
        abi: fortuneProtocolAbi,
        functionName: "setFee",
        args: [0, feeWei],
      })
      setNewFee("")
    } catch (e) { console.error(e) }
  }

  const handleWithdraw = async () => {
    try {
      await writeContractAsync({
        address: FORTUNE_CONTRACT_ADDRESS as `0x${string}`,
        abi: fortuneProtocolAbi,
        functionName: "withdraw",
      })
    } catch (e) { console.error(e) }
  }

  const handleAddPack = async () => {
    if (!newPackName || !newPackFortunes || !newPackPrice) return
    const fortunes = newPackFortunes.split(",").map(s => s.trim()).filter(Boolean)
    if (fortunes.length === 0) return
    try {
      const priceWei = parseEther(newPackPrice)
      await writeContractAsync({
        address: FORTUNE_CONTRACT_ADDRESS as `0x${string}`,
        abi: fortuneProtocolAbi,
        functionName: "addPack",
        args: [newPackName, fortunes, priceWei, true],
      })
      setNewPackName("")
      setNewPackFortunes("")
      setNewPackPrice("")
    } catch (e) { console.error(e) }
  }

  return (
    <div className="p-6 bg-zinc-900 rounded-xl border border-amber-900/50 space-y-6">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold text-amber-400">Admin Panel</h2>
        <span className="px-2 py-0.5 text-xs bg-amber-900/30 text-amber-500 rounded">Owner Only</span>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-zinc-400">Paused:</span>
          <span className={paused ? "text-red-400" : "text-green-400"}>{paused ? "Yes" : "No"}</span>
        </div>
        {treasury && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Treasury:</span>
            <span className="text-zinc-300 font-mono text-xs">{(treasury as string).slice(0, 6)}...</span>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-zinc-300">Controls</h3>

        <button onClick={handlePauseToggle}
          className="w-full py-2 text-sm bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors">
          {paused ? "▶ Unpause Contract" : "⏸ Pause Contract"}
        </button>

        <button onClick={handleWithdraw}
          className="w-full py-2 text-sm bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors">
          💰 Withdraw to Treasury
        </button>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-zinc-300">Update Fee (Pack 0)</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={newFee}
            onChange={(e) => setNewFee(e.target.value)}
            placeholder="Fee in ETH (e.g. 0.005)"
            className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500"
          />
          <button onClick={handleSetFee}
            disabled={!newFee}
            className="px-4 py-2 bg-amber-700 hover:bg-amber-600 disabled:bg-zinc-700 text-white text-sm rounded-lg transition-colors">
            Set
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-zinc-300">Add New Pack</h3>
        <input
          type="text"
          value={newPackName}
          onChange={(e) => setNewPackName(e.target.value)}
          placeholder="Pack name"
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500"
        />
        <textarea
          value={newPackFortunes}
          onChange={(e) => setNewPackFortunes(e.target.value)}
          placeholder="Fortunes (comma-separated)"
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500"
          rows={2}
        />
        <div className="flex gap-2">
          <input
            type="text"
            value={newPackPrice}
            onChange={(e) => setNewPackPrice(e.target.value)}
            placeholder="Price in ETH (e.g. 0.01)"
            className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500"
          />
          <button onClick={handleAddPack}
            disabled={!newPackName || !newPackFortunes || !newPackPrice}
            className="px-4 py-2 bg-amber-700 hover:bg-amber-600 disabled:bg-zinc-700 text-white text-sm rounded-lg transition-colors">
            Add
          </button>
        </div>
      </div>
    </div>
  )
}
