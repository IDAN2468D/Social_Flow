'use client';

import React, { useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ImagePlus,
  BarChart3,
  Sparkles,
  Hash,
  X,
  Plus,
  Globe,
  Users,
  Lock,
  Loader2,
  Send,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

export interface ComposerUser {
  id?: string | number;
  username?: string;
  name?: string;
  avatarUrl?: string;
}

export interface CreatedPostPollOption {
  id: number;
  text: string;
  voteCount?: number;
  percentage?: number;
  isSelected?: boolean;
}

export interface CreatedPostPayload {
  id: number | string;
  authorId?: number;
  authorUsername: string;
  authorName?: string;
  authorAvatar?: string;
  content: string;
  mediaUrls?: string[];
  tags?: string[];
  visibility?: 'PUBLIC' | 'FOLLOWERS' | 'PRIVATE' | string;
  likesCount?: number;
  commentsCount?: number;
  repostsCount?: number;
  isLiked?: boolean;
  isBookmarked?: boolean;
  createdAt?: string;
  poll?: {
    id?: number;
    question: string;
    options: CreatedPostPollOption[];
    totalVotes?: number;
    hasVoted?: boolean;
  };
}

export interface AIAnalyzeResult {
  sentiment?: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | string;
  category?: string;
  suggested_tags?: string[];
  is_safe?: boolean;
  moderation_reason?: string;
  summary?: string;
  model_used?: string;
}

export interface PostComposerCardProps {
  currentUser?: ComposerUser;
  apiBaseUrl?: string;
  authToken?: string | null;
  maxCharacters?: number;
  maxImages?: number;
  defaultExpanded?: boolean;
  placeholder?: string;
  onPostCreated?: (post: CreatedPostPayload) => void;
  className?: string;
}

interface UploadItem {
  id: string;
  url: string;
  name: string;
  status: 'uploading' | 'done' | 'fallback';
  progress: number;
}

const VALID_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export function PostComposerCard({
  currentUser = {
    id: 1,
    username: 'idan',
    name: 'עידן קזם',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=idan',
  },
  apiBaseUrl = '',
  authToken = null,
  maxCharacters = 2000,
  maxImages = 4,
  defaultExpanded = false,
  placeholder = 'מה חדש בפיד שלך? שתף רעיון, תובנה טכנולוגית או סקר... (תומך עברית ואנגלית)',
  onPostCreated,
  className = '',
}: PostComposerCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [content, setContent] = useState('');
  const [manualTags, setManualTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);

  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const [showPoll, setShowPoll] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [pollDurationHours, setPollDurationHours] = useState<number>(24);

  const [visibility, setVisibility] = useState<'PUBLIC' | 'FOLLOWERS' | 'PRIVATE'>('PUBLIC');

  const [aiLoading, setAiLoading] = useState(false);
  const [aiInsight, setAiInsight] = useState<AIAnalyzeResult | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'error' | 'info' | 'success'; text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Extract inline #hashtags from content automatically
  const inlineTags = useMemo(() => {
    const matches = content.match(/#([\w\u0590-\u05fe]+)/g) || [];
    return Array.from(new Set(matches.map((t) => t.replace(/^#/, ''))));
  }, [content]);

  const combinedTags = useMemo(() => {
    return Array.from(new Set([...manualTags, ...inlineTags])).slice(0, 10);
  }, [manualTags, inlineTags]);

  // Character Ring Calculations
  const charCount = content.length;
  const charRatio = Math.min(charCount / maxCharacters, 1);
  const remainingChars = maxCharacters - charCount;
  const ringRadius = 11;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference * (1 - charRatio);

  const ringColor =
    charCount > maxCharacters
      ? '#F43F5E'
      : charRatio >= 0.9
      ? '#F59E0B'
      : '#6366F1';

  const isUploadingAny = uploads.some((u) => u.status === 'uploading');

  const buildAuthHeaders = (includeContentType = true): Record<string, string> => {
    const headers: Record<string, string> = {
      'X-Auth-UserId': String(currentUser.id ?? 1),
      'X-Auth-Username': currentUser.username ?? 'idan',
    };
    if (includeContentType) {
      headers['Content-Type'] = 'application/json';
    }
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    return headers;
  };

  const handleFilesSelected = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setIsExpanded(true);
    setStatusMessage(null);

    const availableSlots = maxImages - uploads.length;
    if (availableSlots <= 0) {
      setStatusMessage({ type: 'error', text: `ניתן לצרף עד ${maxImages} תמונות לפוסט.` });
      return;
    }

    const files = Array.from(fileList).slice(0, availableSlots);

    for (const file of files) {
      if (!VALID_IMAGE_TYPES.includes(file.type)) {
        setStatusMessage({
          type: 'error',
          text: `הקובץ "${file.name}" אינו נתמך. מותר JPG, PNG, WEBP או GIF.`,
        });
        continue;
      }

      const tempId = `upload_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const localPreviewUrl = URL.createObjectURL(file);

      setUploads((prev) => [
        ...prev,
        { id: tempId, url: localPreviewUrl, name: file.name, status: 'uploading', progress: 25 },
      ]);

      try {
        // 1. Request MinIO S3 presigned URL
        const presignRes = await fetch(`${apiBaseUrl}/api/v1/media/upload-url`, {
          method: 'POST',
          credentials: 'include',
          headers: buildAuthHeaders(true),
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type,
          }),
        });

        if (!presignRes.ok) {
          throw new Error(`Presign failed (${presignRes.status})`);
        }

        const { uploadUrl, accessUrl } = (await presignRes.json()) as {
          fileKey?: string;
          uploadUrl: string;
          accessUrl: string;
        };

        setUploads((prev) =>
          prev.map((u) => (u.id === tempId ? { ...u, progress: 65 } : u))
        );

        // 2. PUT directly to MinIO S3
        const putRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: file,
        });

        if (!putRes.ok) {
          throw new Error(`S3 PUT failed (${putRes.status})`);
        }

        URL.revokeObjectURL(localPreviewUrl);
        setUploads((prev) =>
          prev.map((u) =>
            u.id === tempId ? { ...u, url: accessUrl, status: 'done', progress: 100 } : u
          )
        );
      } catch {
        // Graceful local fallback preview when MinIO / Gateway is unreachable
        setUploads((prev) =>
          prev.map((u) =>
            u.id === tempId ? { ...u, status: 'fallback', progress: 100 } : u
          )
        );
        setStatusMessage({
          type: 'info',
          text: 'מצב תצוגה מקדימה: שרת MinIO לא זמין כרגע, התמונה נשמרה מקומית לפוסט.',
        });
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveUpload = (id: string) => {
    setUploads((prev) => {
      const target = prev.find((u) => u.id === id);
      if (target && target.url.startsWith('blob:')) {
        URL.revokeObjectURL(target.url);
      }
      return prev.filter((u) => u.id !== id);
    });
  };

  const handleAddManualTag = () => {
    const clean = tagInput.trim().replace(/^#/, '').replace(/\s+/g, '_');
    if (clean && !combinedTags.includes(clean)) {
      setManualTags((prev) => [...prev, clean]);
    }
    setTagInput('');
  };

  const handleRemoveTag = (tag: string) => {
    setManualTags((prev) => prev.filter((t) => t !== tag));
  };

  const handleAiEnhance = async () => {
    const trimmed = content.trim();
    if (!trimmed) {
      setStatusMessage({ type: 'info', text: 'כתוב תחילה טקסט קצר כדי שה-AI ינתח וישפר את הפוסט.' });
      textareaRef.current?.focus();
      return;
    }

    setAiLoading(true);
    setStatusMessage(null);

    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/ai/analyze`, {
        method: 'POST',
        credentials: 'include',
        headers: buildAuthHeaders(true),
        body: JSON.stringify({ content: trimmed }),
      });

      if (!res.ok) {
        throw new Error(`AI service status ${res.status}`);
      }

      const data = (await res.json()) as AIAnalyzeResult;
      setAiInsight(data);

      if (Array.isArray(data.suggested_tags) && data.suggested_tags.length > 0) {
        const normalized = data.suggested_tags
          .map((t) => t.replace(/^#/, '').trim())
          .filter(Boolean);
        setManualTags((prev) => Array.from(new Set([...prev, ...normalized])).slice(0, 10));
      }
      setStatusMessage({ type: 'success', text: 'Gemini AI ניתח את הפוסט והוסיף תגיות חכמות ✨' });
    } catch {
      // Offline graceful AI fallback
      const fallbackTags = ['SocialFlow', 'AI', 'Tech'];
      setAiInsight({
        sentiment: 'POSITIVE',
        category: 'Technology',
        suggested_tags: fallbackTags,
        is_safe: true,
        summary: trimmed.slice(0, 90),
        model_used: 'offline-fallback',
      });
      setManualTags((prev) => Array.from(new Set([...prev, ...fallbackTags])).slice(0, 10));
      setStatusMessage({
        type: 'info',
        text: 'תגיות חכמות הוספו במצב אופליין (ai-service לא מחובר כרגע).',
      });
    } finally {
      setAiLoading(false);
    }
  };

  const handleAddPollOption = () => {
    if (pollOptions.length < 5) {
      setPollOptions((prev) => [...prev, '']);
    }
  };

  const handleRemovePollOption = (index: number) => {
    if (pollOptions.length > 2) {
      setPollOptions((prev) => prev.filter((_, idx) => idx !== index));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    const validPollOpts = pollOptions.map((o) => o.trim()).filter(Boolean);
    let pollPayload:
      | { question: string; options: string[]; durationHours: number }
      | undefined;

    if (showPoll) {
      if (!pollQuestion.trim() || validPollOpts.length < 2) {
        setStatusMessage({
          type: 'error',
          text: 'סקר חייב לכלול שאלה ולפחות 2 אפשרויות בחירה.',
        });
        return;
      }
      pollPayload = {
        question: pollQuestion.trim(),
        options: validPollOpts,
        durationHours: pollDurationHours,
      };
    }

    const finalContent = content.trim() || (pollPayload ? pollPayload.question : '');
    if (!finalContent) {
      setStatusMessage({ type: 'error', text: 'תוכן הפוסט אינו יכול להיות ריק.' });
      return;
    }
    if (finalContent.length > maxCharacters) {
      setStatusMessage({
        type: 'error',
        text: `הפוסט חורג ממגבלת ${maxCharacters} התווים.`,
      });
      return;
    }

    const mediaUrls = uploads.filter((u) => u.status !== 'uploading').map((u) => u.url);
    const requestBody = {
      content: finalContent,
      mediaUrls,
      tags: combinedTags,
      visibility,
      ...(pollPayload ? { poll: pollPayload } : {}),
    };

    setSubmitting(true);

    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/posts`, {
        method: 'POST',
        credentials: 'include',
        headers: buildAuthHeaders(true),
        body: JSON.stringify(requestBody),
      });

      if (res.ok) {
        const created = (await res.json()) as CreatedPostPayload;
        onPostCreated?.({
          ...created,
          authorName: created.authorName || currentUser.name || currentUser.username || 'משתמש',
          authorAvatar: created.authorAvatar || currentUser.avatarUrl,
        });
        resetComposer();
        setStatusMessage({ type: 'success', text: 'הפוסט פורסם בהצלחה!' });
        return;
      }
      throw new Error(`HTTP ${res.status}`);
    } catch {
      // Fallback callback so UI state updates seamlessly even in offline/mock mode
      const fallbackPost: CreatedPostPayload = {
        id: Date.now(),
        authorId: typeof currentUser.id === 'number' ? currentUser.id : 1,
        authorUsername: currentUser.username || 'idan',
        authorName: currentUser.name || 'עידן קזם',
        authorAvatar:
          currentUser.avatarUrl || 'https://api.dicebear.com/7.x/bottts/svg?seed=idan',
        content: finalContent,
        mediaUrls,
        tags: combinedTags,
        visibility,
        likesCount: 0,
        commentsCount: 0,
        repostsCount: 0,
        isLiked: false,
        isBookmarked: false,
        createdAt: new Date().toISOString(),
        ...(pollPayload
          ? {
              poll: {
                id: Date.now(),
                question: pollPayload.question,
                totalVotes: 0,
                hasVoted: false,
                options: pollPayload.options.map((text, idx) => ({
                  id: idx + 1,
                  text,
                  voteCount: 0,
                  percentage: 0,
                  isSelected: false,
                })),
              },
            }
          : {}),
      };
      onPostCreated?.(fallbackPost);
      resetComposer();
      setStatusMessage({
        type: 'info',
        text: 'הפוסט נוסף לפיד המקומי (שרת ה-API אינו זמין כעת).',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const resetComposer = () => {
    setContent('');
    setManualTags([]);
    setTagInput('');
    setShowTagInput(false);
    setUploads([]);
    setShowPoll(false);
    setPollQuestion('');
    setPollOptions(['', '']);
    setAiInsight(null);
  };

  return (
    <section
      aria-label="יצירת פוסט חדש"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
        setIsExpanded(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        handleFilesSelected(e.dataTransfer.files);
      }}
      className={`relative rounded-2xl bg-[#121521]/75 backdrop-blur-xl border transition-all duration-200 shadow-[0_12px_36px_rgba(0,0,0,0.4)] ${
        isDragging
          ? 'border-[#6366F1] ring-2 ring-[#6366F1]/30'
          : isExpanded
          ? 'border-indigo-500/35'
          : 'border-white/10 hover:border-indigo-500/30'
      } ${className}`}
    >
      {/* Drag Overlay */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-20 rounded-2xl bg-[#090A0F]/85 backdrop-blur-md border-2 border-dashed border-[#6366F1] flex flex-col items-center justify-center gap-2 pointer-events-none"
          >
            <UploadCloud className="w-8 h-8 text-[#6366F1]" />
            <p className="text-sm font-semibold text-[#F8FAFC]">
              שחרר כאן להעלאת תמונות ישירות ל-MinIO S3
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={handleSubmit} className="p-4 sm:p-5">
        <div className="flex items-start gap-3.5">
          <img
            src={currentUser.avatarUrl || 'https://api.dicebear.com/7.x/bottts/svg?seed=idan'}
            alt={currentUser.name || currentUser.username || 'Avatar'}
            className="w-10 h-10 rounded-full object-cover border border-white/15 bg-[#090A0F] shrink-0"
          />

          <div className="flex-1 min-w-0">
            <textarea
              ref={textareaRef}
              dir="auto"
              rows={isExpanded ? 3 : 1}
              value={content}
              onFocus={() => setIsExpanded(true)}
              onChange={(e) => setContent(e.target.value)}
              placeholder={placeholder}
              className="w-full bg-transparent text-[#F8FAFC] placeholder-[#64748B] text-[15px] leading-relaxed resize-none focus:outline-none min-h-[40px]"
            />

            {/* Hashtag Chips Row */}
            {combinedTags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                {combinedTags.map((tag) => {
                  const isManual = manualTags.includes(tag);
                  return (
                    <span
                      key={tag}
                      dir="auto"
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono bg-[#6366F1]/15 border border-[#6366F1]/35 text-indigo-200"
                    >
                      <span>#{tag}</span>
                      {isManual && (
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          aria-label={`הסר תגית ${tag}`}
                          className="text-indigo-300 hover:text-white cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Expandable Body */}
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              {/* Manual Hashtag Input */}
              <AnimatePresence>
                {showTagInput && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="mt-3 flex items-center gap-2 ps-13"
                  >
                    <div className="relative flex-1">
                      <Hash className="w-3.5 h-3.5 text-[#64748B] absolute start-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        dir="auto"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddManualTag();
                          }
                        }}
                        placeholder="הוסף תגית (לדוגמה: NextJS, AI, קהילה)..."
                        className="w-full ps-8 pe-3 py-1.5 rounded-xl bg-[#090A0F]/80 border border-white/10 text-xs text-[#F8FAFC] placeholder-[#64748B] focus:outline-none focus:border-[#6366F1]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddManualTag}
                      className="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-medium text-[#F8FAFC] cursor-pointer"
                    >
                      הוסף
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Multi-Image Preview Grid */}
              {uploads.length > 0 && (
                <div
                  className={`mt-3.5 ps-13 grid gap-2 ${
                    uploads.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
                  }`}
                >
                  {uploads.map((item) => (
                    <div
                      key={item.id}
                      className="relative group rounded-xl overflow-hidden border border-white/10 bg-[#090A0F] aspect-video"
                    >
                      <img
                        src={item.url}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />

                      {/* Upload progress overlay */}
                      {item.status === 'uploading' && (
                        <div className="absolute inset-0 bg-[#090A0F]/75 backdrop-blur-sm flex flex-col items-center justify-center gap-2 p-3">
                          <Loader2 className="w-5 h-5 text-[#6366F1] animate-spin" />
                          <div className="w-full max-w-[140px] h-1.5 rounded-full bg-white/10 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] transition-all duration-300"
                              style={{ width: `${item.progress}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-mono text-[#94A3B8]">
                            MinIO S3...
                          </span>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => handleRemoveUpload(item.id)}
                        aria-label={`הסר ${item.name}`}
                        className="absolute top-2 end-2 p-1.5 rounded-full bg-[#090A0F]/80 border border-white/15 text-[#F8FAFC] hover:bg-[#F43F5E] hover:border-[#F43F5E] transition-colors cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Poll Builder */}
              <AnimatePresence>
                {showPoll && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="mt-3.5 ms-13 p-3.5 rounded-xl bg-[#090A0F]/75 border border-white/10 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#8B5CF6] flex items-center gap-1.5">
                        <BarChart3 className="w-3.5 h-3.5" />
                        בונה סקר אינטראקטיבי
                      </span>
                      <div className="flex items-center gap-2">
                        <select
                          aria-label="משך הסקר"
                          value={pollDurationHours}
                          onChange={(e) => setPollDurationHours(Number(e.target.value))}
                          className="bg-[#121521] border border-white/10 rounded-lg px-2 py-1 text-[11px] font-mono text-[#94A3B8] focus:outline-none focus:border-[#6366F1]"
                        >
                          <option value={12}>12h</option>
                          <option value={24}>24h</option>
                          <option value={72}>3d</option>
                          <option value={168}>7d</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => setShowPoll(false)}
                          className="text-xs text-[#64748B] hover:text-[#F43F5E] cursor-pointer"
                        >
                          הסר סקר
                        </button>
                      </div>
                    </div>

                    <input
                      type="text"
                      dir="auto"
                      value={pollQuestion}
                      onChange={(e) => setPollQuestion(e.target.value)}
                      placeholder="שאלת הסקר..."
                      className="w-full px-3 py-2 rounded-xl bg-[#121521]/90 border border-white/10 text-sm text-[#F8FAFC] placeholder-[#64748B] focus:outline-none focus:border-[#6366F1]"
                    />

                    <div className="space-y-2">
                      {pollOptions.map((opt, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input
                            type="text"
                            dir="auto"
                            value={opt}
                            onChange={(e) => {
                              const next = [...pollOptions];
                              next[idx] = e.target.value;
                              setPollOptions(next);
                            }}
                            placeholder={`אפשרות ${idx + 1}`}
                            className="flex-1 px-3 py-1.5 rounded-xl bg-[#121521]/80 border border-white/10 text-xs text-[#F8FAFC] placeholder-[#64748B] focus:outline-none focus:border-[#6366F1]"
                          />
                          {pollOptions.length > 2 && (
                            <button
                              type="button"
                              onClick={() => handleRemovePollOption(idx)}
                              aria-label="מחק אפשרות"
                              className="p-1.5 rounded-lg text-[#64748B] hover:text-[#F43F5E] hover:bg-white/[0.05] cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    {pollOptions.length < 5 && (
                      <button
                        type="button"
                        onClick={handleAddPollOption}
                        className="inline-flex items-center gap-1 text-xs font-medium text-[#6366F1] hover:text-[#8B5CF6] cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>הוסף אפשרות ({pollOptions.length}/5)</span>
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* AI Insight Pill */}
              {aiInsight && (
                <div className="mt-3 ms-13 px-3 py-2 rounded-xl bg-[#6366F1]/10 border border-[#6366F1]/30 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 text-indigo-200">
                    <Sparkles className="w-3.5 h-3.5 text-[#8B5CF6]" />
                    <span>ניתוח Gemini:</span>
                    {aiInsight.category && (
                      <span className="px-2 py-0.5 rounded-md bg-white/10 font-mono text-[11px]">
                        {aiInsight.category}
                      </span>
                    )}
                    {aiInsight.sentiment && (
                      <span className="px-2 py-0.5 rounded-md bg-[#10B981]/15 text-[#10B981] font-mono text-[11px]">
                        {aiInsight.sentiment}
                      </span>
                    )}
                  </div>
                  {aiInsight.is_safe !== undefined && (
                    <span className="text-[11px] font-mono text-[#94A3B8]">
                      {aiInsight.is_safe ? '✓ Safe Content' : '⚠ Review'}
                    </span>
                  )}
                </div>
              )}

              {/* Status / Error Banner */}
              {statusMessage && (
                <div
                  className={`mt-3 ms-13 px-3 py-2 rounded-xl border text-xs flex items-center gap-2 ${
                    statusMessage.type === 'error'
                      ? 'bg-[#F43F5E]/15 border-[#F43F5E]/35 text-rose-200'
                      : statusMessage.type === 'success'
                      ? 'bg-[#10B981]/15 border-[#10B981]/35 text-emerald-200'
                      : 'bg-[#6366F1]/15 border-[#6366F1]/35 text-indigo-200'
                  }`}
                >
                  {statusMessage.type === 'error' ? (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  )}
                  <span className="flex-1">{statusMessage.text}</span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action Toolbar */}
        <div className="mt-3 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1 sm:gap-1.5">
            {/* Hidden File Input for MinIO S3 Upload */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              className="hidden"
              onChange={(e) => handleFilesSelected(e.target.files)}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploads.length >= maxImages}
              title="העלה תמונות ל-MinIO S3"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-white/[0.06] disabled:opacity-40 transition-colors cursor-pointer"
            >
              <ImagePlus className="w-4 h-4 text-[#6366F1]" />
              <span className="hidden sm:inline">מדיה</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsExpanded(true);
                setShowPoll((v) => !v);
              }}
              title="צרף סקר"
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                showPoll
                  ? 'bg-[#8B5CF6]/20 text-[#F8FAFC] border border-[#8B5CF6]/40'
                  : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-white/[0.06]'
              }`}
            >
              <BarChart3 className="w-4 h-4 text-[#8B5CF6]" />
              <span className="hidden sm:inline">סקר</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsExpanded(true);
                setShowTagInput((v) => !v);
              }}
              title="הוסף האשטאגים"
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                showTagInput
                  ? 'bg-[#6366F1]/20 text-[#F8FAFC] border border-[#6366F1]/40'
                  : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-white/[0.06]'
              }`}
            >
              <Hash className="w-4 h-4 text-indigo-400" />
              <span className="hidden sm:inline">תגית</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsExpanded(true);
                handleAiEnhance();
              }}
              disabled={aiLoading}
              title="שיפור פוסט והמלצת תגיות עם Gemini AI"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-violet-300 bg-[#8B5CF6]/10 hover:bg-[#8B5CF6]/20 border border-[#8B5CF6]/30 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {aiLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              <span>AI Enhance</span>
            </button>
          </div>

          <div className="flex items-center gap-3 ms-auto">
            {/* Visibility selector when expanded */}
            {isExpanded && (
              <div className="relative flex items-center">
                {visibility === 'PUBLIC' ? (
                  <Globe className="w-3.5 h-3.5 text-[#10B981] absolute start-2.5 pointer-events-none" />
                ) : visibility === 'FOLLOWERS' ? (
                  <Users className="w-3.5 h-3.5 text-[#6366F1] absolute start-2.5 pointer-events-none" />
                ) : (
                  <Lock className="w-3.5 h-3.5 text-[#94A3B8] absolute start-2.5 pointer-events-none" />
                )}
                <select
                  aria-label="פרטיות הפוסט"
                  value={visibility}
                  onChange={(e) =>
                    setVisibility(e.target.value as 'PUBLIC' | 'FOLLOWERS' | 'PRIVATE')
                  }
                  className="ps-7 pe-2.5 py-1.5 rounded-xl bg-[#090A0F]/80 border border-white/10 text-xs text-[#94A3B8] focus:outline-none focus:border-[#6366F1]"
                >
                  <option value="PUBLIC">ציבורי</option>
                  <option value="FOLLOWERS">עוקבים</option>
                  <option value="PRIVATE">פרטי</option>
                </select>
              </div>
            )}

            {/* SVG Character Progress Ring */}
            <div
              className="flex items-center gap-1.5"
              title={`${charCount} / ${maxCharacters}`}
            >
              <svg className="w-7 h-7 -rotate-90" viewBox="0 0 28 28" aria-hidden="true">
                <circle
                  cx="14"
                  cy="14"
                  r={ringRadius}
                  fill="none"
                  stroke="rgba(255,255,255,0.1)"
                  strokeWidth="2.5"
                />
                <circle
                  cx="14"
                  cy="14"
                  r={ringRadius}
                  fill="none"
                  stroke={ringColor}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringOffset}
                  className="transition-all duration-150"
                />
              </svg>
              {charCount > maxCharacters * 0.8 && (
                <span
                  className={`text-[11px] font-mono ${
                    remainingChars < 0 ? 'text-[#F43F5E]' : 'text-[#94A3B8]'
                  }`}
                >
                  {remainingChars}
                </span>
              )}
            </div>

            <motion.button
              type="submit"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              disabled={
                submitting ||
                isUploadingAny ||
                charCount > maxCharacters ||
                (!content.trim() && !(showPoll && pollQuestion.trim()))
              }
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] text-white font-semibold text-xs sm:text-sm shadow-[0_4px_20px_rgba(99,102,241,0.35)] hover:shadow-[0_6px_25px_rgba(99,102,241,0.5)] disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>{submitting ? 'מפרסם...' : 'פרסם'}</span>
            </motion.button>
          </div>
        </div>
      </form>
    </section>
  );
}
