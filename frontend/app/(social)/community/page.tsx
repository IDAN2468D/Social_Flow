'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowUpLeft,
  BadgeCheck,
  Bot,
  Cpu,
  Flame,
  Hash,
  Layers,
  Sparkles,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { BadgePill, BentoTile, GlassCard, GradientButton } from '@/components/ui/GlassPrimitives';

interface CommunityRoom {
  id: string;
  name: string;
  handle: string;
  description: string;
  members: string;
  activeNow: number;
  tags: string[];
  accent: 'indigo' | 'violet' | 'emerald';
}

const COMMUNITY_ROOMS: CommunityRoom[] = [
  {
    id: 'ai-builders',
    name: 'AI & LangGraph Builders',
    handle: 'ai-builders',
    description:
      'קהילת מפתחי סוכני AI אוטונומיים, RAG על Elasticsearch 8 וארכיטקטורת Human-in-the-Loop.',
    members: '4.2K',
    activeNow: 128,
    tags: ['LangGraph', 'RAG', 'AI_Agents'],
    accent: 'violet',
  },
  {
    id: 'liquid-glass-ui',
    name: 'Next.js 15 & Liquid Glass UI',
    handle: 'design-systems',
    description:
      'עיצוב ממשקי Bento Grid, Tailwind CSS v4, Framer Motion וטיפוגרפיה דו-לשונית בעברית ואנגלית.',
    members: '6.8K',
    activeNow: 214,
    tags: ['Nextjs15', 'LiquidGlass', 'React19'],
    accent: 'indigo',
  },
  {
    id: 'distributed-kafka',
    name: 'Spring Boot 3 & Kafka Streams',
    handle: 'backend-mesh',
    description:
      'מיקרו-שירותים מונחי-אירועים, MinIO S3, STOMP WebSockets ואופטימיזציה של p95 מתחת ל-25ms.',
    members: '3.5K',
    activeNow: 89,
    tags: ['KafkaStreams', 'Elasticsearch', 'SpringBoot'],
    accent: 'emerald',
  },
  {
    id: 'socialflow-core',
    name: 'SocialFlow Open Architecture',
    handle: 'socialflow-core',
    description:
      'דיונים פתוחים על פיתוח הפיצ׳רים הבאים ברשת החברתית, API Gateway JWT ואינטגרציית MCP.',
    members: '2.9K',
    activeNow: 64,
    tags: ['SocialFlow', 'Microservices', 'API_Gateway'],
    accent: 'indigo',
  },
];

const FEATURED_CREATORS = [
  {
    username: 'idan',
    name: 'עידן קזם',
    role: 'System & AI Architect',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=idan',
    verified: true,
    followers: '12.4K',
  },
  {
    username: 'noa',
    name: 'נועה כהן',
    role: 'AI Product & LangGraph Lead',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Noa',
    verified: true,
    followers: '8.9K',
  },
  {
    username: 'daniel',
    name: 'דניאל לוי',
    role: 'Distributed Systems & Kafka',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Daniel',
    verified: true,
    followers: '6.3K',
  },
  {
    username: 'maya',
    name: 'מאיה שקד',
    role: 'Design Systems & Motion',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Maya',
    verified: false,
    followers: '5.1K',
  },
];

export default function CommunityPage() {
  const [joinedRooms, setJoinedRooms] = useState<string[]>(['ai-builders', 'liquid-glass-ui']);
  const [followedCreators, setFollowedCreators] = useState<string[]>(['idan', 'noa']);

  const toggleJoinRoom = (id: string) => {
    setJoinedRooms((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleFollowCreator = (username: string) => {
    setFollowedCreators((prev) =>
      prev.includes(username) ? prev.filter((u) => u !== username) : [...prev, username]
    );
  };

  return (
    <AppShell activePath="/community" mobileTitle="קהילת SocialFlow">
      {/* Community Hero Bento Banner */}
      <GlassCard interactive className="p-6 relative overflow-hidden">
        <div className="absolute -top-16 -end-16 h-44 w-44 rounded-full bg-[#6366F1]/20 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <BadgePill variant="indigo">
                <Users className="h-3 w-3" />
                קהילות וערוצי תוכן
              </BadgePill>
              <BadgePill variant="emerald">
                <span className="h-1.5 w-1.5 rounded-full bg-[#10B981] animate-pulse-live" />
                495 מחוברים כעת
              </BadgePill>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-[#F8FAFC]">
              גלה קהילות טכנולוגיה ויוצרים ב-SocialFlow
            </h1>
            <p className="text-sm text-[#94A3B8] leading-relaxed" dir="auto">
              הצטרף לקבוצות מקצועיות סביב AI Agents, עיצוב Liquid Glass ומערכות מבוזרות בזמן אמת.
            </p>
          </div>
          <Link href="/" className="no-underline shrink-0">
            <GradientButton size="md">
              <Sparkles className="h-4 w-4" />
              חזרה לפיד הראשי
            </GradientButton>
          </Link>
        </div>
      </GlassCard>

      {/* Quick Telemetry Bento Stats Row */}
      <div className="grid grid-cols-3 gap-3">
        <BentoTile className="p-4 flex flex-col gap-1">
          <span className="text-xs text-[#94A3B8] flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-[#6366F1]" />
            קבוצות פעילות
          </span>
          <span className="font-mono text-xl font-extrabold text-[#F8FAFC]">24</span>
        </BentoTile>
        <BentoTile className="p-4 flex flex-col gap-1">
          <span className="text-xs text-[#94A3B8] flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5 text-[#10B981]" />
            אירועי Kafka/דקה
          </span>
          <span className="font-mono text-xl font-extrabold text-[#F8FAFC]">1,420</span>
        </BentoTile>
        <BentoTile className="p-4 flex flex-col gap-1">
          <span className="text-xs text-[#94A3B8] flex items-center gap-1.5">
            <Bot className="h-3.5 w-3.5 text-[#8B5CF6]" />
            סוכני RAG זמינים
          </span>
          <span className="font-mono text-xl font-extrabold text-[#F8FAFC]">Online</span>
        </BentoTile>
      </div>

      {/* Community Channels Bento Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-base font-bold text-[#F8FAFC] flex items-center gap-2">
            <Flame className="h-4 w-4 text-[#F43F5E]" />
            קהילות מובילות
          </h2>
          <span className="font-mono text-xs text-[#64748B]">LIVE CHANNELS</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {COMMUNITY_ROOMS.map((room) => {
            const isJoined = joinedRooms.includes(room.id);
            return (
              <GlassCard key={room.id} interactive className="p-5 flex flex-col justify-between gap-4">
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-bold text-[#F8FAFC]" dir="auto">
                        {room.name}
                      </h3>
                      <span className="font-mono text-xs text-[#64748B]">/{room.handle}</span>
                    </div>
                    <BadgePill variant={room.accent === 'emerald' ? 'emerald' : room.accent === 'violet' ? 'violet' : 'indigo'}>
                      <Cpu className="h-3 w-3" />
                      {room.activeNow} פעילים
                    </BadgePill>
                  </div>

                  <p className="text-xs text-[#94A3B8] leading-relaxed" dir="auto">
                    {room.description}
                  </p>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {room.tags.map((tag) => (
                      <Link
                        key={tag}
                        href="/"
                        className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[11px] font-medium text-indigo-300 hover:border-indigo-500/40 hover:bg-indigo-500/10 transition-colors no-underline"
                      >
                        <Hash className="h-2.5 w-2.5" />
                        {tag}
                      </Link>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-white/10">
                  <span className="font-mono text-xs text-[#94A3B8]">
                    {room.members} חברים
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleJoinRoom(room.id)}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                      isJoined
                        ? 'border border-[#10B981]/35 bg-[#10B981]/15 text-emerald-300'
                        : 'bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] text-white shadow-[0_6px_16px_-4px_rgba(99,102,241,0.5)] hover:brightness-110'
                    }`}
                  >
                    {isJoined ? 'חבר בקבוצה ✓' : 'הצטרף לקבוצה'}
                  </button>
                </div>
              </GlassCard>
            );
          })}
        </div>
      </div>

      {/* Featured Builders Card */}
      <GlassCard className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-[#F8FAFC] flex items-center gap-2">
            <Users className="h-4 w-4 text-[#6366F1]" />
            יוצרים ומובילים בקהילה
          </h2>
          <Link
            href="/profile"
            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-300 hover:text-indigo-200 no-underline"
          >
            לפרופיל שלך
            <ArrowUpLeft className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {FEATURED_CREATORS.map((creator) => {
            const isFollowing = followedCreators.includes(creator.username);
            return (
              <div
                key={creator.username}
                className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#090A0F]/60 p-3.5 hover:border-indigo-500/35 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={creator.avatar}
                    alt={creator.name}
                    className="h-10 w-10 rounded-full border border-white/15 bg-[#121521] shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="truncate text-sm font-bold text-[#F8FAFC]">
                        {creator.name}
                      </span>
                      {creator.verified && (
                        <BadgeCheck className="h-3.5 w-3.5 text-[#6366F1] shrink-0" />
                      )}
                    </div>
                    <p className="truncate text-[11px] text-[#94A3B8]">
                      @{creator.username} · {creator.followers} עוקבים
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => toggleFollowCreator(creator.username)}
                  className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                    isFollowing
                      ? 'border border-white/15 bg-white/[0.06] text-[#F8FAFC]'
                      : 'border border-indigo-500/40 bg-indigo-500/15 text-indigo-200 hover:bg-indigo-500/25'
                  }`}
                >
                  {isFollowing ? (
                    <>
                      <UserCheck className="h-3.5 w-3.5 text-[#10B981]" />
                      עוקב
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-3.5 w-3.5" />
                      עקוב
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </GlassCard>
    </AppShell>
  );
}
