'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ReactionMicroBar } from './ReactionMicroBar';
import { UserHoverCard } from './UserHoverCard';
import { ThreadedCommentsDrawer } from './ThreadedCommentsDrawer';

export interface SocialPostData {
  id: string;
  authorUsername: string;
  authorName: string;
  authorAvatar: string;
  content: string;
  tags?: string[];
  createdAt: string;
  mediaUrls?: string[];
  attachedEntity?: {
    entityType: 'PRODUCT' | 'ITEM' | 'ACHIEVEMENT' | 'EVENT';
    entityId: string;
    title: string;
    thumbnailUrl?: string;
  };
  poll?: {
    question: string;
    options: { id: number; text: string; percentage?: number }[];
  };
  commentCount?: number;
}

interface PostGlassCardProps {
  post: SocialPostData;
}

export function PostGlassCard({ post }: PostGlassCardProps) {
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [selectedPollOption, setSelectedPollOption] = useState<number | null>(null);

  return (
    <>
      <motion.article
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="social-glass-card rounded-2xl p-5 mb-4 transform-gpu text-slate-100"
      >
        {/* Author Header */}
        <div className="flex items-center justify-between mb-3">
          <UserHoverCard
            username={post.authorUsername}
            name={post.authorName}
            avatarUrl={post.authorAvatar}
          >
            <div className="flex items-center gap-3">
              <img
                src={post.authorAvatar}
                alt={post.authorName}
                className="w-10 h-10 rounded-full border border-cyan-400/30 object-cover"
              />
              <div>
                <h4 className="font-bold text-sm text-slate-100 hover:text-cyan-400 transition-colors">
                  {post.authorName}
                </h4>
                <div className="text-sm text-slate-400 font-mono">
                  @{post.authorUsername} • {post.createdAt}
                </div>
              </div>
            </div>
          </UserHoverCard>

          <button className="text-slate-400 hover:text-slate-200 p-1">•••</button>
        </div>

        {/* Post Content */}
        <p className="text-sm leading-relaxed mb-3 whitespace-pre-wrap text-slate-200">
          {post.content}
        </p>

        {/* Attached Entity (UGC / Site Entity Sharing) */}
        {post.attachedEntity && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-950/60 border border-cyan-500/30 mb-3 hover:border-cyan-400/60 transition-colors cursor-pointer">
            <span className="text-2xl">📦</span>
            <div className="flex-1">
              <span className="text-sm font-mono uppercase text-cyan-400 tracking-wider">
                {post.attachedEntity.entityType}
              </span>
              <div className="text-sm font-bold text-slate-100">{post.attachedEntity.title}</div>
            </div>
            <button className="text-xs px-3 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 font-semibold">
              צפה באתר
            </button>
          </div>
        )}

        {/* Media Preview */}
        {post.mediaUrls && post.mediaUrls.length > 0 && (
          <div className="mb-3 rounded-xl overflow-hidden border border-slate-800">
            <img src={post.mediaUrls[0]} alt="" className="w-full max-h-96 object-cover" />
          </div>
        )}

        {/* Interactive Poll */}
        {post.poll && (
          <div className="mb-3.5 p-3.5 rounded-xl bg-slate-950/50 border border-slate-800">
            <div className="text-sm font-bold text-slate-200 mb-2.5 flex items-center gap-1.5">
              <span>📊</span>
              <span>{post.poll.question}</span>
            </div>
            <div className="space-y-2">
              {post.poll.options.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setSelectedPollOption(opt.id)}
                  className={`relative w-full p-2.5 rounded-lg text-xs font-medium flex items-center justify-between border transition-all ${
                    selectedPollOption === opt.id
                      ? 'border-cyan-400 bg-cyan-500/15 text-cyan-200'
                      : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <span className="z-10">{opt.text}</span>
                  {opt.percentage !== undefined && (
                    <span className="z-10 font-bold font-mono">{opt.percentage}%</span>
                  )}
                  {opt.percentage !== undefined && (
                    <div
                      style={{ width: `${opt.percentage}%` }}
                      className="absolute inset-y-0 start-0 bg-cyan-500/20 rounded-lg pointer-events-none"
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Hashtags */}
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {post.tags.map((t, i) => (
              <span key={i} className="text-sm text-cyan-400 font-mono hover:underline cursor-pointer">
                #{t.replace(/^#/, '')}
              </span>
            ))}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800/80">
          <ReactionMicroBar targetId={post.id} />

          <button
            onClick={() => setIsCommentsOpen(true)}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-cyan-300 transition-colors font-medium"
          >
            <span>💬</span>
            <span>{post.commentCount || 2} תגובות</span>
          </button>
        </div>
      </motion.article>

      <ThreadedCommentsDrawer
        isOpen={isCommentsOpen}
        onClose={() => setIsCommentsOpen(false)}
        postId={post.id}
      />
    </>
  );
}
