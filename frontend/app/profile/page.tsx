'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  Bookmark,
  ExternalLink,
  Heart,
  Image as ImageIcon,
  Layers,
  LogIn,
  MessageCircle,
  Repeat2,
  Sparkles,
  X,
} from 'lucide-react';
import {
  BentoProfileHeader,
  type ProfileUpdatePayload,
  type UserProfileData,
} from '@/components/profile/BentoProfileHeader';
import {
  BadgePill,
  GlassCard,
  GradientButton,
  SkeletonPulse,
} from '@/components/ui/GlassPrimitives';

type ProfileTab = 'posts' | 'media' | 'likes';

interface ProfilePostItem {
  id: string;
  authorName: string;
  authorUsername: string;
  authorAvatar: string;
  content: string;
  tags: string[];
  createdAt: string;
  mediaUrl?: string;
  likesCount: number;
  commentsCount: number;
  repostsCount: number;
  likedByMe?: boolean;
  bookmarkedByMe?: boolean;
}

const DEFAULT_PROFILE: UserProfileData = {
  id: 1,
  username: 'idan',
  fullName: 'עידן קזם | Idan Kazam',
  bio: 'Lead Architect @ SocialFlow • Building Microservices, Spring Boot 3, Kafka, Elasticsearch & LangGraph AI Agents.\nבונה מערכות מבוזרות וחוויית Liquid Glass 2026.',
  avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=idan',
  coverUrl:
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1400&q=80',
  location: 'Tel Aviv, Israel',
  website: 'github.com/IDAN2468D',
  verified: true,
  roleBadge: 'Core Architect',
  joinedAt: 'נובמבר 2025',
  isOwnProfile: true,
  stats: {
    posts: 42,
    followers: 1840,
    following: 128,
    engagementImpact: '96.4',
    engagementDelta: '+24.8%',
  },
};

const INITIAL_POSTS: ProfilePostItem[] = [
  {
    id: 'prof-101',
    authorName: 'עידן קזם | Idan Kazam',
    authorUsername: 'idan',
    authorAvatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=idan',
    content:
      'השקנו היום את עיצוב ה-Obsidian Liquid Glass החדש ב-SocialFlow! 🚀 שילוב של Next.js 15, Tailwind v4, Apache Kafka ו-Elasticsearch 8 לחוויית פיד בזמן אמת.',
    tags: ['SocialFlow', 'LiquidGlass', 'NextJS15'],
    createdAt: 'לפני שעתיים',
    mediaUrl:
      'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
    likesCount: 148,
    commentsCount: 24,
    repostsCount: 19,
    likedByMe: false,
    bookmarkedByMe: true,
  },
  {
    id: 'prof-102',
    authorName: 'עידן קזם | Idan Kazam',
    authorUsername: 'idan',
    authorAvatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=idan',
    content:
      'LangGraph autonomous trend-research + Gemini RAG feed QA is now live on port 8086. Clean event-driven pipelines from Kafka to WebSocket STOMP in milliseconds. ⚡',
    tags: ['LangGraph', 'AI', 'Kafka', 'Microservices'],
    createdAt: 'אתמול',
    mediaUrl:
      'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=80',
    likesCount: 94,
    commentsCount: 13,
    repostsCount: 11,
    likedByMe: true,
    bookmarkedByMe: false,
  },
  {
    id: 'prof-103',
    authorName: 'עידן קזם | Idan Kazam',
    authorUsername: 'idan',
    authorAvatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=idan',
    content:
      'טיפ ארכיטקטורה: תמיד תפרידו בין תיעוד Spec-First לבין מימוש רכיבי UI מודולריים. Bento Grids הופכים דשבורדים מורכבים לברורים וקריאים במבט ראשון. ✨',
    tags: ['BentoUI', 'Architecture', 'DesignSystems'],
    createdAt: 'לפני 3 ימים',
    mediaUrl:
      'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?auto=format&fit=crop&w=1200&q=80',
    likesCount: 215,
    commentsCount: 31,
    repostsCount: 27,
    likedByMe: false,
    bookmarkedByMe: false,
  },
];

const INITIAL_LIKED_POSTS: ProfilePostItem[] = [
  {
    id: 'like-201',
    authorName: 'נועה כהן',
    authorUsername: 'noa',
    authorAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Noa',
    content:
      'ממשק הפרופיל החדש עם אריחי ה-Bento והשקיפות העדינה נראה פשוט מדהים במובייל ובדסקטופ! 💜',
    tags: ['UX2026', 'Glassmorphism'],
    createdAt: 'לפני 4 שעות',
    mediaUrl:
      'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=1200&q=80',
    likesCount: 87,
    commentsCount: 9,
    repostsCount: 5,
    likedByMe: true,
    bookmarkedByMe: false,
  },
  {
    id: 'like-202',
    authorName: 'דניאל לוי',
    authorUsername: 'daniel',
    authorAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Daniel',
    content:
      'Testing MinIO S3 presigned uploads + Spring Boot 3 API Gateway rate limiting under load — sub-25ms p95 latency across all nodes. 🔥',
    tags: ['SpringBoot', 'MinIO', 'Performance'],
    createdAt: 'לפני יומיים',
    likesCount: 112,
    commentsCount: 16,
    repostsCount: 14,
    likedByMe: true,
    bookmarkedByMe: true,
  },
];

const PROFILE_TABS: { id: ProfileTab; label: string; icon: React.ReactNode }[] = [
  { id: 'posts', label: 'פוסטים / Posts', icon: <Layers className="h-4 w-4" /> },
  { id: 'media', label: 'מדיה / Media', icon: <ImageIcon className="h-4 w-4" /> },
  { id: 'likes', label: 'אהבתי / Likes', icon: <Heart className="h-4 w-4" /> },
];

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfileData>(DEFAULT_PROFILE);
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');
  const [posts, setPosts] = useState<ProfilePostItem[]>(INITIAL_POSTS);
  const [likedPosts, setLikedPosts] = useState<ProfilePostItem[]>(INITIAL_LIKED_POSTS);
  const [isHydrating, setIsHydrating] = useState(true);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; caption: string } | null>(
    null
  );
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function hydrateProfile() {
      let localUsername = 'idan';
      let localFullName = DEFAULT_PROFILE.fullName;

      try {
        const raw = localStorage.getItem('socialflow_user');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.username) localUsername = parsed.username;
          if (parsed?.fullName) localFullName = parsed.fullName;

          if (isMounted) {
            setProfile((prev) => ({
              ...prev,
              id: parsed.userId ?? prev.id,
              username: localUsername,
              fullName: localFullName,
              avatarUrl:
                parsed.avatarUrl ||
                `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(localUsername)}`,
            }));
          }
        }
      } catch {
        // Ignore malformed localStorage
      }

      try {
        const res = await fetch(`/api/users/profile/${encodeURIComponent(localUsername)}`, {
          credentials: 'include',
        });
        if (res.ok && isMounted) {
          const data = await res.json();
          setProfile((prev) => ({
            ...prev,
            id: data.id ?? prev.id,
            username: data.username || prev.username,
            fullName: data.fullName || prev.fullName,
            bio: data.bio || prev.bio,
            avatarUrl: data.profileImageUrl || prev.avatarUrl,
            stats: {
              ...prev.stats,
              followers:
                typeof data.followersCount === 'number'
                  ? data.followersCount
                  : prev.stats.followers,
              following:
                typeof data.followingCount === 'number'
                  ? data.followingCount
                  : prev.stats.following,
            },
          }));
        }
      } catch {
        // Graceful offline fallback using hydrated/default profile
      } finally {
        if (isMounted) setIsHydrating(false);
      }
    }

    hydrateProfile();
    return () => {
      isMounted = false;
    };
  }, []);

  const mediaItems = useMemo(
    () => posts.filter((p) => Boolean(p.mediaUrl)),
    [posts]
  );

  const handleUpdateProfile = async (updated: ProfileUpdatePayload) => {
    setProfile((prev) => ({
      ...prev,
      fullName: updated.fullName,
      bio: updated.bio,
      location: updated.location,
      website: updated.website,
      avatarUrl: updated.avatarUrl || prev.avatarUrl,
      coverUrl: updated.coverUrl || prev.coverUrl,
    }));

    try {
      const raw = localStorage.getItem('socialflow_user');
      if (raw) {
        const parsed = JSON.parse(raw);
        localStorage.setItem(
          'socialflow_user',
          JSON.stringify({
            ...parsed,
            fullName: updated.fullName,
            avatarUrl: updated.avatarUrl || parsed.avatarUrl,
          })
        );
      }
    } catch {
      // Ignore storage error
    }

    setStatusBanner('הפרופיל עודכן בהצלחה');
    setTimeout(() => setStatusBanner(null), 2600);
  };

  const togglePostLike = (postId: string, list: 'posts' | 'likes') => {
    const updater = (items: ProfilePostItem[]) =>
      items.map((item) => {
        if (item.id !== postId) return item;
        const nextLiked = !item.likedByMe;
        return {
          ...item,
          likedByMe: nextLiked,
          likesCount: Math.max(0, item.likesCount + (nextLiked ? 1 : -1)),
        };
      });

    if (list === 'posts') setPosts(updater);
    else setLikedPosts(updater);
  };

  const togglePostBookmark = (postId: string, list: 'posts' | 'likes') => {
    const updater = (items: ProfilePostItem[]) =>
      items.map((item) =>
        item.id === postId ? { ...item, bookmarkedByMe: !item.bookmarkedByMe } : item
      );

    if (list === 'posts') setPosts(updater);
    else setLikedPosts(updater);
  };

  const renderPostCard = (post: ProfilePostItem, sourceList: 'posts' | 'likes') => (
    <GlassCard key={post.id} interactive glow="indigo" className="space-y-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src={post.authorAvatar}
            alt={post.authorName}
            className="h-10 w-10 rounded-full border border-indigo-400/35 object-cover bg-[#090A0F] shrink-0"
          />
          <div className="min-w-0">
            <p dir="auto" className="text-sm font-bold text-slate-100 truncate">
              {post.authorName}
            </p>
            <p className="text-xs font-mono text-slate-400 truncate">
              @{post.authorUsername} • {post.createdAt}
            </p>
          </div>
        </div>

        <BadgePill variant="indigo" size="sm">
          {sourceList === 'likes' ? 'מועדף' : 'פורסם'}
        </BadgePill>
      </div>

      <p dir="auto" className="text-sm leading-relaxed text-slate-200 whitespace-pre-line">
        {post.content}
      </p>

      {post.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {post.tags.map((tag) => (
            <span
              key={tag}
              className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {post.mediaUrl && (
        <button
          type="button"
          onClick={() =>
            setLightboxImage({ url: post.mediaUrl!, caption: post.content })
          }
          className="group relative block w-full overflow-hidden rounded-xl border border-white/10 cursor-pointer"
        >
          <img
            src={post.mediaUrl}
            alt=""
            className="h-56 w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
          <span className="absolute bottom-2.5 end-2.5 inline-flex items-center gap-1 rounded-full bg-[#090A0F]/75 backdrop-blur-md border border-white/15 px-2.5 py-1 text-[11px] font-medium text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity">
            <ExternalLink className="h-3 w-3" />
            <span>הגדל תמונה</span>
          </span>
        </button>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs text-slate-400">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => togglePostLike(post.id, sourceList)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
              post.likedByMe
                ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                : 'hover:bg-white/5 hover:text-rose-300'
            }`}
          >
            <Heart className={`h-3.5 w-3.5 ${post.likedByMe ? 'fill-current' : ''}`} />
            <span className="font-mono">{post.likesCount}</span>
          </button>

          <span className="inline-flex items-center gap-1.5 px-2 py-1">
            <MessageCircle className="h-3.5 w-3.5" />
            <span className="font-mono">{post.commentsCount}</span>
          </span>

          <span className="inline-flex items-center gap-1.5 px-2 py-1">
            <Repeat2 className="h-3.5 w-3.5" />
            <span className="font-mono">{post.repostsCount}</span>
          </span>
        </div>

        <button
          type="button"
          onClick={() => togglePostBookmark(post.id, sourceList)}
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
            post.bookmarkedByMe
              ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
              : 'hover:bg-white/5 hover:text-slate-200'
          }`}
          aria-label="Bookmark post"
        >
          <Bookmark className={`h-3.5 w-3.5 ${post.bookmarkedByMe ? 'fill-current' : ''}`} />
        </button>
      </div>
    </GlassCard>
  );

  return (
    <div className="w-full min-h-screen bg-[#090A0F] text-[#F8FAFC]">
      {/* Sticky Top Glass Navigation */}
      <header className="sticky top-0 z-40 w-full bg-[#090A0F]/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl bg-[rgba(18,21,33,0.72)] border border-white/10 hover:border-indigo-500/40 px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-100 transition-all"
            >
              <ArrowRight className="h-4 w-4 text-indigo-400" />
              <span>פיד ראשי</span>
            </Link>
            <div className="hidden sm:block">
              <p className="text-sm font-bold text-slate-100">{profile.fullName}</p>
              <p className="text-[11px] font-mono text-slate-400">
                @{profile.username} • {profile.stats.posts} posts
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <BadgePill variant="emerald" pulseDot size="sm">
              Live Sync
            </BadgePill>
            <Link href="/login">
              <GradientButton
                variant="secondary"
                size="sm"
                leftIcon={<LogIn className="h-3.5 w-3.5" />}
              >
                החלף משתמש
              </GradientButton>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Dashboard Container */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <AnimatePresence>
          {statusBanner && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="rounded-2xl bg-emerald-500/15 border border-emerald-500/35 px-4 py-2.5 text-xs font-semibold text-emerald-200 flex items-center gap-2"
            >
              <Sparkles className="h-4 w-4 text-emerald-400" />
              <span>{statusBanner}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bento Profile Header + 4-Tile Stats Grid */}
        <BentoProfileHeader
          profile={profile}
          onUpdateProfile={handleUpdateProfile}
          backHref="/"
          isLoading={isHydrating}
        />

        {/* Tabbed Content Switcher */}
        <GlassCard padding="sm" className="rounded-2xl">
          <div className="grid grid-cols-3 gap-2" role="tablist" aria-label="Profile tabs">
            {PROFILE_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                    isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="profile-tab-indicator"
                      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                      className="absolute inset-0 rounded-xl bg-gradient-to-r from-indigo-500/25 via-violet-500/25 to-indigo-500/25 border border-indigo-400/40 shadow-[0_4px_20px_rgba(99,102,241,0.2)]"
                    />
                  )}
                  <span className="relative z-10 inline-flex items-center gap-2">
                    {tab.icon}
                    <span>{tab.label}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </GlassCard>

        {/* Tab Views */}
        {isHydrating ? (
          <div className="space-y-4">
            <SkeletonPulse variant="card" className="h-44" />
            <SkeletonPulse variant="card" className="h-44" />
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {activeTab === 'posts' && (
              <motion.div
                key="tab-posts"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="space-y-4"
              >
                {posts.map((post) => renderPostCard(post, 'posts'))}
              </motion.div>
            )}

            {activeTab === 'media' && (
              <motion.div
                key="tab-media"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
              >
                {mediaItems.map((item, idx) => (
                  <GlassCard
                    key={item.id}
                    padding="none"
                    interactive
                    glow="violet"
                    onClick={() =>
                      setLightboxImage({ url: item.mediaUrl!, caption: item.content })
                    }
                    className={`overflow-hidden group ${
                      idx === 0 ? 'sm:col-span-2 lg:col-span-2' : ''
                    }`}
                  >
                    <div className="relative h-64 w-full overflow-hidden">
                      <img
                        src={item.mediaUrl}
                        alt=""
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#090A0F]/90 via-transparent to-transparent" />
                      <div className="absolute bottom-3 inset-x-3 flex items-end justify-between gap-2">
                        <p dir="auto" className="text-xs text-slate-200 line-clamp-2">
                          {item.content}
                        </p>
                        <span className="text-[11px] font-mono text-rose-300 inline-flex items-center gap-1 shrink-0 bg-[#090A0F]/70 px-2 py-0.5 rounded-full border border-white/10">
                          <Heart className="h-3 w-3 fill-current" />
                          {item.likesCount}
                        </span>
                      </div>
                    </div>
                  </GlassCard>
                ))}
              </motion.div>
            )}

            {activeTab === 'likes' && (
              <motion.div
                key="tab-likes"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="space-y-4"
              >
                {likedPosts.map((post) => renderPostCard(post, 'likes'))}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </main>

      {/* Media Lightbox Modal */}
      <AnimatePresence>
        {lightboxImage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setLightboxImage(null)}
              className="absolute inset-0 bg-[#090A0F]/85 backdrop-blur-xl"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              className="relative z-10 max-w-3xl w-full rounded-3xl overflow-hidden bg-[rgba(18,21,33,0.92)] border border-white/15 shadow-2xl"
            >
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="absolute top-3 end-3 z-20 h-9 w-9 rounded-full bg-[#090A0F]/80 border border-white/20 text-white inline-flex items-center justify-center hover:bg-white/10 cursor-pointer"
                aria-label="Close lightbox"
              >
                <X className="h-4 w-4" />
              </button>
              <img
                src={lightboxImage.url}
                alt=""
                className="w-full max-h-[72vh] object-contain bg-black/50"
              />
              <div className="p-4 border-t border-white/10">
                <p dir="auto" className="text-sm text-slate-200">
                  {lightboxImage.caption}
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
