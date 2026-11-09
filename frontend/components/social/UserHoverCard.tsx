'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface UserHoverCardProps {
  username: string;
  name: string;
  avatarUrl: string;
  bio?: string;
  followersCount?: number;
  followingCount?: number;
  children: React.ReactNode;
}

export function UserHoverCard({
  username,
  name,
  avatarUrl,
  bio = 'חבר קהילת SocialFlow • מתעניין בטכנולוגיה ובינה מלאכותית 🚀',
  followersCount = 428,
  followingCount = 182,
  children,
}: UserHoverCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <div className="cursor-pointer">{children}</div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.95 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="absolute z-50 top-full start-0 mt-2 w-72 p-4 rounded-2xl social-glass-card shadow-2xl"
          >
            <div className="flex items-start justify-between mb-3">
              <img
                src={avatarUrl}
                alt={name}
                className="w-12 h-12 rounded-full border border-cyan-400/30 object-cover"
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsFollowing(!isFollowing);
                }}
                className={`px-3 py-1 rounded-full text-sm font-bold transition-all duration-200 ${
                  isFollowing
                    ? 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-red-500/10 hover:text-red-400'
                    : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                }`}
              >
                {isFollowing ? 'עוקב/ת ✓' : '+ עקוב'}
              </button>
            </div>

            <div className="mb-2">
              <div className="font-bold text-sm text-slate-100">{name}</div>
              <div className="text-sm text-cyan-400 font-mono">@{username}</div>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed mb-3">{bio}</p>

            <div className="flex items-center gap-4 text-sm text-slate-400 border-t border-slate-800/80 pt-2 font-mono">
              <div>
                <strong className="text-slate-200 font-bold">{followersCount}</strong>{' '}
                <span>עוקבים</span>
              </div>
              <div>
                <strong className="text-slate-200 font-bold">{followingCount}</strong>{' '}
                <span>עוקב</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
