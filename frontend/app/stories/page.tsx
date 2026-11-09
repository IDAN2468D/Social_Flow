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
    <div dir="rtl" className="w-full min-h-screen bg-[#07090e] text-slate-100 flex flex-col items-center justify-between select-none relative overflow-hidden font-sans">
      
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#07090e] via-slate-950 to-black pointer-events-none" />
      <div className="bg-orb orb-1 opacity-30 pointer-events-none" />
      <div className="bg-orb orb-2 opacity-30 pointer-events-none" />

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 z-50 px-6 py-3 rounded-2xl bg-cyan-500 text-slate-950 font-bold shadow-2xl"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Header Bar */}
      <header className="w-full max-w-[1400px] px-8 py-5 flex items-center justify-between z-40 relative">
        <Link
          href="/"
          className="flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-slate-900/80 border border-white/15 backdrop-blur-xl text-sm font-bold text-white hover:border-cyan-400 hover:bg-slate-850 transition-all shadow-lg no-underline"
        >
          <span>✕</span>
          <span>חזרה לפיד הראשי</span>
        </Link>

        {/* Stories Switcher Tray (Friends Avatars) */}
        <div className="flex items-center gap-3 px-5 py-2 rounded-full bg-slate-900/85 border border-white/15 backdrop-blur-xl shadow-xl">
          {stories.map((storyUser, idx) => (
            <button
              key={storyUser.id}
              onClick={() => {
                setCurrentUserIndex(idx);
                setCurrentSlideIndex(0);
                setProgress(0);
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all cursor-pointer ${
                idx === currentUserIndex
                  ? 'bg-cyan-500/20 border border-cyan-400/60 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <img src={storyUser.avatar} alt="" className="w-7 h-7 rounded-full border border-cyan-400/50" />
              <span className="text-xs font-bold">{storyUser.username}</span>
            </button>
          ))}
        </div>

        <button
          onClick={() => setIsCreatorOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-cyan-500 to-indigo-600 text-slate-950 font-bold text-xs shadow-lg hover:opacity-95 transition-all cursor-pointer"
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
          className="absolute start-12 z-40 w-14 h-14 rounded-full bg-slate-900/80 border border-white/20 text-white text-2xl flex items-center justify-center hover:bg-cyan-500 hover:text-slate-950 transition-all cursor-pointer shadow-2xl hidden md:flex"
          title="הקודם"
        >
          ▶
        </button>
        <button
          onClick={handleNextSlide}
          className="absolute end-12 z-40 w-14 h-14 rounded-full bg-slate-900/80 border border-white/20 text-white text-2xl flex items-center justify-center hover:bg-cyan-500 hover:text-slate-950 transition-all cursor-pointer shadow-2xl hidden md:flex"
          title="הבא"
        >
          ◀
        </button>

        {/* Previous Story Card (Ghost on Right in RTL) */}
        {currentUserIndex > 0 && (
          <div
            onClick={handlePrevSlide}
            className="w-64 h-[640px] rounded-3xl overflow-hidden opacity-40 scale-90 blur-[1px] hover:opacity-70 transition-all cursor-pointer border border-white/15 me-6 shadow-2xl flex-shrink-0"
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
          className="relative w-full max-w-[500px] h-[82vh] max-h-[820px] rounded-3xl overflow-hidden bg-slate-950 border-2 border-cyan-400/50 shadow-[0_0_50px_rgba(6,182,212,0.25)] flex flex-col justify-between"
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
                    <div className="h-full bg-cyan-400 transition-all duration-75" style={{ width: fillWidth }} />
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
                  className="w-12 h-12 rounded-full border-2 border-cyan-400 shadow-md object-cover bg-slate-950"
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
                style={{
                  backgroundColor: 'rgba(10, 15, 28, 0.92)',
                  color: '#ffffff',
                  border: '1.5px solid rgba(6, 182, 212, 0.5)',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.8)',
                }}
                className="p-4 rounded-2xl text-base leading-relaxed text-white shadow-2xl text-start font-bold"
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
                  className="text-3xl transition-transform hover:scale-135 active:scale-90 p-1 cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </div>

            {/* Direct Message Input */}
            <form onSubmit={handleSendReply} className="flex items-center gap-2.5">
              <input
                type="text"
                placeholder={`השב ל-${currentUser.name}...`}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className="flex-1 px-4 py-3 rounded-full bg-black/70 border border-white/25 text-xs text-white placeholder-slate-400 backdrop-blur-md focus:outline-none focus:border-cyan-400"
              />
              <button
                type="submit"
                disabled={!replyText.trim()}
                className="w-12 h-12 rounded-full bg-cyan-500 hover:bg-cyan-400 disabled:opacity-30 text-slate-950 font-bold flex items-center justify-center transition-all shadow-lg cursor-pointer"
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
            className="w-64 h-[640px] rounded-3xl overflow-hidden opacity-40 scale-90 blur-[1px] hover:opacity-70 transition-all cursor-pointer border border-white/15 ms-6 shadow-2xl flex-shrink-0"
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md p-6 rounded-3xl border border-cyan-500/40 bg-slate-900 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <h3 className="font-bold text-base text-white flex items-center gap-2">
                  <span>✨</span>
                  <span>יצירת סטורי חדש</span>
                </h3>
                <button onClick={() => setIsCreatorOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">טקסט / כיתוב על הסטורי:</label>
                <textarea
                  rows={3}
                  value={newCaption}
                  onChange={(e) => setNewCaption(e.target.value)}
                  placeholder="מה תרצה לספר לעוקבים בסטורי?"
                  className="w-full p-3 rounded-2xl bg-slate-950/80 border border-white/10 text-sm text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">בחר תמונת רקע איכותית:</label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80',
                    'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=600&q=80',
                    'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=600&q=80',
                  ].map((url, i) => (
                    <div
                      key={i}
                      onClick={() => setNewMediaUrl(url)}
                      className={`h-24 rounded-2xl overflow-hidden cursor-pointer border-2 transition-all ${
                        newMediaUrl === url ? 'border-cyan-400 scale-95 shadow-lg' : 'border-transparent opacity-60'
                      }`}
                    >
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  onClick={() => setIsCreatorOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-xs text-slate-300 font-semibold cursor-pointer"
                >
                  ביטול
                </button>
                <button
                  onClick={handleAddCustomStory}
                  disabled={!newCaption.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 text-slate-950 text-sm font-bold shadow-lg disabled:opacity-40 cursor-pointer"
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
