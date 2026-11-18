'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowRight,
  Bookmark,
  CheckCircle2,
  CornerDownRight,
  Info,
  Loader2,
  MessageCircle,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { LeftNavRail, type NavUserSummary } from '@/components/layout/LeftNavRail';
import { RightBentoSidebar } from '@/components/layout/RightBentoSidebar';
import {
  CommandSearchModal,
  type SearchResultItem,
} from '@/components/search/CommandSearchModal';
import {
  PostCard,
  PostCardSkeleton,
  type PostCardData,
  type PostPollData,
  type ReactionTypeValue,
} from '@/components/feed/PostCard';
import { BadgePill, GlassCard, GradientButton } from '@/components/ui/GlassPrimitives';
import { clearStoredAuthToken, isJwtExpired } from '@/lib/auth';
import { useSocialStore } from '@/store/useSocialStore';

interface StoredUser {
  userId?: number | string;
  username?: string;
  fullName?: string;
  email?: string;
  token?: string;
  avatarUrl?: string;
}

interface RawBookmarkRecord {
  id?: string | number;
  postId?: string | number;
  authorId?: number | string;
  authorUsername?: string;
  authorName?: string;
  authorAvatar?: string;
  authorVerified?: boolean;
  content?: string;
  quoteComment?: string | null;
  mediaUrls?: string[];
  tags?: string[];
  createdAt?: string;
  likesCount?: number;
  commentsCount?: number;
  commentCount?: number;
  repostsCount?: number;
  isLiked?: boolean;
  likedByMe?: boolean;
  userReaction?: ReactionTypeValue | null;
  reactionCounts?: Record<string, number>;
  isBookmarked?: boolean;
  bookmarkedByMe?: boolean;
  isRepost?: boolean;
  isReposted?: boolean;
  repostedByName?: string;
  isPinned?: boolean;
  poll?: PostPollData | null;
  attachedEntity?: PostCardData['attachedEntity'];
  originalPost?: RawBookmarkRecord | null;
}

interface BookmarkCommentItem {
  id: string;
  postId: string | number;
  authorName: string;
  authorUsername: string;
  authorAvatar: string;
  content: string;
  createdAt: string;
  parentId?: string;
  replyToUsername?: string;
}

const CURATED_BOOKMARKED_POSTS: PostCardData[] = [
  {
    id: 101,
    authorId: 1,
    authorUsername: 'idan',
    authorName: 'עידן קזם',
    authorAvatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=idan',
    authorVerified: true,
    isPinned: true,
    content:
      'השקנו את ממשק ה-Obsidian Liquid Glass 2026 ב-SocialFlow! 🚀\nארכיטקטורה מודולרית עם Next.js 15, React 19, סוכני LangGraph אוטונומיים, חיפוש מיידי ב-Elasticsearch 8 והעלאות ישירות ל-MinIO S3.',
    tags: ['Nextjs15', 'LangGraph', 'LiquidGlass', 'SocialFlow'],
    mediaUrls: [
      'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
    ],
    createdAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    likesCount: 142,
    commentsCount: 2,
    repostsCount: 24,
    isLiked: false,
    userReaction: 'INSIGHTFUL',
    isBookmarked: true,
    attachedEntity: {
      entityType: 'PROJECT',
      title: 'SocialFlow Obsidian Liquid Glass v2.0',
      badge: 'RELEASE 2026',
    },
    poll: {
      id: 901,
      question: 'איזה שדרוג בממשק החדש הכי מרשים אותך?',
      totalVotes: 98,
      hasVoted: false,
      options: [
        { id: 1, text: 'עיצוב Obsidian Liquid Glass & Bento Grid ✨', voteCount: 54, percentage: 55 },
        { id: 2, text: 'סוכן LangGraph + חיפוש AI RAG מהיר 🤖', voteCount: 31, percentage: 32 },
        { id: 3, text: 'העלאות MinIO ישירות + ריאקציות ב-0ms ⚡', voteCount: 13, percentage: 13 },
      ],
    },
  },
  {
    id: 103,
    authorId: 3,
    authorUsername: 'daniel',
    authorName: 'דניאל לוי',
    authorAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Daniel',
    authorVerified: true,
    content:
      'Zero-lag event streaming from Spring Boot 3 Post Service through Apache Kafka directly into Elasticsearch 8 & STOMP WebSocket push notifications. Sub-25ms p95 latency across all nodes! ⚡ #KafkaStreams #Elasticsearch',
    tags: ['KafkaStreams', 'Elasticsearch', 'SpringBoot'],
    createdAt: new Date(Date.now() - 85 * 60 * 1000).toISOString(),
    likesCount: 64,
    commentsCount: 1,
    repostsCount: 9,
    isLiked: true,
    userReaction: 'LIKE',
    isBookmarked: true,
  },
];

function normalizeBookmarkPost(raw: RawBookmarkRecord, idx: number): PostCardData {
  const username = raw.authorUsername || 'member';
  const id = raw.postId ?? raw.id ?? `bm-${idx}-${Date.now()}`;
  return {
    id,
    authorId: raw.authorId,
    authorUsername: username,
    authorName: raw.authorName || (username === 'idan' ? 'עידן קזם' : `@${username}`),
    authorAvatar:
      raw.authorAvatar ||
      (username === 'idan'
        ? 'https://api.dicebear.com/7.x/bottts/svg?seed=idan'
        : `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(username)}`),
    authorVerified: raw.authorVerified ?? true,
    content: raw.content || '',
    quoteComment: raw.quoteComment ?? null,
    mediaUrls: Array.isArray(raw.mediaUrls) ? raw.mediaUrls : [],
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    createdAt: raw.createdAt || new Date().toISOString(),
    likesCount: raw.likesCount ?? 0,
    commentsCount: raw.commentsCount ?? raw.commentCount ?? 0,
    repostsCount: raw.repostsCount ?? 0,
    isLiked: Boolean(raw.isLiked ?? raw.likedByMe ?? raw.userReaction),
    userReaction: raw.userReaction ?? (raw.isLiked || raw.likedByMe ? 'LIKE' : null),
    reactionCounts: raw.reactionCounts,
    isBookmarked: true,
    isRepost: Boolean(raw.isRepost),
    isReposted: Boolean(raw.isReposted),
    repostedByName: raw.repostedByName,
    isPinned: Boolean(raw.isPinned),
    poll: raw.poll ?? null,
    attachedEntity: raw.attachedEntity ?? null,
    originalPost: raw.originalPost
      ? normalizeBookmarkPost(raw.originalPost, idx + 1000)
      : null,
  };
}

function formatCommentTime(isoOrText: string): string {
  if (!isoOrText) return 'כרגע';
  const d = new Date(isoOrText);
  if (Number.isNaN(d.getTime())) return isoOrText;
  const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diffSec < 60) return 'עכשיו';
  if (diffSec < 3600) return `לפני ${Math.floor(diffSec / 60)} דק׳`;
  if (diffSec < 86400) return `לפני ${Math.floor(diffSec / 3600)} שע׳`;
  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
}

export default function BookmarksPage() {
  const router = useRouter();
  const { unreadNotificationsCount } = useSocialStore();

  const [authHydrated, setAuthHydrated] = useState(false);
  const [storedUser, setStoredUser] = useState<StoredUser>({
    userId: 1,
    username: 'idan',
    fullName: 'עידן קזם',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=idan',
  });

  const [posts, setPosts] = useState<PostCardData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [source, setSource] = useState<'live' | 'curated'>('curated');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [filterQuery, setFilterQuery] = useState('');
  const [followingUsernames, setFollowingUsernames] = useState<string[]>(['noa', 'daniel']);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Comments Drawer State
  const [commentsPostId, setCommentsPostId] = useState<string | number | null>(null);
  const [commentsByPost, setCommentsByPost] = useState<Record<string, BookmarkCommentItem[]>>({});
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [replyingToComment, setReplyingToComment] = useState<BookmarkCommentItem | null>(null);
  const [smartReplies, setSmartReplies] = useState<string[]>([]);

  const commentInputRef = useRef<HTMLInputElement>(null);

  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'info' | 'error';
  } | null>(null);

  const showToast = useCallback(
    (message: string, type: 'success' | 'info' | 'error' = 'info') => {
      setToast({ message, type });
      setTimeout(() => {
        setToast((prev) => (prev?.message === message ? null : prev));
      }, 3000);
    },
    []
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem('socialflow_user');
      if (raw) {
        const parsed = JSON.parse(raw) as StoredUser;
        const expired = parsed?.token ? isJwtExpired(parsed.token) : false;
        if (expired) {
          clearStoredAuthToken();
        }
        if (parsed && parsed.username) {
          setStoredUser({
            userId: parsed.userId ?? 1,
            username: parsed.username,
            fullName: parsed.fullName || parsed.username,
            email: parsed.email,
            token: expired ? undefined : parsed.token,
            avatarUrl:
              parsed.avatarUrl ||
              `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(
                parsed.username
              )}`,
          });
        }
      }
    } catch {
      // Ignore malformed storage
    } finally {
      setAuthHydrated(true);
    }
  }, []);

  const navUser: NavUserSummary = useMemo(
    () => ({
      name: storedUser.fullName || storedUser.username || 'עידן קזם',
      handle: storedUser.username || 'idan',
      avatarUrl:
        storedUser.avatarUrl ||
        `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(
          storedUser.username || 'idan'
        )}`,
      roleBadge: 'AI Architect',
      isVerified: true,
    }),
    [storedUser]
  );

  const buildAuthHeaders = useCallback(
    (includeJson = true): Record<string, string> => {
      const headers: Record<string, string> = {
        'X-Auth-UserId': String(storedUser.userId ?? 1),
        'X-Auth-Username': storedUser.username || 'idan',
      };
      if (includeJson) headers['Content-Type'] = 'application/json';
      if (storedUser.token && !isJwtExpired(storedUser.token)) {
        headers['Authorization'] = `Bearer ${storedUser.token}`;
      }
      return headers;
    },
    [storedUser]
  );

  const loadBookmarks = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/v1/posts/bookmarks?page=0&size=20', {
        method: 'GET',
        credentials: 'include',
        headers: buildAuthHeaders(false),
      });

      if (res.status === 401 || res.status === 403) {
        clearStoredAuthToken();
        setStoredUser((prev) => ({ ...prev, token: undefined }));
        setPosts(CURATED_BOOKMARKED_POSTS);
        setSource('curated');
        setIsLoading(false);
        return;
      }

      if (res.ok) {
        const data = (await res.json()) as
          | RawBookmarkRecord[]
          | { content?: RawBookmarkRecord[] };
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.content)
          ? data.content
          : [];
        setPosts(list.map((item, idx) => normalizeBookmarkPost(item, idx)));
        setSource('live');
        setIsLoading(false);
        return;
      }
    } catch {
      // Graceful fallback below
    }

    setPosts(CURATED_BOOKMARKED_POSTS);
    setSource('curated');
    setIsLoading(false);
  }, [buildAuthHeaders]);

  useEffect(() => {
    if (authHydrated) {
      void loadBookmarks();
    }
  }, [authHydrated, loadBookmarks]);

  const handleToggleFollow = async (username: string) => {
    const isCurrentlyFollowing = followingUsernames.includes(username);
    setFollowingUsernames((prev) =>
      isCurrentlyFollowing ? prev.filter((u) => u !== username) : [...prev, username]
    );
    showToast(
      isCurrentlyFollowing ? `הפסקת לעקוב אחרי @${username}` : `התחלת לעקוב אחרי @${username}!`,
      'info'
    );
    try {
      await fetch(`/api/v1/users/${encodeURIComponent(username)}/follow`, {
        method: isCurrentlyFollowing ? 'DELETE' : 'POST',
        credentials: 'include',
        headers: buildAuthHeaders(true),
      });
    } catch {
      // Optimistic follow kept
    }
  };

  const handleSelectTag = (tag: string | null) => {
    const clean = tag ? tag.replace(/^#/, '').trim() : null;
    setSelectedTag(clean || null);
  };

  const handleSearchResult = (item: SearchResultItem) => {
    if (item.type === 'tag') {
      handleSelectTag(item.title.replace(/^#/, ''));
    } else if (item.type === 'user') {
      const targetUser =
        item.authorUsername ||
        item.subtitle?.match(/@([\w.-]+)/)?.[1] ||
        item.title.replace(/^@/, '').trim();
      if (targetUser) {
        router.push(`/profile/${encodeURIComponent(targetUser)}`);
      }
    } else if (item.type === 'post' && item.content) {
      setFilterQuery(item.content.slice(0, 24));
    }
  };

  const handleOpenComments = async (postId: number | string) => {
    const key = String(postId);
    const targetPost = posts.find((p) => String(p.id) === key);
    setCommentsPostId(postId);
    setNewCommentText('');
    setReplyingToComment(null);
    setCommentsLoading(true);
    setSmartReplies([
      'שמרתי את הפוסט הזה בדיוק בגלל התובנה הזו! 💡',
      'ארכיטקטורה מצוינת, תודה על השיתוף 🔥',
      'רעיון מעולה להטמעה בצוות שלנו 👏',
    ]);

    await Promise.allSettled([
      (async () => {
        try {
          const res = await fetch(`/api/v1/posts/${encodeURIComponent(key)}/comments`, {
            method: 'GET',
            credentials: 'include',
            headers: buildAuthHeaders(false),
          });
          if (res.ok) {
            const list = (await res.json()) as Array<{
              id?: string | number;
              authorUsername?: string;
              authorAvatar?: string;
              content?: string;
              createdAt?: string;
              parentId?: string | number;
              replyToUsername?: string;
            }>;
            if (Array.isArray(list)) {
              setCommentsByPost((prev) => ({
                ...prev,
                [key]: list.map((c, idx) => {
                  const uname = c.authorUsername || 'member';
                  return {
                    id: String(c.id ?? `bm-c-${idx}`),
                    postId,
                    authorName: uname === 'idan' ? 'עידן קזם' : `@${uname}`,
                    authorUsername: uname,
                    authorAvatar:
                      c.authorAvatar ||
                      `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(
                        uname
                      )}`,
                    content: c.content || '',
                    createdAt: formatCommentTime(c.createdAt || ''),
                    parentId: c.parentId !== undefined ? String(c.parentId) : undefined,
                    replyToUsername: c.replyToUsername,
                  };
                }),
              }));
            }
          }
        } catch {
          // Keep existing local comments
        } finally {
          setCommentsLoading(false);
        }
      })(),
      (async () => {
        try {
          const res = await fetch('/api/v1/ai/smart-replies', {
            method: 'POST',
            credentials: 'include',
            headers: buildAuthHeaders(true),
            body: JSON.stringify({ content: targetPost?.content || '' }),
          });
          if (res.ok) {
            const data = (await res.json()) as { replies?: string[] } | string[];
            const list = Array.isArray(data)
              ? data
              : Array.isArray(data?.replies)
              ? data.replies
              : [];
            const cleaned = list.map((r) => String(r).trim()).filter(Boolean).slice(0, 3);
            if (cleaned.length > 0) setSmartReplies(cleaned);
          }
        } catch {
          // Keep fallback smart replies
        }
      })(),
    ]);
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentsPostId || !newCommentText.trim() || submittingComment) return;
    const key = String(commentsPostId);
    const trimmed = newCommentText.trim();
    const replyTarget = replyingToComment;
    const tempId = `temp-${Date.now()}`;

    const optimistic: BookmarkCommentItem = {
      id: tempId,
      postId: commentsPostId,
      authorName: navUser.name,
      authorUsername: navUser.handle,
      authorAvatar:
        navUser.avatarUrl ||
        `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(navUser.handle)}`,
      content: trimmed,
      createdAt: 'עכשיו',
      parentId: replyTarget?.id,
      replyToUsername: replyTarget?.authorUsername,
    };

    setSubmittingComment(true);
    setNewCommentText('');
    setReplyingToComment(null);
    setCommentsByPost((prev) => ({
      ...prev,
      [key]: replyTarget ? [...(prev[key] ?? []), optimistic] : [optimistic, ...(prev[key] ?? [])],
    }));
    setPosts((prev) =>
      prev.map((p) =>
        String(p.id) === key
          ? { ...p, commentsCount: (p.commentsCount ?? p.commentCount ?? 0) + 1 }
          : p
      )
    );

    try {
      const res = await fetch(`/api/v1/posts/${encodeURIComponent(key)}/comments`, {
        method: 'POST',
        credentials: 'include',
        headers: buildAuthHeaders(true),
        body: JSON.stringify({
          content: trimmed,
          ...(replyTarget
            ? { parentId: replyTarget.id, replyToUsername: replyTarget.authorUsername }
            : {}),
        }),
      });
      if (res.ok) {
        const saved = (await res.json()) as { id?: number | string; createdAt?: string };
        setCommentsByPost((prev) => ({
          ...prev,
          [key]: (prev[key] ?? []).map((c) =>
            c.id === tempId
              ? {
                  ...c,
                  id: String(saved.id ?? tempId),
                  createdAt: formatCommentTime(saved.createdAt || 'עכשיו'),
                }
              : c
          ),
        }));
      }
      showToast('התגובה נוספה בהצלחה! 💬', 'success');
    } catch {
      showToast('התגובה נשמרה מקומית (מצב אופליין)', 'info');
    } finally {
      setSubmittingComment(false);
    }
  };

  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      if (selectedTag) {
        const qTag = selectedTag.toLowerCase();
        const matchesTag =
          post.tags?.some((t) => t.toLowerCase().includes(qTag)) ||
          post.content.toLowerCase().includes(`#${qTag}`);
        if (!matchesTag) return false;
      }
      if (filterQuery.trim()) {
        const q = filterQuery.trim().toLowerCase();
        const matchesText =
          post.content.toLowerCase().includes(q) ||
          post.authorUsername.toLowerCase().includes(q) ||
          (post.authorName?.toLowerCase().includes(q) ?? false) ||
          (post.tags?.some((t) => t.toLowerCase().includes(q)) ?? false);
        if (!matchesText) return false;
      }
      return true;
    });
  }, [posts, selectedTag, filterQuery]);

  const activeCommentsList = commentsPostId ? commentsByPost[String(commentsPostId)] ?? [] : [];
  const activeCommentsPost = commentsPostId
    ? posts.find((p) => String(p.id) === String(commentsPostId))
    : undefined;

  const { rootComments, childrenByParent } = useMemo(() => {
    const idSet = new Set(activeCommentsList.map((c) => c.id));
    const map = new Map<string, BookmarkCommentItem[]>();
    const roots: BookmarkCommentItem[] = [];
    for (const c of activeCommentsList) {
      if (c.parentId && idSet.has(c.parentId)) {
        const list = map.get(c.parentId) ?? [];
        list.push(c);
        map.set(c.parentId, list);
      } else {
        roots.push(c);
      }
    }
    return { rootComments: roots, childrenByParent: map };
  }, [activeCommentsList]);

  const renderCommentNode = (comment: BookmarkCommentItem, depth = 0): React.ReactNode => {
    const replies = childrenByParent.get(comment.id) ?? [];
    const hasReplies = replies.length > 0;
    return (
      <div key={comment.id} className="space-y-2">
        <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-[#090A0F]/60 p-3.5">
          <div className="flex flex-col items-center shrink-0">
            <img
              src={comment.authorAvatar}
              alt={comment.authorName}
              className="h-8 w-8 rounded-full border border-white/15 object-cover"
            />
            {hasReplies && (
              <div
                aria-hidden="true"
                className="w-0.5 flex-1 min-h-[16px] mt-1.5 rounded-full bg-gradient-to-b from-[#6366F1]/75 via-[#8B5CF6]/45 to-transparent"
              />
            )}
          </div>
          <div className="min-w-0 flex-1 text-start">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-[#F8FAFC]">{comment.authorName}</span>
              <span className="font-mono text-[10px] text-[#64748B]">{comment.createdAt}</span>
            </div>
            {comment.replyToUsername && (
              <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-mono text-[#8B5CF6]">
                <CornerDownRight className="h-3 w-3" />
                <span>@{comment.replyToUsername}</span>
              </div>
            )}
            <p dir="auto" className="mt-1 text-xs sm:text-sm leading-relaxed text-[#94A3B8]">
              {comment.content}
            </p>
            <button
              type="button"
              onClick={() => {
                setReplyingToComment(comment);
                setTimeout(() => commentInputRef.current?.focus(), 20);
              }}
              className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-300 hover:text-indigo-200 cursor-pointer"
            >
              <CornerDownRight className="h-3 w-3" />
              <span>הגב</span>
            </button>
          </div>
        </div>
        {hasReplies && (
          <div
            className={
              depth < 3
                ? 'ms-4 ps-3.5 border-s-2 border-[#6366F1]/40 space-y-2'
                : 'space-y-2'
            }
          >
            {replies.map((reply) => renderCommentNode(reply, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <AppShell
      activePath="/bookmarks"
      selectedTag={selectedTag}
      onSelectTag={handleSelectTag}
      onOpenSearch={() => setIsSearchOpen(true)}
      onOpenComposer={() => router.push('/')}
      onOpenAgent={() => router.push('/')}
      onSelectSearchResult={handleSearchResult}
      unreadNotificationsCount={unreadNotificationsCount}
      mobileTitle="סימניות"
      leftRail={
        <LeftNavRail
          activePath="/bookmarks"
          user={navUser}
          unreadNotificationsCount={unreadNotificationsCount}
          onNewPost={() => router.push('/')}
          onOpenAgent={() => router.push('/')}
        />
      }
      rightSidebar={
        <RightBentoSidebar
          onOpenSearch={() => setIsSearchOpen(true)}
          selectedTag={selectedTag}
          onSelectTag={handleSelectTag}
          followingUsernames={followingUsernames}
          onToggleFollow={handleToggleFollow}
        />
      }
    >
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.96 }}
            className="fixed top-5 end-5 z-50 flex items-center gap-2.5 rounded-2xl border border-indigo-500/40 bg-[#121521]/95 px-4 py-3 text-sm font-semibold text-[#F8FAFC] shadow-[0_16px_40px_rgba(0,0,0,0.65)] backdrop-blur-2xl"
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-[#10B981]" />
            ) : toast.type === 'error' ? (
              <AlertCircle className="h-4 w-4 shrink-0 text-[#F43F5E]" />
            ) : (
              <Info className="h-4 w-4 shrink-0 text-[#6366F1]" />
            )}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bookmarks Header Glass Card */}
      <GlassCard className="p-5 sm:p-6 relative overflow-hidden space-y-4">
        <div className="absolute -top-16 -end-16 h-40 w-40 rounded-full bg-[#6366F1]/20 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <BadgePill variant="indigo">
                <Bookmark className="h-3 w-3 fill-current" />
                <span>Saved Bookmarks</span>
              </BadgePill>
              <BadgePill variant={source === 'live' ? 'emerald' : 'violet'} pulseDot={source === 'live'}>
                {source === 'live' ? 'Live Sync' : 'Curated Offline'}
              </BadgePill>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#F8FAFC]">
              הסימניות השמורות שלך
            </h1>
            <p className="text-xs sm:text-sm text-[#94A3B8]">
              כל הפוסטים, הדיונים והסקרים ששמרת לעיון מהיר במקום אחד.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadBookmarks()}
              aria-label="רענן סימניות"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-[#94A3B8] hover:border-indigo-500/40 hover:text-[#F8FAFC] transition-colors cursor-pointer"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin text-[#6366F1]' : ''}`} />
            </button>
            <Link href="/" className="no-underline">
              <GradientButton variant="secondary" size="sm" leftIcon={<ArrowRight className="h-3.5 w-3.5" />}>
                לפיד הראשי
              </GradientButton>
            </Link>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="relative z-10 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="h-4 w-4 text-[#64748B] absolute start-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              dir="auto"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="סנן בתוך הסימניות לפי מילה, יוצר או #תגית..."
              className="w-full rounded-xl border border-white/10 bg-[#090A0F]/75 ps-10 pe-8 py-2 text-xs sm:text-sm text-[#F8FAFC] placeholder-[#64748B] outline-none focus:border-[#6366F1]"
            />
            {filterQuery && (
              <button
                type="button"
                onClick={() => setFilterQuery('')}
                aria-label="נקה סינון"
                className="absolute end-2.5 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#F8FAFC] cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {selectedTag && (
            <button
              type="button"
              onClick={() => setSelectedTag(null)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#6366F1]/40 bg-[#6366F1]/15 px-3 py-2 text-xs font-mono text-indigo-200 hover:bg-[#6366F1]/25 cursor-pointer"
            >
              <span>#{selectedTag}</span>
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </GlassCard>

      {/* Status Strip */}
      <div className="flex items-center justify-between px-1 text-[11px] font-mono text-[#64748B]">
        <span>
          {source === 'live'
            ? 'GET /api/v1/posts/bookmarks'
            : 'Curated Saved Bookmarks'}
        </span>
        <span>{filteredPosts.length} saved</span>
      </div>

      {/* Bookmarked Posts Stream */}
      {isLoading ? (
        <div className="space-y-4">
          <PostCardSkeleton />
          <PostCardSkeleton />
        </div>
      ) : filteredPosts.length === 0 ? (
        <GlassCard className="p-10 text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-indigo-500/30 bg-[#6366F1]/15 text-[#6366F1]">
            <Bookmark className="h-6 w-6" />
          </div>
          <h2 className="text-base font-bold text-[#F8FAFC]">
            {posts.length === 0 ? 'עדיין אין לך סימניות שמורות' : 'לא נמצאו סימניות תואמות לסינון'}
          </h2>
          <p className="text-sm text-[#94A3B8]">
            {posts.length === 0
              ? 'שמור פוסטים מעניינים מהפיד הראשי כדי לחזור אליהם בכל רגע.'
              : 'נסה לנקות את מילות הסינון או התגית שנבחרה.'}
          </p>
          <div className="pt-2">
            {posts.length === 0 ? (
              <Link href="/" className="no-underline">
                <GradientButton size="sm">גלה פוסטים בפיד</GradientButton>
              </Link>
            ) : (
              <GradientButton
                size="sm"
                onClick={() => {
                  setFilterQuery('');
                  setSelectedTag(null);
                }}
              >
                נקה סינונים
              </GradientButton>
            )}
          </div>
        </GlassCard>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {filteredPosts.map((post) => (
              <motion.div
                key={String(post.id)}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.18 }}
              >
                <PostCard
                  post={post}
                  authToken={storedUser.token ?? null}
                  currentUserId={storedUser.userId ?? 1}
                  currentUsername={navUser.handle}
                  onHashtagClick={(tag) => handleSelectTag(tag)}
                  onAuthorClick={(username) =>
                    router.push(`/profile/${encodeURIComponent(username)}`)
                  }
                  onCommentClick={handleOpenComments}
                  onReactionChange={(postId, userReaction, likesCount, reactionCounts) => {
                    setPosts((prev) =>
                      prev.map((p) =>
                        String(p.id) === String(postId)
                          ? {
                              ...p,
                              isLiked: userReaction !== null,
                              userReaction,
                              likesCount,
                              reactionCounts,
                            }
                          : p
                      )
                    );
                  }}
                  onLikeChange={(postId, liked, likesCount) => {
                    setPosts((prev) =>
                      prev.map((p) =>
                        String(p.id) === String(postId)
                          ? { ...p, isLiked: liked, likesCount }
                          : p
                      )
                    );
                  }}
                  onRepost={(postId, quoteComment) => {
                    setPosts((prev) =>
                      prev.map((p) =>
                        String(p.id) === String(postId)
                          ? { ...p, isReposted: true, repostsCount: (p.repostsCount ?? 0) + 1 }
                          : p
                      )
                    );
                    showToast(
                      quoteComment ? 'הציטוט פורסם בפיד! 🔁' : 'הפוסט שותף מחדש! 🔁',
                      'success'
                    );
                  }}
                  onPinChange={(postId, nextPinned) => {
                    setPosts((prev) =>
                      prev.map((p) =>
                        String(p.id) === String(postId) ? { ...p, isPinned: nextPinned } : p
                      )
                    );
                    showToast(nextPinned ? 'הפוסט הוצמד 📌' : 'ההצמדה בוטלה', 'info');
                  }}
                  onDeletePost={(postId) => {
                    setPosts((prev) => prev.filter((p) => String(p.id) !== String(postId)));
                    showToast('הפוסט נמחק 🗑️', 'info');
                  }}
                  onBookmarkChange={(postId, bookmarked) => {
                    if (!bookmarked) {
                      setPosts((prev) => prev.filter((p) => String(p.id) !== String(postId)));
                      showToast('הפוסט הוסר מהסימניות 🔖', 'info');
                    }
                  }}
                  onShare={() => showToast('קישור לפוסט הועתק לשיתוף!', 'info')}
                  onPollVoted={(postId, updatedPoll) => {
                    setPosts((prev) =>
                      prev.map((p) =>
                        String(p.id) === String(postId) ? { ...p, poll: updatedPoll } : p
                      )
                    );
                    showToast('הצבעתך בסקר נקלטה! 📊', 'success');
                  }}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Search Modal */}
      <CommandSearchModal
        isOpen={isSearchOpen}
        onOpen={() => setIsSearchOpen(true)}
        onClose={() => setIsSearchOpen(false)}
        onSelectTag={(tag) => handleSelectTag(tag)}
        onSelectResult={handleSearchResult}
      />

      {/* Comments Drawer */}
      <AnimatePresence>
        {commentsPostId !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setCommentsPostId(null)}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#090A0F]/80 backdrop-blur-md p-0 sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-label="תגובות לפוסט"
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl border border-white/10 bg-[#121521]/95 backdrop-blur-2xl shadow-[0_24px_80px_rgba(0,0,0,0.85)]"
            >
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5 text-[#6366F1]" />
                  <div>
                    <h3 className="text-sm font-bold text-[#F8FAFC]">שיח ותגובות</h3>
                    {activeCommentsPost && (
                      <p className="text-[11px] font-mono text-[#94A3B8]">
                        @{activeCommentsPost.authorUsername} · {activeCommentsList.length} תגובות
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCommentsPostId(null)}
                  className="rounded-xl p-1.5 text-[#94A3B8] hover:bg-white/10 hover:text-[#F8FAFC] transition-colors cursor-pointer"
                  aria-label="סגור תגובות"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {activeCommentsPost && (
                <div className="border-b border-white/10 bg-[#090A0F]/55 px-5 py-3">
                  <p dir="auto" className="line-clamp-2 text-xs text-[#94A3B8]">
                    {activeCommentsPost.content}
                  </p>
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-5 space-y-3">
                {commentsLoading ? (
                  <div className="flex items-center justify-center py-8 text-xs text-[#94A3B8] gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-[#6366F1]" />
                    <span>טוען תגובות...</span>
                  </div>
                ) : rootComments.length === 0 ? (
                  <div className="py-8 text-center text-sm text-[#64748B]">
                    עדיין אין תגובות. היה הראשון להגיב!
                  </div>
                ) : (
                  rootComments.map((comment) => renderCommentNode(comment, 0))
                )}
              </div>

              <div className="border-t border-white/10 bg-[#090A0F]/75 p-4 space-y-2.5">
                {smartReplies.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-300">
                      <Sparkles className="h-3.5 w-3.5 text-[#8B5CF6]" />
                      <span>AI Smart Replies</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {smartReplies.map((reply) => (
                        <button
                          key={reply}
                          type="button"
                          dir="auto"
                          onClick={() => {
                            setNewCommentText(reply);
                            commentInputRef.current?.focus();
                          }}
                          className="rounded-full border border-[#8B5CF6]/35 bg-[#8B5CF6]/12 px-3 py-1 text-xs font-medium text-violet-200 hover:border-[#8B5CF6]/60 hover:bg-[#8B5CF6]/25 transition-colors cursor-pointer"
                        >
                          {reply}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {replyingToComment && (
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-[#6366F1]/35 bg-[#6366F1]/12 px-3 py-1.5 text-xs text-indigo-200">
                    <span className="inline-flex items-center gap-1.5">
                      <CornerDownRight className="h-3.5 w-3.5 text-[#6366F1]" />
                      <span>משיב ל-@{replyingToComment.authorUsername}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setReplyingToComment(null)}
                      className="rounded-lg p-1 hover:bg-white/10 cursor-pointer"
                      aria-label="בטל מענה"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                <form onSubmit={handleSubmitComment} className="flex items-center gap-2">
                  <input
                    ref={commentInputRef}
                    type="text"
                    dir="auto"
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    placeholder="כתוב תגובה עניינית..."
                    className="flex-1 rounded-xl border border-white/10 bg-[#121521] px-3.5 py-2.5 text-sm text-[#F8FAFC] placeholder-[#64748B] outline-none focus:border-[#6366F1]"
                  />
                  <GradientButton
                    type="submit"
                    size="sm"
                    disabled={!newCommentText.trim() || submittingComment}
                    isLoading={submittingComment}
                    leftIcon={<Send className="h-3.5 w-3.5" />}
                  >
                    שלח
                  </GradientButton>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppShell>
  );
}
