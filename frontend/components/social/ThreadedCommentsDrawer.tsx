'use client';

import React, { useState, useOptimistic, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createCommentAction } from '@/lib/actions/social.actions';

export interface CommentItem {
  id: string;
  authorName: string;
  authorUsername: string;
  authorAvatar: string;
  content: string;
  createdAt: string;
  replies?: CommentItem[];
}

interface ThreadedCommentsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  postId: string;
  initialComments?: CommentItem[];
}

export function ThreadedCommentsDrawer({
  isOpen,
  onClose,
  postId,
  initialComments = [
    {
      id: 'c1',
      authorName: 'דניאל לוי',
      authorUsername: 'daniel',
      authorAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Daniel',
      content: 'הארכיטקטורה של Next.js 15 בשילוב LangGraph נראית כמו העתיד של Web Apps!',
      createdAt: 'לפני 12 דקות',
      replies: [
        {
          id: 'c1-1',
          authorName: 'עידן קזם',
          authorUsername: 'idan',
          authorAvatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=idan',
          content: 'מדויק! והכי חשוב שיש Human-in-the-Loop מובנה לשליטה מלאה.',
          createdAt: 'לפני 5 דקות',
        },
      ],
    },
  ],
}: ThreadedCommentsDrawerProps) {
  const [commentText, setCommentText] = useState('');
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const [optimisticComments, addOptimisticComment] = useOptimistic(
    initialComments,
    (state, newComment: CommentItem) => [newComment, ...state]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    const newComment: CommentItem = {
      id: `temp_${Date.now()}`,
      authorName: 'עידן קזם',
      authorUsername: 'idan',
      authorAvatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=idan',
      content: commentText.trim(),
      createdAt: 'כרגע',
    };

    startTransition(async () => {
      addOptimisticComment(newComment);
      const textToSubmit = commentText;
      setCommentText('');
      setReplyingToId(null);
      await createCommentAction({
        postId,
        parentCommentId: replyingToId || undefined,
        content: textToSubmit,
      });
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />

          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="fixed inset-y-0 start-0 z-50 w-full max-w-md bg-slate-950/95 border-e border-cyan-500/20 p-6 flex flex-col shadow-2xl backdrop-blur-2xl"
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xl">💬</span>
                <h3 className="font-bold text-base text-slate-100">שיח ותגובות</h3>
              </div>
              <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-4">
              {optimisticComments.map((comment) => (
                <div key={comment.id} className="space-y-3">
                  <div className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800/80">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <img src={comment.authorAvatar} alt="" className="w-7 h-7 rounded-full" />
                        <span className="text-sm font-bold text-slate-200">{comment.authorName}</span>
                      </div>
                      <span className="text-sm text-slate-500">{comment.createdAt}</span>
                    </div>
                    <p className="text-sm text-slate-300 leading-relaxed ps-9">{comment.content}</p>
                    <div className="ps-9 mt-2 flex items-center gap-3">
                      <button
                        onClick={() => setReplyingToId(comment.id)}
                        className="text-sm font-semibold text-cyan-400 hover:text-cyan-300"
                      >
                        השב
                      </button>
                    </div>
                  </div>

                  {comment.replies?.map((reply) => (
                    <div key={reply.id} className="ms-8 p-3 rounded-xl bg-slate-900/40 border-s-2 border-cyan-500/40">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <img src={reply.authorAvatar} alt="" className="w-5 h-5 rounded-full" />
                          <span className="text-sm font-bold text-slate-300">{reply.authorName}</span>
                        </div>
                        <span className="text-sm text-slate-500">{reply.createdAt}</span>
                      </div>
                      <p className="text-sm text-slate-300 ps-7">{reply.content}</p>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="pt-3 border-t border-slate-800">
              {replyingToId && (
                <div className="flex items-center justify-between text-sm text-cyan-400 mb-2 px-1">
                  <span>משיב לתגובה...</span>
                  <button type="button" onClick={() => setReplyingToId(null)} className="text-slate-400">ביטול</button>
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="כתוב תגובה עניינית..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
                <button
                  type="submit"
                  disabled={!commentText.trim()}
                  className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 font-bold text-xs"
                >
                  שלח
                </button>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
