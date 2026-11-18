'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  Clapperboard,
  CornerDownRight,
  Info,
  Loader2,
  MessageCircle,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { LeftNavRail, type NavUserSummary } from '@/components/layout/LeftNavRail';
import {
  RightBentoSidebar,
  type TrendingTagItem,
} from '@/components/layout/RightBentoSidebar';
import {
  CommandSearchModal,
  type SearchResultItem,
} from '@/components/search/CommandSearchModal';
import {
  FeedHeaderTabs,
  type FeedTabKey,
} from '@/components/feed/FeedHeaderTabs';
import {
  PostComposerCard,
  type CreatedPostPayload,
} from '@/components/composer/PostComposerCard';
import {
  PostCard,
  PostCardSkeleton,
  type PostCardData,
  type PostPollData,
  type ReactionTypeValue,
} from '@/components/feed/PostCard';
import { BadgePill, GradientButton } from '@/components/ui/GlassPrimitives';
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

interface StoryStripItem {
  id: string;
  username: string;
  name: string;
  avatar: string;
  coverImage: string;
  hasUnread: boolean;
  previewLabel: string;
}

interface FeedCommentItem {
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

interface RawFeedRecord {
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
  originalPost?: RawFeedRecord | null;
}

interface AgentRunResponse {
  draft_content?: string;
  suggested_tags?: string[];
  logs?: string[];
  moderation_status?: { is_safe?: boolean; reason?: string };
  error?: string | null;
}

interface RagAskResponse {
  answer?: string;
  relevant_posts_count?: number;
  model_used?: string;
  sources?: Array<string | number>;
}

const STORIES_STRIP: StoryStripItem[] = [
  {
    id: 'story-idan',
    username: 'idan',
    name: 'הסטורי שלך',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=idan',
    coverImage:
      'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=80',
    hasUnread: false,
    previewLabel: 'הוסף סטורי',
  },
  {
    id: 'story-noa',
    username: 'noa',
    name: 'נועה כהן',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Noa',
    coverImage:
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    hasUnread: true,
    previewLabel: 'AI & Design',
  },
  {
    id: 'story-daniel',
    username: 'daniel',
    name: 'דניאל לוי',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Daniel',
    coverImage:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    hasUnread: true,
    previewLabel: 'Kafka 0ms',
  },
  {
    id: 'story-maya',
    username: 'maya',
    name: 'מאיה שקד',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Maya',
    coverImage:
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80',
    hasUnread: true,
    previewLabel: 'Liquid Glass',
  },
];

const CURATED_FALLBACK_POSTS: PostCardData[] = [
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
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    likesCount: 142,
    commentsCount: 2,
    repostsCount: 24,
    isLiked: false,
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
    id: 102,
    authorId: 2,
    authorUsername: 'noa',
    authorName: 'נועה כהן',
    authorAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Noa',
    authorVerified: true,
    content:
      'סוכן ה-AI סורק את הפיד בזמן אמת, מנתח מגמות טכנולוגיות ומכין טיוטה מאומתת הממתינה לאישור אנושי (Human-in-the-Loop) בלחיצה אחת. 🤖✨\nBuilding bilingual #AI_Agents with #LangGraph and clean dir="auto" typography.',
    tags: ['AI_Agents', 'LangGraph', 'RAG'],
    mediaUrls: [
      'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?auto=format&fit=crop&w=900&q=80',
    ],
    createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    likesCount: 89,
    commentsCount: 1,
    repostsCount: 14,
    isLiked: true,
    isBookmarked: false,
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
    createdAt: new Date(Date.now() - 75 * 60 * 1000).toISOString(),
    likesCount: 64,
    commentsCount: 1,
    repostsCount: 9,
    isLiked: false,
    isBookmarked: false,
  },
  {
    id: 104,
    authorId: 4,
    authorUsername: 'maya',
    authorName: 'מאיה שקד',
    authorAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Maya',
    authorVerified: false,
    content:
      'שילוב של גריד תמונות בסגנון Bento עם Lightbox מהיר וטבעת תווים אינטראקטיבית הופך את חוויית הכתיבה בפיד לחלקה ומדויקת להפליא. 🎨💜',
    tags: ['LiquidGlass', 'DesignSystems', 'Nextjs15'],
    mediaUrls: [
      'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=900&q=80',
    ],
    createdAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    likesCount: 53,
    commentsCount: 0,
    repostsCount: 6,
    isLiked: false,
    isBookmarked: false,
  },
];

const INITIAL_COMMENTS_BY_POST: Record<string, FeedCommentItem[]> = {
  '101': [
    {
      id: 'c-101-1',
      postId: 101,
      authorName: 'נועה כהן',
      authorUsername: 'noa',
      authorAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Noa',
      content: 'המעבר ל-Obsidian Liquid Glass עם הגריד הממוקד נראה חד, נקי ומהיר במיוחד!',
      createdAt: 'לפני 3 דקות',
    },
    {
      id: 'c-101-2',
      postId: 101,
      authorName: 'דניאל לוי',
      authorUsername: 'daniel',
      authorAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Daniel',
      content: 'מסכים! וגם שילוב סוכן ה-LangGraph עם חיפוש ה-RAG ב-Ctrl+K עובד מדהים.',
      createdAt: 'לפני דקה',
      parentId: 'c-101-1',
      replyToUsername: 'noa',
    },
  ],
  '102': [
    {
      id: 'c-102-1',
      postId: 102,
      authorName: 'עידן קזם',
      authorUsername: 'idan',
      authorAvatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=idan',
      content: 'Human-in-the-Loop לפני פרסום לפיד מבטיח איכות תוכן ובקרה מלאה.',
      createdAt: 'לפני 15 דקות',
    },
  ],
  '103': [
    {
      id: 'c-103-1',
      postId: 103,
      authorName: 'מאיה שקד',
      authorUsername: 'maya',
      authorAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Maya',
      content: 'ביצועי p95 מתחת ל-25ms — תענוג לראות!',
      createdAt: 'לפני 40 דקות',
    },
  ],
};

function buildContextualSmartReplies(post?: PostCardData): string[] {
  const text = (post?.content || '').toLowerCase();
  const tags = (post?.tags || []).map((t) => t.toLowerCase());
  if (text.includes('langgraph') || text.includes('ai') || tags.includes('ai_agents')) {
    return [
      'ארכיטקטורת ה-AI והסוכנים נראית חדה במיוחד! 🤖',
      'מסקרן לראות איך ה-RAG משפר את הדיוק בפיד ✨',
      'כל הכבוד על השילוב של Human-in-the-Loop 👏',
    ];
  }
  if (text.includes('kafka') || text.includes('spring') || text.includes('elasticsearch')) {
    return [
      'ביצועים מרשימים, latency מתחת ל-25ms זה מטורף! ⚡',
      'ארכיטקטורת Event-Driven נקייה ומדויקת 🔥',
      'תודה על השיתוף, שמרתי לבדיקה אצלנו 💡',
    ];
  }
  return [
    'שיתוף מעולה, אהבתי מאוד את הגישה! 🔥',
    'ממש מעורר השראה — תודה על התובנה 🙌',
    'נראה מדהים ב-Obsidian Liquid Glass! ✨',
  ];
}

function normalizeRawPost(raw: RawFeedRecord, idx: number): PostCardData {
  const username = raw.authorUsername || 'member';
  const id = raw.postId ?? raw.id ?? `feed-${idx}-${Date.now()}`;
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
    isBookmarked: Boolean(raw.isBookmarked ?? raw.bookmarkedByMe),
    isRepost: Boolean(raw.isRepost),
    isReposted: Boolean(raw.isReposted),
    repostedByName: raw.repostedByName,
    isPinned: Boolean(raw.isPinned),
    poll: raw.poll ?? null,
    attachedEntity: raw.attachedEntity ?? null,
    originalPost: raw.originalPost ? normalizeRawPost(raw.originalPost, idx + 1000) : null,
  };
}

function createdPayloadToPostCard(
  created: CreatedPostPayload,
  fallbackUser: NavUserSummary
): PostCardData {
  return {
    id: created.id ?? Date.now(),
    authorId: created.authorId,
    authorUsername: created.authorUsername || fallbackUser.handle,
    authorName: created.authorName || fallbackUser.name,
    authorAvatar: created.authorAvatar || fallbackUser.avatarUrl,
    authorVerified: true,
    content: created.content,
    mediaUrls: created.mediaUrls ?? [],
    tags: created.tags ?? [],
    createdAt: created.createdAt || new Date().toISOString(),
    likesCount: created.likesCount ?? 0,
    commentsCount: created.commentsCount ?? 0,
    repostsCount: created.repostsCount ?? 0,
    isLiked: Boolean(created.isLiked),
    isBookmarked: Boolean(created.isBookmarked),
    poll: created.poll
      ? {
          id: created.poll.id,
          question: created.poll.question,
          totalVotes: created.poll.totalVotes ?? 0,
          hasVoted: Boolean(created.poll.hasVoted),
          options: created.poll.options.map((o) => ({
            id: o.id,
            text: o.text,
            voteCount: o.voteCount ?? 0,
            percentage: o.percentage ?? 0,
            isSelected: o.isSelected,
          })),
        }
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

export function SocialFlowHome() {
  const router = useRouter();
  const { unreadNotificationsCount } = useSocialStore();

  // Hydrated user state from localStorage("socialflow_user")
  const [authHydrated, setAuthHydrated] = useState(false);
  const [storedUser, setStoredUser] = useState<StoredUser>({
    userId: 1,
    username: 'idan',
    fullName: 'עידן קזם',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=idan',
  });

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
      // Ignore storage access issues
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

  // Feed State
  const [activeTab, setActiveTab] = useState<FeedTabKey>('for-you');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [posts, setPosts] = useState<PostCardData[]>(CURATED_FALLBACK_POSTS);
  const [isLoadingFeed, setIsLoadingFeed] = useState<boolean>(true);
  const [feedSource, setFeedSource] = useState<'live' | 'curated'>('curated');
  const [followingUsernames, setFollowingUsernames] = useState<string[]>(['noa', 'daniel']);
  const [trendingTags, setTrendingTags] = useState<TrendingTagItem[] | undefined>(undefined);

  // Stories Strip State (synced with /api/v1/stories when live)
  const [storiesStrip, setStoriesStrip] = useState<StoryStripItem[]>(STORIES_STRIP);

  // Search Modal State
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Comments Drawer/Modal State
  const [commentsPostId, setCommentsPostId] = useState<string | number | null>(null);
  const [commentsByPost, setCommentsByPost] =
    useState<Record<string, FeedCommentItem[]>>(INITIAL_COMMENTS_BY_POST);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [replyingToComment, setReplyingToComment] = useState<FeedCommentItem | null>(null);
  const [smartReplies, setSmartReplies] = useState<string[]>([]);
  const [smartRepliesLoading, setSmartRepliesLoading] = useState(false);

  // LangGraph Agent Modal State
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
  const [agentTopic, setAgentTopic] = useState('');
  const [agentAudience, setAgentAudience] = useState('קהילת מפתחי AI ו-Web');
  const [agentRunning, setAgentRunning] = useState(false);
  const [agentLogs, setAgentLogs] = useState<string[]>([]);
  const [agentDraft, setAgentDraft] = useState<string | null>(null);
  const [agentTags, setAgentTags] = useState<string[]>([]);
  const [agentPublishing, setAgentPublishing] = useState(false);

  // RAG Feed QA Modal State
  const [isRagModalOpen, setIsRagModalOpen] = useState(false);
  const [ragQuestion, setRagQuestion] = useState('');
  const [ragLoading, setRagLoading] = useState(false);
  const [ragResponse, setRagResponse] = useState<RagAskResponse | null>(null);

  // Toast State
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'info' | 'error';
  } | null>(null);

  const composerSectionRef = useRef<HTMLDivElement>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);

  const showToast = useCallback(
    (message: string, type: 'success' | 'info' | 'error' = 'success') => {
      setToast({ message, type });
      setTimeout(() => {
        setToast((prev) => (prev?.message === message ? null : prev));
      }, 3200);
    },
    []
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

  // Sync live stories strip from /api/v1/stories (graceful fallback to STORIES_STRIP)
  useEffect(() => {
    let cancelled = false;
    async function loadStoriesStrip() {
      try {
        const res = await fetch('/api/v1/stories', {
          credentials: 'include',
          headers: buildAuthHeaders(false),
        });
        if (!res.ok) return;
        const data = (await res.json()) as Array<{
          id?: string | number;
          username?: string;
          userAvatar?: string;
          mediaUrl?: string;
          caption?: string;
        }>;
        if (!cancelled && Array.isArray(data) && data.length > 0) {
          const seen = new Set<string>(['idan']);
          const liveOthers: StoryStripItem[] = [];
          for (const item of data) {
            const uname = item.username || '';
            if (!uname || seen.has(uname)) continue;
            seen.add(uname);
            liveOthers.push({
              id: `story-live-${item.id ?? uname}`,
              username: uname,
              name: uname,
              avatar:
                item.userAvatar ||
                `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(uname)}`,
              coverImage:
                item.mediaUrl ||
                'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=80',
              hasUnread: true,
              previewLabel: item.caption ? item.caption.slice(0, 14) : 'Live Story',
            });
          }
          if (liveOthers.length > 0) {
            setStoriesStrip([STORIES_STRIP[0], ...liveOthers, ...STORIES_STRIP.slice(1).filter((s) => !seen.has(s.username))]);
          }
        }
      } catch {
        // Keep STORIES_STRIP curated fallback
      }
    }
    loadStoriesStrip();
    return () => {
      cancelled = true;
    };
  }, [buildAuthHeaders]);

  // Load Trending Hashtags from feed-service with graceful fallback
  useEffect(() => {
    let cancelled = false;
    async function loadTrendingTags() {
      try {
        const res = await fetch('/api/v1/feed/trending-tags?limit=5', {
          credentials: 'include',
          headers: buildAuthHeaders(false),
        });
        if (!res.ok) return;
        const data = (await res.json()) as Array<{
          tag?: string;
          hashtag?: string;
          name?: string;
          count?: number;
          postsCount?: number;
        }>;
        if (!cancelled && Array.isArray(data) && data.length > 0) {
          const mapped: TrendingTagItem[] = data
            .map((item) => ({
              tag: (item.tag || item.hashtag || item.name || '').replace(/^#/, ''),
              postsCount: Number(item.postsCount ?? item.count ?? 120),
              category: 'Trending',
              trendDelta: '+Live',
            }))
            .filter((t) => Boolean(t.tag));
          if (mapped.length > 0) setTrendingTags(mapped);
        }
      } catch {
        // Keep RightBentoSidebar default curated tags
      }
    }
    loadTrendingTags();
    return () => {
      cancelled = true;
    };
  }, [buildAuthHeaders]);

  // Fetch Feed from /api/v1/feed/* with rich curated fallback
  const loadFeed = useCallback(
    async (tab: FeedTabKey, tag: string | null) => {
      setIsLoadingFeed(true);
      const userId = storedUser.userId ?? 1;

      const endpoint = tag
        ? `/api/v1/feed/search/tag?tag=${encodeURIComponent(tag)}&page=0&size=20`
        : tab === 'following'
        ? `/api/v1/feed/following?userId=${encodeURIComponent(String(userId))}&page=0&size=20`
        : tab === 'trending'
        ? `/api/v1/feed/trending?page=0&size=20`
        : `/api/v1/feed/for-you?userId=${encodeURIComponent(String(userId))}&page=0&size=20`;

      try {
        const res = await fetch(endpoint, {
          method: 'GET',
          credentials: 'include',
          headers: buildAuthHeaders(false),
        });

        if (res.ok) {
          const data = (await res.json()) as
            | RawFeedRecord[]
            | { content?: RawFeedRecord[] };
          const list = Array.isArray(data)
            ? data
            : Array.isArray(data?.content)
            ? data.content
            : [];

          let normalized = list.map((item, idx) => normalizeRawPost(item, idx));
          if (tab === 'media' && !tag) {
            normalized = normalized.filter((p) => p.mediaUrls && p.mediaUrls.length > 0);
          }

          if (normalized.length > 0) {
            setPosts(normalized);
            setFeedSource('live');
            setIsLoadingFeed(false);
            return;
          }
        }
      } catch {
        // Graceful fallback below
      }

      // Curated fallback filtered cleanly by activeTab / selectedTag
      let fallback = [...CURATED_FALLBACK_POSTS];
      if (tag) {
        const q = tag.toLowerCase();
        fallback = fallback.filter(
          (p) =>
            p.tags?.some((t) => t.toLowerCase().includes(q)) ||
            p.content.toLowerCase().includes(q)
        );
      } else if (tab === 'following') {
        fallback = fallback.filter(
          (p) =>
            followingUsernames.includes(p.authorUsername) ||
            p.authorUsername === (storedUser.username || 'idan')
        );
      } else if (tab === 'media') {
        fallback = fallback.filter((p) => p.mediaUrls && p.mediaUrls.length > 0);
      } else if (tab === 'trending') {
        fallback.sort((a, b) => (b.likesCount ?? 0) - (a.likesCount ?? 0));
      }

      setPosts(fallback);
      setFeedSource('curated');
      setIsLoadingFeed(false);
    },
    [storedUser.userId, storedUser.username, followingUsernames, buildAuthHeaders]
  );

  useEffect(() => {
    loadFeed(activeTab, selectedTag);
  }, [activeTab, selectedTag, loadFeed]);

  // Handlers
  const handleTabChange = (tab: FeedTabKey) => {
    setSelectedTag(null);
    setActiveTab(tab);
  };

  const handleSelectTag = (tag: string | null) => {
    const clean = tag ? tag.replace(/^#/, '').trim() : null;
    setSelectedTag(clean || null);
  };

  const handleFocusComposer = () => {
    composerSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const textarea = composerSectionRef.current?.querySelector('textarea');
    if (textarea) {
      textarea.focus();
    }
  };

  const handlePostCreated = (created: CreatedPostPayload) => {
    const card = createdPayloadToPostCard(created, navUser);
    setPosts((prev) => [card, ...prev]);
    showToast('הפוסט פורסם בהצלחה בפיד! 🚀', 'success');
  };

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
    } else if (item.type === 'post') {
      const existing = posts.find((p) => String(p.id) === String(item.id));
      if (!existing && item.content) {
        setPosts((prev) => [
          {
            id: item.id,
            authorUsername: item.authorUsername || 'member',
            authorName: item.authorName || item.title,
            authorAvatar: item.authorAvatar,
            content: item.content,
            tags: item.tags,
            createdAt: item.createdAt || new Date().toISOString(),
            likesCount: item.likesCount ?? 0,
            commentsCount: 0,
          },
          ...prev,
        ]);
      }
      showToast(`נבחר פוסט של ${item.authorName || item.title}`, 'info');
    }
  };

  // Comments Drawer Handlers + AI Smart Replies
  const handleOpenComments = async (postId: number | string) => {
    const key = String(postId);
    const targetPost = posts.find((p) => String(p.id) === key);

    setCommentsPostId(postId);
    setNewCommentText('');
    setReplyingToComment(null);
    setCommentsLoading(true);
    setSmartRepliesLoading(true);
    setSmartReplies(buildContextualSmartReplies(targetPost));

    const fetchCommentsPromise = (async () => {
      try {
        const res = await fetch(`/api/v1/posts/${encodeURIComponent(key)}/comments`, {
          method: 'GET',
          credentials: 'include',
          headers: buildAuthHeaders(false),
        });
        if (res.ok) {
          const list = (await res.json()) as Array<{
            id?: string | number;
            postId?: string | number;
            authorUsername?: string;
            authorAvatar?: string;
            content?: string;
            createdAt?: string;
            parentId?: string | number;
            replyToUsername?: string;
          }>;
          if (Array.isArray(list) && list.length > 0) {
            setCommentsByPost((prev) => {
              const existingById = new Map((prev[key] ?? []).map((item) => [item.id, item]));
              const mapped: FeedCommentItem[] = list.map((c, idx) => {
                const cid = String(c.id ?? `c-${idx}`);
                const uname = c.authorUsername || 'member';
                const prevItem = existingById.get(cid);
                return {
                  id: cid,
                  postId,
                  authorName: uname === 'idan' ? 'עידן קזם' : `@${uname}`,
                  authorUsername: uname,
                  authorAvatar:
                    c.authorAvatar ||
                    `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(uname)}`,
                  content: c.content || '',
                  createdAt: formatCommentTime(c.createdAt || ''),
                  parentId: c.parentId !== undefined ? String(c.parentId) : prevItem?.parentId,
                  replyToUsername: c.replyToUsername ?? prevItem?.replyToUsername,
                };
              });
              const mappedIds = new Set(mapped.map((m) => m.id));
              const localPending = (prev[key] ?? []).filter(
                (item) => item.id.startsWith('temp-') && !mappedIds.has(item.id)
              );
              return { ...prev, [key]: [...localPending, ...mapped] };
            });
          }
        }
      } catch {
        // Keep local/initial comments fallback
      } finally {
        setCommentsLoading(false);
      }
    })();

    const fetchSmartRepliesPromise = (async () => {
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
          if (cleaned.length > 0) {
            setSmartReplies(cleaned);
          }
        }
      } catch {
        // Keep contextual fallback smart replies
      } finally {
        setSmartRepliesLoading(false);
      }
    })();

    await Promise.allSettled([fetchCommentsPromise, fetchSmartRepliesPromise]);
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentsPostId || !newCommentText.trim() || submittingComment) return;

    const key = String(commentsPostId);
    const trimmed = newCommentText.trim();
    const replyTarget = replyingToComment;
    const tempId = `temp-${Date.now()}`;
    const optimisticComment: FeedCommentItem = {
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
      [key]: replyTarget
        ? [...(prev[key] ?? []), optimisticComment]
        : [optimisticComment, ...(prev[key] ?? [])],
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
      showToast('התגובה נוספה לפוסט! 💬', 'success');
    } catch {
      showToast('התגובה נשמרה מקומית (מצב אופליין)', 'info');
    } finally {
      setSubmittingComment(false);
    }
  };

  // LangGraph Autonomous Agent Handlers
  const handleRunAgent = async () => {
    if (!agentTopic.trim() || agentRunning) return;
    setAgentRunning(true);
    setAgentDraft(null);
    setAgentTags([]);
    setAgentLogs([
      '🔍 research_trends: סורק מגמות ופוסטים מובילים ב-feed-service...',
      '✍️ draft_post: מנסח פוסט מותאם לקהל היעד עם Gemini AI...',
      '🛡️ moderate_content: מוודא בטיחות תוכן ותאימות BiDi...',
    ]);

    try {
      const res = await fetch('/api/v1/ai/agent/run', {
        method: 'POST',
        credentials: 'include',
        headers: buildAuthHeaders(true),
        body: JSON.stringify({
          topic: agentTopic.trim(),
          user_id: Number(storedUser.userId) || 1,
          target_audience: agentAudience.trim() || 'קהילת מפתחי AI ו-Web',
          user_approved: false,
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as AgentRunResponse;
        if (Array.isArray(data.logs) && data.logs.length > 0) {
          setAgentLogs(data.logs);
        } else {
          setAgentLogs((prev) => [...prev, '✅ טיוטה מוכנה לאישור אנושי (Human-in-the-Loop)!']);
        }
        setAgentDraft(
          data.draft_content ||
            `תובנה חכמה על "${agentTopic.trim()}": שילוב של Next.js 15, ארכיטקטורת מיקרוסרוויסים מבוססת Kafka וסוכני LangGraph מאפשר יצירת רשתות חברתיות מהירות ובטוחות בזמן אמת. 🚀`
        );
        setAgentTags(
          Array.isArray(data.suggested_tags) && data.suggested_tags.length > 0
            ? data.suggested_tags
            : ['LangGraph', 'AI_Agents', 'SocialFlow']
        );
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch {
      setAgentLogs((prev) => [
        ...prev,
        '⚠️ שירות AI מרוחק לא זמין — הופקה טיוטת fallback חכמה לאישור.',
      ]);
      setAgentDraft(
        `ניתוח מגמות עבור "${agentTopic.trim()}":\nבניית מערכות מבוזרות עם Next.js 15, Spring Boot 3, Kafka וסוכני LangGraph מאפשרת תגובות בזמן אמת (0ms Optimistic UI) וחיפוש RAG מבוסס הקשר. ✨`
      );
      setAgentTags(['LangGraph', 'Nextjs15', 'SocialFlow']);
    } finally {
      setAgentRunning(false);
    }
  };

  const handleApproveAgentPost = async () => {
    if (!agentDraft || agentPublishing) return;
    setAgentPublishing(true);

    const payload = {
      content: agentDraft,
      mediaUrls: [],
      tags: agentTags.length > 0 ? agentTags : ['LangGraph', 'AI_Agent'],
      visibility: 'PUBLIC',
    };

    let createdCard: PostCardData = {
      id: Date.now(),
      authorId: storedUser.userId ?? 1,
      authorUsername: navUser.handle,
      authorName: `${navUser.name} · AI Agent`,
      authorAvatar: navUser.avatarUrl,
      authorVerified: true,
      content: agentDraft,
      tags: payload.tags,
      createdAt: new Date().toISOString(),
      likesCount: 0,
      commentsCount: 0,
      repostsCount: 0,
      attachedEntity: {
        entityType: 'AI_AGENT',
        title: 'נוצר בסיוע סוכן LangGraph אוטונומי',
        badge: 'Human-Approved',
      },
    };

    let didPublish = false;
    try {
      const res = await fetch('/api/v1/posts', {
        method: 'POST',
        credentials: 'include',
        headers: buildAuthHeaders(true),
        body: JSON.stringify(payload),
      });
      if (res.status === 401 || res.status === 403) {
        clearStoredAuthToken();
        setStoredUser((prev) => ({ ...prev, token: undefined }));
        showToast('פג תוקף ההתחברות — יש להתחבר מחדש ב-/login כדי לפרסם לשרת ול-Kafka.', 'error');
        return;
      }
      if (res.ok) {
        const saved = (await res.json()) as CreatedPostPayload;
        createdCard = createdPayloadToPostCard(saved, navUser);
      }
      didPublish = true;
    } catch {
      // Optimistic local prepend preserved
      didPublish = true;
    } finally {
      setAgentPublishing(false);
      if (didPublish) {
        setPosts((prev) => [createdCard, ...prev]);
        setIsAgentModalOpen(false);
        setAgentDraft(null);
        setAgentTopic('');
        setAgentLogs([]);
        showToast('פוסט סוכן ה-AI אושר ופורסם בפיד! 🤖🚀', 'success');
      }
    }
  };

  // RAG Feed QA Handlers
  const runRagQuery = useCallback(
    async (questionToAsk: string) => {
      const q = questionToAsk.trim();
      if (!q) return;
      setRagLoading(true);
      setRagResponse(null);

      try {
        const res = await fetch('/api/v1/ai/ask-feed', {
          method: 'POST',
          credentials: 'include',
          headers: buildAuthHeaders(true),
          body: JSON.stringify({
            question: q,
            posts: posts.slice(0, 15).map((p) => ({
              id: p.id,
              postId: p.id,
              authorUsername: p.authorUsername,
              content: p.content,
              tags: p.tags,
              poll: p.poll,
            })),
          }),
        });

        if (res.ok) {
          const data = (await res.json()) as RagAskResponse;
          setRagResponse(data);
        } else {
          throw new Error(`HTTP ${res.status}`);
        }
      } catch {
        const matching = posts.filter(
          (p) =>
            p.content.toLowerCase().includes(q.toLowerCase()) ||
            p.tags?.some((t) => t.toLowerCase().includes(q.toLowerCase()))
        );
        const contextSample = (matching.length > 0 ? matching : posts).slice(0, 3);
        setRagResponse({
          answer:
            contextSample.length > 0
              ? `על פי סריקת ${posts.length} הפוסטים הפעילים בפיד עבור "${q}":\n${contextSample
                  .map((p) => `• @${p.authorUsername}: ${p.content.slice(0, 110)}...`)
                  .join('\n')}`
              : 'לא נמצאו פוסטים תואמים לשאלה בפיד הנוכחי.',
          relevant_posts_count: contextSample.length,
          model_used: 'local-rag-fallback',
          sources: contextSample.map((p) => p.id),
        });
      } finally {
        setRagLoading(false);
      }
    },
    [posts, buildAuthHeaders]
  );

  const handleOpenRagWithQuery = (query: string) => {
    setRagQuestion(query);
    setIsRagModalOpen(true);
    void runRagQuery(query);
  };

  const activeCommentsList = commentsPostId ? commentsByPost[String(commentsPostId)] ?? [] : [];
  const activeCommentsPost = commentsPostId
    ? posts.find((p) => String(p.id) === String(commentsPostId))
    : undefined;

  const { rootComments, childrenByParent } = useMemo(() => {
    const idSet = new Set(activeCommentsList.map((c) => c.id));
    const map = new Map<string, FeedCommentItem[]>();
    const roots: FeedCommentItem[] = [];

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

  const renderCommentNode = (comment: FeedCommentItem, depth = 0): React.ReactNode => {
    const replies = childrenByParent.get(comment.id) ?? [];
    const hasReplies = replies.length > 0;

    return (
      <div key={comment.id} className="space-y-2">
        <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-[#090A0F]/60 p-3.5 hover:border-indigo-500/30 transition-colors">
          <div className="flex flex-col items-center shrink-0">
            <button
              type="button"
              onClick={() => {
                setCommentsPostId(null);
                router.push(`/profile/${encodeURIComponent(comment.authorUsername)}`);
              }}
              className="rounded-full cursor-pointer"
            >
              <img
                src={comment.authorAvatar}
                alt={comment.authorName}
                className="h-8 w-8 rounded-full border border-white/15 object-cover"
              />
            </button>
            {hasReplies && (
              <div
                aria-hidden="true"
                className="w-0.5 flex-1 min-h-[18px] mt-1.5 rounded-full bg-gradient-to-b from-[#6366F1]/75 via-[#8B5CF6]/45 to-transparent"
              />
            )}
          </div>

          <div className="min-w-0 flex-1 text-start">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <button
                  type="button"
                  onClick={() => {
                    setCommentsPostId(null);
                    router.push(`/profile/${encodeURIComponent(comment.authorUsername)}`);
                  }}
                  className="text-xs font-bold text-[#F8FAFC] hover:text-[#6366F1] transition-colors truncate cursor-pointer"
                >
                  {comment.authorName}
                </button>
                <span className="font-mono text-[10px] text-[#64748B] truncate">
                  @{comment.authorUsername}
                </span>
              </div>
              <span className="font-mono text-[10px] text-[#64748B] shrink-0">
                {comment.createdAt}
              </span>
            </div>

            {comment.replyToUsername && (
              <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-mono text-[#8B5CF6]">
                <CornerDownRight className="h-3 w-3" />
                <span>בתגובה ל-@{comment.replyToUsername}</span>
              </div>
            )}

            <p dir="auto" className="mt-1 text-xs sm:text-sm leading-relaxed text-[#94A3B8]">
              {comment.content}
            </p>

            <div className="mt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setReplyingToComment(comment);
                  setTimeout(() => commentInputRef.current?.focus(), 20);
                }}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-300 hover:text-indigo-200 transition-colors cursor-pointer"
              >
                <CornerDownRight className="h-3 w-3" />
                <span>הגב</span>
              </button>
            </div>
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
      activePath="/"
      selectedTag={selectedTag}
      onSelectTag={handleSelectTag}
      onOpenSearch={() => setIsSearchOpen(true)}
      onOpenComposer={handleFocusComposer}
      onOpenAgent={() => setIsAgentModalOpen(true)}
      onSelectSearchResult={handleSearchResult}
      onAskAI={handleOpenRagWithQuery}
      unreadNotificationsCount={unreadNotificationsCount}
      mobileTitle="SocialFlow"
      leftRail={
        <LeftNavRail
          activePath="/"
          user={navUser}
          unreadNotificationsCount={unreadNotificationsCount}
          onNewPost={handleFocusComposer}
          onOpenAgent={() => setIsAgentModalOpen(true)}
        />
      }
      rightSidebar={
        <RightBentoSidebar
          onOpenSearch={() => setIsSearchOpen(true)}
          selectedTag={selectedTag}
          onSelectTag={handleSelectTag}
          trendingTags={trendingTags}
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

      {/* 1. Compact Stories Strip linking to /stories */}
      <section
        aria-label="סטוריז פעילים"
        className="rounded-[20px] border border-white/10 bg-[#121521]/72 backdrop-blur-xl p-3.5 shadow-[0_12px_36px_-12px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.08)]"
      >
        <div className="flex items-center justify-between mb-2.5 px-1">
          <div className="flex items-center gap-2">
            <Clapperboard className="h-4 w-4 text-[#8B5CF6]" />
            <h2 className="text-xs sm:text-sm font-bold text-[#F8FAFC]">סטוריז חיים</h2>
            <BadgePill variant="emerald" pulseDot size="sm">
              LIVE
            </BadgePill>
          </div>
          <Link
            href="/stories"
            className="text-xs font-semibold text-indigo-300 hover:text-indigo-200 transition-colors no-underline"
          >
            נגן מסך מלא ←
          </Link>
        </div>

        <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar scroll-smooth snap-x pb-0.5">
          {storiesStrip.map((story, idx) => (
            <Link
              key={story.id}
              href="/stories"
              className="group relative flex w-[104px] h-[132px] shrink-0 flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-[#090A0F] p-2.5 transition-all hover:border-indigo-500/50 hover:-translate-y-0.5 no-underline"
            >
              <img
                src={story.coverImage}
                alt={story.name}
                className="absolute inset-0 h-full w-full object-cover opacity-55 transition-transform duration-300 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-[#090A0F]/60 via-transparent to-[#090A0F]/95" />

              <div className="relative z-10 flex items-center justify-between">
                <div
                  className={`h-8 w-8 rounded-full p-[2px] ${
                    story.hasUnread
                      ? 'bg-gradient-to-tr from-[#6366F1] via-[#8B5CF6] to-[#10B981]'
                      : 'bg-white/25'
                  }`}
                >
                  <img
                    src={story.avatar}
                    alt={story.name}
                    className="h-full w-full rounded-full bg-[#090A0F] object-cover"
                  />
                </div>
                {idx === 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#6366F1] text-white shadow">
                    <Plus className="h-3 w-3" />
                  </span>
                )}
              </div>

              <div className="relative z-10 text-start">
                <p className="truncate text-[11px] font-bold text-[#F8FAFC]">{story.name}</p>
                <p className="truncate font-mono text-[10px] text-indigo-300">
                  {story.previewLabel}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 2. Sticky FeedHeaderTabs + AI RAG Trigger */}
      <FeedHeaderTabs
        activeTab={activeTab}
        onTabChange={handleTabChange}
        activeHashtag={selectedTag}
        onClearHashtag={() => handleSelectTag(null)}
        rightSlot={
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setIsRagModalOpen(true);
              }}
              aria-label="שאל את AI RAG על הפיד"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#8B5CF6]/35 bg-[#8B5CF6]/15 px-2.5 py-1.5 text-xs font-semibold text-violet-200 hover:bg-[#8B5CF6]/25 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5 text-[#8B5CF6]" />
              <span className="hidden sm:inline">שאל AI</span>
            </button>
            <button
              type="button"
              onClick={() => loadFeed(activeTab, selectedTag)}
              title="רענן פיד"
              aria-label="רענן פיד"
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-[#94A3B8] hover:border-indigo-500/40 hover:text-[#F8FAFC] transition-colors cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoadingFeed ? 'animate-spin text-[#6366F1]' : ''}`} />
            </button>
          </div>
        }
      />

      {/* 3. PostComposerCard (MinIO upload + Polls + Gemini Analyze + POST /api/v1/posts) */}
      <div ref={composerSectionRef} className="space-y-3">
        {authHydrated && !storedUser.token && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-400/25 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-100">
            <span className="inline-flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-300 shrink-0" />
              <span>אינך מחובר כרגע (או שפג תוקף ה-JWT) — פוסטים לא יישלחו לשרת ול-Kafka עד שתתחבר.</span>
            </span>
            <Link
              href="/login"
              className="rounded-lg bg-amber-400/20 px-3 py-1 font-semibold text-amber-100 hover:bg-amber-400/30 transition-colors"
            >
              התחברות / הרשמה
            </Link>
          </div>
        )}
        <PostComposerCard
          currentUser={{
            id: storedUser.userId ?? 1,
            username: navUser.handle,
            name: navUser.name,
            avatarUrl: navUser.avatarUrl,
          }}
          authToken={storedUser.token ?? null}
          onPostCreated={handlePostCreated}
          onAuthRequired={() => setStoredUser((prev) => ({ ...prev, token: undefined }))}
        />
      </div>

      {/* 4. Feed Stream Status Strip */}
      <div className="flex items-center justify-between px-1 text-[11px] font-mono text-[#64748B]">
        <span className="inline-flex items-center gap-1.5">
          <span
            className={`h-2 w-2 rounded-full ${
              feedSource === 'live' ? 'bg-[#10B981] shadow-[0_0_8px_#10B981]' : 'bg-[#6366F1]'
            }`}
          />
          <span>
            {feedSource === 'live'
              ? 'Live Gateway Feed (/api/v1/feed)'
              : 'Curated Obsidian Stream'}
          </span>
        </span>
        <span>{posts.length} posts</span>
      </div>

      {/* 5. PostCard Stream */}
      {isLoadingFeed ? (
        <div className="space-y-4">
          <PostCardSkeleton />
          <PostCardSkeleton />
          <PostCardSkeleton />
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-[#121521]/72 backdrop-blur-xl p-10 text-center space-y-3">
          <p className="text-base font-bold text-[#F8FAFC]">לא נמצאו פוסטים בסינון הנוכחי</p>
          <p className="text-sm text-[#94A3B8]">
            נסה לנקות את סינון התגית או לעבור ללשונית &quot;בשבילך&quot;.
          </p>
          <div className="pt-2">
            <GradientButton
              size="sm"
              onClick={() => {
                setSelectedTag(null);
                setActiveTab('for-you');
              }}
            >
              חזרה לכל הפיד
            </GradientButton>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard
              key={String(post.id)}
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
              onRepost={(postId, quoteComment, createdRepost) => {
                const targetPost = posts.find((p) => String(p.id) === String(postId));
                setPosts((prev) => {
                  const updated = prev.map((p) =>
                    String(p.id) === String(postId)
                      ? {
                          ...p,
                          isReposted: true,
                          repostsCount: (p.repostsCount ?? 0) + 1,
                        }
                      : p
                  );
                  if (quoteComment && targetPost) {
                    const normalizedQuote: PostCardData = createdRepost
                      ? {
                          ...normalizeRawPost(createdRepost as unknown as RawFeedRecord, 0),
                          authorName: createdRepost.authorName || navUser.name,
                          authorAvatar: createdRepost.authorAvatar || navUser.avatarUrl,
                          originalPost:
                            createdRepost.originalPost ?? targetPost,
                        }
                      : {
                          id: `quote-${Date.now()}`,
                          authorId: storedUser.userId ?? 1,
                          authorUsername: navUser.handle,
                          authorName: navUser.name,
                          authorAvatar: navUser.avatarUrl,
                          authorVerified: true,
                          content: quoteComment,
                          quoteComment,
                          createdAt: new Date().toISOString(),
                          likesCount: 0,
                          commentsCount: 0,
                          repostsCount: 0,
                          isRepost: true,
                          repostedByName: navUser.name,
                          originalPost: targetPost,
                        };
                    return [normalizedQuote, ...updated];
                  }
                  return updated;
                });
                showToast(
                  quoteComment ? 'הציטוט פורסם בפיד! 🔁✨' : 'הפוסט שותף מחדש! 🔁',
                  'success'
                );
              }}
              onPinChange={(postId, nextPinned) => {
                setPosts((prev) =>
                  prev.map((p) =>
                    String(p.id) === String(postId) ? { ...p, isPinned: nextPinned } : p
                  )
                );
                showToast(
                  nextPinned ? 'הפוסט הוצמד בהצלחה 📌' : 'הצמדת הפוסט בוטלה',
                  'info'
                );
              }}
              onDeletePost={(postId) => {
                setPosts((prev) => prev.filter((p) => String(p.id) !== String(postId)));
                showToast('הפוסט נמחק בהצלחה 🗑️', 'info');
              }}
              onBookmarkChange={(postId, bookmarked) => {
                setPosts((prev) =>
                  prev.map((p) =>
                    String(p.id) === String(postId) ? { ...p, isBookmarked: bookmarked } : p
                  )
                );
                showToast(
                  bookmarked ? 'הפוסט נשמר בסימניות 🔖' : 'הוסר מהסימניות',
                  'info'
                );
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
          ))}
        </div>
      )}

      {/* Controlled Ctrl+K Command Search Modal */}
      <CommandSearchModal
        isOpen={isSearchOpen}
        onOpen={() => setIsSearchOpen(true)}
        onClose={() => setIsSearchOpen(false)}
        onSelectTag={(tag) => handleSelectTag(tag)}
        onSelectResult={handleSearchResult}
        onAskAI={handleOpenRagWithQuery}
      />

      {/* Comments Drawer / Modal */}
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
                {/* AI Smart Replies Chips */}
                {(smartReplies.length > 0 || smartRepliesLoading) && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-indigo-300">
                      <span className="inline-flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-[#8B5CF6]" />
                        <span>AI Smart Replies</span>
                      </span>
                      {smartRepliesLoading && (
                        <Loader2 className="h-3 w-3 animate-spin text-[#8B5CF6]" />
                      )}
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
                          className="rounded-full border border-[#8B5CF6]/35 bg-[#8B5CF6]/12 px-3 py-1 text-xs font-medium text-violet-200 hover:border-[#8B5CF6]/60 hover:bg-[#8B5CF6]/25 transition-colors cursor-pointer text-start"
                        >
                          {reply}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Dismissible @username Reply Banner */}
                <AnimatePresence>
                  {replyingToComment && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      className="flex items-center justify-between gap-2 rounded-xl border border-[#6366F1]/35 bg-[#6366F1]/12 px-3 py-1.5 text-xs text-indigo-200"
                    >
                      <span className="inline-flex items-center gap-1.5 truncate">
                        <CornerDownRight className="h-3.5 w-3.5 text-[#6366F1] shrink-0" />
                        <span>משיב לתגובה של</span>
                        <span className="font-mono font-bold">
                          @{replyingToComment.authorUsername}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setReplyingToComment(null)}
                        aria-label="בטל מענה לתגובה"
                        className="rounded-lg p-1 text-indigo-300 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                <form onSubmit={handleSubmitComment} className="flex items-center gap-2">
                  <input
                    ref={commentInputRef}
                    type="text"
                    dir="auto"
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    placeholder={
                      replyingToComment
                        ? `הגב ל-@${replyingToComment.authorUsername}...`
                        : 'כתוב תגובה עניינית...'
                    }
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

      {/* LangGraph Autonomous AI Agent Modal */}
      <AnimatePresence>
        {isAgentModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsAgentModalOpen(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#090A0F]/80 backdrop-blur-md p-4"
            role="dialog"
            aria-modal="true"
            aria-label="סוכן תוכן אוטונומי LangGraph"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl rounded-3xl border border-[#8B5CF6]/40 bg-[#121521]/95 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.85)] backdrop-blur-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-[#6366F1] to-[#8B5CF6] text-white">
                    <Bot className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-[#F8FAFC]">
                      סוכן תוכן אוטונומי (LangGraph Agent)
                    </h3>
                    <p className="font-mono text-[11px] text-[#94A3B8]">
                      POST /api/v1/ai/agent/run · Human-in-the-Loop
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAgentModalOpen(false)}
                  className="rounded-xl p-1.5 text-[#94A3B8] hover:bg-white/10 hover:text-[#F8FAFC] cursor-pointer"
                  aria-label="סגור סוכן AI"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#94A3B8]">
                    נושא הפוסט למחקר וניסוח:
                  </label>
                  <input
                    type="text"
                    dir="auto"
                    value={agentTopic}
                    onChange={(e) => setAgentTopic(e.target.value)}
                    placeholder="למשל: ארכיטקטורת מיקרוסרוויסים ב-Next.js 15 וסוכני AI..."
                    className="w-full rounded-2xl border border-white/10 bg-[#090A0F]/80 px-4 py-3 text-sm text-[#F8FAFC] placeholder-[#64748B] outline-none focus:border-[#6366F1]"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-[#94A3B8]">
                    קהל יעד מותאם:
                  </label>
                  <input
                    type="text"
                    dir="auto"
                    value={agentAudience}
                    onChange={(e) => setAgentAudience(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#090A0F]/80 px-4 py-2.5 text-xs text-[#F8FAFC] outline-none focus:border-[#6366F1]"
                  />
                </div>

                <GradientButton
                  type="button"
                  fullWidth
                  onClick={handleRunAgent}
                  disabled={!agentTopic.trim() || agentRunning}
                  isLoading={agentRunning}
                  leftIcon={<Sparkles className="h-4 w-4" />}
                >
                  {agentRunning ? 'הסוכן חוקר, מנסח ומאמת...' : 'הפעל סוכן LangGraph אוטונומי'}
                </GradientButton>

                {agentLogs.length > 0 && (
                  <div className="max-h-32 overflow-y-auto rounded-2xl border border-white/10 bg-[#090A0F]/90 p-3.5 font-mono text-xs text-[#94A3B8] space-y-1">
                    {agentLogs.map((log, i) => (
                      <div key={i} dir="auto">
                        {log}
                      </div>
                    ))}
                  </div>
                )}

                {agentDraft && (
                  <div className="rounded-2xl border border-indigo-500/40 bg-[#6366F1]/10 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-indigo-300">
                        טיוטה מוכנה לאישור אנושי:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {agentTags.map((t) => (
                          <span
                            key={t}
                            className="rounded-full bg-white/10 px-2 py-0.5 font-mono text-[10px] text-indigo-200"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    </div>
                    <p
                      dir="auto"
                      className="whitespace-pre-wrap text-sm leading-relaxed text-[#F8FAFC]"
                    >
                      {agentDraft}
                    </p>
                    <GradientButton
                      type="button"
                      fullWidth
                      onClick={handleApproveAgentPost}
                      isLoading={agentPublishing}
                      leftIcon={<CheckCircle2 className="h-4 w-4" />}
                    >
                      אשר ופרסם לפיד מיידית
                    </GradientButton>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* RAG Feed QA Modal (triggered by CommandSearchModal onAskAI or Feed Header) */}
      <AnimatePresence>
        {isRagModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsRagModalOpen(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#090A0F]/80 backdrop-blur-md p-4"
            role="dialog"
            aria-modal="true"
            aria-label="עוזר RAG חכם על הפיד"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl rounded-3xl border border-indigo-500/40 bg-[#121521]/95 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.85)] backdrop-blur-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-[#6366F1] to-[#8B5CF6] text-white">
                    <Sparkles className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-[#F8FAFC]">
                      שאל את ה-AI על הפיד (RAG Feed QA)
                    </h3>
                    <p className="font-mono text-[11px] text-[#94A3B8]">
                      POST /api/v1/ai/ask-feed · Gemini Grounded Q&amp;A
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsRagModalOpen(false)}
                  className="rounded-xl p-1.5 text-[#94A3B8] hover:bg-white/10 hover:text-[#F8FAFC] cursor-pointer"
                  aria-label="סגור RAG QA"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void runRagQuery(ragQuestion);
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  dir="auto"
                  value={ragQuestion}
                  onChange={(e) => setRagQuestion(e.target.value)}
                  placeholder="שאל כל שאלה על הפוסטים והדיונים בפיד..."
                  className="flex-1 rounded-2xl border border-white/10 bg-[#090A0F]/80 px-4 py-3 text-sm text-[#F8FAFC] placeholder-[#64748B] outline-none focus:border-[#6366F1]"
                />
                <GradientButton
                  type="submit"
                  disabled={!ragQuestion.trim() || ragLoading}
                  isLoading={ragLoading}
                  leftIcon={<Sparkles className="h-4 w-4" />}
                >
                  נתח פיד
                </GradientButton>
              </form>

              {ragLoading && (
                <div className="flex items-center justify-center gap-2.5 rounded-2xl border border-white/10 bg-[#090A0F]/65 p-6 text-sm text-[#94A3B8]">
                  <Loader2 className="h-4 w-4 animate-spin text-[#6366F1]" />
                  <span>סורק את הפוסטים ומגבש תשובה מבוססת הקשר...</span>
                </div>
              )}

              {ragResponse && !ragLoading && (
                <div className="rounded-2xl border border-indigo-500/35 bg-[#090A0F]/75 p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <BadgePill variant="indigo" size="sm">
                      {ragResponse.model_used || 'Gemini RAG'}
                    </BadgePill>
                    {ragResponse.relevant_posts_count !== undefined && (
                      <span className="font-mono text-[11px] text-[#94A3B8]">
                        מבוסס על {ragResponse.relevant_posts_count} פוסטים
                      </span>
                    )}
                  </div>
                  <p
                    dir="auto"
                    className="whitespace-pre-wrap text-sm leading-relaxed text-[#F8FAFC]"
                  >
                    {ragResponse.answer}
                  </p>
                  {Array.isArray(ragResponse.sources) && ragResponse.sources.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-white/10">
                      <span className="text-[11px] text-[#64748B]">מקורות:</span>
                      {ragResponse.sources.map((srcId) => (
                        <span
                          key={String(srcId)}
                          className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 font-mono text-[11px] text-indigo-300"
                        >
                          Post #{srcId}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppShell>
  );
}

export default SocialFlowHome;
