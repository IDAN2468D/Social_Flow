'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bell,
  Bot,
  Clapperboard,
  House,
  Plus,
  Search,
  User,
  Users,
  Zap,
} from 'lucide-react';
import { useSocialStore } from '@/store/useSocialStore';
import { LeftNavRail } from './LeftNavRail';
import { RightBentoSidebar } from './RightBentoSidebar';
import { CommandSearchModal, SearchResultItem } from '../search/CommandSearchModal';

export interface AppShellProps {
  children: React.ReactNode;
  leftRail?: React.ReactNode;
  rightSidebar?: React.ReactNode;
  activePath?: string;
  selectedTag?: string | null;
  onSelectTag?: (tag: string | null) => void;
  onOpenSearch?: () => void;
  onOpenComposer?: () => void;
  onOpenAgent?: () => void;
  onSelectSearchResult?: (item: SearchResultItem) => void;
  onAskAI?: (query: string) => void;
  unreadNotificationsCount?: number;
  mobileTitle?: string;
  className?: string;
}

export function AppShell({
  children,
  leftRail,
  rightSidebar,
  activePath,
  selectedTag = null,
  onSelectTag,
  onOpenSearch,
  onOpenComposer,
  onOpenAgent,
  onSelectSearchResult,
  onAskAI,
  unreadNotificationsCount: unreadOverride,
  mobileTitle = 'SocialFlow',
  className = '',
}: AppShellProps) {
  const pathname = usePathname();
  const currentPath = activePath ?? pathname ?? '/';

  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const {
    unreadNotificationsCount: storeUnreadCount,
    openComposer,
    openAgentModal,
  } = useSocialStore();

  const unreadCount = unreadOverride ?? storeUnreadCount;

  const handleOpenSearch = () => {
    if (onOpenSearch) {
      onOpenSearch();
    } else {
      setIsSearchOpen(true);
    }
  };

  const handleOpenComposer = () => {
    if (onOpenComposer) {
      onOpenComposer();
    } else {
      openComposer();
    }
  };

  const handleOpenAgent = () => {
    if (onOpenAgent) {
      onOpenAgent();
    } else {
      openAgentModal();
    }
  };

  const dockItems = [
    { href: '/', label: 'בית', icon: House },
    { href: '/stories', label: 'סטוריז', icon: Clapperboard },
    { href: '/community', label: 'קהילה', icon: Users },
    { href: '/profile', label: 'פרופיל', icon: User },
  ];

  return (
    <div
      className={`relative min-h-screen w-full bg-[#090A0F] text-[#F8FAFC] selection:bg-[#6366F1] selection:text-white overflow-x-clip ${className}`}
    >
      {/* Ambient Obsidian Glow Orbs */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden z-0"
      >
        <div className="absolute -top-32 start-[-80px] h-[420px] w-[420px] rounded-full bg-[#6366F1]/18 blur-[140px]" />
        <div className="absolute bottom-10 end-[-100px] h-[460px] w-[460px] rounded-full bg-[#8B5CF6]/16 blur-[150px]" />
        <div className="absolute top-[42%] start-[35%] h-[320px] w-[320px] rounded-full bg-[#10B981]/8 blur-[140px]" />
      </div>

      {/* Mobile & Tablet Sticky Top Glass Bar */}
      <header className="lg:hidden sticky top-0 z-40 w-full border-b border-white/10 bg-[#090A0F]/80 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2.5 no-underline">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-[#6366F1] to-[#8B5CF6] text-white shadow-[0_0_16px_rgba(99,102,241,0.5)]">
              <Zap className="h-4 w-4" />
            </span>
            <span className="text-base font-extrabold tracking-tight text-[#F8FAFC]">
              {mobileTitle}
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenSearch}
              className="flex h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-[#121521]/80 px-3 text-xs text-[#94A3B8] hover:border-indigo-500/40 hover:text-[#F8FAFC] transition-colors cursor-pointer"
              aria-label="חיפוש מהיר"
            >
              <Search className="h-4 w-4" />
              <span className="hidden sm:inline font-mono text-[11px]">Ctrl+K</span>
            </button>

            <button
              type="button"
              onClick={handleOpenAgent}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#8B5CF6]/40 bg-[#8B5CF6]/15 text-violet-200 hover:bg-[#8B5CF6]/25 transition-colors cursor-pointer"
              aria-label="סוכן AI"
            >
              <Bot className="h-4 w-4" />
            </button>

            <Link
              href="/profile"
              className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-[#121521]/80 text-[#94A3B8] hover:text-[#F8FAFC] transition-colors no-underline"
              aria-label="התראות"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -end-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#F43F5E] px-1 font-mono text-[10px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      {/* Desktop 3-Zone Bento Grid: 256px | minmax(0, 660px) | 336px */}
      <div className="relative z-10 mx-auto w-full max-w-[1360px] px-4 sm:px-6 lg:px-8 py-6 pb-28 lg:pb-12">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[256px_minmax(0,1fr)] xl:grid-cols-[256px_minmax(0,660px)_336px] xl:justify-center">
          {/* Zone 1: Left Navigation Rail (256px) */}
          <aside className="hidden lg:block">
            {leftRail !== undefined ? (
              leftRail
            ) : (
              <LeftNavRail
                activePath={currentPath}
                unreadNotificationsCount={unreadCount}
                onNewPost={handleOpenComposer}
                onOpenAgent={handleOpenAgent}
              />
            )}
          </aside>

          {/* Zone 2: Center Single-Column Feed Stream (minmax(0, 660px)) */}
          <main className="min-w-0 w-full max-w-[660px] mx-auto space-y-5">
            {children}
          </main>

          {/* Zone 3: Right Bento Discovery Sidebar (340px) */}
          <aside className="hidden xl:block">
            {rightSidebar !== undefined ? (
              rightSidebar
            ) : (
              <RightBentoSidebar
                onOpenSearch={handleOpenSearch}
                selectedTag={selectedTag}
                onSelectTag={onSelectTag}
              />
            )}
          </aside>
        </div>
      </div>

      {/* Mobile & Tablet Bottom Floating Glass Dock */}
      <nav
        aria-label="ניווט תחתון"
        className="lg:hidden fixed bottom-3 inset-x-3 z-40 mx-auto max-w-md rounded-2xl border border-white/10 bg-[#121521]/85 backdrop-blur-2xl px-2 py-2 shadow-[0_16px_48px_-8px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.12)]"
      >
        <div className="flex items-center justify-around gap-1">
          {dockItems.slice(0, 2).map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === '/'
                ? currentPath === '/'
                : currentPath.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-[11px] font-medium no-underline transition-colors ${
                  isActive ? 'text-[#6366F1]' : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={handleOpenComposer}
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-[#6366F1] to-[#8B5CF6] text-white shadow-[0_6px_20px_-4px_rgba(99,102,241,0.75)] active:scale-95 transition-transform cursor-pointer"
            aria-label="פוסט חדש"
          >
            <Plus className="h-5 w-5" />
          </button>

          {dockItems.slice(2).map((item) => {
            const Icon = item.icon;
            const isActive = currentPath.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-[11px] font-medium no-underline transition-colors ${
                  isActive ? 'text-[#6366F1]' : 'text-[#94A3B8] hover:text-[#F8FAFC]'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Built-in Ctrl+K Command Search Modal when using default search trigger */}
      {!onOpenSearch && (
        <CommandSearchModal
          isOpen={isSearchOpen}
          onOpen={() => setIsSearchOpen(true)}
          onClose={() => setIsSearchOpen(false)}
          onSelectTag={(tag) => onSelectTag?.(tag)}
          onSelectResult={onSelectSearchResult}
          onAskAI={onAskAI}
        />
      )}
    </div>
  );
}

export default AppShell;
