"use client"

import { WalletConnect } from "@/components/WalletConnect"
import { ReadingForm } from "@/components/ReadingForm"
import { ReadingHistory } from "@/components/ReadingHistory"
import { DailyFortune } from "@/components/DailyFortune"
import { AdminPanel } from "@/components/AdminPanel"
import { FORTUNE_CONTRACT_ADDRESS } from "@/lib/config"

export default function Home() {
  const isConfigured = FORTUNE_CONTRACT_ADDRESS && FORTUNE_CONTRACT_ADDRESS !== "0x0" && FORTUNE_CONTRACT_ADDRESS !== "0x"

  if (!isConfigured) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="max-w-md text-center space-y-4 p-8">
          <h1 className="text-2xl font-bold text-red-400">Setup Required</h1>
          <p className="text-zinc-400">
            The contract address is not configured. Set <code className="text-amber-400 bg-zinc-800 px-2 py-0.5 rounded">NEXT_PUBLIC_CONTRACT_ADDRESS</code> in your <code className="text-amber-400 bg-zinc-800 px-2 py-0.5 rounded">frontend/.env.local</code> file.
          </p>
          <div className="text-sm text-zinc-500 space-y-2">
            <p>1. Deploy the FortuneProtocol contract to Sepolia or localhost</p>
            <p>2. Copy the deployed address</p>
            <p>3. Add it to your environment file</p>
            <p>4. Restart the dev server</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-black/80 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-purple-400">FortuneProtocol</h1>
            <p className="text-xs text-zinc-500">Chainlink VRF v2.5 • Sepolia</p>
          </div>
          <WalletConnect />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <ReadingForm />
            <ReadingHistory />
          </div>
          <div className="space-y-6">
            <DailyFortune />
            <AdminPanel />
          </div>
        </div>
      </main>

      <footer className="border-t border-zinc-800 py-6 text-center text-xs text-zinc-600">
        FortuneProtocol — Powered by Chainlink VRF
      </footer>
    </div>
  )
}
