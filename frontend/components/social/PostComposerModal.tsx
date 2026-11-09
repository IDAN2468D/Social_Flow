'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createSocialPostAction } from '@/lib/actions/social.actions';

interface PostComposerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated?: () => void;
}

export function PostComposerModal({ isOpen, onClose, onPostCreated }: PostComposerModalProps) {
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [showPoll, setShowPoll] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddTag = () => {
    const clean = tagInput.trim().replace(/^#/, '');
    if (clean && !tags.includes(clean)) {
      setTags([...tags, clean]);
      setTagInput('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const payload: any = {
      content: content.trim(),
      tags,
    };

    if (showPoll && pollQuestion.trim()) {
      const validOpts = pollOptions.filter((o) => o.trim());
      if (validOpts.length >= 2) {
        payload.poll = {
          question: pollQuestion.trim(),
          options: validOpts,
        };
      }
    }

    const res = await createSocialPostAction(payload);
    setLoading(false);

    if (res.success) {
      setContent('');
      setTags([]);
      setShowPoll(false);
      onPostCreated?.();
      onClose();
    } else {
      setError(res.error || 'אירעה שגיאה בפרסום');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            className="w-full max-w-lg social-glass-card rounded-3xl p-6 shadow-2xl relative"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                <span>✍️</span> <span>יצירת פוסט בקהילה</span>
              </h3>
              <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:text-white">✕</button>
            </div>

            {error && (
              <div className="mb-3 p-3 rounded-xl bg-red-500/20 border border-red-500/30 text-xs text-red-300">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <textarea
                placeholder="מה תרצה לשתף עם הקהילה היום?"
                rows={4}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
              />

              {/* Hashtags */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="הוסף תגית (#טכנולוגיה)"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                  className="flex-1 p-2 rounded-xl bg-slate-950/60 border border-slate-800 text-sm text-slate-200"
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="px-3 py-2 rounded-xl bg-slate-800 text-sm text-slate-300 hover:bg-slate-700"
                >
                  + הוסף
                </button>
              </div>

              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((t) => (
                    <span
                      key={t}
                      onClick={() => setTags(tags.filter((item) => item !== t))}
                      className="text-xs px-2.5 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 cursor-pointer"
                    >
                      #{t} ✕
                    </span>
                  ))}
                </div>
              )}

              {/* Poll Toggle */}
              {showPoll && (
                <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2.5">
                  <input
                    type="text"
                    placeholder="שאלת הסקר..."
                    value={pollQuestion}
                    onChange={(e) => setPollQuestion(e.target.value)}
                    className="w-full p-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-slate-100"
                  />
                  {pollOptions.map((opt, i) => (
                    <input
                      key={i}
                      type="text"
                      placeholder={`אפשרות ${i + 1}`}
                      value={opt}
                      onChange={(e) => {
                        const next = [...pollOptions];
                        next[i] = e.target.value;
                        setPollOptions(next);
                      }}
                      className="w-full p-2 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-100"
                    />
                  ))}
                </div>
              )}

              {/* Actions Footer */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setShowPoll(!showPoll)}
                  className={`text-xs px-3 py-1.5 rounded-xl border transition-colors ${
                    showPoll
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/50'
                      : 'border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  📊 {showPoll ? 'הסר סקר' : '+ צרף סקר'}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-slate-200"
                  >
                    ביטול
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !content.trim()}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 hover:opacity-90 disabled:opacity-40 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20"
                  >
                    {loading ? 'מפרסם...' : 'פרסם עכשיו 🚀'}
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
