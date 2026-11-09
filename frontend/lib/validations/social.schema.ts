import { z } from "zod";

export const ReactionTypeSchema = z.enum(["LIKE", "FIRE", "CLAP", "STAR", "MIND_BLOWN"]);

export const CreatePostSchema = z.object({
  content: z
    .string()
    .min(1, "תוכן הפוסט אינו יכול להיות ריק")
    .max(2000, "הפוסט ארוך מדי (מקסימום 2,000 תווים)"),
  mediaUrls: z
    .array(z.string().url("כתובת מדיה לא תקינה"))
    .max(4, "ניתן לצרף עד 4 קבצי מדיה לפוסט")
    .optional()
    .default([]),
  groupId: z.string().optional(),
  attachedEntity: z
    .object({
      entityType: z.enum(["PRODUCT", "ITEM", "ACHIEVEMENT", "EVENT"]),
      entityId: z.string(),
      title: z.string(),
      thumbnailUrl: z.string().url().optional(),
    })
    .optional(),
  tags: z.array(z.string().max(30)).max(10).optional().default([]),
  poll: z
    .object({
      question: z.string().min(2, "שאלת הסקר קצרה מדי"),
      options: z.array(z.string().min(1)).min(2, "יש להזין לפחות 2 אפשרויות"),
      durationHours: z.number().default(24),
    })
    .optional(),
});

export const ToggleReactionSchema = z.object({
  targetId: z.string().min(1),
  targetType: z.enum(["POST", "COMMENT"]),
  reactionType: ReactionTypeSchema,
});

export const CreateCommentSchema = z.object({
  postId: z.string().min(1),
  parentCommentId: z.string().optional(),
  content: z
    .string()
    .min(1, "תוכן התגובה אינו יכול להיות ריק")
    .max(600, "התגובה ארוכה מדי (מקסימום 600 תווים)"),
});

export const FeedFilterSchema = z.object({
  tab: z.enum(["TRENDING", "FOLLOWING", "GROUP"]).default("TRENDING"),
  groupId: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.number().int().min(5).max(50).default(15),
});

export type ReactionType = z.infer<typeof ReactionTypeSchema>;
export type CreatePostInput = z.infer<typeof CreatePostSchema>;
export type ToggleReactionInput = z.infer<typeof ToggleReactionSchema>;
export type CreateCommentInput = z.infer<typeof CreateCommentSchema>;
export type FeedFilterInput = z.infer<typeof FeedFilterSchema>;
