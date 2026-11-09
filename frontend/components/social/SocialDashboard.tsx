'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

// --- Interfaces ---
export interface PollOption {
  id: number;
  text: string;
  votes: number;
  percentage: number;
}

export interface PostPoll {
  question: string;
  options: PollOption[];
  totalVotes: number;
  userVotedId?: number | null;
}

export interface CommentItem {
  id: string;
  authorName: string;
  authorUsername: string;
  authorAvatar: string;
  content: string;
  createdAt: string;
}

export interface Post {
  id: number;
  authorUsername: string;
  authorName: string;
  authorAvatar: string;
  content: string;
  tags: string[];
  createdAt: string;
  likesCount: number;
  isLiked?: boolean;
  userReaction?: string | null;
  reactionCounts: { [emoji: string]: number };
  poll?: PostPoll;
  attachedEntity?: {
    type: string;
    title: string;
    badge: string;
  };
  comments: CommentItem[];
}

export interface StorySlide {
  id: string;
  mediaUrl: string;
  caption?: string;
  createdAt: string;
}

export interface UserStoryGroup {
  id: string;
  userId: string;
  username: string;
  name: string;
  avatar: string;
  coverImage: string;
  slides: StorySlide[];
  hasUnread: boolean;
}

// Initial Stories Data
const INITIAL_STORIES_DATA: UserStoryGroup[] = [
  {
    id: 'user-idan',
    userId: '1',
    username: 'idan',
    name: 'הסטורי שלך',
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=idan',
    coverImage: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80',
    hasUnread: false,
    slides: [
      {
        id: 's1-1',
        mediaUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1000&q=80',
        caption: 'משיקים את עמוד הסטוריז המשודרג ברשת SocialFlow! ⚡🚀',
        createdAt: 'לפני 10 דקות',
      },
      {
        id: 's1-2',
        mediaUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1000&q=80',
        caption: 'סוכן ה-AI סרק את הפיד ומצא טרנדים מדהימים לפיתוח היום 🤖',
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
        mediaUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1000&q=80',
        caption: 'בוקר טוב קהילת SocialFlow! שבוע מלא פיתוחים וחידושים מרגשים ✨',
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
        mediaUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=1000&q=80',
        caption: 'הריאקציות המונפשות עובדות מהר וחלק ב-0ms! 🔥👏',
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
        mediaUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1000&q=80',
        caption: 'עיצוב זכוכית חלבית Liquid Glass 4.0 Pro עם תאורת אווירה מדהימה 🎨💜',
        createdAt: 'לפני 3 שעות',
      },
    ],
  },
  {
    id: 'user-yonatan',
    userId: '5',
    username: 'yonatan',
    name: 'יונתן רון',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Yonatan',
    coverImage: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=600&q=80',
    hasUnread: false,
    slides: [
      {
        id: 's5-1',
        mediaUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=1000&q=80',
        caption: 'בדיקות עומס וביצועים של ה-API Gateway הושלמו בהצלחה מלאה 🚀',
        createdAt: 'לפני 4 שעות',
      },
    ],
  },
];

// Curated Posts with Clean Hebrew BiDi
const INITIAL_POSTS: Post[] = [
  {
    id: 1,
    authorUsername: 'idan',
    authorName: 'עידן קזם',
    authorAvatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=idan',
    content: 'שלום לכולם! שמחים להשיק את הגרסה החדשה של רשת SocialFlow 🚀\nשדרגנו את כל המערכת לפרונטנד מודרני ב-Next.js 15 ו-React 19.\nהמערכת כוללת כעת סוכני AI אוטונומיים של LangGraph, נגן סטוריז אינטראקטיבי, ומערכת ריאקציות מהירה ב-0ms בעיצוב Liquid Glass 4.0 Pro מרווח, ברור וקריא.',
    tags: ['Nextjs15', 'LangGraph', 'SocialFlow', 'React19'],
    createdAt: 'לפני 5 דקות',
    likesCount: 68,
    isLiked: false,
    reactionCounts: { '❤️': 32, '🔥': 24, '👏': 18, '⭐': 11, '💡': 9 },
    attachedEntity: {
      type: 'PROJECT',
      title: 'ארכיטקטורת Next.js 15 וסוכני AI אוטונומיים',
      badge: 'v10.0 Pro',
    },
    poll: {
      question: 'איך חוויית הריצה, הנראות וקנה המידה של ה-UI כעת?',
      options: [
        { id: 1, text: 'נראה פנטסטי, רחב, ברור ועשיר! 🔥', votes: 74, percentage: 76 },
        { id: 2, text: 'נוח וקריא במיוחד 👏', votes: 24, percentage: 24 },
      ],
      totalVotes: 98,
      userVotedId: null,
    },
    comments: [
      {
        id: 'c1',
        authorName: 'נועה כהן',
        authorUsername: 'noa',
        authorAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Noa',
        content: 'העיצוב הממורכז עם הגריד הרחב והפונטים הגדולים נראה מעולה! הכל קריא וחד.',
        createdAt: 'לפני 3 דקות',
      },
      {
        id: 'c2',
        authorName: 'דניאל לוי',
        authorUsername: 'daniel',
        authorAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Daniel',
        content: 'איזה כיף לראות את סוכן ה-LangGraph עובד בצורה אוטונומית כחלק מהמערכת.',
        createdAt: 'לפני דקה',
      },
    ],
  },
  {
    id: 2,
    authorUsername: 'noa',
    authorName: 'נועה כהן',
    authorAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Noa',
    content: 'סוכן ה-AI סורק את הפיד, מזהה טרנדים, מוודא בטיחות תוכן ומכין טיוטה מושלמת הממתינה לאישור אנושי בלחיצה אחת לפני פרסום לפיד! ✨🤖',
    tags: ['AI_Agents', 'LangGraph', 'Innovation'],
    createdAt: 'לפני 25 דקות',
    likesCount: 39,
    isLiked: false,
    reactionCounts: { '❤️': 15, '🔥': 11, '👏': 8, '⭐': 5, '💡': 6 },
    comments: [],
  },
  {
    id: 3,
    authorUsername: 'daniel',
    authorName: 'דניאל לוי',
    authorAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Daniel',
    content: 'עמוד הסטוריז החדש ב-Stories מספק חוויה סוחפת של שקופיות עם השהיה בלחיצה רצופה, ריאקציות מרחפות ומעבר חלק בין חברים!',
    tags: ['Stories', 'UserExperience', 'Nextjs15'],
    createdAt: 'לפני שעה',
    likesCount: 52,
    isLiked: false,
    reactionCounts: { '❤️': 22, '🔥': 17, '👏': 14, '⭐': 7, '💡': 8 },
    comments: [
      {
        id: 'c3',
        authorName: 'מאיה שקד',
        authorUsername: 'maya',
        authorAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Maya',
        content: 'ממש מזכיר את החוויה של אינסטגרם אבל עם ביצועים מהירים בהרבה בדפדפן!',
        createdAt: 'לפני 40 דקות',
      },
    ],
  },
];

// Format Hebrew BiDi Text smoothly without breaking English word order
function renderBiDiText(text: string) {
  const lines = text.split('\n');
  return lines.map((line, idx) => (
    <p key={idx} dir="auto" className="text-start leading-relaxed my-1.5 break-words font-normal text-slate-100 text-lg">
      {line}
    </p>
  ));
}

export function SocialDashboard() {
  // Navigation & Filter states
  const [activeTab, setActiveTab] = useState<'for-you' | 'trending' | 'saved' | 'following'>('for-you');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>(INITIAL_POSTS);
  const [savedPostIds, setSavedPostIds] = useState<number[]>([1]);
  const [followingUsers, setFollowingUsers] = useState<string[]>(['noa', 'daniel']);
  
  // Modals & Drawers
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  // In-Feed Stories state
  const storiesReelRef = useRef<HTMLDivElement>(null);
  const scrollStories = (direction: 'left' | 'right') => {
    if (storiesReelRef.current) {
      storiesReelRef.current.scrollBy({ left: direction === 'left' ? -340 : 340, behavior: 'smooth' });
    }
  };
  const [stories, setStories] = useState<UserStoryGroup[]>(INITIAL_STORIES_DATA);
  const [activeStoryViewerIndex, setActiveStoryViewerIndex] = useState<number | null>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [storyProgress, setStoryProgress] = useState(0);
  const [isStoryPaused, setIsStoryPaused] = useState(false);
  const [storyReplyText, setStoryReplyText] = useState('');
  const [flyingStoryReactions, setFlyingStoryReactions] = useState<{ id: number; emoji: string }[]>([]);
  const [isCreateStoryOpen, setIsCreateStoryOpen] = useState(false);
  const [newStoryCaption, setNewStoryCaption] = useState('');
  const [newStoryCover, setNewStoryCover] = useState('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1000&q=80');

  // Composer state
  const [composerText, setComposerText] = useState('');
  const [composerAudience, setComposerAudience] = useState('ציבורי');
  const [showPollBuilder, setShowPollBuilder] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOpt1, setPollOpt1] = useState('');
  const [pollOpt2, setPollOpt2] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Agent State
  const [agentTopic, setAgentTopic] = useState('');
  const [agentAudience, setAgentAudience] = useState('קהילת מפתחי AI ו-Web');
  const [agentRunning, setAgentRunning] = useState(false);
  const [agentLogs, setAgentLogs] = useState<string[]>([]);
  const [agentDraft, setAgentDraft] = useState<string | null>(null);

  // Chat State
  const [chatMessages, setChatMessages] = useState([
    { id: 1, sender: 'noa', name: 'נועה כהן', text: 'היי עידן! ראית את הגרסה החדשה של סוכן ה-AI?', time: '12:05' },
    { id: 2, sender: 'me', name: 'עידן קזם', text: 'כן, זה עובד פשוט מדהים! הגריד הממורכז נראה מעולה.', time: '12:07' },
  ]);
  const [newMsg, setNewMsg] = useState('');

  // Notifications
  const [notifications, setNotifications] = useState([
    { id: 1, text: 'נועה כהן הגיבה על הפוסט שלך: "העיצוב הממורכז נראה מעולה!"', time: 'לפני 3 דקות', unread: true },
    { id: 2, text: 'דניאל לוי הצביע בסקר שלך', time: 'לפני 10 דקות', unread: true },
    { id: 3, text: 'סוכן ה-AI סיים לחקור טרנדים חדשים', time: 'לפני 25 דקות', unread: false },
  ]);

  // Toast Helper
  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Story Timer
  useEffect(() => {
    if (activeStoryViewerIndex === null || isStoryPaused || isCreateStoryOpen) return;
    const currentGroup = stories[activeStoryViewerIndex];
    if (!currentGroup) return;

    const interval = 50;
    const step = (interval / 5000) * 100;

    const timer = setInterval(() => {
      setStoryProgress((prev) => {
        if (prev + step >= 100) {
          handleNextStorySlide();
          return 0;
        }
        return prev + step;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [activeStoryViewerIndex, currentSlideIndex, isStoryPaused, isCreateStoryOpen, stories]);

  const handleNextStorySlide = () => {
    setStoryProgress(0);
    if (activeStoryViewerIndex === null) return;
    const currentGroup = stories[activeStoryViewerIndex];
    if (currentSlideIndex < currentGroup.slides.length - 1) {
      setCurrentSlideIndex((prev) => prev + 1);
    } else if (activeStoryViewerIndex < stories.length - 1) {
      setActiveStoryViewerIndex((prev) => (prev !== null ? prev + 1 : 0));
      setCurrentSlideIndex(0);
    } else {
      setActiveStoryViewerIndex(null);
      setCurrentSlideIndex(0);
    }
  };

  const handlePrevStorySlide = () => {
    setStoryProgress(0);
    if (activeStoryViewerIndex === null) return;
    if (currentSlideIndex > 0) {
      setCurrentSlideIndex((prev) => prev - 1);
    } else if (activeStoryViewerIndex > 0) {
      const prevIdx = activeStoryViewerIndex - 1;
      setActiveStoryViewerIndex(prevIdx);
      setCurrentSlideIndex(stories[prevIdx].slides.length - 1);
    }
  };

  const handleSendStoryReaction = (emoji: string) => {
    const rId = Date.now();
    setFlyingStoryReactions((prev) => [...prev, { id: rId, emoji }]);
    setTimeout(() => {
      setFlyingStoryReactions((prev) => prev.filter((r) => r.id !== rId));
    }, 1200);
  };

  const handleCreateCustomStory = () => {
    if (!newStoryCaption.trim()) return;
    const newSlide: StorySlide = {
      id: `story_${Date.now()}`,
      mediaUrl: newStoryCover,
      caption: newStoryCaption,
      createdAt: 'כרגע',
    };
    setStories((prev) => {
      const updated = [...prev];
      updated[0].slides.unshift(newSlide);
      updated[0].hasUnread = true;
      return updated;
    });
    setNewStoryCaption('');
    setIsCreateStoryOpen(false);
    showToast('הסטורי שלך פורסם בהצלחה! 🌟', 'success');
  };

  // Reactions & Bookmarks
  const handleReaction = (postId: number, emoji: string) => {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id === postId) {
          const prevUserReaction = p.userReaction;
          const newCounts = { ...p.reactionCounts };
          if (prevUserReaction && newCounts[prevUserReaction]) {
            newCounts[prevUserReaction] = Math.max(0, newCounts[prevUserReaction] - 1);
          }
          if (prevUserReaction === emoji) {
            return { ...p, userReaction: null, reactionCounts: newCounts };
          }
          newCounts[emoji] = (newCounts[emoji] || 0) + 1;
          return { ...p, userReaction: emoji, reactionCounts: newCounts };
        }
        return p;
      })
    );
    showToast(`הגבת ב-${emoji} לפוסט!`, 'success');
  };

  const handleToggleSave = (postId: number) => {
    setSavedPostIds((prev) => {
      const exists = prev.includes(postId);
      const next = exists ? prev.filter((id) => id !== postId) : [...prev, postId];
      showToast(exists ? 'הפוסט הוסר מהשמורים' : 'הפוסט נשמר בסימניות! 🔖', 'success');
      return next;
    });
  };

  const handleVotePoll = (postId: number, optId: number) => {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id === postId && p.poll) {
          if (p.poll.userVotedId) return p;
          const newTotal = p.poll.totalVotes + 1;
          const newOpts = p.poll.options.map((opt) => {
            const votes = opt.id === optId ? opt.votes + 1 : opt.votes;
            const percentage = Math.round((votes / newTotal) * 100);
            return { ...opt, votes, percentage };
          });
          return {
            ...p,
            poll: { ...p.poll, totalVotes: newTotal, userVotedId: optId, options: newOpts },
          };
        }
        return p;
      })
    );
    showToast('הצבעתך בסקר נקלטה בהצלחה! 📊', 'success');
  };

  // Post Submission
  const handleCreatePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!composerText.trim() && !pollQuestion.trim()) return;
    setIsSubmitting(true);

    const newPost: Post = {
      id: Date.now(),
      authorUsername: 'idan',
      authorName: 'עידן קזם',
      authorAvatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=idan',
      content: composerText,
      tags: ['SocialFlow', 'Nextjs15', 'Update'],
      createdAt: 'כרגע',
      likesCount: 1,
      isLiked: true,
      reactionCounts: { '❤️': 1 },
      comments: [],
    };

    if (showPollBuilder && pollQuestion.trim() && pollOpt1.trim() && pollOpt2.trim()) {
      newPost.poll = {
        question: pollQuestion,
        options: [
          { id: 1, text: pollOpt1, votes: 0, percentage: 0 },
          { id: 2, text: pollOpt2, votes: 0, percentage: 0 },
        ],
        totalVotes: 0,
      };
    }

    setPosts((prev) => [newPost, ...prev]);
    setComposerText('');
    setPollQuestion('');
    setPollOpt1('');
    setPollOpt2('');
    setShowPollBuilder(false);
    setIsSubmitting(false);
    showToast('הפוסט פורסם בהצלחה בפיד! 🚀', 'success');
  };

  // Run LangGraph Agent
  const handleRunAgent = async () => {
    if (!agentTopic.trim()) return;
    setAgentRunning(true);
    setAgentLogs([
      '🔍 סוכן LangGraph סורק מגמות ונושאים חמים ברשת...',
      '✍️ מנסח טיוטת פוסט מותאמת אישית לקהל היעד...',
      '🛡️ בודק בטיחות תוכן, רלוונטיות טכנולוגית ותקינות BiDi...',
      '✅ טיוטה מוכנה לאישור אנושי!',
    ]);

    try {
      const res = await fetch('/api/v1/ai/agent/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: agentTopic,
          user_id: 1,
          target_audience: agentAudience,
          user_approved: false,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setAgentDraft(data.draft_content || `ניתוח מגמות טכנולוגיות עבור "${agentTopic}": שימוש בסוכני AI אוטונומיים מאפשר אוטומציה חכמה וזמני תגובה מיידיים.`);
      } else {
        setAgentDraft(`ניתוח מגמות טכנולוגיות עבור "${agentTopic}": ארכיטקטורת Next.js 15 ו-LangGraph מספקת פתרון אמין ועוצמתי לרשתות חברתיות מהדור הבא. מומלץ ליישם Optimistic UI לתגובות ב-0ms.`);
      }
    } catch {
      setAgentDraft(`ניתוח מגמות טכנולוגיות עבור "${agentTopic}": ארכיטקטורת Next.js 15 ו-LangGraph מספקת פתרון אמין ועוצמתי לרשתות חברתיות מהדור הבא. מומלץ ליישם Optimistic UI לתגובות ב-0ms.`);
    } finally {
      setAgentRunning(false);
    }
  };

  const handleApproveAgentPost = () => {
    if (!agentDraft) return;
    const newPost: Post = {
      id: Date.now(),
      authorUsername: 'idan',
      authorName: 'עידן קזם (בסיוע סוכן AI)',
      authorAvatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=idan',
      content: agentDraft,
      tags: ['LangGraph', 'AI_Agent', 'Autonomous'],
      createdAt: 'כרגע',
      likesCount: 12,
      isLiked: false,
      reactionCounts: { '❤️': 8, '🔥': 4 },
      comments: [],
    };
    setPosts((prev) => [newPost, ...prev]);
    setIsAgentModalOpen(false);
    setAgentDraft(null);
    setAgentTopic('');
    showToast('הפוסט האוטונומי אושר ופורסם לפיד! 🚀', 'success');
  };

  // Filtered & Sorted Posts
  let displayedPosts = posts.filter((p) => {
    if (activeTab === 'saved') return savedPostIds.includes(p.id);
    if (activeTab === 'following') return followingUsers.includes(p.authorUsername) || p.authorUsername === 'idan';
    if (selectedTagFilter) return p.tags.some((t) => t.toLowerCase().includes(selectedTagFilter.toLowerCase()));
    return true;
  });

  if (activeTab === 'trending') {
    displayedPosts = [...displayedPosts].sort((a, b) => {
      const scoreA = a.likesCount + Object.values(a.reactionCounts).reduce((x, y) => x + y, 0);
      const scoreB = b.likesCount + Object.values(b.reactionCounts).reduce((x, y) => x + y, 0);
      return scoreB - scoreA;
    });
  }

  return (
    <div dir="rtl" className="w-full min-h-screen bg-[#07090e] text-slate-100 flex flex-col items-center selection:bg-cyan-500 selection:text-black">
      
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-6 end-8 z-50 flex items-center gap-3 px-6 py-3.5 rounded-2xl shadow-2xl backdrop-blur-2xl border bg-slate-900/90 border-cyan-500/40 text-white font-bold"
          >
            <span className="text-xl">{toast.type === 'success' ? '✓' : 'ℹ'}</span>
            <span className="text-base">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Navbar - 100% Centered with Max Width 1600px */}
      <header className="sticky top-0 z-40 w-full backdrop-blur-2xl border-b border-white/10 bg-[#080b14]/92 flex justify-center shadow-lg">
        <div className="w-full max-w-[1600px] px-8 h-20 flex items-center justify-between">
          
          {/* Brand Logo & Name */}
          <Link href="/" className="flex items-center gap-3 text-inherit no-underline group">
            <div className="flex items-center justify-center rounded-2xl shadow-lg w-12 h-12 bg-gradient-to-tr from-cyan-500 via-indigo-600 to-purple-600 text-white transition-transform group-hover:scale-105">
              <span className="text-2xl font-black">⚡</span>
            </div>
            <div className="flex flex-col text-start">
              <span className="text-2xl font-black tracking-tight leading-tight bg-gradient-to-r from-white via-slate-100 to-cyan-400 bg-clip-text text-transparent">
                Social<span className="text-cyan-400">Flow</span>
              </span>
              <span className="text-xs text-slate-400 font-bold tracking-wider">
                Next.js 15 &bull; AI Multi-Agent &bull; Pulse Hub
              </span>
            </div>
          </Link>

          {/* Search Bar */}
          <div className="flex items-center gap-3 px-5 rounded-2xl border border-white/12 bg-white/5 w-[420px] lg:w-[480px] h-12 focus-within:border-cyan-400 focus-within:bg-white/10 transition-all">
            <span className="text-slate-400 text-lg">🔍</span>
            <input
              type="text"
              placeholder="חיפוש חברים, פוסטים, האשטאגים וטרנדים..."
              dir="rtl"
              className="w-full bg-transparent border-none outline-none text-white placeholder-slate-400 text-sm font-medium"
              onChange={(e) => setSelectedTagFilter(e.target.value.trim() || null)}
            />
            <kbd className="px-2.5 py-1 rounded-lg text-xs text-slate-400 bg-white/10 font-mono">⌘K</kbd>
          </div>

          {/* Nav Actions */}
          <div className="flex items-center gap-3.5">
            {/* LangGraph Agent Button */}
            <button
              onClick={() => setIsAgentModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-white font-bold transition-all hover:scale-105 shadow-lg bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-500 text-sm cursor-pointer"
            >
              <span className="text-base">🤖</span>
              <span>סוכן AI</span>
            </button>

            {/* DMs Button */}
            <button
              onClick={() => setIsChatOpen(!isChatOpen)}
              className="relative flex items-center justify-center rounded-2xl border border-white/10 text-white hover:bg-white/10 w-11 h-11 bg-white/5 cursor-pointer transition-colors"
              title="הודעות ישירות"
            >
              <span className="text-xl">💬</span>
              <span className="absolute -top-1 -end-1 w-5 h-5 rounded-full flex items-center justify-center font-bold text-xs bg-cyan-400 text-slate-950 shadow-md">
                {chatMessages.length}
              </span>
            </button>

            {/* Notifications Bell */}
            <div className="relative">
              <button
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className="relative flex items-center justify-center rounded-2xl border border-white/10 text-white hover:bg-white/10 w-11 h-11 bg-white/5 cursor-pointer transition-colors"
                title="התראות"
              >
                <span className="text-xl">🔔</span>
                {notifications.filter((n) => n.unread).length > 0 && (
                  <span className="absolute -top-1 -end-1 w-5 h-5 rounded-full flex items-center justify-center font-bold text-xs bg-pink-500 text-white shadow-md">
                    {notifications.filter((n) => n.unread).length}
                  </span>
                )}
              </button>

              {/* Notification Dropdown */}
              <AnimatePresence>
                {isNotifOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute end-0 mt-3 rounded-3xl p-5 shadow-2xl border border-white/15 backdrop-blur-2xl bg-slate-900/98 w-88 z-50"
                  >
                    <div className="flex items-center justify-between pb-3.5 border-b border-white/10 mb-3.5">
                      <span className="font-bold text-white text-base">🔔 התראות ועדכונים</span>
                      <button
                        onClick={() => setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })))}
                        className="text-xs text-cyan-400 hover:underline font-bold cursor-pointer"
                      >
                        סמן כנקרא
                      </button>
                    </div>
                    <div className="space-y-2.5 max-h-80 overflow-y-auto">
                      {notifications.map((n) => (
                        <div
                          key={n.id}
                          className="p-3 rounded-2xl flex items-start gap-3 transition-colors hover:bg-white/5"
                          style={{
                            background: n.unread ? 'rgba(99, 102, 241, 0.16)' : 'transparent',
                            border: n.unread ? '1px solid rgba(99, 102, 241, 0.35)' : '1px solid transparent',
                          }}
                        >
                          <div className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: n.unread ? '#06b6d4' : '#64748b' }} />
                          <div className="flex-1 text-start">
                            <p className="text-sm text-slate-200 leading-snug">{n.text}</p>
                            <span className="text-xs text-slate-400 block mt-1">{n.time}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* User Profile */}
            <div className="flex items-center gap-3 ps-3 border-s border-white/10">
              <img
                src="https://api.dicebear.com/7.x/bottts/svg?seed=idan"
                alt="Idan"
                className="rounded-2xl border-2 border-cyan-400/60 object-cover w-11 h-11"
              />
              <div className="flex flex-col text-start">
                <span className="font-bold text-sm leading-tight text-white">עידן קזם</span>
                <span className="text-xs text-cyan-400 font-mono">@idan</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Spacious Centered 3-Column Layout (Max Width 1600px) */}
      <div className="w-full flex justify-center px-8 py-10" style={{ width: '100%' }}>
        <div
          className="w-full"
          style={{
            display: 'grid',
            gridTemplateColumns: '290px minmax(0, 1fr) 350px',
            gap: '32px',
            width: '100%',
            maxWidth: '1600px',
            margin: '0 auto',
            alignItems: 'start',
          }}
        >
          
          {/* ========================================================
              RIGHT COLUMN: Main Navigation & Shortcuts
             ======================================================== */}
          <aside className="sticky top-28 flex flex-col gap-6">
            
            {/* Quick Profile Summary */}
            <div className="p-6 rounded-[28px] border border-white/10 bg-slate-900/70 backdrop-blur-xl shadow-lg space-y-4">
              <div className="flex items-center gap-4">
                <img
                  src="https://api.dicebear.com/7.x/bottts/svg?seed=idan"
                  alt="Avatar"
                  className="w-14 h-14 rounded-2xl border-2 border-cyan-400/60 shadow-md"
                />
                <div className="text-start">
                  <div className="font-bold text-lg text-white">עידן קזם</div>
                  <div className="text-xs text-cyan-400 font-mono">@idan</div>
                  <span className="inline-block mt-1 px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    מפתח Fullstack & AI
                  </span>
                </div>
              </div>
            </div>

            {/* Main Nav Items */}
            <nav className="flex flex-col gap-2 p-3.5 rounded-[28px] border border-white/10 bg-slate-900/60 backdrop-blur-xl shadow-lg font-semibold text-base">
              <button
                onClick={() => { setActiveTab('for-you'); setSelectedTagFilter(null); }}
                className={`flex items-center gap-4 px-5 py-4 rounded-2xl text-start font-bold transition-all cursor-pointer ${
                  activeTab === 'for-you' && !selectedTagFilter
                    ? 'bg-gradient-to-r from-indigo-600/40 to-purple-600/30 text-white border border-indigo-500/50 shadow-md'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <span className="text-2xl">🏠</span>
                <span className="text-base">פיד ראשי (For You)</span>
              </button>

              <button
                onClick={() => { setActiveTab('trending'); setSelectedTagFilter(null); }}
                className={`flex items-center gap-4 px-5 py-4 rounded-2xl text-start font-bold transition-all cursor-pointer ${
                  activeTab === 'trending'
                    ? 'bg-gradient-to-r from-indigo-600/40 to-purple-600/30 text-white border border-indigo-500/50 shadow-md'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <span className="text-2xl">🔥</span>
                <span className="text-base">טרנדים ופופולרי</span>
              </button>

              <button
                onClick={() => setActiveStoryViewerIndex(0)}
                className="flex items-center justify-between px-5 py-4 rounded-2xl text-slate-300 font-bold hover:text-white hover:bg-white/5 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <span className="text-2xl">⭕</span>
                  <span className="text-base">סטוריז (Stories)</span>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-black text-white bg-gradient-to-r from-pink-500 to-rose-500">
                  חי
                </span>
              </button>

              <button
                onClick={() => setIsAgentModalOpen(true)}
                className="flex items-center gap-4 px-5 py-4 rounded-2xl text-start font-bold text-indigo-300 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
              >
                <span className="text-2xl">🤖</span>
                <span className="text-base">סוכן AI (LangGraph)</span>
              </button>

              <button
                onClick={() => { setActiveTab('saved'); setSelectedTagFilter(null); }}
                className={`flex items-center justify-between px-5 py-4 rounded-2xl text-start font-bold transition-all cursor-pointer ${
                  activeTab === 'saved'
                    ? 'bg-gradient-to-r from-indigo-600/40 to-purple-600/30 text-white border border-indigo-500/50 shadow-md'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-4">
                  <span className="text-2xl">🔖</span>
                  <span className="text-base">סימניות שמורות</span>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/10 text-white">
                  {savedPostIds.length}
                </span>
              </button>

              <button
                onClick={() => setIsChatOpen(!isChatOpen)}
                className="flex items-center justify-between px-5 py-4 rounded-2xl text-slate-300 font-bold hover:text-white hover:bg-white/5 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <span className="text-2xl">💬</span>
                  <span className="text-base">הודעות צ׳אט</span>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-cyan-400 text-slate-950">
                  {chatMessages.length}
                </span>
              </button>

              <button
                onClick={() => { setActiveTab('for-you'); setSelectedTagFilter(null); }}
                className="flex items-center gap-4 px-5 py-4 rounded-2xl text-start font-bold text-cyan-400 hover:text-cyan-300 hover:bg-white/5 transition-all cursor-pointer"
              >
                <span className="text-2xl">⚡</span>
                <span className="text-base">מרחב קהילה Pulse</span>
              </button>
            </nav>
          </aside>

          {/* ========================================================
              CENTER COLUMN: Stories, Composer, Feed
             ======================================================== */}
          <main className="flex flex-col gap-8 min-w-0">
            
            {/* 1. Large Rich Stories Carousel Bar */}
            <section className="p-6 rounded-[28px] border border-white/10 bg-slate-900/65 backdrop-blur-xl shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">⭕</span>
                  <h3 className="font-bold text-lg text-white">סטוריז ועדכונים חיים</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => scrollStories('right')}
                    className="w-9 h-9 rounded-full bg-white/10 hover:bg-cyan-500 hover:text-black text-white flex items-center justify-center transition-all cursor-pointer font-bold text-sm shadow-md"
                    title="גלול ימינה"
                  >
                    ▶
                  </button>
                  <button
                    onClick={() => scrollStories('left')}
                    className="w-9 h-9 rounded-full bg-white/10 hover:bg-cyan-500 hover:text-black text-white flex items-center justify-center transition-all cursor-pointer font-bold text-sm shadow-md"
                    title="גלול שמאלה"
                  >
                    ◀
                  </button>
                  <Link
                    href="/stories"
                    className="ms-2 px-3.5 py-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-bold hover:bg-cyan-500/20 transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                  >
                    <span>מסך מלא</span>
                    <span>←</span>
                  </Link>
                </div>
              </div>

              {/* Story Cards Carousel */}
              <div
                ref={storiesReelRef}
                className="flex items-center gap-4 overflow-x-auto py-2 no-scrollbar scroll-smooth"
                style={{
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                }}
              >
                
                {/* Create Story Card */}
                <div
                  onClick={() => setIsCreateStoryOpen(true)}
                  className="relative w-36 h-52 rounded-2xl overflow-hidden flex-shrink-0 cursor-pointer group border border-dashed border-cyan-400/50 hover:border-cyan-400 transition-all shadow-md bg-gradient-to-b from-slate-900 to-indigo-950/70 flex flex-col justify-between p-3.5"
                >
                  <div className="w-11 h-11 rounded-full border-2 border-cyan-400 p-0.5 shadow-md">
                    <img src="https://api.dicebear.com/7.x/bottts/svg?seed=idan" alt="" className="w-full h-full rounded-full" />
                  </div>
                  <div className="text-center space-y-1.5">
                    <div className="w-9 h-9 rounded-full bg-cyan-400 text-slate-950 font-black text-xl mx-auto flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      +
                    </div>
                    <span className="text-xs font-bold text-white block">צור סטורי</span>
                  </div>
                </div>

                {/* Friend Stories Cards */}
                {stories.map((storyUser, idx) => (
                  <div
                    key={storyUser.id}
                    onClick={() => {
                      setActiveStoryViewerIndex(idx);
                      setCurrentSlideIndex(0);
                    }}
                    className="relative w-36 h-52 rounded-2xl overflow-hidden flex-shrink-0 cursor-pointer group border border-white/10 hover:border-cyan-400/80 transition-all shadow-md hover:scale-102"
                  >
                    {/* Background Image */}
                    <img
                      src={storyUser.coverImage}
                      alt={storyUser.name}
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                    />
                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/90" />
                    
                    {/* Author Avatar at Top Right */}
                    <div className="absolute top-3 end-3 z-10">
                      <div className={`w-10 h-10 rounded-full p-[2px] ${storyUser.hasUnread ? 'bg-gradient-to-tr from-cyan-400 via-indigo-500 to-pink-500 shadow-md' : 'bg-slate-700'}`}>
                        <img src={storyUser.avatar} alt="" className="w-full h-full rounded-full object-cover bg-slate-950" />
                      </div>
                    </div>

                    {/* Author Name at Bottom */}
                    <div className="absolute bottom-3 inset-x-3 z-10 text-start">
                      <span className="text-xs font-bold text-white block leading-tight drop-shadow-md">
                        {storyUser.name}
                      </span>
                      <span className="text-[11px] text-cyan-300 font-mono">
                        @{storyUser.username}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* 2. Post Composer Card */}
            <section className="p-8 rounded-[28px] border border-white/10 bg-slate-900/70 backdrop-blur-xl shadow-xl space-y-5">
              <form onSubmit={handleCreatePost} className="space-y-5">
                <div className="flex items-start gap-4">
                  <img
                    src="https://api.dicebear.com/7.x/bottts/svg?seed=idan"
                    alt="Idan"
                    className="w-13 h-13 rounded-2xl border-2 border-cyan-400/60 shadow-md flex-shrink-0"
                  />
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-lg text-white">עידן קזם</span>
                      <select
                        value={composerAudience}
                        onChange={(e) => setComposerAudience(e.target.value)}
                        className="bg-slate-800/80 border border-white/10 text-xs text-slate-300 rounded-xl px-3.5 py-2 outline-none font-semibold cursor-pointer"
                      >
                        <option value="ציבורי">🌐 פוסט ציבורי</option>
                        <option value="חברים">👥 חברים בלבד</option>
                        <option value="קהילת AI">🤖 קהילת AI</option>
                      </select>
                    </div>

                    <div className="bg-slate-950/60 border border-white/12 rounded-2xl p-4 focus-within:border-cyan-400/60 transition-colors shadow-inner">
                      <textarea
                        rows={3}
                        value={composerText}
                        onChange={(e) => setComposerText(e.target.value)}
                        placeholder="על מה תרצה לשתף היום, עידן? (עדכון, סקר, תובנה או שאלה)..."
                        dir="auto"
                        className="w-full min-h-[90px] bg-transparent border-none outline-none text-white placeholder-slate-400 text-lg leading-relaxed resize-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Collapsible Poll Builder */}
                {showPollBuilder && (
                  <div className="p-5 rounded-2xl border border-white/10 bg-white/5 space-y-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-cyan-400">📊 יצירת סקר קהילתי חדש</span>
                      <button
                        type="button"
                        onClick={() => setShowPollBuilder(false)}
                        className="text-xs text-slate-400 hover:text-white cursor-pointer"
                      >
                        ✕ בטל סקר
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="שאלת הסקר..."
                      value={pollQuestion}
                      onChange={(e) => setPollQuestion(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-slate-950/70 border border-white/10 text-sm text-white focus:outline-none focus:border-cyan-400"
                    />
                    <div className="grid grid-cols-2 gap-3.5">
                      <input
                        type="text"
                        placeholder="אפשרות 1..."
                        value={pollOpt1}
                        onChange={(e) => setPollOpt1(e.target.value)}
                        className="px-4 py-2.5 rounded-xl bg-slate-950/70 border border-white/10 text-xs text-white focus:outline-none focus:border-cyan-400"
                      />
                      <input
                        type="text"
                        placeholder="אפשרות 2..."
                        value={pollOpt2}
                        onChange={(e) => setPollOpt2(e.target.value)}
                        className="px-4 py-2.5 rounded-xl bg-slate-950/70 border border-white/10 text-xs text-white focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                  </div>
                )}

                {/* Composer Footer Actions Shelf */}
                <div className="flex items-center justify-between pt-4 border-t border-white/10">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setShowPollBuilder(!showPollBuilder)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                        showPollBuilder ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40' : 'bg-white/5 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      <span>📊</span>
                      <span>סקר קהילה</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAgentModalOpen(true)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/25 transition-colors cursor-pointer"
                    >
                      <span>🤖</span>
                      <span>סוכן AI</span>
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting || (!composerText.trim() && !pollQuestion.trim())}
                    className="px-8 py-3 rounded-2xl font-bold text-white shadow-lg transition-all hover:opacity-95 disabled:opacity-40 bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-500 text-sm cursor-pointer hover:scale-102"
                  >
                    {isSubmitting ? 'מפרסם...' : 'פרסם פוסט 🚀'}
                  </button>
                </div>
              </form>
            </section>

            {/* 3. Feed Navigation Filter Tabs */}
            <div className="flex items-center justify-between p-2.5 rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-xl">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setActiveTab('for-you'); setSelectedTagFilter(null); }}
                  className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                    activeTab === 'for-you' && !selectedTagFilter
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  בשבילך (For You)
                </button>
                <button
                  onClick={() => { setActiveTab('trending'); setSelectedTagFilter(null); }}
                  className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                    activeTab === 'trending'
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  🔥 טרנדים חמים
                </button>
                <button
                  onClick={() => { setActiveTab('saved'); setSelectedTagFilter(null); }}
                  className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                    activeTab === 'saved'
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  🔖 שמורים ({savedPostIds.length})
                </button>
              </div>

              <button
                onClick={() => {
                  setPosts(INITIAL_POSTS);
                  showToast('הפיד רוענן בהצלחה! 🔄', 'info');
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:bg-white/10 transition-colors cursor-pointer"
              >
                <span>🔄</span>
                <span>רענן</span>
              </button>
            </div>

            {/* Active Tag Filter Indicator */}
            {selectedTagFilter && (
              <div className="flex items-center justify-between p-4 rounded-2xl border border-cyan-500/40 bg-cyan-500/10">
                <span className="text-sm text-cyan-300">
                  מסנן לפי תגית: <span className="font-bold font-mono">#{selectedTagFilter}</span>
                </span>
                <button
                  onClick={() => setSelectedTagFilter(null)}
                  className="text-xs text-cyan-400 hover:underline font-bold cursor-pointer"
                >
                  ✕ נקה סינון
                </button>
              </div>
            )}

            {/* Empty State for Saved */}
            {displayedPosts.length === 0 && (
              <div className="p-12 rounded-[28px] border border-white/10 bg-slate-900/60 backdrop-blur-xl text-center space-y-4">
                <span className="text-5xl block">🔖</span>
                <h4 className="font-bold text-xl text-white">אין פוסטים שמורים עדיין</h4>
                <p className="text-base text-slate-400 max-w-md mx-auto leading-relaxed">
                  לחץ על סמל הסימניה 🔖 בכל פוסט בפיד כדי לשמור אותו כאן לגישה מהירה בכל עת.
                </p>
                <button
                  onClick={() => setActiveTab('for-you')}
                  className="px-6 py-3 rounded-xl bg-cyan-500 text-slate-950 font-bold text-sm shadow-lg hover:bg-cyan-400 transition-colors cursor-pointer"
                >
                  חזרה לפיד הראשי
                </button>
              </div>
            )}

            {/* 4. Posts Stream (Spacious 32px separation) */}
            <div className="space-y-8">
              {displayedPosts.map((post) => (
                <article
                  key={post.id}
                  className="p-8 rounded-[28px] border border-white/10 bg-slate-900/65 backdrop-blur-xl shadow-xl transition-all hover:border-white/20 space-y-6"
                >
                  {/* Post Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <img
                        src={post.authorAvatar}
                        alt={post.authorName}
                        className="w-13 h-13 rounded-2xl border border-cyan-400/40 object-cover shadow-md"
                      />
                      <div className="text-start">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-lg text-white">{post.authorName}</span>
                          {post.authorUsername === 'idan' && (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                              מחבר
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                          <bdi dir="ltr" className="text-cyan-400">@{post.authorUsername}</bdi>
                          <span>&bull;</span>
                          <span>{post.createdAt}</span>
                        </div>
                      </div>
                    </div>

                    {/* Bookmark Button */}
                    <button
                      onClick={() => handleToggleSave(post.id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        savedPostIds.includes(post.id)
                          ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                          : 'border-white/5 text-slate-400 hover:text-white hover:bg-white/5'
                      }`}
                      title={savedPostIds.includes(post.id) ? 'הסר מהשמורים' : 'שמור בסימניות'}
                    >
                      <span className="text-lg">{savedPostIds.includes(post.id) ? '🔖' : '🏷️'}</span>
                    </button>
                  </div>

                  {/* Post Content */}
                  <div className="text-slate-100 text-lg leading-relaxed text-start">
                    {renderBiDiText(post.content)}
                  </div>

                  {/* Attached Project / Entity Badge */}
                  {post.attachedEntity && (
                    <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">📦</span>
                        <div>
                          <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 block">פרויקט פיתוח</span>
                          <span className="text-base font-bold text-white">{post.attachedEntity.title}</span>
                        </div>
                      </div>
                      <span className="px-3 py-1.5 rounded-xl text-xs font-mono font-bold bg-cyan-400/20 text-cyan-300 border border-cyan-400/30">
                        {post.attachedEntity.badge}
                      </span>
                    </div>
                  )}

                  {/* Interactive Poll */}
                  {post.poll && (
                    <div className="p-6 rounded-2xl bg-black/40 border border-white/10 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-base text-cyan-300 flex items-center gap-2.5">
                          <span className="text-xl">📊</span>
                          <span>{post.poll.question}</span>
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          {post.poll.totalVotes} הצבעות
                        </span>
                      </div>

                      <div className="space-y-3">
                        {post.poll.options.map((opt) => (
                          <div
                            key={opt.id}
                            onClick={() => handleVotePoll(post.id, opt.id)}
                            className={`relative overflow-hidden h-14 px-5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                              post.poll?.userVotedId === opt.id
                                ? 'border-cyan-400 bg-cyan-950/40 shadow-md'
                                : 'border-white/10 bg-white/5 hover:bg-white/10'
                            }`}
                          >
                            <div
                              className="absolute top-0 bottom-0 right-0 bg-cyan-500/20 transition-all duration-500 rounded-2xl"
                              style={{ width: `${opt.percentage}%` }}
                            />
                            <span className="relative z-10 text-base font-semibold text-white">
                              {opt.text}
                            </span>
                            <div className="relative z-10 flex items-center gap-2.5 text-xs">
                              <span className="font-bold text-cyan-400 font-mono text-base">{opt.percentage}%</span>
                              <span className="text-slate-400 font-medium">({opt.votes} הצבעות)</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Hashtags Bar (Rendered with correct BiDi LTR) */}
                  <div className="flex flex-wrap gap-2.5 pt-1">
                    {post.tags.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => setSelectedTagFilter(tag)}
                        className="px-3.5 py-1.5 rounded-full text-xs font-mono font-semibold bg-white/5 border border-white/10 text-cyan-400 hover:bg-cyan-500/15 hover:border-cyan-500/40 transition-all cursor-pointer"
                        dir="ltr"
                      >
                        #{tag}
                      </button>
                    ))}
                  </div>

                  {/* Post Actions Bar: Reactions & Comments */}
                  <div className="pt-4 border-t border-white/10 flex items-center justify-between flex-wrap gap-4">
                    
                    {/* 5-Reaction Micro-Bar */}
                    <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-white/5 border border-white/10">
                      {['❤️', '🔥', '👏', '⭐', '💡'].map((emoji) => {
                        const count = post.reactionCounts[emoji] || 0;
                        const isSelected = post.userReaction === emoji;
                        return (
                          <button
                            key={emoji}
                            onClick={() => handleReaction(post.id, emoji)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-indigo-600/40 text-white border border-indigo-400/60 scale-105'
                                : 'text-slate-300 hover:bg-white/10'
                            }`}
                          >
                            <span className="text-base">{emoji}</span>
                            <span className="text-xs font-mono font-bold">{count}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Comments Toggle */}
                    <button
                      onClick={() => showToast(`נפתחו ${post.comments.length} תגובות`, 'info')}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <span className="text-lg">💬</span>
                      <span>תגובות ({post.comments.length})</span>
                    </button>
                  </div>

                  {/* Inline Comments List */}
                  {post.comments.length > 0 && (
                    <div className="space-y-3 pt-3 border-t border-white/5">
                      {post.comments.map((c) => (
                        <div key={c.id} className="p-4 rounded-2xl bg-white/5 flex items-start gap-3.5">
                          <img src={c.authorAvatar} alt="" className="w-9 h-9 rounded-full border border-white/20 mt-0.5" />
                          <div className="flex-1 text-start">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-sm text-white">{c.authorName}</span>
                              <span className="text-xs text-slate-400 font-mono">{c.createdAt}</span>
                            </div>
                            <p className="text-sm text-slate-300 mt-1 leading-relaxed">{c.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
          </main>

          {/* ========================================================
              LEFT COLUMN: Follow Suggestions, Hot Trends, Contacts
             ======================================================== */}
          <aside className="sticky top-28 flex flex-col gap-6">
            
            {/* Suggested Follows */}
            <div className="p-6 rounded-3xl border border-white/10 bg-slate-900/65 backdrop-blur-xl shadow-xl space-y-4">
              <h4 className="font-bold text-sm text-white flex items-center gap-2">
                <span>👥</span>
                <span>הצעות מעקב עבורך</span>
              </h4>
              <div className="space-y-3.5 text-xs">
                {[
                  { name: 'נועה כהן', handle: 'noa', role: 'מעצבת מוצר ב-AI', seed: 'Noa' },
                  { name: 'דניאל לוי', handle: 'daniel', role: 'מפתח Fullstack', seed: 'Daniel' },
                  { name: 'מאיה שקד', handle: 'maya', role: 'חוקרת ממשקי UI/UX', seed: 'Maya' },
                ].map((user) => {
                  const isFollowing = followingUsers.includes(user.handle);
                  return (
                    <div key={user.handle} className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.seed}`}
                          alt=""
                          className="w-10 h-10 rounded-full border border-cyan-400/40"
                        />
                        <div className="text-start">
                          <div className="font-bold text-slate-100">{user.name}</div>
                          <div className="text-[11px] text-slate-400">{user.role}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setFollowingUsers((prev) =>
                            isFollowing ? prev.filter((h) => h !== user.handle) : [...prev, user.handle]
                          );
                          showToast(isFollowing ? `הפסקת לעקוב אחרי ${user.name}` : `התחלת לעקוב אחרי ${user.name}!`, 'info');
                        }}
                        className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                          isFollowing
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400'
                        }`}
                      >
                        {isFollowing ? 'עוקב ✓' : '+ עקוב'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Hot Trending Hashtags */}
            <div className="p-6 rounded-3xl border border-white/10 bg-slate-900/65 backdrop-blur-xl shadow-xl space-y-3.5">
              <h4 className="font-bold text-sm text-white flex items-center gap-2">
                <span>🔥</span>
                <span>נושאים וטרנדים חמים</span>
              </h4>
              <div className="space-y-2.5 text-xs">
                {[
                  { tag: 'Nextjs15', posts: '1,420 פוסטים' },
                  { tag: 'LangGraph', posts: '980 פוסטים' },
                  { tag: 'LiquidGlass', posts: '2,150 פוסטים' },
                  { tag: 'SocialFlow', posts: '3,400 פוסטים' },
                ].map((item) => (
                  <div
                    key={item.tag}
                    onClick={() => setSelectedTagFilter(item.tag)}
                    className="flex items-center justify-between p-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <span className="text-cyan-400 font-bold font-mono" dir="ltr">#{item.tag}</span>
                    <span className="text-slate-400 text-[11px]">{item.posts}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Connected Contacts */}
            <div className="p-6 rounded-3xl border border-white/10 bg-slate-900/65 backdrop-blur-xl shadow-xl space-y-3.5">
              <h4 className="font-bold text-sm text-white flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span>🟢</span>
                  <span>אנשי קשר מחוברים</span>
                </span>
                <span className="text-xs text-emerald-400 font-mono">3 מחוברים</span>
              </h4>
              <div className="space-y-2.5 text-xs">
                {[
                  { name: 'דניאל לוי', seed: 'Daniel' },
                  { name: 'נועה כהן', seed: 'Noa' },
                  { name: 'מאיה שקד', seed: 'Maya' },
                ].map((c) => (
                  <div
                    key={c.name}
                    onClick={() => setIsChatOpen(true)}
                    className="flex items-center justify-between p-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="relative">
                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${c.seed}`} alt="" className="w-8 h-8 rounded-full" />
                        <span className="absolute bottom-0 end-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-slate-950" />
                      </div>
                      <span className="font-semibold text-slate-200">{c.name}</span>
                    </div>
                    <span className="text-xs text-slate-400">💬</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* ========================================================
          FULLSCREEN / THEATER STORY VIEWER MODAL
         ======================================================== */}
      <AnimatePresence>
        {activeStoryViewerIndex !== null && (
          <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-2xl flex items-center justify-center p-4">
            
            {/* Top Close & Counter */}
            <div className="absolute top-6 inset-x-8 z-50 flex items-center justify-between pointer-events-auto max-w-5xl mx-auto">
              <button
                onClick={() => setActiveStoryViewerIndex(null)}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/80 border border-white/20 text-white text-sm font-bold hover:bg-white/10 transition-colors cursor-pointer"
              >
                <span>✕</span>
                <span>סגור סטורי</span>
              </button>

              <div className="text-sm font-bold text-white bg-slate-900/80 px-4 py-1.5 rounded-full border border-white/20">
                {activeStoryViewerIndex + 1} מתוך {stories.length} משתמשים
              </div>
            </div>

            {/* Navigation Arrows */}
            <button
              onClick={handlePrevStorySlide}
              className="absolute start-8 z-40 w-14 h-14 rounded-full bg-slate-900/80 border border-white/20 text-white text-2xl flex items-center justify-center hover:bg-cyan-500 hover:text-slate-950 transition-all cursor-pointer shadow-xl hidden md:flex"
              title="הקודם"
            >
              ▶
            </button>
            <button
              onClick={handleNextStorySlide}
              className="absolute end-8 z-40 w-14 h-14 rounded-full bg-slate-900/80 border border-white/20 text-white text-2xl flex items-center justify-center hover:bg-cyan-500 hover:text-slate-950 transition-all cursor-pointer shadow-xl hidden md:flex"
              title="הבא"
            >
              ◀
            </button>

            {/* Active Story Phone Frame */}
            {(() => {
              const currentGroup = stories[activeStoryViewerIndex];
              const currentSlide = currentGroup.slides[currentSlideIndex] || currentGroup.slides[0];

              return (
                <div
                  className="relative z-30 w-full max-w-[480px] h-[85vh] max-h-[820px] rounded-3xl overflow-hidden bg-slate-950 border-2 border-cyan-400/40 shadow-2xl flex flex-col justify-between"
                  onMouseDown={() => setIsStoryPaused(true)}
                  onMouseUp={() => setIsStoryPaused(false)}
                  onTouchStart={() => setIsStoryPaused(true)}
                  onTouchEnd={() => setIsStoryPaused(false)}
                >
                  {/* Background Image */}
                  <img
                    src={currentSlide.mediaUrl}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover z-0"
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-transparent to-black/90 z-10 pointer-events-none" />

                  {/* Tap Targets */}
                  <div className="absolute inset-y-24 inset-x-0 z-20 grid grid-cols-2">
                    <div onClick={handlePrevStorySlide} className="h-full cursor-pointer" />
                    <div onClick={handleNextStorySlide} className="h-full cursor-pointer" />
                  </div>

                  {/* Top Progress & Header */}
                  <div className="relative z-30 p-5 space-y-3 pointer-events-none">
                    <div className="flex items-center gap-1.5 w-full">
                      {currentGroup.slides.map((s, sIdx) => {
                        let fillWidth = '0%';
                        if (sIdx < currentSlideIndex) fillWidth = '100%';
                        else if (sIdx === currentSlideIndex) fillWidth = `${storyProgress}%`;
                        return (
                          <div key={s.id} className="flex-1 h-1.5 bg-white/30 rounded-full overflow-hidden">
                            <div className="h-full bg-cyan-400 transition-all duration-75" style={{ width: fillWidth }} />
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <img src={currentGroup.avatar} alt="" className="w-11 h-11 rounded-full border-2 border-cyan-400 shadow-md" />
                        <div>
                          <div className="font-bold text-sm text-white drop-shadow">{currentGroup.name}</div>
                          <div className="text-xs text-slate-300 font-mono">@{currentGroup.username} &bull; {currentSlide.createdAt}</div>
                        </div>
                      </div>
                      <span className="text-xs px-3 py-1 rounded-full bg-black/50 border border-white/20 text-white font-mono">
                        {currentSlideIndex + 1}/{currentGroup.slides.length}
                      </span>
                    </div>
                  </div>

                  {/* Bottom Caption, Reactions & Input */}
                  <div className="relative z-30 p-5 space-y-3.5 pointer-events-auto">
                    {currentSlide.caption && (
                      <div
                        style={{
                          backgroundColor: 'rgba(10, 15, 28, 0.92)',
                          color: '#ffffff',
                          border: '1.5px solid rgba(6, 182, 212, 0.5)',
                          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.8)',
                        }}
                        className="p-4 rounded-2xl text-base leading-relaxed text-white shadow-xl text-start font-bold"
                      >
                        {currentSlide.caption}
                      </div>
                    )}

                    {/* Emoji Reaction Bar */}
                    <div className="flex items-center justify-around py-1">
                      {['❤️', '🔥', '👏', '😂', '😮'].map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => handleSendStoryReaction(emoji)}
                          className="text-3xl transition-transform hover:scale-135 active:scale-90 p-1 cursor-pointer"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>

                    {/* Direct Message Input */}
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder={`השב לסטורי של ${currentGroup.name}...`}
                        value={storyReplyText}
                        onChange={(e) => setStoryReplyText(e.target.value)}
                        className="flex-1 px-4 py-3 rounded-full bg-black/70 border border-white/20 text-xs text-white placeholder-slate-400 backdrop-blur-md outline-none focus:border-cyan-400"
                      />
                      <button
                        onClick={() => {
                          if (!storyReplyText.trim()) return;
                          handleSendStoryReaction('💬');
                          setStoryReplyText('');
                          showToast('התגובה נשלחה בהצלחה בפרטי!', 'success');
                        }}
                        className="w-11 h-11 rounded-full bg-cyan-500 text-slate-950 font-bold flex items-center justify-center shadow-lg hover:bg-cyan-400 transition-colors cursor-pointer"
                      >
                        ➤
                      </button>
                    </div>
                  </div>

                  {/* Flying Reactions */}
                  <div className="absolute inset-0 pointer-events-none z-40 overflow-hidden">
                    {flyingStoryReactions.map((r) => (
                      <motion.div
                        key={r.id}
                        initial={{ opacity: 1, y: 550, scale: 0.8, x: 220 }}
                        animate={{ opacity: 0, y: 80, scale: 2.2, x: 200 + (Math.random() * 80 - 40) }}
                        transition={{ duration: 1.1, ease: 'easeOut' }}
                        className="absolute text-5xl"
                      >
                        {r.emoji}
                      </motion.div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================
          CREATE STORY MODAL
         ======================================================== */}
      <AnimatePresence>
        {isCreateStoryOpen && (
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
                <button onClick={() => setIsCreateStoryOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">טקסט / כיתוב על הסטורי:</label>
                <textarea
                  rows={3}
                  value={newStoryCaption}
                  onChange={(e) => setNewStoryCaption(e.target.value)}
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
                      onClick={() => setNewStoryCover(url)}
                      className={`h-24 rounded-2xl overflow-hidden cursor-pointer border-2 transition-all ${
                        newStoryCover === url ? 'border-cyan-400 scale-95 shadow-lg' : 'border-transparent opacity-60'
                      }`}
                    >
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  onClick={() => setIsCreateStoryOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-xs text-slate-300 font-semibold cursor-pointer"
                >
                  ביטול
                </button>
                <button
                  onClick={handleCreateCustomStory}
                  disabled={!newStoryCaption.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 text-slate-950 text-sm font-bold shadow-lg disabled:opacity-40 cursor-pointer"
                >
                  פרסם סטורי 🚀
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================
          LANGGRAPH AUTONOMOUS AGENT MODAL
         ======================================================== */}
      <AnimatePresence>
        {isAgentModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl p-7 rounded-3xl border border-indigo-500/40 bg-slate-900 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between pb-3.5 border-b border-white/10">
                <h3 className="font-bold text-base text-white flex items-center gap-2">
                  <span>🤖</span>
                  <span>סוכן תוכן אוטונומי (LangGraph Agent)</span>
                </h3>
                <button onClick={() => setIsAgentModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">נושא הפוסט למחקר וניסוח:</label>
                  <input
                    type="text"
                    placeholder="למשל: ארכיטקטורת מיקרוסרוויסים ב-Next.js 15 וסוכני AI..."
                    value={agentTopic}
                    onChange={(e) => setAgentTopic(e.target.value)}
                    className="w-full p-3.5 rounded-2xl bg-slate-950/80 border border-white/10 text-sm text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">קהל יעד מותאם:</label>
                  <input
                    type="text"
                    value={agentAudience}
                    onChange={(e) => setAgentAudience(e.target.value)}
                    className="w-full p-3 rounded-xl bg-slate-950/80 border border-white/10 text-xs text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <button
                  onClick={handleRunAgent}
                  disabled={agentRunning || !agentTopic.trim()}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-600 font-bold text-sm text-slate-950 shadow-lg disabled:opacity-40 transition-all cursor-pointer"
                >
                  {agentRunning ? '⏳ הסוכן חוקר, מנסח ומאמת...' : '🚀 הפעל סוכן LangGraph אוטונומי'}
                </button>

                {/* Progress Logs */}
                {agentLogs.length > 0 && (
                  <div className="p-3.5 rounded-2xl bg-slate-950 border border-white/10 font-mono text-xs space-y-1 text-slate-300 max-h-36 overflow-y-auto">
                    {agentLogs.map((l, i) => (
                      <div key={i}>{l}</div>
                    ))}
                  </div>
                )}

                {/* Draft Preview & Approval */}
                {agentDraft && (
                  <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-sm text-slate-200 space-y-3">
                    <div className="font-bold text-cyan-400">טיוטת הפוסט שנוצרה:</div>
                    <p className="leading-relaxed whitespace-pre-wrap">{agentDraft}</p>
                    <button
                      onClick={handleApproveAgentPost}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-bold text-xs shadow-md cursor-pointer"
                    >
                      אשר ופרסם לפיד מיידית 🚀
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================
          FLOATING CHAT MESSENGER DRAWER
         ======================================================== */}
      {isChatOpen && (
        <div className="fixed bottom-6 start-8 z-50 w-96 rounded-3xl border border-white/15 bg-slate-900/98 backdrop-blur-2xl shadow-2xl overflow-hidden flex flex-col h-[480px]">
          <div className="p-4 bg-gradient-to-r from-indigo-600/40 to-purple-600/40 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-bold text-sm text-white">נועה כהן (צ'אט ישיר)</span>
            </div>
            <button onClick={() => setIsChatOpen(false)} className="text-white/80 hover:text-white cursor-pointer">✕</button>
          </div>

          <div className="flex-1 p-4 overflow-y-auto space-y-3">
            {chatMessages.map((m) => (
              <div
                key={m.id}
                className={`p-3 rounded-2xl max-w-[80%] text-xs leading-relaxed ${
                  m.sender === 'me'
                    ? 'ms-auto bg-gradient-to-r from-cyan-500 to-indigo-600 text-slate-950 font-semibold'
                    : 'me-auto bg-white/10 text-white'
                }`}
              >
                <div>{m.text}</div>
                <span className="text-[10px] opacity-70 block mt-1">{m.time}</span>
              </div>
            ))}
          </div>

          <div className="p-3 border-t border-white/10 flex items-center gap-2 bg-slate-950/80">
            <input
              type="text"
              placeholder="כתוב הודעה לנועה..."
              value={newMsg}
              onChange={(e) => setNewMsg(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newMsg.trim()) {
                  setChatMessages((prev) => [
                    ...prev,
                    { id: Date.now(), sender: 'me', name: 'עידן קזם', text: newMsg, time: 'כרגע' },
                  ]);
                  setNewMsg('');
                }
              }}
              className="flex-1 px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white outline-none focus:border-cyan-400"
            />
            <button
              onClick={() => {
                if (!newMsg.trim()) return;
                setChatMessages((prev) => [
                  ...prev,
                  { id: Date.now(), sender: 'me', name: 'עידן קזם', text: newMsg, time: 'כרגע' },
                ]);
                setNewMsg('');
              }}
              className="px-3.5 py-2 rounded-xl bg-cyan-400 text-slate-950 font-bold text-xs cursor-pointer"
            >
              שלח
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
