'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  BadgeCheck,
  Database,
  Flame,
  Hash,
  Radio,
  Search,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  Wifi,
  X,
} from 'lucide-react';

export interface TrendingTagItem {
  tag: string;
  postsCount: number;
  category?: string;
  trendDelta?: string;
}

export interface CommunityHighlightItem {
  id: string;
  name: string;
  membersLabel: string;
  tag: string;
}

export interface SuggestedUserItem {
  id: string;
  name: string;
  username: string;
  avatarUrl: string;
  bio?: string;
  isVerified?: boolean;
}

export interface SystemTelemetryItem {
  id: 'kafka' | 'elasticsearch' | 'websocket' | string;
  label: string;
  detail?: string;
  status: 'online' | 'degraded' | 'offline';
  latencyMs?: number;
}

export interface RightBentoSidebarProps {
  onOpenSearch?: () => void;
  onSelectTag?: (tag: string | null) => void;
  selectedTag?: string | null;
  trendingTags?: TrendingTagItem[];
  communities?: CommunityHighlightItem[];
  suggestedUsers?: SuggestedUserItem[];
  followingUsernames?: string[];
  onToggleFollow?: (username: string) => void;
  telemetry?: SystemTelemetryItem[];
  className?: string;
}

const DEFAULT_TRENDING_TAGS: TrendingTagItem[] = [
  { tag: 'LangGraph', postsCount: 1240, category: 'AI & Agents', trendDelta: '+28%' },
  { tag: 'Nextjs15', postsCount: 890, category: 'Frontend', trendDelta: '+19%' },
  { tag: 'LiquidGlass', postsCount: 540, category: 'UI Design', trendDelta: '+42%' },
  { tag: 'KafkaStreams', postsCount: 410, category: 'Architecture', trendDelta: '+12%' },
];

const DEFAULT_COMMUNITIES: CommunityHighlightItem[] = [
  { id: 'c1', name: 'AI Builders Israel', membersLabel: '4.2K', tag: 'LangGraph' },
  { id: 'c2', name: 'React 19 & Next.js', membersLabel: '6.8K', tag: 'Nextjs15' },
];

const DEFAULT_SUGGESTED_USERS: SuggestedUserItem[] = [
  {
    id: 'u-noa',
    name: 'נועה כהן',
    username: 'noa',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Noa',
    bio: 'AI & Product Design',
    isVerified: true,
  },
  {
    id: 'u-daniel',
    name: 'דניאל לוי',
    username: 'daniel',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Daniel',
    bio: 'Kafka & Distributed Systems',
    isVerified: true,
  },
  {
    id: 'u-maya',
    name: 'מאיה שקד',
    username: 'maya',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Maya',
    bio: 'Design Systems & Motion',
    isVerified: false,
  },
];

const DEFAULT_TELEMETRY: SystemTelemetryItem[] = [
  { id: 'kafka', label: 'Kafka Event Bus', detail: 'post-events · 0 lag', status: 'online', latencyMs: 4 },
  { id: 'elasticsearch', label: 'Elasticsearch 8', detail: 'posts index', status: 'online', latencyMs: 11 },
  { id: 'websocket', label: 'WebSocket STOMP', detail: 'Live Push', status: 'online', latencyMs: 7 },
];

function renderTelemetryIcon(id: string) {
  switch (id) {
    case 'kafka':
      return <Activity className="h-3.5 w-3.5 text-[#10B981]" />;
    case 'elasticsearch':
      return <Database className="h-3.5 w-3.5 text-[#10B981]" />;
    default:
      return <Wifi className="h-3.5 w-3.5 text-[#10B981]" />;
  }
}

export function RightBentoSidebar({
  onOpenSearch,
  onSelectTag,
  selectedTag = null,
  trendingTags = DEFAULT_TRENDING_TAGS,
  communities = DEFAULT_COMMUNITIES,
  suggestedUsers = DEFAULT_SUGGESTED_USERS,
  followingUsernames,
  onToggleFollow,
  telemetry = DEFAULT_TELEMETRY,
  className = '',
}: RightBentoSidebarProps) {
  const [localFollowing, setLocalFollowing] = useState<string[]>(['noa']);
  const activeFollowing = followingUsernames ?? localFollowing;

  const handleFollowClick = (username: string) => {
    if (onToggleFollow) {
      onToggleFollow(username);
      return;
    }
    setLocalFollowing((prev) =>
      prev.includes(username) ? prev.filter((u) => u !== username) : [...prev, username]
    );
  };

  const handleTagClick = (tag: string) => {
    if (!onSelectTag) return;
    onSelectTag(selectedTag === tag ? null : tag);
  };

  return (
    <div className={`sticky top-5 flex flex-col gap-4 ${className}`}>
      {/* Bento Card 1: Ctrl+K Search Trigger */}
      <div className="rounded-[20px] border border-white/10 bg-[#121521]/72 backdrop-blur-xl p-3 shadow-[0_12px_36px_-12px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.08)]">
        <button
          type="button"
          onClick={onOpenSearch}
          className="group flex w-full items-center justify-between gap-2.5 rounded-xl border border-white/10 bg-[#090A0F]/65 px-3.5 py-2.5 text-start hover:border-indigo-500/40 hover:bg-[#090A0F]/90 transition-all cursor-pointer"
        >
          <span className="flex items-center gap-2.5 min-w-0">
            <Search className="h-4 w-4 shrink-0 text-[#94A3B8] group-hover:text-[#6366F1] transition-colors" />
            <span className="truncate text-xs sm:text-sm text-[#64748B] group-hover:text-[#94A3B8]">
              חיפוש מיידי ב-Elasticsearch...
            </span>
          </span>
          <kbd className="shrink-0 rounded-lg border border-white/10 bg-white/[0.06] px-2 py-0.5 font-mono text-[11px] font-semibold text-[#94A3B8] group-hover:border-indigo-500/40 group-hover:text-indigo-300">
            Ctrl+K
          </kbd>
        </button>
      </div>

      {/* Bento Card 2: Trending Hashtags & Communities */}
      <section
        aria-label="טרנדים וקהילות"
        className="rounded-[20px] border border-white/10 bg-[#121521]/72 backdrop-blur-xl p-4 space-y-3.5 shadow-[0_12px_36px_-12px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.08)]"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#6366F1]/15 text-[#6366F1]">
              <Flame className="h-4 w-4" />
            </span>
            <h3 className="text-sm font-bold text-[#F8FAFC]">טרנדים וקהילות</h3>
          </div>

          {selectedTag && onSelectTag && (
            <button
              type="button"
              onClick={() => onSelectTag(null)}
              className="inline-flex items-center gap-1 rounded-full border border-indigo-500/40 bg-indigo-500/15 px-2 py-0.5 font-mono text-[10px] text-indigo-300 hover:bg-indigo-500/25 cursor-pointer"
            >
              <span>#{selectedTag}</span>
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Trending Hashtags */}
        <div className="space-y-1.5">
          {trendingTags.map((item) => {
            const isSelected = selectedTag?.toLowerCase() === item.tag.toLowerCase();
            return (
              <button
                key={item.tag}
                type="button"
                onClick={() => handleTagClick(item.tag)}
                className={`group flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-start transition-all cursor-pointer ${
                  isSelected
                    ? 'border-indigo-500/50 bg-[#6366F1]/18 shadow-[0_0_20px_-8px_rgba(99,102,241,0.5)]'
                    : 'border-transparent bg-white/[0.02] hover:border-indigo-500/30 hover:bg-white/[0.05]'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Hash className="h-3.5 w-3.5 shrink-0 text-[#6366F1]" />
                    <span dir="auto" className="truncate font-mono text-xs font-bold text-[#F8FAFC]">
                      {item.tag}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[#64748B]">
                    {item.category && <span>{item.category}</span>}
                    <span>·</span>
                    <span className="font-mono">{item.postsCount.toLocaleString()} פוסטים</span>
                  </div>
                </div>

                {item.trendDelta && (
                  <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-[#10B981]/12 px-2 py-0.5 font-mono text-[10px] font-semibold text-[#10B981]">
                    <TrendingUp className="h-3 w-3" />
                    <span>{item.trendDelta}</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Communities Strip */}
        {communities.length > 0 && (
          <div className="border-t border-white/10 pt-3 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-semibold text-[#94A3B8]">
              <span className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-[#8B5CF6]" />
                <span>קהילות מובילות</span>
              </span>
              <Link href="/community" className="text-indigo-300 hover:text-indigo-200 no-underline">
                הכל
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {communities.map((comm) => (
                <button
                  key={comm.id}
                  type="button"
                  onClick={() => handleTagClick(comm.tag)}
                  className="rounded-xl border border-white/10 bg-[#090A0F]/55 p-2.5 text-start hover:border-indigo-500/40 transition-colors cursor-pointer"
                >
                  <div dir="auto" className="truncate text-xs font-semibold text-[#F8FAFC]">
                    {comm.name}
                  </div>
                  <div className="mt-0.5 font-mono text-[10px] text-[#64748B]">
                    {comm.membersLabel} members
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Bento Card 3: Who to Follow + Live System Telemetry */}
      <section
        aria-label="אנשים שכדאי להכיר וסטטוס מערכת"
        className="rounded-[20px] border border-white/10 bg-[#121521]/72 backdrop-blur-xl p-4 space-y-4 shadow-[0_12px_36px_-12px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.08)]"
      >
        {/* Who to Follow */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#F8FAFC]">מומלצים למעקב</h3>
            <span className="font-mono text-[10px] text-[#64748B]">Curated</span>
          </div>

          <div className="space-y-2.5">
            {suggestedUsers.map((person) => {
              const isFollowing = activeFollowing.includes(person.username);
              return (
                <div
                  key={person.id}
                  className="flex items-center justify-between gap-2.5 rounded-xl border border-transparent p-1.5 hover:border-white/10 hover:bg-white/[0.03] transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={person.avatarUrl}
                      alt={person.name}
                      className="h-9 w-9 shrink-0 rounded-full border border-white/10 bg-[#090A0F] object-cover"
                    />
                    <div className="min-w-0 text-start">
                      <div className="flex items-center gap-1">
                        <span dir="auto" className="truncate text-xs font-bold text-[#F8FAFC]">
                          {person.name}
                        </span>
                        {person.isVerified && (
                          <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-[#6366F1]" />
                        )}
                      </div>
                      <p dir="auto" className="truncate font-mono text-[11px] text-[#64748B]">
                        @{person.username}
                        {person.bio ? ` · ${person.bio}` : ''}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleFollowClick(person.username)}
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all cursor-pointer ${
                      isFollowing
                        ? 'border-white/15 bg-white/[0.06] text-[#94A3B8] hover:border-rose-500/40 hover:text-rose-300'
                        : 'border-indigo-500/40 bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25'
                    }`}
                  >
                    {isFollowing ? (
                      <>
                        <UserCheck className="h-3 w-3" />
                        <span>עוקב</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-3 w-3" />
                        <span>עקוב</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live System Telemetry */}
        <div className="border-t border-white/10 pt-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#10B981] opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#10B981] shadow-[0_0_8px_#10B981]" />
              </span>
              <span className="text-xs font-bold text-[#F8FAFC]">Live System Telemetry</span>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full border border-[#10B981]/30 bg-[#10B981]/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-[#10B981]">
              <Radio className="h-2.5 w-2.5" />
              <span>ALL LIVE</span>
            </span>
          </div>

          <div className="space-y-1.5">
            {telemetry.map((svc) => {
              const dotColor =
                svc.status === 'online'
                  ? 'bg-[#10B981]'
                  : svc.status === 'degraded'
                    ? 'bg-amber-400'
                    : 'bg-rose-500';

              return (
                <div
                  key={svc.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#090A0F]/65 px-3 py-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {renderTelemetryIcon(svc.id)}
                    <div className="min-w-0 text-start">
                      <div className="truncate text-[11px] font-semibold text-[#F8FAFC]">
                        {svc.label}
                      </div>
                      {svc.detail && (
                        <div className="truncate font-mono text-[10px] text-[#64748B]">
                          {svc.detail}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 font-mono text-[10px] text-[#94A3B8]">
                    {svc.latencyMs !== undefined && <span>{svc.latencyMs}ms</span>}
                    <span className={`h-2 w-2 rounded-full ${dotColor}`} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

export default RightBentoSidebar;
