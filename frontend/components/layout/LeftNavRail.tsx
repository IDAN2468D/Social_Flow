'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BadgeCheck,
  Bell,
  Bot,
  Clapperboard,
  House,
  LogIn,
  PenLine,
  Sparkles,
  User,
  Users,
  Zap,
} from 'lucide-react';
import { useSocialStore } from '@/store/useSocialStore';

export interface NavLinkItem {
  href: string;
  label: string;
  sublabel?: string;
  icon: 'home' | 'stories' | 'community' | 'profile' | 'login';
  badge?: string;
}

export interface NavUserSummary {
  name: string;
  handle: string;
  avatarUrl?: string;
  roleBadge?: string;
  isVerified?: boolean;
}

export interface LeftNavRailProps {
  activePath?: string;
  links?: NavLinkItem[];
  user?: NavUserSummary;
  unreadNotificationsCount?: number;
  onNewPost?: () => void;
  onOpenAgent?: () => void;
  onNotificationsClick?: () => void;
  className?: string;
}

const DEFAULT_NAV_LINKS: NavLinkItem[] = [
  { href: '/', label: 'פיד ראשי', sublabel: 'Home', icon: 'home' },
  { href: '/stories', label: 'סטוריז', sublabel: 'Stories', icon: 'stories', badge: 'LIVE' },
  { href: '/community', label: 'קהילה', sublabel: 'Community', icon: 'community' },
  { href: '/profile', label: 'פרופיל', sublabel: 'Profile', icon: 'profile' },
  { href: '/login', label: 'התחברות', sublabel: 'Sign in', icon: 'login' },
];

const DEFAULT_USER: NavUserSummary = {
  name: 'עידן קזם',
  handle: 'idan',
  avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=idan',
  roleBadge: 'AI Architect',
  isVerified: true,
};

function renderNavIcon(icon: NavLinkItem['icon'], isActive: boolean) {
  const cls = `h-5 w-5 shrink-0 transition-colors ${
    isActive ? 'text-indigo-300' : 'text-[#94A3B8] group-hover:text-[#F8FAFC]'
  }`;
  switch (icon) {
    case 'home':
      return <House className={cls} />;
    case 'stories':
      return <Clapperboard className={cls} />;
    case 'community':
      return <Users className={cls} />;
    case 'profile':
      return <User className={cls} />;
    case 'login':
      return <LogIn className={cls} />;
  }
}

export function LeftNavRail({
  activePath,
  links = DEFAULT_NAV_LINKS,
  user = DEFAULT_USER,
  unreadNotificationsCount: unreadOverride,
  onNewPost,
  onOpenAgent,
  onNotificationsClick,
  className = '',
}: LeftNavRailProps) {
  const pathname = usePathname();
  const currentPath = activePath ?? pathname ?? '/';

  const {
    notifications,
    unreadNotificationsCount: storeUnreadCount,
    markAllNotificationsRead,
    openComposer,
    openAgentModal,
  } = useSocialStore();

  const unreadCount = unreadOverride ?? storeUnreadCount;
  const [isNotifExpanded, setIsNotifExpanded] = useState(false);

  const handleNewPost = () => {
    if (onNewPost) {
      onNewPost();
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

  const handleNotifToggle = () => {
    if (onNotificationsClick) {
      onNotificationsClick();
    } else {
      setIsNotifExpanded((prev) => !prev);
    }
  };

  return (
    <div className={`sticky top-5 flex flex-col gap-4 ${className}`}>
      {/* Brand Header Card */}
      <div className="rounded-[20px] border border-white/10 bg-[#121521]/72 backdrop-blur-xl p-4 shadow-[0_12px_36px_-12px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.08)]">
        <Link href="/" className="flex items-center gap-3 no-underline group">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#6366F1] via-[#8B5CF6] to-indigo-400 text-white shadow-[0_0_24px_-4px_rgba(99,102,241,0.65)] transition-transform duration-200 group-hover:scale-105">
            <Zap className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-extrabold tracking-tight text-[#F8FAFC]">
                Social<span className="text-[#6366F1]">Flow</span>
              </span>
              <span className="rounded-md border border-indigo-500/30 bg-indigo-500/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-indigo-300">
                2.0
              </span>
            </div>
            <p className="truncate font-mono text-[11px] text-[#64748B]">
              Liquid Glass · AI Pulse
            </p>
          </div>
        </Link>
      </div>

      {/* Primary Navigation Links & Notifications */}
      <nav
        aria-label="ניווט ראשי"
        className="rounded-[20px] border border-white/10 bg-[#121521]/72 backdrop-blur-xl p-2.5 shadow-[0_12px_36px_-12px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.08)] space-y-1"
      >
        {links.map((item) => {
          const isActive =
            item.href === '/'
              ? currentPath === '/'
              : currentPath.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition-all no-underline ${
                isActive
                  ? 'border-indigo-500/40 bg-gradient-to-r from-[#6366F1]/20 via-[#8B5CF6]/10 to-transparent text-[#F8FAFC] shadow-[0_4px_18px_-6px_rgba(99,102,241,0.45)]'
                  : 'border-transparent text-[#94A3B8] hover:border-white/10 hover:bg-white/[0.04] hover:text-[#F8FAFC]'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                {renderNavIcon(item.icon, isActive)}
                <span className="truncate">{item.label}</span>
              </div>

              {item.badge && (
                <span className="rounded-full border border-[#10B981]/40 bg-[#10B981]/15 px-2 py-0.5 font-mono text-[10px] font-bold text-[#10B981]">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}

        {/* Notifications Trigger with Zustand Unread Badge */}
        <div className="pt-1 border-t border-white/10 mt-1">
          <button
            type="button"
            onClick={handleNotifToggle}
            className={`group flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition-all cursor-pointer ${
              isNotifExpanded
                ? 'border-indigo-500/40 bg-indigo-500/15 text-[#F8FAFC]'
                : 'border-transparent text-[#94A3B8] hover:border-white/10 hover:bg-white/[0.04] hover:text-[#F8FAFC]'
            }`}
          >
            <div className="flex items-center gap-3">
              <Bell
                className={`h-5 w-5 ${
                  unreadCount > 0 ? 'text-indigo-300' : 'text-[#94A3B8] group-hover:text-[#F8FAFC]'
                }`}
              />
              <span>התראות</span>
            </div>

            {unreadCount > 0 && (
              <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-gradient-to-r from-[#F43F5E] to-[#8B5CF6] px-1.5 py-0.5 font-mono text-[11px] font-bold text-white shadow-[0_0_12px_rgba(244,63,94,0.45)]">
                {unreadCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {isNotifExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden"
              >
                <div className="mt-1.5 rounded-xl border border-white/10 bg-[#090A0F]/80 p-2.5 space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[11px] font-semibold text-[#94A3B8]">
                      עדכונים אחרונים
                    </span>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={markAllNotificationsRead}
                        className="text-[11px] font-medium text-indigo-300 hover:text-indigo-200 cursor-pointer"
                      >
                        סמן כנקרא
                      </button>
                    )}
                  </div>

                  <div className="max-h-44 overflow-y-auto space-y-1.5">
                    {notifications.length === 0 ? (
                      <p className="py-2 text-center text-xs text-[#64748B]">
                        אין התראות חדשות
                      </p>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`flex items-start gap-2 rounded-lg p-2 text-xs transition-colors ${
                            n.isRead
                              ? 'bg-transparent text-[#64748B]'
                              : 'bg-indigo-500/10 border border-indigo-500/20 text-[#F8FAFC]'
                          }`}
                        >
                          <img
                            src={n.actorAvatar}
                            alt={n.actorName}
                            className="h-6 w-6 shrink-0 rounded-full border border-white/10 object-cover"
                          />
                          <div className="min-w-0 flex-1 text-start">
                            <p dir="auto" className="font-semibold truncate">
                              {n.actorName}
                            </p>
                            <p dir="auto" className="text-[11px] leading-snug text-[#94A3B8] line-clamp-2">
                              {n.text}
                            </p>
                            <span className="font-mono text-[10px] text-[#64748B]">{n.time}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </nav>

      {/* Primary Gradient CTAs: New Post & AI Agent */}
      <div className="rounded-[20px] border border-white/10 bg-[#121521]/72 backdrop-blur-xl p-3 space-y-2.5 shadow-[0_12px_36px_-12px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.08)]">
        <button
          type="button"
          onClick={handleNewPost}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#6366F1] via-[#8B5CF6] to-indigo-500 px-4 py-3 text-sm font-bold text-white shadow-[0_8px_24px_-4px_rgba(99,102,241,0.55)] hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer"
        >
          <PenLine className="h-4 w-4" />
          <span>פוסט חדש</span>
        </button>

        <button
          type="button"
          onClick={handleOpenAgent}
          className="flex w-full items-center justify-between gap-2 rounded-xl border border-[#8B5CF6]/35 bg-[#8B5CF6]/12 px-3.5 py-2.5 text-xs font-semibold text-violet-200 hover:border-[#8B5CF6]/60 hover:bg-[#8B5CF6]/20 active:scale-[0.98] transition-all cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-[#8B5CF6]" />
            <span>סוכן AI אוטונומי</span>
          </span>
          <Sparkles className="h-3.5 w-3.5 text-indigo-300" />
        </button>
      </div>

      {/* User Mini-Profile Pill */}
      <Link
        href="/profile"
        className="group flex items-center gap-3 rounded-[20px] border border-white/10 bg-[#121521]/72 backdrop-blur-xl p-3 hover:border-indigo-500/40 transition-all no-underline shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
      >
        <div className="relative shrink-0">
          <img
            src={user.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(user.handle)}`}
            alt={user.name}
            className="h-10 w-10 rounded-full border border-indigo-400/40 bg-[#090A0F] object-cover"
          />
          <span
            className="absolute -bottom-0.5 -end-0.5 h-3 w-3 rounded-full border-2 border-[#121521] bg-[#10B981]"
            title="Online"
          />
        </div>

        <div className="min-w-0 flex-1 text-start">
          <div className="flex items-center gap-1">
            <span dir="auto" className="truncate text-sm font-bold text-[#F8FAFC]">
              {user.name}
            </span>
            {user.isVerified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-[#6366F1]" />}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="truncate font-mono text-xs text-[#94A3B8]">@{user.handle}</span>
            {user.roleBadge && (
              <span className="truncate rounded-md bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-indigo-300">
                {user.roleBadge}
              </span>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}

export default LeftNavRail;
