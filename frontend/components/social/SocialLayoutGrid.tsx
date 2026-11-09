'use client';

import React from 'react';
import Link from 'next/link';
import { NotificationDropdown } from './NotificationDropdown';
import { useSocialStore } from '@/store/useSocialStore';

interface SocialLayoutGridProps {
  children: React.ReactNode;
  onOpenAgentModal?: () => void;
}

export function SocialLayoutGrid({ children, onOpenAgentModal }: SocialLayoutGridProps) {
  const { openComposer } = useSocialStore();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-cyan-500 selection:text-slate-950">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/75 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center text-slate-950 font-black shadow-[0_0_16px_rgba(6,182,212,0.4)]">
              ⚡
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-cyan-400 via-indigo-300 to-white bg-clip-text text-transparent">
                Social<span className="text-cyan-400">Flow</span>
              </span>
              <span className="ms-2 px-1.5 py-0.5 rounded text-sm font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                Pulse Hub
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {onOpenAgentModal && (
              <button
                onClick={onOpenAgentModal}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold bg-gradient-to-r from-indigo-500 to-purple-600 hover:opacity-90 text-white shadow-[0_0_12px_rgba(99,102,241,0.4)] transition-all"
              >
                <span>🤖</span> <span>סוכן LangGraph</span>
              </button>
            )}

            <NotificationDropdown />

            <div className="flex items-center gap-2 ps-2 border-s border-slate-800">
              <img
                src="https://api.dicebear.com/7.x/bottts/svg?seed=idan"
                alt="Idan"
                className="w-10 h-10 rounded-full border border-cyan-400/40"
              />
              <span className="text-sm font-bold hidden md:inline">עידן קזם</span>
            </div>
          </div>
        </div>
      </header>

      {/* 3-Column Responsive Grid */}
      <div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Right Nav Column (In RTL start is right) */}
        <aside className="lg:col-span-3 space-y-4 hidden lg:block">
          <div className="social-glass-card rounded-3xl p-5 space-y-4">
            <div className="flex items-center gap-3">
              <img
                src="https://api.dicebear.com/7.x/bottts/svg?seed=idan"
                alt=""
                className="w-12 h-12 rounded-full border border-cyan-400/40"
              />
              <div>
                <div className="font-bold text-sm text-slate-100">עידן קזם</div>
                <div className="text-sm text-cyan-400 font-mono">@idan</div>
              </div>
            </div>

            <button
              onClick={openComposer}
              className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-indigo-500 hover:opacity-90 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all"
            >
              ✍️ צור פוסט חדש
            </button>
          </div>

          <nav className="social-glass-card rounded-3xl p-3 space-y-1 text-sm font-semibold">
            <Link href="/community" className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl bg-cyan-500/15 text-cyan-300 font-bold">
              <span>🏠</span> <span>פיד קהילה ראשי</span>
            </Link>
            <Link href="/stories" className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-400 hover:bg-slate-900/60 hover:text-slate-200 transition-colors">
              <span>📸</span> <span>סטוריז (Stories)</span>
            </Link>
            <button
              onClick={onOpenAgentModal}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-400 hover:bg-slate-900/60 hover:text-slate-200 transition-colors"
            >
              <span>🤖</span> <span>סוכן AI (LangGraph)</span>
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-400 hover:bg-slate-900/60 hover:text-slate-200 transition-colors">
              <span>🔥</span> <span>נושאים חמים</span>
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-400 hover:bg-slate-900/60 hover:text-slate-200 transition-colors">
              <span>🔖</span> <span>פוסטים שמורים</span>
            </button>
          </nav>
        </aside>

        {/* Center Main Stream */}
        <main className="lg:col-span-6 space-y-4">{children}</main>

        {/* Left Trends & Widget Column (In RTL end is left) */}
        <aside className="lg:col-span-3 space-y-4 hidden lg:block">
          {/* Trending Box */}
          <div className="social-glass-card rounded-3xl p-5 space-y-3">
            <h4 className="font-bold text-sm text-slate-200 flex items-center gap-2">
              <span>🔥</span> <span>טרנדים מובילים באתר</span>
            </h4>
            <div className="space-y-2 text-xs">
              <div className="hover:bg-slate-900/40 p-2 rounded-xl transition-colors cursor-pointer">
                <span className="text-cyan-400 font-bold font-mono">#LangGraph_10</span>
                <div className="text-sm text-slate-400">1,240 שיתופים היום</div>
              </div>
              <div className="hover:bg-slate-900/40 p-2 rounded-xl transition-colors cursor-pointer">
                <span className="text-cyan-400 font-bold font-mono">#Nextjs15_React19</span>
                <div className="text-sm text-slate-400">890 שיתופים היום</div>
              </div>
              <div className="hover:bg-slate-900/40 p-2 rounded-xl transition-colors cursor-pointer">
                <span className="text-cyan-400 font-bold font-mono">#LiquidGlass_UI</span>
                <div className="text-sm text-slate-400">540 שיתופים היום</div>
              </div>
            </div>
          </div>

          {/* Suggested Follows */}
          <div className="social-glass-card rounded-3xl p-5 space-y-3">
            <h4 className="font-bold text-sm text-slate-200 flex items-center gap-2">
              <span>👥</span> <span>חברים שכדאי להכיר</span>
            </h4>
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Noa" alt="" className="w-7 h-7 rounded-full" />
                  <div>
                    <div className="font-bold text-slate-200">נועה כהן</div>
                    <div className="text-sm text-slate-400">@noa</div>
                  </div>
                </div>
                <button className="text-sm font-bold text-cyan-400 hover:text-cyan-300">+ עקוב</button>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Daniel" alt="" className="w-7 h-7 rounded-full" />
                  <div>
                    <div className="font-bold text-slate-200">דניאל לוי</div>
                    <div className="text-sm text-slate-400">@daniel</div>
                  </div>
                </div>
                <button className="text-sm font-bold text-cyan-400 hover:text-cyan-300">+ עקוב</button>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
