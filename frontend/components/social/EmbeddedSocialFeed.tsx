'use client';

import React, { useState } from 'react';
import { PostGlassCard, SocialPostData } from './PostGlassCard';
import { PostComposerModal } from './PostComposerModal';

const EMBEDDED_SAMPLE_POSTS: SocialPostData[] = [
  {
    id: 'emb-1',
    authorUsername: 'idan',
    authorName: 'עידן קזם',
    authorAvatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=idan',
    content: 'שלום לכל חברי הקהילה! ווידג׳ט הרשת החברתית Social Pulse Hub מוטמע כעת ישירות בעמודי האתר.',
    tags: ['EmbeddedWidget', 'CommunityUGC'],
    createdAt: 'לפני 15 דקות',
    commentCount: 3,
  },
];

interface EmbeddedSocialFeedProps {
  title?: string;
  groupId?: string;
  limit?: number;
}

export function EmbeddedSocialFeed({
  title = 'שיח הקהילה החי',
  limit = 3,
}: EmbeddedSocialFeedProps) {
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [posts, setPosts] = useState<SocialPostData[]>(EMBEDDED_SAMPLE_POSTS.slice(0, limit));

  return (
    <section className="w-full my-8 p-6 rounded-3xl social-glass-card border border-cyan-500/25">
      {/* Widget Header */}
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">💬</span>
          <div>
            <h3 className="font-bold text-sm text-slate-100">{title}</h3>
            <span className="text-sm text-cyan-400">שיתופי גולשים בזמן אמת</span>
          </div>
        </div>

        <button
          onClick={() => setIsComposerOpen(true)}
          className="px-3.5 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-400/40 text-sm font-bold transition-all"
        >
          + הוסף תגובה / פוסט
        </button>
      </div>

      {/* Feed Stream */}
      <div className="space-y-3">
        {posts.map((post) => (
          <PostGlassCard key={post.id} post={post} />
        ))}
      </div>

      <PostComposerModal
        isOpen={isComposerOpen}
        onClose={() => setIsComposerOpen(false)}
        onPostCreated={() => {
          setPosts([
            {
              id: `emb_${Date.now()}`,
              authorUsername: 'idan',
              authorName: 'עידן קזם',
              authorAvatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=idan',
              content: 'פוסט חדש שותף זה עתה בווידג׳ט הקהילתי! 🚀',
              tags: ['Community'],
              createdAt: 'כרגע',
              commentCount: 0,
            },
            ...posts,
          ]);
        }}
      />
    </section>
  );
}
