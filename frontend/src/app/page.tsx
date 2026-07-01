"use client"

import { WalletConnect } from "@/components/WalletConnect"
import { ReadingForm } from "@/components/ReadingForm"
import { ReadingHistory } from "@/components/ReadingHistory"
import { DailyFortune } from "@/components/DailyFortune"
import { AdminPanel } from "@/components/AdminPanel"

export default function Home() {
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
