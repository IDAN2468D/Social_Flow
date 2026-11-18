'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  BadgeCheck,
  Bot,
  Database,
  Flame,
  HardDrive,
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
import { isJwtExpired } from '@/lib/auth';

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
  id: 'kafka' | 'elasticsearch' | 'websocket' | 'ai' | 'media' | string;
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

const INITIAL_TELEMETRY: SystemTelemetryItem[] = [
  { id: 'kafka', label: 'Gateway & Kafka Bus', detail: 'checking health...', status: 'degraded' },
  { id: 'elasticsearch', label: 'Feed & Elasticsearch 8', detail: 'checking index...', status: 'degraded' },
  { id: 'ai', label: 'AI & LangGraph', detail: 'checking Gemini RAG...', status: 'degraded' },
  { id: 'media', label: 'MinIO S3 & Media', detail: 'checking bucket...', status: 'degraded' },
];

function renderTelemetryIcon(id: string, status: SystemTelemetryItem['status']) {
  const colorClass =
    status === 'online'
      ? 'text-[#10B981]'
      : status === 'degraded'
        ? 'text-amber-400'
        : 'text-rose-400';

  switch (id) {
    case 'kafka':
      return <Activity className={`h-3.5 w-3.5 ${colorClass}`} />;
    case 'elasticsearch':
      return <Database className={`h-3.5 w-3.5 ${colorClass}`} />;
    case 'ai':
      return <Bot className={`h-3.5 w-3.5 ${colorClass}`} />;
    case 'media':
      return <HardDrive className={`h-3.5 w-3.5 ${colorClass}`} />;
    default:
      return <Wifi className={`h-3.5 w-3.5 ${colorClass}`} />;
  }
}

interface ProbeResult {
  status: 'online' | 'degraded' | 'offline';
  latencyMs?: number;
}

async function probeHealthEndpoint(
  url: string,
  headers: Record<string, string>
): Promise<ProbeResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);
  const start = typeof performance !== 'undefined' ? performance.now() : Date.now();

  try {
    const res = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      credentials: 'include',
      headers,
      signal: controller.signal,
    });
    const end = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const latencyMs = Math.max(1, Math.round(end - start));

    if (res.ok) {
      return {
        status: latencyMs > 900 ? 'degraded' : 'online',
        latencyMs,
      };
    }
    if (res.status === 401 || res.status === 403) {
      return { status: 'degraded', latencyMs };
    }
    return { status: 'offline' };
  } catch {
    return { status: 'offline' };
  } finally {
    clearTimeout(timeoutId);
  }
}

function getTelemetryHeaders(): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (typeof window === 'undefined') return headers;
  try {
    const raw = localStorage.getItem('socialflow_user');
    if (raw) {
      const parsed = JSON.parse(raw) as { token?: string };
      if (parsed?.token && !isJwtExpired(parsed.token)) {
        headers.Authorization = `Bearer ${parsed.token}`;
      }
    }
  } catch {
    // Ignore storage error
  }
  return headers;
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
  telemetry,
  className = '',
}: RightBentoSidebarProps) {
  const [localFollowing, setLocalFollowing] = useState<string[]>(['noa']);
  const [liveTelemetry, setLiveTelemetry] = useState<SystemTelemetryItem[]>(INITIAL_TELEMETRY);
  const activeFollowing = followingUsernames ?? localFollowing;

  useEffect(() => {
    if (telemetry) return;
    let cancelled = false;

    const runTelemetryCheck = async () => {
      const headers = getTelemetryHeaders();
      const [feedProbe, aiProbe] = await Promise.all([
        probeHealthEndpoint('/api/v1/feed/trending?size=1', headers),
        probeHealthEndpoint('/api/v1/ai/health', headers),
      ]);

      if (cancelled) return;

      const gatewayStatus: SystemTelemetryItem['status'] =
        feedProbe.status === 'online' && aiProbe.status === 'online'
          ? 'online'
          : feedProbe.status === 'offline' && aiProbe.status === 'offline'
            ? 'offline'
            : 'degraded';

      const latencies = [feedProbe.latencyMs, aiProbe.latencyMs].filter(
        (v): v is number => typeof v === 'number'
      );
      const gatewayLatency =
        latencies.length > 0
          ? Math.round(latencies.reduce((acc, v) => acc + v, 0) / latencies.length)
          : undefined;

      setLiveTelemetry([
        {
          id: 'kafka',
          label: 'Gateway & Kafka Bus',
          detail:
            gatewayStatus === 'online'
              ? 'post-events · live'
              : gatewayStatus === 'degraded'
                ? 'partial connectivity'
                : 'local fallback mode',
          status: gatewayStatus,
          latencyMs: gatewayLatency,
        },
        {
          id: 'elasticsearch',
          label: 'Feed & Elasticsearch 8',
          detail:
            feedProbe.status === 'online'
              ? 'posts index · live'
              : feedProbe.status === 'degraded'
                ? 'high latency / guarded'
                : 'containers offline',
          status: feedProbe.status,
          latencyMs: feedProbe.latencyMs,
        },
        {
          id: 'ai',
          label: 'AI & LangGraph',
          detail:
            aiProbe.status === 'online'
              ? 'Gemini RAG · active'
              : aiProbe.status === 'degraded'
                ? 'high latency'
                : 'local fallback mode',
          status: aiProbe.status,
          latencyMs: aiProbe.latencyMs,
        },
        {
          id: 'media',
          label: 'MinIO S3 & Media',
          detail:
            gatewayStatus === 'online'
              ? 's3 bucket · live'
              : gatewayStatus === 'degraded'
                ? 'partial connectivity'
                : 'local fallback mode',
          status: gatewayStatus,
          latencyMs: gatewayLatency,
        },
      ]);
    };

    void runTelemetryCheck();
    const intervalId = setInterval(() => {
      void runTelemetryCheck();
    }, 30_000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [telemetry]);

  const activeTelemetry = telemetry ?? liveTelemetry;
  const allOnline =
    activeTelemetry.length > 0 && activeTelemetry.every((t) => t.status === 'online');
  const allOffline =
    activeTelemetry.length > 0 && activeTelemetry.every((t) => t.status === 'offline');

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
              const profileHref = `/profile/${encodeURIComponent(person.username)}`;
              return (
                <div
                  key={person.id}
                  className="flex items-center justify-between gap-2.5 rounded-xl border border-transparent p-1.5 hover:border-white/10 hover:bg-white/[0.03] transition-colors"
                >
                  <Link
                    href={profileHref}
                    className="group/user flex items-center gap-2.5 min-w-0 flex-1 no-underline"
                  >
                    <img
                      src={person.avatarUrl}
                      alt={person.name}
                      className="h-9 w-9 shrink-0 rounded-full border border-white/10 bg-[#090A0F] object-cover transition-transform group-hover/user:scale-105"
                    />
                    <div className="min-w-0 text-start">
                      <div className="flex items-center gap-1">
                        <span
                          dir="auto"
                          className="truncate text-xs font-bold text-[#F8FAFC] group-hover/user:text-indigo-300 transition-colors"
                        >
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
                  </Link>

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
                {allOnline && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#10B981] opacity-75" />
                )}
                <span
                  className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                    allOnline
                      ? 'bg-[#10B981] shadow-[0_0_8px_#10B981]'
                      : allOffline
                        ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.7)]'
                        : 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)]'
                  }`}
                />
              </span>
              <span className="text-xs font-bold text-[#F8FAFC]">Live System Telemetry</span>
            </div>
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold ${
                allOnline
                  ? 'border-[#10B981]/30 bg-[#10B981]/10 text-[#10B981]'
                  : allOffline
                    ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                    : 'border-amber-400/30 bg-amber-500/10 text-amber-300'
              }`}
            >
              <Radio className="h-2.5 w-2.5" />
              <span>{allOnline ? 'ALL LIVE' : allOffline ? 'OFFLINE' : 'DEGRADED'}</span>
            </span>
          </div>

          <div className="space-y-1.5">
            {activeTelemetry.map((svc) => {
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
                    {renderTelemetryIcon(svc.id, svc.status)}
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
                    {svc.latencyMs !== undefined ? (
                      <span>{svc.latencyMs}ms</span>
                    ) : (
                      <span className="text-[#64748B]">--</span>
                    )}
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
