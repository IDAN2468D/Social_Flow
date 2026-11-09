'use client';

import React, { useState, useEffect } from 'react';
import { PostGlassCard, SocialPostData } from './PostGlassCard';
import { useSocialStore } from '@/store/useSocialStore';

const INITIAL_POSTS: SocialPostData[] = [
  {
    id: 'p1',
    authorUsername: 'idan',
    authorName: 'עידן קזם',
    authorAvatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=idan',
    content: 'שילבנו את מודול Social Pulse Hub המלא באתר! 🎉 פיד מבוסס Liquid Glass 4.0 Pro, סוכני LangGraph אוטונומיים, ותמיכה מלאה בריאקציות מהירות ב-0ms.',
    tags: ['Nextjs15', 'LangGraph', 'SocialPulse', 'Fullstack'],
    createdAt: 'לפני 10 דקות',
    attachedEntity: {
      entityType: 'PRODUCT',
      entityId: 'prd_01',
      title: 'ערכת הרשת החברתית SocialFlow v10.0',
    },
    poll: {
      question: 'האם התחלתם להשתמש בסוכני AI ב-Production?',
      options: [
        { id: 1, text: 'כן, יומיומי בעבודה 🚀', percentage: 65 },
        { id: 2, text: 'עדיין בודקים ומתנסים 🧪', percentage: 35 },
      ],
    },
    commentCount: 4,
  },
  {
    id: 'p2',
    authorUsername: 'noa',
    authorName: 'נועה כהן',
    authorAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Noa',
    content: 'מערכת הריאקציות המונפשת פשוט תענוג לעיניים. ה-Optimistic UI נותן תחושה מיידית וללא כל השהיית שרת. 👏🔥',
    tags: ['UIUX', 'TailwindCSS', 'FramerMotion'],
    createdAt: 'לפני 40 דקות',
    commentCount: 1,
  },
];

export function ActivityFeedList() {
  const { currentTab, setTab } = useSocialStore();
  const [posts, setPosts] = useState<SocialPostData[]>(INITIAL_POSTS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(timer);
  }, [currentTab]);

  return (
    <div className="space-y-4">
      {/* Feed Category Tabs */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-md">
        <button
          onClick={() => setTab('TRENDING')}
          className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
            currentTab === 'TRENDING'
              ? 'bg-cyan-500 text-slate-950 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          🔥 מגמות (Trending)
        </button>
        <button
          onClick={() => setTab('FOLLOWING')}
          className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
            currentTab === 'FOLLOWING'
              ? 'bg-cyan-500 text-slate-950 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          👥 עוקבים (Following)
        </button>
        <button
          onClick={() => setTab('GROUP')}
          className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
            currentTab === 'GROUP'
              ? 'bg-cyan-500 text-slate-950 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          🌐 קהילות (Spaces)
        </button>
      </div>

      {/* Posts Stream */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((n) => (
            <div key={n} className="social-glass-card rounded-2xl p-5 animate-pulse space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-800" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-3 w-28 bg-slate-800 rounded" />
                  <div className="h-2 w-20 bg-slate-800 rounded" />
                </div>
              </div>
              <div className="h-4 w-3/4 bg-slate-800 rounded" />
              <div className="h-4 w-1/2 bg-slate-800 rounded" />
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="p-8 rounded-2xl social-glass-card text-center space-y-2">
          <span className="text-3xl">📭</span>
          <h4 className="font-bold text-sm text-slate-200">אין פוסטים עדיין בטאב זה</h4>
          <p className="text-sm text-slate-400">היה הראשון לפתוח דיון בקהילה!</p>
        </div>
      ) : (
        posts.map((post) => <PostGlassCard key={post.id} post={post} />)
      )}
    </div>
  );
}
