'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Users, Flame, Image as ImageIcon, Hash, X } from 'lucide-react';

export type FeedTabKey = 'for-you' | 'following' | 'trending' | 'media';

export interface FeedTabItem {
  key: FeedTabKey;
  label: string;
  labelEn: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const FEED_TABS: FeedTabItem[] = [
  { key: 'for-you', label: 'בשבילך', labelEn: 'For You', icon: Sparkles },
  { key: 'following', label: 'עוקבים', labelEn: 'Following', icon: Users },
  { key: 'trending', label: 'טרנדינג', labelEn: 'Trending', icon: Flame },
  { key: 'media', label: 'מדיה', labelEn: 'Media', icon: ImageIcon },
];

export interface FeedHeaderTabsProps {
  activeTab: FeedTabKey;
  onTabChange: (tab: FeedTabKey) => void;
  activeHashtag?: string | null;
  onClearHashtag?: () => void;
  tabs?: FeedTabItem[];
  showEnglishSublabels?: boolean;
  rightSlot?: React.ReactNode;
  className?: string;
}

export function FeedHeaderTabs({
  activeTab,
  onTabChange,
  activeHashtag = null,
  onClearHashtag,
  tabs = FEED_TABS,
  showEnglishSublabels = false,
  rightSlot,
  className = '',
}: FeedHeaderTabsProps) {
  const cleanTag = activeHashtag ? activeHashtag.replace(/^#/, '') : null;

  return (
    <header
      className={`sticky top-0 z-30 w-full rounded-2xl bg-[#090A0F]/80 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.45)] transition-colors ${className}`}
    >
      <div className="flex items-center justify-between gap-2 px-2.5 py-2 sm:px-3">
        <nav
          aria-label="Feed switcher"
          role="tablist"
          className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 flex-1"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key && !cleanTag;

            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onTabChange(tab.key)}
                className={`relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 ${
                  isActive
                    ? 'text-[#F8FAFC]'
                    : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-white/[0.04]'
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="feed-header-active-pill"
                    transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                    className="absolute inset-0 rounded-xl bg-gradient-to-r from-[#6366F1]/25 via-[#8B5CF6]/20 to-[#6366F1]/25 border border-indigo-500/40 shadow-[0_0_20px_rgba(99,102,241,0.22)]"
                  />
                )}
                <Icon
                  className={`relative z-10 w-4 h-4 transition-colors ${
                    isActive ? 'text-[#8B5CF6]' : 'text-[#64748B]'
                  }`}
                />
                <span className="relative z-10 flex items-center gap-1.5">
                  <span>{tab.label}</span>
                  {showEnglishSublabels && (
                    <span className="hidden md:inline text-[11px] font-mono text-[#64748B]">
                      {tab.labelEn}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </nav>

        {rightSlot && <div className="shrink-0 flex items-center gap-2">{rightSlot}</div>}
      </div>

      {/* Active Hashtag Filter Chip */}
      <AnimatePresence initial={false}>
        {cleanTag && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden border-t border-white/10"
          >
            <div className="flex items-center justify-between px-3.5 py-2 bg-[#121521]/70">
              <div className="flex items-center gap-2 text-xs text-[#94A3B8]">
                <span>מסנן לפי תגית:</span>
                <span
                  dir="auto"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#6366F1]/20 border border-[#6366F1]/40 text-[#F8FAFC] font-mono text-xs font-medium"
                >
                  <Hash className="w-3.5 h-3.5 text-[#8B5CF6]" />
                  {cleanTag}
                </span>
              </div>

              {onClearHashtag && (
                <button
                  type="button"
                  onClick={onClearHashtag}
                  aria-label="נקה סינון תגית"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-white/[0.06] transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>נקה סינון</span>
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
