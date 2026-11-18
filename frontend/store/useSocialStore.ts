import { create } from "zustand";
import { clearStoredAuthToken, isJwtExpired } from "@/lib/auth";

export interface SocialNotificationItem {
  id: string;
  actorName: string;
  actorUsername?: string;
  actorAvatar: string;
  type: "REACTION" | "COMMENT" | "MENTION" | "FOLLOW";
  text: string;
  time: string;
  isRead: boolean;
  targetPostId?: string;
  entityId?: string;
}

interface RawNotificationDto {
  id?: string | number;
  recipientId?: number;
  actorId?: number;
  actorName?: string;
  actorUsername?: string;
  actorAvatar?: string;
  type?: string;
  entityId?: string | number | null;
  targetPostId?: string | number | null;
  message?: string;
  text?: string;
  isRead?: boolean;
  read?: boolean;
  createdAt?: string;
  time?: string;
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
  notificationsLoading: boolean;
  notificationsSource: "live" | "fallback";
  fetchNotifications: (headers?: Record<string, string>) => Promise<void>;
  markNotificationRead: (
    id: string,
    headers?: Record<string, string>
  ) => Promise<void>;
  markAllNotificationsRead: (
    headersOrEvent?: Record<string, string> | unknown
  ) => Promise<void>;
}

const FALLBACK_NOTIFICATIONS: SocialNotificationItem[] = [
  {
    id: "n1",
    actorName: "נועה כהן",
    actorUsername: "noa",
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
    actorUsername: "daniel",
    actorAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Daniel",
    type: "COMMENT",
    text: "הגיב: 'האינטגרציה של LangGraph מדהימה!'",
    time: "לפני 35 דק'",
    isRead: false,
    targetPostId: "102",
  },
  {
    id: "n3",
    actorName: "מאיה שקד",
    actorUsername: "maya",
    actorAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Maya",
    type: "MENTION",
    text: "אזכרה אותך בדיון על עיצוב Liquid Glass 2.0",
    time: "לפני שעה",
    isRead: true,
    targetPostId: "104",
  },
];

function sanitizeHeaders(
  headers?: unknown
): Record<string, string> | undefined {
  if (
    !headers ||
    typeof headers !== "object" ||
    Array.isArray(headers) ||
    "nativeEvent" in headers ||
    "target" in headers
  ) {
    return undefined;
  }
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers as Record<string, unknown>)) {
    if (typeof v === "string" && v.length > 0) {
      clean[k] = v;
    }
  }
  return Object.keys(clean).length > 0 ? clean : undefined;
}

function resolveNotificationHeaders(
  provided?: unknown
): Record<string, string> {
  const safeProvided = sanitizeHeaders(provided);
  const resolved: Record<string, string> = {
    Accept: "application/json",
    ...(safeProvided ?? {}),
  };

  if (typeof window !== "undefined" && !resolved.Authorization) {
    try {
      const raw = localStorage.getItem("socialflow_user");
      if (raw) {
        const parsed = JSON.parse(raw) as {
          userId?: number | string;
          username?: string;
          token?: string;
        };
        if (parsed?.token) {
          if (isJwtExpired(parsed.token)) {
            clearStoredAuthToken();
          } else {
            resolved.Authorization = `Bearer ${parsed.token}`;
          }
        }
        if (parsed?.userId != null && !resolved["X-Auth-UserId"]) {
          resolved["X-Auth-UserId"] = String(parsed.userId);
        }
        if (parsed?.username && !resolved["X-Auth-Username"]) {
          resolved["X-Auth-Username"] = parsed.username;
        }
      }
    } catch {
      // Ignore storage parsing errors
    }
  }

  return resolved;
}

function formatNotificationTime(isoOrText?: string): string {
  if (!isoOrText) return "עכשיו";
  const date = new Date(isoOrText);
  if (Number.isNaN(date.getTime())) return isoOrText;
  const diffSec = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diffSec < 60) return "עכשיו";
  if (diffSec < 3600) return `לפני ${Math.floor(diffSec / 60)} דק'`;
  if (diffSec < 86400) return `לפני ${Math.floor(diffSec / 3600)} שע'`;
  return date.toLocaleDateString("he-IL", { day: "numeric", month: "short" });
}

function normalizeNotificationType(
  rawType?: string
): SocialNotificationItem["type"] {
  const upper = (rawType || "").toUpperCase();
  if (upper === "LIKE" || upper === "REACTION") return "REACTION";
  if (upper === "MENTION") return "MENTION";
  if (upper === "FOLLOW") return "FOLLOW";
  if (upper === "COMMENT") return "COMMENT";
  return "REACTION";
}

function mapRawNotification(
  raw: RawNotificationDto,
  idx: number
): SocialNotificationItem {
  const normalizedType = normalizeNotificationType(raw.type);
  const actorUsername = raw.actorUsername || undefined;
  const actorName =
    raw.actorName ||
    (actorUsername
      ? `@${actorUsername}`
      : raw.actorId != null
      ? `משתמש #${raw.actorId}`
      : "חבר קהילה");
  const avatarSeed = actorUsername || String(raw.actorId ?? raw.id ?? idx);
  const entityStr =
    raw.entityId != null
      ? String(raw.entityId)
      : raw.targetPostId != null
      ? String(raw.targetPostId)
      : undefined;

  return {
    id: String(raw.id ?? `notif-${idx}`),
    actorName,
    actorUsername,
    actorAvatar:
      raw.actorAvatar ||
      `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(avatarSeed)}`,
    type: normalizedType,
    text: raw.message || raw.text || "",
    time: formatNotificationTime(raw.createdAt || raw.time),
    isRead: Boolean(raw.isRead ?? raw.read),
    targetPostId: normalizedType === "FOLLOW" ? undefined : entityStr,
    entityId: entityStr,
  };
}

export const useSocialStore = create<SocialStoreState>((set, get) => ({
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

  notifications: FALLBACK_NOTIFICATIONS,
  unreadNotificationsCount: FALLBACK_NOTIFICATIONS.filter((n) => !n.isRead).length,
  notificationsLoading: false,
  notificationsSource: "fallback",

  fetchNotifications: async (headers) => {
    const resolvedHeaders = resolveNotificationHeaders(headers);
    set({ notificationsLoading: true });
    try {
      const [listRes, countRes] = await Promise.allSettled([
        fetch("/api/v1/notifications", {
          method: "GET",
          credentials: "include",
          headers: resolvedHeaders,
        }),
        fetch("/api/v1/notifications/unread-count", {
          method: "GET",
          credentials: "include",
          headers: resolvedHeaders,
        }),
      ]);

      let nextList: SocialNotificationItem[] | null = null;
      if (listRes.status === "fulfilled" && listRes.value.ok) {
        const data = (await listRes.value.json()) as unknown;
        if (Array.isArray(data)) {
          nextList = (data as RawNotificationDto[]).map((item, idx) =>
            mapRawNotification(item, idx)
          );
        }
      }

      let nextUnread: number | null = null;
      if (countRes.status === "fulfilled" && countRes.value.ok) {
        const countData = (await countRes.value.json()) as {
          unreadCount?: number;
        };
        if (typeof countData?.unreadCount === "number") {
          nextUnread = countData.unreadCount;
        }
      }

      if (nextList !== null) {
        set({
          notifications: nextList,
          unreadNotificationsCount:
            nextUnread ?? nextList.filter((n) => !n.isRead).length,
          notificationsSource: "live",
        });
      } else if (nextUnread !== null) {
        set({
          unreadNotificationsCount: nextUnread,
          notificationsSource: "live",
        });
      }
    } catch {
      // Preserve existing/curated fallback notifications when offline
    } finally {
      set({ notificationsLoading: false });
    }
  },

  markNotificationRead: async (id, headers) => {
    const target = get().notifications.find((n) => n.id === id);
    const wasUnread = target ? !target.isRead : false;

    set((state) => {
      const updated = state.notifications.map((n) =>
        n.id === id ? { ...n, isRead: true } : n
      );
      return {
        notifications: updated,
        unreadNotificationsCount: wasUnread
          ? Math.max(0, state.unreadNotificationsCount - 1)
          : state.unreadNotificationsCount,
      };
    });

    if (!/^\d+$/.test(id)) return;

    try {
      const resolvedHeaders = resolveNotificationHeaders(headers);
      await fetch(`/api/v1/notifications/${encodeURIComponent(id)}/read`, {
        method: "PATCH",
        credentials: "include",
        headers: resolvedHeaders,
      });
    } catch {
      // Optimistic read state preserved offline
    }
  },

  markAllNotificationsRead: async (headers) => {
    set((state) => ({
      unreadNotificationsCount: 0,
      notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
    }));

    try {
      const resolvedHeaders = resolveNotificationHeaders(headers);
      await fetch("/api/v1/notifications/read-all", {
        method: "PATCH",
        credentials: "include",
        headers: resolvedHeaders,
      });
    } catch {
      // Optimistic read-all state preserved offline
    }
  },
}));
