'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocialStore } from '@/store/useSocialStore';

export function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const { notifications, unreadNotificationsCount, markAllNotificationsRead } = useSocialStore();

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 rounded-full bg-slate-900/80 border border-slate-800 text-slate-300 hover:text-white hover:border-cyan-500/40 transition-colors"
        title="התראות"
      >
        <span className="text-lg">🔔</span>
        {unreadNotificationsCount > 0 && (
          <span className="absolute -top-1 -end-1 w-5 h-5 bg-cyan-500 text-slate-950 font-black rounded-full flex items-center justify-center text-xs shadow-[0_0_8px_rgba(6,182,212,0.6)]">
            {unreadNotificationsCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              className="absolute z-50 top-full end-0 mt-3 w-80 p-4 rounded-3xl social-glass-card shadow-2xl"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-2">
                <span className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
                  <span>🔔</span> <span>מרכז התראות</span>
                </span>
                {unreadNotificationsCount > 0 && (
                  <button
                    onClick={markAllNotificationsRead}
                    className="text-sm text-cyan-400 hover:text-cyan-300 font-medium"
                  >
                    סמן הכל כנקרא
                  </button>
                )}
              </div>

              <div className="divide-y divide-slate-800/60 max-h-72 overflow-y-auto">
                {notifications.map((item) => (
                  <div
                    key={item.id}
                    className={`py-3 px-2 flex items-start gap-3 rounded-xl transition-colors ${
                      item.isRead ? 'opacity-70' : 'bg-cyan-500/5'
                    }`}
                  >
                    <img src={item.actorAvatar} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                    <div className="flex-1 text-xs">
                      <div className="font-bold text-slate-200">{item.actorName}</div>
                      <p className="text-slate-400 leading-snug">{item.text}</p>
                      <span className="text-sm text-slate-500 font-mono mt-1 block">{item.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
