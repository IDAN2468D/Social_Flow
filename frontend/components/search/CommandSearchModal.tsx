'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowUpRight,
  CornerDownLeft,
  Hash,
  LoaderCircle,
  Search,
  Sparkles,
  User,
  X,
} from 'lucide-react';

export type SearchResultType = 'post' | 'user' | 'tag';

export interface SearchResultItem {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle?: string;
  content: string;
  authorName?: string;
  authorUsername?: string;
  authorAvatar?: string;
  tags?: string[];
  createdAt?: string;
  likesCount?: number;
  source?: 'elasticsearch' | 'fallback';
}

export interface CommandSearchModalProps {
  isOpen?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
  onSelectResult?: (item: SearchResultItem) => void;
  onSelectTag?: (tag: string) => void;
  onAskAI?: (query: string) => void;
  initialQuery?: string;
  placeholder?: string;
  enableShortcut?: boolean;
}

const FALLBACK_RESULTS: SearchResultItem[] = [
  {
    id: 'fb-post-1',
    type: 'post',
    title: 'עידן קזם · @idan',
    subtitle: 'לפני 5 דקות · Elasticsearch & Kafka',
    content:
      'השקנו את ממשק ה-Obsidian Liquid Glass החדש ב-SocialFlow עם Next.js 15, סוכני LangGraph אוטונומיים וחיפוש מיידי ב-Elasticsearch.',
    authorName: 'עידן קזם',
    authorUsername: 'idan',
    authorAvatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=idan',
    tags: ['Nextjs15', 'LangGraph', 'SocialFlow'],
    createdAt: 'לפני 5 דקות',
    likesCount: 68,
    source: 'fallback',
  },
  {
    id: 'fb-post-2',
    type: 'post',
    title: 'נועה כהן · @noa',
    subtitle: 'לפני 25 דקות · AI & RAG',
    content:
      'Building real-time social streams with Apache Kafka, Spring Boot 3 microservices, and bilingual dir="auto" Liquid Glass cards.',
    authorName: 'נועה כהן',
    authorUsername: 'noa',
    authorAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Noa',
    tags: ['Kafka', 'AI_Agents', 'LiquidGlass'],
    createdAt: 'לפני 25 דקות',
    likesCount: 42,
    source: 'fallback',
  },
  {
    id: 'fb-user-1',
    type: 'user',
    title: 'דניאל לוי',
    subtitle: '@daniel · Staff Distributed Systems Engineer',
    content: 'Kafka Event Pipelines, Elasticsearch 8 Indexing & WebSocket STOMP Live Telemetry.',
    authorName: 'דניאל לוי',
    authorUsername: 'daniel',
    authorAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Daniel',
    tags: ['Kafka', 'Elasticsearch'],
    source: 'fallback',
  },
  {
    id: 'fb-tag-1',
    type: 'tag',
    title: '#LangGraph_Agents',
    subtitle: '1,240 פוסטים היום · קהילת AI',
    content: 'סינון הפיד לפי נושא סוכני AI אוטונומיים, LangGraph ו-RAG.',
    tags: ['LangGraph_Agents'],
    source: 'fallback',
  },
  {
    id: 'fb-tag-2',
    type: 'tag',
    title: '#Nextjs15',
    subtitle: '890 פוסטים היום · פיתוח Frontend',
    content: 'Next.js 15, React 19, Tailwind CSS v4 ורכיבי Liquid Glass.',
    tags: ['Nextjs15'],
    source: 'fallback',
  },
];

interface RawSearchPost {
  id?: string | number;
  postId?: string | number;
  authorName?: string;
  authorUsername?: string;
  authorAvatar?: string;
  content?: string;
  tags?: string[];
  createdAt?: string;
  likesCount?: number;
}

function normalizeSearchPayload(data: unknown): SearchResultItem[] {
  const rawList: RawSearchPost[] = Array.isArray(data)
    ? (data as RawSearchPost[])
    : data && typeof data === 'object' && Array.isArray((data as { content?: unknown[] }).content)
      ? ((data as { content: RawSearchPost[] }).content)
      : [];

  return rawList
    .filter((item) => item && (item.content || item.authorUsername))
    .map((item, idx) => {
      const username = item.authorUsername || 'member';
      const displayName = item.authorName || `@${username}`;
      return {
        id: String(item.id ?? item.postId ?? `es-${idx}`),
        type: 'post' as const,
        title: `${displayName} · @${username}`,
        subtitle: item.createdAt ? `${item.createdAt} · Elasticsearch` : 'Elasticsearch Index',
        content: item.content || '',
        authorName: displayName,
        authorUsername: username,
        authorAvatar:
          item.authorAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(username)}`,
        tags: Array.isArray(item.tags) ? item.tags : [],
        createdAt: item.createdAt,
        likesCount: item.likesCount,
        source: 'elasticsearch' as const,
      };
    });
}

function filterFallback(query: string): SearchResultItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return FALLBACK_RESULTS;
  const cleanQ = q.startsWith('#') ? q.slice(1) : q;
  const matched = FALLBACK_RESULTS.filter(
    (item) =>
      item.title.toLowerCase().includes(cleanQ) ||
      item.content.toLowerCase().includes(cleanQ) ||
      (item.subtitle?.toLowerCase().includes(cleanQ) ?? false) ||
      (item.tags?.some((t) => t.toLowerCase().includes(cleanQ)) ?? false)
  );
  return matched.length > 0 ? matched : FALLBACK_RESULTS.slice(0, 3);
}

export function CommandSearchModal({
  isOpen: controlledOpen,
  onOpen,
  onClose,
  onSelectResult,
  onSelectTag,
  onAskAI,
  initialQuery = '',
  placeholder = 'חפש פוסטים, משתמשים או #האשטאגים... (Search posts, users, tags)',
  enableShortcut = true,
}: CommandSearchModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResultItem[]>(FALLBACK_RESULTS);
  const [isLoading, setIsLoading] = useState(false);
  const [resultSource, setResultSource] = useState<'elasticsearch' | 'fallback'>('fallback');
  const [activeIndex, setActiveIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);

  const closeModal = () => {
    if (!isControlled) setInternalOpen(false);
    onClose?.();
  };

  const openModal = () => {
    if (!isControlled) setInternalOpen(true);
    onOpen?.();
  };

  // Global Ctrl+K / Cmd+K and Escape listener
  useEffect(() => {
    if (!enableShortcut) return;
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) {
          closeModal();
        } else {
          openModal();
        }
      } else if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        closeModal();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  });

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setActiveIndex(0);
      const timer = setTimeout(() => inputRef.current?.focus(), 40);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Debounced live GET /api/v1/search?query=...
  useEffect(() => {
    if (!isOpen) return;
    const trimmed = query.trim();

    if (!trimmed) {
      setResults(FALLBACK_RESULTS);
      setResultSource('fallback');
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const encoded = encodeURIComponent(trimmed);
        const res = await fetch(`/api/v1/search?query=${encoded}&q=${encoded}`, {
          method: 'GET',
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });

        if (!res.ok) {
          throw new Error(`Search HTTP ${res.status}`);
        }

        const data: unknown = await res.json();
        const normalized = normalizeSearchPayload(data);

        if (normalized.length > 0) {
          setResults(normalized);
          setResultSource('elasticsearch');
        } else {
          setResults(filterFallback(trimmed));
          setResultSource('fallback');
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setResults(filterFallback(trimmed));
          setResultSource('fallback');
        }
      } finally {
        setIsLoading(false);
        setActiveIndex(0);
      }
    }, 240);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, isOpen]);

  const quickTags = useMemo(
    () => ['Nextjs15', 'LangGraph', 'Kafka', 'Elasticsearch', 'LiquidGlass'],
    []
  );

  const handleChooseResult = (item: SearchResultItem) => {
    if (item.type === 'tag') {
      const cleanTag = item.title.replace(/^#/, '');
      onSelectTag?.(cleanTag);
    }
    onSelectResult?.(item);
    closeModal();
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (results.length ? (prev + 1) % results.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (results.length ? (prev - 1 + results.length) % results.length : 0));
    } else if (e.key === 'Enter' && results[activeIndex]) {
      e.preventDefault();
      handleChooseResult(results[activeIndex]);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="fixed inset-0 z-50 flex items-start justify-center bg-[#090A0F]/80 backdrop-blur-md px-4 pt-[10vh] sm:pt-[12vh]"
          onClick={closeModal}
          role="dialog"
          aria-modal="true"
          aria-label="חיפוש מהיר ב-SocialFlow"
        >
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.97 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl overflow-hidden rounded-[24px] border border-white/10 bg-[#121521]/90 backdrop-blur-2xl shadow-[0_24px_80px_-12px_rgba(0,0,0,0.85),0_0_40px_-10px_rgba(99,102,241,0.28)]"
          >
            {/* Search Input Header */}
            <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3.5 sm:px-5">
              {isLoading ? (
                <LoaderCircle className="h-5 w-5 shrink-0 animate-spin text-[#6366F1]" />
              ) : (
                <Search className="h-5 w-5 shrink-0 text-[#94A3B8]" />
              )}

              <input
                ref={inputRef}
                type="text"
                dir="auto"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder={placeholder}
                className="w-full bg-transparent text-sm sm:text-base text-[#F8FAFC] placeholder-[#64748B] outline-none"
              />

              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="rounded-lg p-1 text-[#94A3B8] hover:bg-white/10 hover:text-[#F8FAFC] transition-colors cursor-pointer"
                  aria-label="נקה חיפוש"
                >
                  <X className="h-4 w-4" />
                </button>
              )}

              <button
                type="button"
                onClick={closeModal}
                className="hidden sm:inline-flex items-center rounded-lg border border-white/10 bg-white/5 px-2 py-1 font-mono text-[11px] text-[#94A3B8] hover:border-white/20 hover:text-[#F8FAFC] transition-colors cursor-pointer"
              >
                ESC
              </button>
            </div>

            {/* Quick Tag Chips & Telemetry Pill */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-white/[0.02] px-4 py-2.5 sm:px-5">
              <div className="flex flex-wrap items-center gap-1.5">
                {quickTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setQuery(tag)}
                    className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 font-mono text-[11px] text-[#94A3B8] hover:border-indigo-500/40 hover:bg-indigo-500/15 hover:text-[#F8FAFC] transition-colors cursor-pointer"
                  >
                    <Hash className="h-3 w-3 text-[#6366F1]" />
                    <span>{tag}</span>
                  </button>
                ))}
              </div>

              <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[#94A3B8]">
                <span
                  className={`h-2 w-2 rounded-full ${
                    resultSource === 'elasticsearch'
                      ? 'bg-[#10B981] shadow-[0_0_8px_#10B981]'
                      : 'bg-[#6366F1]'
                  }`}
                />
                <span>
                  {resultSource === 'elasticsearch' ? 'Elasticsearch Live' : 'Instant Index'}
                </span>
              </span>
            </div>

            {/* AI RAG Shortcut Row when user typed a query */}
            {query.trim().length > 0 && (
              <button
                type="button"
                onClick={() => {
                  onAskAI?.(query.trim());
                  closeModal();
                }}
                className="flex w-full items-center justify-between gap-3 border-b border-white/10 bg-gradient-to-r from-[#6366F1]/15 via-[#8B5CF6]/10 to-transparent px-4 py-3 text-start hover:from-[#6366F1]/25 hover:via-[#8B5CF6]/20 transition-colors cursor-pointer sm:px-5"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-[#6366F1] to-[#8B5CF6] text-white shadow-md shadow-indigo-500/25">
                    <Sparkles className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-indigo-300">
                      שאל את סוכן ה-AI RAG על הפיד
                    </div>
                    <p dir="auto" className="truncate text-sm font-medium text-[#F8FAFC]">
                      &ldquo;{query.trim()}&rdquo;
                    </p>
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-indigo-300" />
              </button>
            )}

            {/* Results List */}
            <div className="max-h-[54vh] overflow-y-auto p-2 sm:p-3 space-y-1">
              {results.map((item, idx) => {
                const isSelected = idx === activeIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => handleChooseResult(item)}
                    className={`group flex w-full items-start gap-3 rounded-2xl border px-3.5 py-3 text-start transition-all cursor-pointer ${
                      isSelected
                        ? 'border-indigo-500/40 bg-[#6366F1]/12 shadow-[0_0_24px_-8px_rgba(99,102,241,0.4)]'
                        : 'border-transparent hover:border-white/10 hover:bg-white/[0.04]'
                    }`}
                  >
                    {/* Leading Icon / Avatar */}
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-[#090A0F]/80">
                      {item.authorAvatar ? (
                        <img
                          src={item.authorAvatar}
                          alt={item.authorName || item.title}
                          className="h-full w-full object-cover"
                        />
                      ) : item.type === 'tag' ? (
                        <Hash className="h-4 w-4 text-[#8B5CF6]" />
                      ) : (
                        <User className="h-4 w-4 text-[#6366F1]" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span dir="auto" className="truncate text-sm font-semibold text-[#F8FAFC]">
                          {item.title}
                        </span>
                        {item.subtitle && (
                          <span
                            dir="auto"
                            className="shrink-0 font-mono text-[11px] text-[#64748B]"
                          >
                            {item.subtitle}
                          </span>
                        )}
                      </div>

                      <p
                        dir="auto"
                        className="line-clamp-2 text-xs sm:text-sm leading-relaxed text-[#94A3B8]"
                      >
                        {item.content}
                      </p>

                      {item.tags && item.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {item.tags.slice(0, 4).map((t) => (
                            <span
                              key={t}
                              className="rounded-md bg-white/[0.05] px-1.5 py-0.5 font-mono text-[10px] text-indigo-300"
                            >
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <CornerDownLeft
                      className={`mt-1 h-4 w-4 shrink-0 transition-opacity ${
                        isSelected ? 'opacity-100 text-indigo-300' : 'opacity-0 group-hover:opacity-60 text-[#64748B]'
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            {/* Footer Hints */}
            <div className="flex items-center justify-between border-t border-white/10 bg-[#090A0F]/60 px-4 py-2.5 text-[11px] text-[#64748B] sm:px-5">
              <div className="flex items-center gap-3 font-mono">
                <span>↑↓ ניווט</span>
                <span>↵ בחירה</span>
                <span>ESC סגירה</span>
              </div>
              <span className="font-mono text-[#94A3B8]">GET /api/v1/search</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default CommandSearchModal;
