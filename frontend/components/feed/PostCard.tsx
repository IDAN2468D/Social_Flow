'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BadgeCheck,
  Heart,
  MessageCircle,
  Repeat2,
  Bookmark,
  Share2,
  BarChart3,
  Check,
  MoreHorizontal,
  X,
  ChevronLeft,
  ChevronRight,
  Pin,
  CornerDownRight,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';

export interface PostPollOptionData {
  id: number;
  text: string;
  voteCount?: number;
  votes?: number;
  percentage?: number;
  isSelected?: boolean;
}

export interface PostPollData {
  id?: number;
  question: string;
  options: PostPollOptionData[];
  totalVotes?: number;
  isExpired?: boolean;
  hasVoted?: boolean;
  selectedOptionId?: number | null;
  expiresAt?: string;
}

export interface AttachedEntityData {
  entityType: 'PRODUCT' | 'ITEM' | 'ACHIEVEMENT' | 'EVENT' | string;
  entityId?: string;
  title: string;
  thumbnailUrl?: string;
  badge?: string;
}

export interface PostCardData {
  id: number | string;
  authorId?: number | string;
  authorUsername: string;
  authorName?: string;
  authorAvatar?: string;
  authorVerified?: boolean;
  content: string;
  mediaUrls?: string[];
  tags?: string[];
  createdAt: string;
  likesCount?: number;
  commentsCount?: number;
  commentCount?: number;
  repostsCount?: number;
  isLiked?: boolean;
  isBookmarked?: boolean;
  isReposted?: boolean;
  isPinned?: boolean;
  isRepost?: boolean;
  repostedByName?: string;
  replyToUsername?: string;
  isThreadReply?: boolean;
  hasThreadContinuation?: boolean;
  poll?: PostPollData | null;
  attachedEntity?: AttachedEntityData | null;
  originalPost?: PostCardData | null;
}

export interface PostCardProps {
  post: PostCardData;
  apiBaseUrl?: string;
  authToken?: string | null;
  currentUserId?: string | number;
  currentUsername?: string;
  onHashtagClick?: (tag: string) => void;
  onAuthorClick?: (username: string) => void;
  onCommentClick?: (postId: number | string) => void;
  onLikeChange?: (postId: number | string, liked: boolean, likesCount: number) => void;
  onRepost?: (postId: number | string) => void;
  onBookmarkChange?: (postId: number | string, bookmarked: boolean) => void;
  onShare?: (postId: number | string) => void;
  onPollVoted?: (postId: number | string, updatedPoll: PostPollData) => void;
  className?: string;
}

function formatRelativeTime(isoOrText: string): string {
  if (!isoOrText) return '';
  const date = new Date(isoOrText);
  if (Number.isNaN(date.getTime())) return isoOrText;

  const diffSeconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSeconds < 60) return 'עכשיו';
  if (diffSeconds < 3600) return `לפני ${Math.floor(diffSeconds / 60)} דק׳`;
  if (diffSeconds < 86400) return `לפני ${Math.floor(diffSeconds / 3600)} שע׳`;
  if (diffSeconds < 604800) return `לפני ${Math.floor(diffSeconds / 86400)} ימים`;
  return date.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
}

export function PostCard({
  post,
  apiBaseUrl = '',
  authToken = null,
  currentUserId = 1,
  currentUsername = 'idan',
  onHashtagClick,
  onAuthorClick,
  onCommentClick,
  onLikeChange,
  onRepost,
  onBookmarkChange,
  onShare,
  onPollVoted,
  className = '',
}: PostCardProps) {
  const [liked, setLiked] = useState<boolean>(Boolean(post.isLiked));
  const [likesCount, setLikesCount] = useState<number>(post.likesCount ?? 0);
  const [reposted, setReposted] = useState<boolean>(Boolean(post.isReposted));
  const [repostsCount, setRepostsCount] = useState<number>(post.repostsCount ?? 0);
  const [bookmarked, setBookmarked] = useState<boolean>(Boolean(post.isBookmarked));
  const [sharedToast, setSharedToast] = useState<boolean>(false);

  const [pollState, setPollState] = useState<PostPollData | null>(post.poll ?? null);
  const [votingOptionId, setVotingOptionId] = useState<number | null>(null);

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    setLiked(Boolean(post.isLiked));
    setLikesCount(post.likesCount ?? 0);
    setReposted(Boolean(post.isReposted));
    setRepostsCount(post.repostsCount ?? 0);
    setBookmarked(Boolean(post.isBookmarked));
    setPollState(post.poll ?? null);
  }, [post]);

  const mediaUrls = post.mediaUrls ?? [];
  const commentsTotal = post.commentsCount ?? post.commentCount ?? 0;
  const displayName = post.authorName || post.authorUsername;
  const avatarSrc =
    post.authorAvatar ||
    `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(post.authorUsername)}`;

  const buildHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Auth-UserId': String(currentUserId),
      'X-Auth-Username': currentUsername,
    };
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    return headers;
  };

  // Lightbox keyboard navigation
  const handleLightboxNext = useCallback(() => {
    setLightboxIndex((prev) =>
      prev === null || mediaUrls.length === 0 ? null : (prev + 1) % mediaUrls.length
    );
  }, [mediaUrls.length]);

  const handleLightboxPrev = useCallback(() => {
    setLightboxIndex((prev) =>
      prev === null || mediaUrls.length === 0
        ? null
        : (prev - 1 + mediaUrls.length) % mediaUrls.length
    );
  }, [mediaUrls.length]);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIndex(null);
      if (e.key === 'ArrowRight') handleLightboxNext();
      if (e.key === 'ArrowLeft') handleLightboxPrev();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lightboxIndex, handleLightboxNext, handleLightboxPrev]);

  const handleToggleLike = async () => {
    const nextLiked = !liked;
    const nextCount = Math.max(0, likesCount + (nextLiked ? 1 : -1));
    setLiked(nextLiked);
    setLikesCount(nextCount);
    onLikeChange?.(post.id, nextLiked, nextCount);

    try {
      await fetch(`${apiBaseUrl}/api/v1/posts/${post.id}/reactions`, {
        method: 'POST',
        credentials: 'include',
        headers: buildHeaders(),
        body: JSON.stringify({ reactionType: 'LIKE' }),
      });
    } catch {
      // Optimistic state kept for resilient UX
    }
  };

  const handleToggleRepost = async () => {
    const nextReposted = !reposted;
    const nextCount = Math.max(0, repostsCount + (nextReposted ? 1 : -1));
    setReposted(nextReposted);
    setRepostsCount(nextCount);
    onRepost?.(post.id);

    try {
      await fetch(`${apiBaseUrl}/api/v1/posts/${post.id}/repost`, {
        method: 'POST',
        credentials: 'include',
        headers: buildHeaders(),
        body: JSON.stringify({}),
      });
    } catch {
      // Optimistic state kept
    }
  };

  const handleToggleBookmark = async () => {
    const nextBookmarked = !bookmarked;
    setBookmarked(nextBookmarked);
    onBookmarkChange?.(post.id, nextBookmarked);

    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/posts/${post.id}/bookmark`, {
        method: 'POST',
        credentials: 'include',
        headers: buildHeaders(),
      });
      if (res.ok) {
        const data = (await res.json()) as { bookmarked?: boolean };
        if (typeof data.bookmarked === 'boolean') {
          setBookmarked(data.bookmarked);
          onBookmarkChange?.(post.id, data.bookmarked);
        }
      }
    } catch {
      // Optimistic state kept
    }
  };

  const handleShare = async () => {
    const shareUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}/?post=${post.id}`
        : `/?post=${post.id}`;

    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({
          title: `${displayName} on SocialFlow`,
          text: post.content.slice(0, 120),
          url: shareUrl,
        });
      } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
      }
    } catch {
      // User dismissed native share or clipboard unavailable
    }

    setSharedToast(true);
    setTimeout(() => setSharedToast(false), 1800);
    onShare?.(post.id);
  };

  const handleVotePoll = async (optionId: number) => {
    if (!pollState || pollState.hasVoted || pollState.isExpired || votingOptionId !== null) {
      return;
    }

    setVotingOptionId(optionId);

    // Optimistic local calculation
    const previousPoll = pollState;
    const prevTotal =
      pollState.totalVotes ??
      pollState.options.reduce((acc, o) => acc + (o.voteCount ?? o.votes ?? 0), 0);
    const nextTotal = prevTotal + 1;

    const optimisticOptions = pollState.options.map((opt) => {
      const baseVotes = opt.voteCount ?? opt.votes ?? 0;
      const newVotes = opt.id === optionId ? baseVotes + 1 : baseVotes;
      const pct = nextTotal > 0 ? Math.round((newVotes / nextTotal) * 100) : 0;
      return {
        ...opt,
        voteCount: newVotes,
        votes: newVotes,
        percentage: pct,
        isSelected: opt.id === optionId,
      };
    });

    const optimisticPoll: PostPollData = {
      ...pollState,
      totalVotes: nextTotal,
      hasVoted: true,
      selectedOptionId: optionId,
      options: optimisticOptions,
    };

    setPollState(optimisticPoll);

    try {
      const res = await fetch(
        `${apiBaseUrl}/api/v1/posts/${post.id}/poll/vote?optionId=${optionId}`,
        {
          method: 'POST',
          credentials: 'include',
          headers: buildHeaders(),
        }
      );

      if (res.ok) {
        const updatedPoll = (await res.json()) as PostPollData;
        setPollState(updatedPoll);
        onPollVoted?.(post.id, updatedPoll);
      } else if (res.status === 409) {
        // Already voted on server; keep previous or mark voted
        setPollState({ ...previousPoll, hasVoted: true });
      } else {
        onPollVoted?.(post.id, optimisticPoll);
      }
    } catch {
      onPollVoted?.(post.id, optimisticPoll);
    } finally {
      setVotingOptionId(null);
    }
  };

  // Render content paragraphs with clickable #hashtags and @mentions
  const renderRichText = (text: string) => {
    const paragraphs = text.split(/\n+/);
    return paragraphs.map((paragraph, pIdx) => {
      const tokens = paragraph.split(/(\s+)/);
      return (
        <p
          key={pIdx}
          dir="auto"
          className="text-[15px] leading-[1.6] text-[#F8FAFC]/95 break-words mb-2 last:mb-0"
        >
          {tokens.map((token, tIdx) => {
            if (/^#[\w\u0590-\u05fe]+$/.test(token)) {
              const cleanTag = token.slice(1);
              return (
                <button
                  key={tIdx}
                  type="button"
                  onClick={() => onHashtagClick?.(cleanTag)}
                  className="text-[#8B5CF6] hover:text-[#6366F1] font-medium hover:underline cursor-pointer"
                >
                  {token}
                </button>
              );
            }
            if (/^@[\w.-]+$/.test(token)) {
              const cleanUser = token.slice(1);
              return (
                <button
                  key={tIdx}
                  type="button"
                  onClick={() => onAuthorClick?.(cleanUser)}
                  className="text-[#6366F1] hover:text-indigo-300 font-medium hover:underline cursor-pointer"
                >
                  {token}
                </button>
              );
            }
            return <React.Fragment key={tIdx}>{token}</React.Fragment>;
          })}
        </p>
      );
    });
  };

  // Bento / Masonry multi-image grid renderer
  const renderMediaBentoGrid = () => {
    if (mediaUrls.length === 0) return null;

    if (mediaUrls.length === 1) {
      return (
        <div
          onClick={() => setLightboxIndex(0)}
          className="mt-3 rounded-2xl overflow-hidden border border-white/10 bg-[#090A0F] cursor-zoom-in group"
        >
          <img
            src={mediaUrls[0]}
            alt="Post media"
            loading="lazy"
            className="w-full max-h-[440px] object-cover group-hover:scale-[1.015] transition-transform duration-300"
          />
        </div>
      );
    }

    if (mediaUrls.length === 2) {
      return (
        <div className="mt-3 grid grid-cols-2 gap-1.5 rounded-2xl overflow-hidden border border-white/10">
          {mediaUrls.map((url, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setLightboxIndex(idx)}
              className="relative aspect-[4/3] overflow-hidden bg-[#090A0F] cursor-zoom-in group"
            >
              <img
                src={url}
                alt={`Post media ${idx + 1}`}
                loading="lazy"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </button>
          ))}
        </div>
      );
    }

    if (mediaUrls.length === 3) {
      return (
        <div className="mt-3 grid grid-cols-2 grid-rows-2 gap-1.5 h-[300px] sm:h-[340px] rounded-2xl overflow-hidden border border-white/10">
          <button
            type="button"
            onClick={() => setLightboxIndex(0)}
            className="row-span-2 relative overflow-hidden bg-[#090A0F] cursor-zoom-in group"
          >
            <img
              src={mediaUrls[0]}
              alt="Post media 1"
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </button>
          {mediaUrls.slice(1, 3).map((url, idx) => (
            <button
              key={idx + 1}
              type="button"
              onClick={() => setLightboxIndex(idx + 1)}
              className="relative overflow-hidden bg-[#090A0F] cursor-zoom-in group"
            >
              <img
                src={url}
                alt={`Post media ${idx + 2}`}
                loading="lazy"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </button>
          ))}
        </div>
      );
    }

    // 4 or more images: 2x2 Bento grid with +N overflow badge
    const visibleImages = mediaUrls.slice(0, 4);
    const extraCount = mediaUrls.length - 4;

    return (
      <div className="mt-3 grid grid-cols-2 gap-1.5 rounded-2xl overflow-hidden border border-white/10">
        {visibleImages.map((url, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setLightboxIndex(idx)}
            className="relative aspect-[4/3] overflow-hidden bg-[#090A0F] cursor-zoom-in group"
          >
            <img
              src={url}
              alt={`Post media ${idx + 1}`}
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            {idx === 3 && extraCount > 0 && (
              <div className="absolute inset-0 bg-[#090A0F]/70 backdrop-blur-[2px] flex items-center justify-center">
                <span className="text-xl font-bold font-mono text-[#F8FAFC]">
                  +{extraCount}
                </span>
              </div>
            )}
          </button>
        ))}
      </div>
    );
  };

  return (
    <>
      <motion.article
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
        className={`relative rounded-2xl bg-[#121521]/72 backdrop-blur-xl border border-white/10 hover:border-indigo-500/40 shadow-[0_10px_32px_rgba(0,0,0,0.38)] transition-colors duration-200 p-4 sm:p-5 ${className}`}
      >
        {/* Pinned / Repost / Thread Context Banner */}
        {(post.isPinned || post.isRepost || post.replyToUsername) && (
          <div className="flex flex-wrap items-center gap-3 mb-2.5 text-xs text-[#94A3B8]">
            {post.isPinned && (
              <span className="inline-flex items-center gap-1 text-[#8B5CF6] font-medium">
                <Pin className="w-3.5 h-3.5" />
                <span>פוסט מוצמד</span>
              </span>
            )}
            {post.isRepost && (
              <span className="inline-flex items-center gap-1 text-[#10B981] font-medium">
                <Repeat2 className="w-3.5 h-3.5" />
                <span>{post.repostedByName || displayName} שיתף מחדש</span>
              </span>
            )}
            {post.replyToUsername && (
              <span className="inline-flex items-center gap-1 text-[#94A3B8]">
                <CornerDownRight className="w-3.5 h-3.5 text-[#6366F1]" />
                <span>בתגובה ל-</span>
                <button
                  type="button"
                  onClick={() => onAuthorClick?.(post.replyToUsername!)}
                  className="text-[#6366F1] hover:underline font-mono cursor-pointer"
                >
                  @{post.replyToUsername}
                </button>
              </span>
            )}
          </div>
        )}

        <div className="flex gap-3.5">
          {/* Avatar + Connected Thread Tree Line Column */}
          <div className="flex flex-col items-center shrink-0">
            {post.isThreadReply && (
              <div className="w-0.5 h-3 mb-1 rounded-full bg-gradient-to-b from-transparent to-[#6366F1]/70" />
            )}

            <button
              type="button"
              onClick={() => onAuthorClick?.(post.authorUsername)}
              className="relative rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1] cursor-pointer"
            >
              <img
                src={avatarSrc}
                alt={displayName}
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-full object-cover border border-white/15 bg-[#090A0F]"
              />
            </button>

            {post.hasThreadContinuation && (
              <div
                aria-hidden="true"
                className="w-0.5 flex-1 mt-2 min-h-[24px] rounded-full bg-gradient-to-b from-[#6366F1]/70 via-[#8B5CF6]/40 to-transparent"
              />
            )}
          </div>

          {/* Main Post Body */}
          <div className="flex-1 min-w-0">
            {/* Author Row */}
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                <button
                  type="button"
                  onClick={() => onAuthorClick?.(post.authorUsername)}
                  className="font-bold text-sm sm:text-[15px] text-[#F8FAFC] hover:text-[#6366F1] transition-colors truncate cursor-pointer"
                >
                  {displayName}
                </button>

                {post.authorVerified !== false && (
                  <span title="חשבון מאומת" className="inline-flex items-center shrink-0">
                    <BadgeCheck className="w-4 h-4 text-[#6366F1] fill-[#6366F1]/20" />
                  </span>
                )}

                <span className="text-xs font-mono text-[#64748B] truncate">
                  @{post.authorUsername}
                </span>
                <span className="text-[#64748B] text-xs">•</span>
                <time
                  dateTime={post.createdAt}
                  className="text-xs font-mono text-[#94A3B8] whitespace-nowrap"
                >
                  {formatRelativeTime(post.createdAt)}
                </time>
              </div>

              <button
                type="button"
                aria-label="אפשרויות פוסט"
                className="p-1.5 rounded-lg text-[#64748B] hover:text-[#F8FAFC] hover:bg-white/[0.06] transition-colors cursor-pointer"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </div>

            {/* Post Text (Bilingual dir="auto") */}
            <div className="mt-1">{renderRichText(post.content)}</div>

            {/* Attached Entity Card (UGC / Product / Event) */}
            {post.attachedEntity && (
              <div className="mt-3 p-3 rounded-xl bg-[#090A0F]/75 border border-white/10 hover:border-[#6366F1]/40 transition-colors flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-[#8B5CF6]">
                    {post.attachedEntity.badge || post.attachedEntity.entityType}
                  </span>
                  <div dir="auto" className="text-sm font-semibold text-[#F8FAFC] truncate">
                    {post.attachedEntity.title}
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#6366F1]/15 border border-[#6366F1]/30 text-xs font-medium text-indigo-200 shrink-0">
                  <span>צפה</span>
                  <ExternalLink className="w-3 h-3" />
                </span>
              </div>
            )}

            {/* Embedded Original Quote / Repost */}
            {post.originalPost && (
              <div className="mt-3 p-3.5 rounded-xl bg-[#090A0F]/65 border border-white/10">
                <div className="flex items-center gap-2 mb-1.5">
                  <img
                    src={
                      post.originalPost.authorAvatar ||
                      `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(
                        post.originalPost.authorUsername
                      )}`
                    }
                    alt={post.originalPost.authorUsername}
                    className="w-5 h-5 rounded-full object-cover"
                  />
                  <span className="text-xs font-semibold text-[#F8FAFC]">
                    {post.originalPost.authorName || post.originalPost.authorUsername}
                  </span>
                  <span className="text-xs font-mono text-[#64748B]">
                    @{post.originalPost.authorUsername}
                  </span>
                </div>
                <p dir="auto" className="text-xs sm:text-sm text-[#94A3B8] line-clamp-3">
                  {post.originalPost.content}
                </p>
              </div>
            )}

            {/* Bento Multi-Image Grid */}
            {renderMediaBentoGrid()}

            {/* Interactive Poll */}
            {pollState && (
              <div className="mt-3.5 p-3.5 sm:p-4 rounded-xl bg-[#090A0F]/70 border border-white/10">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <BarChart3 className="w-4 h-4 text-[#8B5CF6] shrink-0" />
                    <h4 dir="auto" className="text-sm font-semibold text-[#F8FAFC]">
                      {pollState.question}
                    </h4>
                  </div>
                  <span className="text-[11px] font-mono text-[#64748B] shrink-0">
                    {pollState.totalVotes ?? 0} הצבעות
                  </span>
                </div>

                <div className="space-y-2">
                  {pollState.options.map((opt) => {
                    const isSelected =
                      Boolean(opt.isSelected) || pollState.selectedOptionId === opt.id;
                    const showResults = Boolean(pollState.hasVoted || pollState.isExpired);
                    const total =
                      pollState.totalVotes ??
                      pollState.options.reduce(
                        (s, o) => s + (o.voteCount ?? o.votes ?? 0),
                        0
                      );
                    const rawVotes = opt.voteCount ?? opt.votes ?? 0;
                    const pct =
                      opt.percentage !== undefined
                        ? Math.round(opt.percentage)
                        : total > 0
                        ? Math.round((rawVotes / total) * 100)
                        : 0;

                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={showResults || votingOptionId !== null}
                        onClick={() => handleVotePoll(opt.id)}
                        className={`relative w-full overflow-hidden rounded-xl border px-3.5 py-2.5 text-start transition-colors flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'border-[#6366F1]/70 bg-[#6366F1]/10 text-[#F8FAFC]'
                            : showResults
                            ? 'border-white/10 bg-[#121521]/60 text-[#94A3B8]'
                            : 'border-white/10 bg-[#121521]/70 hover:border-[#6366F1]/50 hover:bg-white/[0.04] text-[#F8FAFC] cursor-pointer'
                        }`}
                      >
                        {showResults && (
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                            className={`absolute inset-y-0 start-0 pointer-events-none ${
                              isSelected
                                ? 'bg-gradient-to-r from-[#6366F1]/30 to-[#8B5CF6]/25'
                                : 'bg-white/[0.07]'
                            }`}
                          />
                        )}

                        <span
                          dir="auto"
                          className="relative z-10 text-xs sm:text-sm font-medium flex items-center gap-2"
                        >
                          {isSelected && (
                            <Check className="w-3.5 h-3.5 text-[#6366F1] shrink-0" />
                          )}
                          <span>{opt.text}</span>
                        </span>

                        {showResults && (
                          <span className="relative z-10 text-xs font-mono font-semibold text-[#F8FAFC] shrink-0">
                            {pct}%
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Explicit Hashtag Chips */}
            {post.tags && post.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {post.tags.map((tag, idx) => {
                  const clean = tag.replace(/^#/, '');
                  return (
                    <button
                      key={`${clean}-${idx}`}
                      type="button"
                      dir="auto"
                      onClick={() => onHashtagClick?.(clean)}
                      className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-white/[0.04] hover:bg-[#6366F1]/20 border border-white/10 hover:border-[#6366F1]/40 text-[#94A3B8] hover:text-[#F8FAFC] transition-colors cursor-pointer"
                    >
                      #{clean}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Spring-Animated Action Bar */}
            <div className="mt-3.5 pt-2.5 border-t border-white/[0.07] flex items-center justify-between gap-1">
              <div className="flex items-center gap-1 sm:gap-2">
                {/* Like (#F43F5E) */}
                <motion.button
                  type="button"
                  onClick={handleToggleLike}
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.86 }}
                  transition={{ type: 'spring', stiffness: 480, damping: 20 }}
                  aria-label="לייק"
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                    liked
                      ? 'text-[#F43F5E] bg-[#F43F5E]/15 border border-[#F43F5E]/30'
                      : 'text-[#94A3B8] hover:text-[#F43F5E] hover:bg-[#F43F5E]/10'
                  }`}
                >
                  <Heart className={`w-4 h-4 ${liked ? 'fill-[#F43F5E]' : ''}`} />
                  <span className="font-mono">{likesCount}</span>
                </motion.button>

                {/* Comment */}
                <motion.button
                  type="button"
                  onClick={() => onCommentClick?.(post.id)}
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.88 }}
                  transition={{ type: 'spring', stiffness: 480, damping: 20 }}
                  aria-label="תגובות"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-[#94A3B8] hover:text-[#6366F1] hover:bg-[#6366F1]/10 transition-colors cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span className="font-mono">{commentsTotal}</span>
                </motion.button>

                {/* Repost */}
                <motion.button
                  type="button"
                  onClick={handleToggleRepost}
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.88 }}
                  transition={{ type: 'spring', stiffness: 480, damping: 20 }}
                  aria-label="שיתוף מחדש"
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                    reposted
                      ? 'text-[#10B981] bg-[#10B981]/15 border border-[#10B981]/30'
                      : 'text-[#94A3B8] hover:text-[#10B981] hover:bg-[#10B981]/10'
                  }`}
                >
                  <Repeat2 className="w-4 h-4" />
                  <span className="font-mono">{repostsCount}</span>
                </motion.button>
              </div>

              <div className="flex items-center gap-1">
                {/* Bookmark */}
                <motion.button
                  type="button"
                  onClick={handleToggleBookmark}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.86 }}
                  transition={{ type: 'spring', stiffness: 480, damping: 20 }}
                  aria-label="שמירה בסימניות"
                  className={`p-2 rounded-xl transition-colors cursor-pointer ${
                    bookmarked
                      ? 'text-[#6366F1] bg-[#6366F1]/15'
                      : 'text-[#94A3B8] hover:text-[#6366F1] hover:bg-white/[0.06]'
                  }`}
                >
                  <Bookmark className={`w-4 h-4 ${bookmarked ? 'fill-[#6366F1]' : ''}`} />
                </motion.button>

                {/* Share */}
                <motion.button
                  type="button"
                  onClick={handleShare}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.86 }}
                  transition={{ type: 'spring', stiffness: 480, damping: 20 }}
                  aria-label="שתף קישור"
                  className="relative p-2 rounded-xl text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-white/[0.06] transition-colors cursor-pointer"
                >
                  {sharedToast ? (
                    <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                  ) : (
                    <Share2 className="w-4 h-4" />
                  )}
                </motion.button>
              </div>
            </div>
          </div>
        </div>
      </motion.article>

      {/* Media Lightbox Modal */}
      <AnimatePresence>
        {lightboxIndex !== null && mediaUrls[lightboxIndex] && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setLightboxIndex(null)}
            className="fixed inset-0 z-50 bg-[#090A0F]/90 backdrop-blur-2xl flex items-center justify-center p-4"
          >
            <button
              type="button"
              onClick={() => setLightboxIndex(null)}
              aria-label="סגור תצוגה"
              className="absolute top-5 end-5 p-2.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-[#F8FAFC] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {mediaUrls.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLightboxPrev();
                  }}
                  aria-label="תמונה קודמת"
                  className="absolute start-4 sm:start-8 p-3 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-[#F8FAFC] transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLightboxNext();
                  }}
                  aria-label="תמונה הבאה"
                  className="absolute end-4 sm:end-8 p-3 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-[#F8FAFC] transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              </>
            )}

            <motion.div
              key={lightboxIndex}
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-4xl max-h-[85vh] flex flex-col items-center gap-3"
            >
              <img
                src={mediaUrls[lightboxIndex]}
                alt={`Media ${lightboxIndex + 1}`}
                className="max-h-[80vh] max-w-full rounded-2xl border border-white/15 object-contain shadow-2xl"
              />
              {mediaUrls.length > 1 && (
                <div className="px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-mono text-[#F8FAFC]">
                  {lightboxIndex + 1} / {mediaUrls.length}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export function PostCardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`rounded-2xl bg-[#121521]/72 backdrop-blur-xl border border-white/10 p-4 sm:p-5 animate-pulse ${className}`}
    >
      <div className="flex gap-3.5">
        <div className="w-11 h-11 rounded-full bg-white/10 shrink-0" />
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-3.5 w-28 rounded-full bg-white/10" />
            <div className="h-3 w-20 rounded-full bg-white/[0.06]" />
          </div>
          <div className="space-y-2 pt-1">
            <div className="h-3.5 w-full rounded-full bg-white/10" />
            <div className="h-3.5 w-5/6 rounded-full bg-white/10" />
            <div className="h-3.5 w-2/3 rounded-full bg-white/[0.06]" />
          </div>
          <div className="h-44 w-full rounded-xl bg-white/[0.06]" />
          <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between">
            <div className="flex gap-3">
              <div className="h-6 w-12 rounded-lg bg-white/10" />
              <div className="h-6 w-12 rounded-lg bg-white/10" />
              <div className="h-6 w-12 rounded-lg bg-white/10" />
            </div>
            <div className="flex gap-2">
              <div className="h-6 w-6 rounded-lg bg-white/10" />
              <div className="h-6 w-6 rounded-lg bg-white/10" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
