'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

interface StorySlide {
  id: string;
  mediaUrl: string;
  caption?: string;
  createdAt: string;
}

interface UserStoryGroup {
  id: string;
  userId: string;
  username: string;
  name: string;
  avatar: string;
  coverImage: string;
  slides: StorySlide[];
  hasUnread: boolean;
}

const INITIAL_STORIES: UserStoryGroup[] = [
  {
    id: 'user-idan',
    userId: '1',
    username: 'idan',
    name: 'עידן קזם (הסטורי שלך)',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=idan',
    coverImage: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80',
    hasUnread: false,
    slides: [
      {
        id: 's1-1',
        mediaUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
        caption: 'משיקים את עמוד הסטוריז החדש והמשודרג ברשת! ⚡ ברוכים הבאים לעידן של חוויית תוכן אינטראקטיבית ומהירה.',
        createdAt: 'לפני 10 דקות',
      },
      {
        id: 's1-2',
        mediaUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=80',
        caption: 'סוכן ה-AI סרק את הפיד ומצא טרנדים מדהימים לפיתוח היום 🤖 הכל רץ חלק בביצועי שיא.',
        createdAt: 'לפני 5 דקות',
      },
    ],
  },
  {
    id: 'user-noa',
    userId: '2',
    username: 'noa',
    name: 'נועה כהן',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Noa',
    coverImage: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
    hasUnread: true,
    slides: [
      {
        id: 's2-1',
        mediaUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1200&q=80',
        caption: 'בוקר טוב קהילת SocialFlow! שבוע של חידושים ופיתוחים מרגשים ✨☕',
        createdAt: 'לפני שעה',
      },
    ],
  },
  {
    id: 'user-daniel',
    userId: '3',
    username: 'daniel',
    name: 'דניאל לוי',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Daniel',
    coverImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80',
    hasUnread: true,
    slides: [
      {
        id: 's3-1',
        mediaUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=1200&q=80',
        caption: 'הריאקציות המונפשות עובדות פשוט מושלם ב-0ms! 🔥👏 כל הכבוד לצוות.',
        createdAt: 'לפני שעתיים',
      },
    ],
  },
  {
    id: 'user-maya',
    userId: '4',
    username: 'maya',
    name: 'מאיה שקד',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Maya',
    coverImage: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80',
    hasUnread: true,
    slides: [
      {
        id: 's4-1',
        mediaUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1200&q=80',
        caption: 'עיצוב זכוכית חלבית Liquid Glass 4.0 Pro עם תאורת אווירה מדהימה 🎨💜',
        createdAt: 'לפני 3 שעות',
      },
    ],
  },
];

export default function StoriesPage() {
  const [stories, setStories] = useState<UserStoryGroup[]>(INITIAL_STORIES);
  const [currentUserIndex, setCurrentUserIndex] = useState(0);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [replyText, setReplyText] = useState('');
  const [flyingHearts, setFlyingHearts] = useState<{ id: number; emoji: string }[]>([]);
  const [isCreatorOpen, setIsCreatorOpen] = useState(false);
  const [newCaption, setNewCaption] = useState('');
  const [newMediaUrl, setNewMediaUrl] = useState(
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80'
  );
  const [toast, setToast] = useState<string | null>(null);

  const currentUser = stories[currentUserIndex] || stories[0];
  const currentSlide = currentUser.slides[currentSlideIndex] || currentUser.slides[0];
  const DURATION_MS = 5000;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Progress timer
  useEffect(() => {
    if (isPaused || isCreatorOpen) return;

    const interval = 50;
    const step = (interval / DURATION_MS) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev + step >= 100) {
          handleNextSlide();
          return 0;
        }
        return prev + step;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [currentUserIndex, currentSlideIndex, isPaused, isCreatorOpen]);

  const handleNextSlide = () => {
    setProgress(0);
    if (currentSlideIndex < currentUser.slides.length - 1) {
      setCurrentSlideIndex((prev) => prev + 1);
    } else if (currentUserIndex < stories.length - 1) {
      setCurrentUserIndex((prev) => prev + 1);
      setCurrentSlideIndex(0);
    } else {
      setCurrentUserIndex(0);
      setCurrentSlideIndex(0);
    }
  };

  const handlePrevSlide = () => {
    setProgress(0);
    if (currentSlideIndex > 0) {
      setCurrentSlideIndex((prev) => prev - 1);
    } else if (currentUserIndex > 0) {
      setCurrentUserIndex((prev) => prev - 1);
      const prevUser = stories[currentUserIndex - 1];
      setCurrentSlideIndex(prevUser.slides.length - 1);
    }
  };

  const handleSendReaction = (emoji: string) => {
    const heart = { id: Date.now(), emoji };
    setFlyingHearts((prev) => [...prev, heart]);
    setTimeout(() => {
      setFlyingHearts((prev) => prev.filter((h) => h.id !== heart.id));
    }, 1200);
  };

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    handleSendReaction('💬');
    setReplyText('');
    showToast('התגובה נשלחה בהצלחה בפרטי!');
  };

  const handleAddCustomStory = () => {
    if (!newCaption.trim()) return;
    const newSlide: StorySlide = {
      id: `custom_${Date.now()}`,
      mediaUrl: newMediaUrl,
      caption: newCaption,
      createdAt: 'כרגע',
    };

    const updated = [...stories];
    updated[0].slides.unshift(newSlide);
    setStories(updated);
    setCurrentUserIndex(0);
    setCurrentSlideIndex(0);
    setProgress(0);
    setNewCaption('');
    setIsCreatorOpen(false);
    showToast('הסטורי שלך פורסם בהצלחה!');
  };

  return (
    <div dir="rtl" className="w-full min-h-screen bg-[#090A0F] text-[#F8FAFC] flex flex-col items-center justify-between select-none relative overflow-hidden font-sans">
      
      {/* Background Ambience */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute -top-32 start-[-80px] h-[420px] w-[420px] rounded-full bg-[#6366F1]/20 blur-[140px]" />
        <div className="absolute bottom-10 end-[-100px] h-[460px] w-[460px] rounded-full bg-[#8B5CF6]/18 blur-[150px]" />
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 z-50 px-6 py-3 rounded-2xl bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] text-white font-bold shadow-[0_12px_32px_rgba(99,102,241,0.45)] border border-white/15"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Header Bar */}
      <header className="w-full max-w-[1360px] px-4 sm:px-8 py-5 flex flex-wrap items-center justify-between gap-3 z-40 relative">
        <Link
          href="/"
          className="flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-[#121521]/80 border border-white/10 backdrop-blur-xl text-sm font-bold text-[#F8FAFC] hover:border-indigo-500/40 hover:bg-[#181C2C] transition-all shadow-lg no-underline"
        >
          <span>✕</span>
          <span>חזרה לפיד הראשי</span>
        </Link>

        {/* Stories Switcher Tray (Friends Avatars) */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-[#121521]/80 border border-white/10 backdrop-blur-xl shadow-xl overflow-x-auto no-scrollbar max-w-full">
          {stories.map((storyUser, idx) => (
            <button
              key={storyUser.id}
              onClick={() => {
                setCurrentUserIndex(idx);
                setCurrentSlideIndex(0);
                setProgress(0);
              }}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full transition-all cursor-pointer shrink-0 ${
                idx === currentUserIndex
                  ? 'bg-gradient-to-r from-[#6366F1]/25 to-[#8B5CF6]/25 border border-indigo-400/50 text-white'
                  : 'text-[#94A3B8] hover:text-white border border-transparent'
              }`}
            >
              <img src={storyUser.avatar} alt="" className="w-7 h-7 rounded-full border border-indigo-400/50 bg-[#090A0F]" />
              <span className="text-xs font-bold font-mono">@{storyUser.username}</span>
            </button>
          ))}
        </div>

        <button
          onClick={() => setIsCreatorOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] text-white font-bold text-xs shadow-[0_6px_20px_-4px_rgba(99,102,241,0.6)] hover:brightness-110 transition-all cursor-pointer"
        >
          <span>+</span>
          <span>סטורי חדש</span>
        </button>
      </header>

      {/* Main Stories Desktop Theater Stage */}
      <div className="w-full flex-1 flex items-center justify-center px-4 relative z-30 my-4">
        
        {/* Navigation Arrows */}
        <button
          onClick={handlePrevSlide}
          className="absolute start-8 z-40 w-12 h-12 rounded-full bg-[#121521]/85 border border-white/15 backdrop-blur-xl text-white text-lg flex items-center justify-center hover:border-indigo-400 hover:bg-indigo-500/20 transition-all cursor-pointer shadow-2xl hidden md:flex"
          title="הקודם"
        >
          ▶
        </button>
        <button
          onClick={handleNextSlide}
          className="absolute end-8 z-40 w-12 h-12 rounded-full bg-[#121521]/85 border border-white/15 backdrop-blur-xl text-white text-lg flex items-center justify-center hover:border-indigo-400 hover:bg-indigo-500/20 transition-all cursor-pointer shadow-2xl hidden md:flex"
          title="הבא"
        >
          ◀
        </button>

        {/* Previous Story Card (Ghost on Right in RTL) */}
        {currentUserIndex > 0 && (
          <div
            onClick={handlePrevSlide}
            className="hidden lg:block w-60 h-[620px] rounded-3xl overflow-hidden opacity-40 scale-90 blur-[1px] hover:opacity-75 transition-all cursor-pointer border border-white/15 me-6 shadow-2xl shrink-0"
          >
            <img
              src={stories[currentUserIndex - 1].slides[0].mediaUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Active Central Story Card */}
        <div
          className="relative w-full max-w-[460px] h-[78vh] max-h-[780px] rounded-3xl overflow-hidden bg-[#121521] border border-indigo-400/40 shadow-[0_24px_64px_-12px_rgba(99,102,241,0.35)] flex flex-col justify-between"
          onMouseDown={() => setIsPaused(true)}
          onMouseUp={() => setIsPaused(false)}
          onTouchStart={() => setIsPaused(true)}
          onTouchEnd={() => setIsPaused(false)}
        >
          {/* Background Media */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide.id}
              initial={{ opacity: 0.7, scale: 1.02 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0.5 }}
              transition={{ duration: 0.25 }}
              className="absolute inset-0 z-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${currentSlide.mediaUrl})` }}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-black/85 via-transparent to-black/90 pointer-events-none" />
            </motion.div>
          </AnimatePresence>

          {/* Tap Zones */}
          <div className="absolute inset-y-20 inset-x-0 z-10 grid grid-cols-2">
            <div onClick={handlePrevSlide} className="h-full cursor-pointer" />
            <div onClick={handleNextSlide} className="h-full cursor-pointer" />
          </div>

          {/* Top Progress Bars & User Meta */}
          <div className="relative z-20 p-5 space-y-3 pointer-events-none">
            {/* Progress Bars */}
            <div className="flex items-center gap-1.5 w-full">
              {currentUser.slides.map((slide, sIdx) => {
                let fillWidth = '0%';
                if (sIdx < currentSlideIndex) fillWidth = '100%';
                else if (sIdx === currentSlideIndex) fillWidth = `${progress}%`;

                return (
                  <div key={slide.id} className="flex-1 h-1.5 bg-white/30 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] transition-all duration-75" style={{ width: fillWidth }} />
                  </div>
                );
              })}
            </div>

            {/* Author Info */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  className="w-12 h-12 rounded-full border-2 border-[#6366F1] shadow-md object-cover bg-[#090A0F]"
                />
                <div className="text-start">
                  <div className="font-bold text-sm text-white drop-shadow-md">{currentUser.name}</div>
                  <div className="text-xs text-slate-300 drop-shadow-sm font-mono">
                    @{currentUser.username} &bull; {currentSlide.createdAt}
                  </div>
                </div>
              </div>

              <span className="text-xs px-3 py-1 rounded-full bg-black/60 border border-white/20 text-white backdrop-blur-md font-mono">
                {currentSlideIndex + 1}/{currentUser.slides.length}
              </span>
            </div>
          </div>

          {/* Bottom Caption & Interactive Reply */}
          <div className="relative z-20 p-5 space-y-4 pointer-events-auto">
            {currentSlide.caption && (
              <motion.div
                key={currentSlide.id + '_caption'}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-2xl bg-[#121521]/90 border border-white/15 backdrop-blur-xl text-sm leading-relaxed text-[#F8FAFC] shadow-2xl text-start font-medium"
                dir="auto"
              >
                {currentSlide.caption}
              </motion.div>
            )}

            {/* Quick Reactions */}
            <div className="flex items-center justify-around py-1">
              {['❤️', '🔥', '👏', '😂', '😮'].map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleSendReaction(emoji)}
                  className="text-3xl transition-transform hover:scale-125 active:scale-90 p-1 cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </div>

            {/* Direct Message Input */}
            <form onSubmit={handleSendReply} className="flex items-center gap-2.5">
              <input
                type="text"
                dir="auto"
                placeholder={`השב ל-${currentUser.name}...`}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className="flex-1 px-4 py-3 rounded-full bg-[#090A0F]/80 border border-white/20 text-xs text-white placeholder-[#94A3B8] backdrop-blur-md focus:outline-none focus:border-[#6366F1]"
              />
              <button
                type="submit"
                disabled={!replyText.trim()}
                className="w-11 h-11 rounded-full bg-gradient-to-tr from-[#6366F1] to-[#8B5CF6] hover:brightness-110 disabled:opacity-30 text-white font-bold flex items-center justify-center transition-all shadow-lg cursor-pointer"
              >
                ➤
              </button>
            </form>
          </div>

          {/* Flying Hearts */}
          <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
            {flyingHearts.map((h) => (
              <motion.div
                key={h.id}
                initial={{ opacity: 1, y: 550, scale: 0.8, x: 220 }}
                animate={{ opacity: 0, y: 80, scale: 2.4, x: 200 + (Math.random() * 80 - 40) }}
                transition={{ duration: 1.1, ease: 'easeOut' }}
                className="absolute text-5xl"
              >
                {h.emoji}
              </motion.div>
            ))}
          </div>
        </div>

        {/* Next Story Card (Ghost on Left in RTL) */}
        {currentUserIndex < stories.length - 1 && (
          <div
            onClick={handleNextSlide}
            className="hidden lg:block w-60 h-[620px] rounded-3xl overflow-hidden opacity-40 scale-90 blur-[1px] hover:opacity-75 transition-all cursor-pointer border border-white/15 ms-6 shadow-2xl shrink-0"
          >
            <img
              src={stories[currentUserIndex + 1].slides[0].mediaUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
        )}
      </div>

      {/* Story Creator Modal */}
      <AnimatePresence>
        {isCreatorOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md p-6 rounded-3xl border border-white/15 bg-[#121521]/95 backdrop-blur-2xl shadow-[0_24px_64px_rgba(0,0,0,0.85)] space-y-5"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <h3 className="font-bold text-base text-[#F8FAFC] flex items-center gap-2">
                  <span>✨</span>
                  <span>יצירת סטורי חדש</span>
                </h3>
                <button
                  onClick={() => setIsCreatorOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-[#94A3B8] hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#94A3B8] mb-2">טקסט / כיתוב על הסטורי:</label>
                <textarea
                  rows={3}
                  dir="auto"
                  value={newCaption}
                  onChange={(e) => setNewCaption(e.target.value)}
                  placeholder="מה תרצה לספר לעוקבים בסטורי?"
                  className="w-full p-3.5 rounded-2xl bg-[#090A0F]/85 border border-white/10 text-sm text-[#F8FAFC] placeholder-[#64748B] focus:outline-none focus:border-indigo-500/60"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#94A3B8] mb-2">בחר תמונת רקע איכותית:</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80',
                    'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=600&q=80',
                    'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=600&q=80',
                  ].map((url, i) => (
                    <div
                      key={i}
                      onClick={() => setNewMediaUrl(url)}
                      className={`h-24 rounded-2xl overflow-hidden cursor-pointer border-2 transition-all ${
                        newMediaUrl === url ? 'border-[#6366F1] scale-[0.97] shadow-[0_0_20px_rgba(99,102,241,0.45)]' : 'border-white/10 opacity-65 hover:opacity-90'
                      }`}
                    >
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setIsCreatorOpen(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-white/5 border border-white/10 text-xs text-[#94A3B8] hover:text-white font-semibold transition-colors cursor-pointer"
                >
                  ביטול
                </button>
                <button
                  onClick={handleAddCustomStory}
                  disabled={!newCaption.trim()}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] text-white text-sm font-bold shadow-[0_6px_20px_-4px_rgba(99,102,241,0.65)] disabled:opacity-40 hover:brightness-110 transition-all cursor-pointer"
                >
                  פרסם סטורי 🚀
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
