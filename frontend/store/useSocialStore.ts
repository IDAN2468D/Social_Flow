import { create } from "zustand";

export interface SocialNotificationItem {
  id: string;
  actorName: string;
  actorAvatar: string;
  type: "REACTION" | "COMMENT" | "MENTION" | "FOLLOW";
  text: string;
  time: string;
  isRead: boolean;
  targetPostId?: string;
}

interface SocialStoreState {
  currentTab: "TRENDING" | "FOLLOWING" | "GROUP";
  setTab: (tab: "TRENDING" | "FOLLOWING" | "GROUP") => void;

  isComposerOpen: boolean;
  openComposer: () => void;
  closeComposer: () => void;

  activeCommentsPostId: string | null;
  openComments: (postId: string) => void;
  closeComments: () => void;

  isAgentModalOpen: boolean;
  openAgentModal: () => void;
  closeAgentModal: () => void;

  notifications: SocialNotificationItem[];
  unreadNotificationsCount: number;
  markAllNotificationsRead: () => void;
}

export const useSocialStore = create<SocialStoreState>((set) => ({
  currentTab: "TRENDING",
  setTab: (tab) => set({ currentTab: tab }),

  isComposerOpen: false,
  openComposer: () => set({ isComposerOpen: true }),
  closeComposer: () => set({ isComposerOpen: false }),

  activeCommentsPostId: null,
  openComments: (postId) => set({ activeCommentsPostId: postId }),
  closeComments: () => set({ activeCommentsPostId: null }),

  isAgentModalOpen: false,
  openAgentModal: () => set({ isAgentModalOpen: true }),
  closeAgentModal: () => set({ isAgentModalOpen: false }),

  notifications: [
    {
      id: "n1",
      actorName: "נועה כהן",
      actorAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Noa",
      type: "REACTION",
      text: "אהבה את הפוסט שלך על Next.js 15 וסוכני AI",
      time: "לפני 10 דק'",
      isRead: false,
      targetPostId: "101",
    },
    {
      id: "n2",
      actorName: "דניאל לוי",
      actorAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Daniel",
      type: "COMMENT",
      text: "הגיב: 'האינטגרציה של LangGraph מדהימה!'",
      time: "לפני 35 דק'",
      isRead: false,
      targetPostId: "102",
    },
  ],
  unreadNotificationsCount: 2,
  markAllNotificationsRead: () =>
    set((state) => ({
      unreadNotificationsCount: 0,
      notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
    })),
}));
