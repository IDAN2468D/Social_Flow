'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

interface Story {
  id: string;
  username: string;
  name: string;
  avatar: string;
  mediaUrl: string;
  isUnread: boolean;
}

const DEMO_STORIES: Story[] = [
  {
    id: 's1',
    username: 'noa',
    name: 'נועה',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Noa',
    mediaUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
    isUnread: true,
  },
  {
    id: 's2',
    username: 'daniel',
    name: 'דניאל',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Daniel',
    mediaUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80',
    isUnread: true,
  },
  {
    id: 's3',
    username: 'maya',
    name: 'מאיה',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Maya',
    mediaUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80',
    isUnread: true,
  },
  {
    id: 's4',
    username: 'yonatan',
    name: 'יונתן',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Yonatan',
    mediaUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=600&q=80',
    isUnread: false,
  },
];

export function StoriesBar() {
  const [activeStory, setActiveStory] = useState<Story | null>(null);

  return (
    <section className="mb-6 p-3 rounded-2xl social-glass-card">
      <div className="flex items-center gap-4 overflow-x-auto no-scrollbar py-1">
        {/* Add Story */}
        <Link href="/stories" className="flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer group">
          <div className="relative w-14 h-14 rounded-full p-0.5 bg-slate-800 border-2 border-dashed border-cyan-500/50 flex items-center justify-center group-hover:border-cyan-400">
            <img src="https://api.dicebear.com/7.x/bottts/svg?seed=idan" alt="" className="w-full h-full rounded-full" />
            <span className="absolute bottom-0 end-0 w-4 h-4 bg-cyan-500 text-slate-950 rounded-full flex items-center justify-center text-xs font-black">+</span>
          </div>
          <span className="text-sm text-slate-300 font-medium">הסטורי שלך</span>
        </Link>

        {/* Story List */}
        {DEMO_STORIES.map((story) => (
          <Link
            key={story.id}
            href="/stories"
            className="flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer"
          >
            <div
              className={`w-14 h-14 rounded-full p-[2.5px] transition-transform duration-200 hover:scale-105 ${
                story.isUnread
                  ? 'bg-gradient-to-tr from-cyan-400 via-indigo-500 to-fuchsia-500'
                  : 'bg-slate-700/60'
              }`}
            >
              <div className="w-full h-full rounded-full bg-slate-950 p-0.5">
                <img src={story.avatar} alt={story.name} className="w-full h-full rounded-full object-cover" />
              </div>
            </div>
            <span className="text-sm text-slate-300 font-medium">{story.name}</span>
          </Link>
        ))}
      </div>

      {/* Story Viewer Modal */}
      <AnimatePresence>
        {activeStory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActiveStory(null)}
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-sm rounded-3xl overflow-hidden bg-slate-900 border border-cyan-500/30 shadow-2xl"
            >
              {/* Progress bar */}
              <div className="absolute top-3 inset-x-3 z-20 h-1 bg-white/30 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 5, ease: 'linear' }}
                  onAnimationComplete={() => setActiveStory(null)}
                  className="h-full bg-cyan-400"
                />
              </div>

              {/* Header */}
              <div className="absolute top-6 inset-x-3 z-20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img src={activeStory.avatar} alt="" className="w-10 h-10 rounded-full border border-white/40" />
                  <span className="text-sm font-bold text-white drop-shadow">{activeStory.name}</span>
                </div>
                <button onClick={() => setActiveStory(null)} className="text-white/80 hover:text-white p-1">✕</button>
              </div>

              <img src={activeStory.mediaUrl} alt="" className="w-full h-[520px] object-cover" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
