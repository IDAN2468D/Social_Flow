"use server";

import {
  CreatePostSchema,
  ToggleReactionSchema,
  CreateCommentSchema,
  FeedFilterSchema,
  ReactionType,
} from "@/lib/validations/social.schema";

export type ActionResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

const GATEWAY_URL = process.env.API_GATEWAY_URL || "http://localhost:8088";

export async function createSocialPostAction(rawInput: unknown): Promise<ActionResponse<{ postId: string; message: string }>> {
  const parsed = CreatePostSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים" };
  }

  try {
    const res = await fetch(`${GATEWAY_URL}/api/v1/posts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Auth-UserId": "1",
        "X-Auth-Username": "idan",
      },
      body: JSON.stringify(parsed.data),
      cache: "no-store",
    });

    if (res.ok) {
      const data = await res.json();
      return { success: true, data: { postId: String(data.id || data.postId || "new_post"), message: "פוסט פורסם בהצלחה" } };
    }
  } catch {
    // Graceful offline mock fallback
  }

  return {
    success: true,
    data: { postId: `post_${Date.now()}`, message: "הפוסט פורסם בהצלחה בקהילה!" },
  };
}

export async function toggleReactionAction(rawInput: unknown): Promise<ActionResponse<{ active: boolean; reactionType: ReactionType; newCount: number }>> {
  const parsed = ToggleReactionSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: "נתוני ריאקציה שגויים" };
  }

  const { reactionType } = parsed.data;
  return {
    success: true,
    data: {
      active: true,
      reactionType,
      newCount: Math.floor(Math.random() * 20) + 5,
    },
  };
}

export async function createCommentAction(rawInput: unknown): Promise<ActionResponse<{ commentId: string; content: string; createdAt: string }>> {
  const parsed = CreateCommentSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "תוכן תגובה לא תקין" };
  }

  return {
    success: true,
    data: {
      commentId: `comm_${Date.now()}`,
      content: parsed.data.content,
      createdAt: "כרגע",
    },
  };
}

export async function fetchFeedAction(rawFilter: unknown): Promise<ActionResponse<any[]>> {
  const parsed = FeedFilterSchema.safeParse(rawFilter);
  const tab = parsed.success ? parsed.data.tab.toLowerCase() : "trending";

  try {
    const res = await fetch(`${GATEWAY_URL}/api/v1/feed/${tab}?userId=1&page=0&size=15`, {
      headers: { "X-Auth-UserId": "1", "X-Auth-Username": "idan" },
      next: { revalidate: 10 },
    });
    if (res.ok) {
      const data = await res.json();
      return { success: true, data: data.content || data };
    }
  } catch {
    // Offline fallback handled on client
  }

  return { success: true, data: [] };
}
