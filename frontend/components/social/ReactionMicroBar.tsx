'use client';

import React, { useOptimistic, useTransition } from 'react';
import { motion } from 'framer-motion';
import { toggleReactionAction } from '@/lib/actions/social.actions';
import { ReactionType } from '@/lib/validations/social.schema';

interface ReactionConfig {
  type: ReactionType;
  emoji: string;
  label: string;
}

const REACTIONS: ReactionConfig[] = [
  { type: 'LIKE', emoji: '❤️', label: 'אהבתי' },
  { type: 'FIRE', emoji: '🔥', label: 'לוהט' },
  { type: 'CLAP', emoji: '👏', label: 'כל הכבוד' },
  { type: 'STAR', emoji: '⭐', label: 'כוכב' },
  { type: 'MIND_BLOWN', emoji: '🤯', label: 'מדהים' },
];

interface ReactionMicroBarProps {
  targetId: string;
  initialCounts?: Record<ReactionType, number>;
  userReaction?: ReactionType | null;
}

export function ReactionMicroBar({
  targetId,
  initialCounts = { LIKE: 12, FIRE: 5, CLAP: 3, STAR: 2, MIND_BLOWN: 1 },
  userReaction = null,
}: ReactionMicroBarProps) {
  const [, startTransition] = useTransition();

  const [optimisticState, setOptimisticReaction] = useOptimistic(
    { counts: initialCounts, activeType: userReaction },
    (state, clickedType: ReactionType) => {
      const isRemoving = state.activeType === clickedType;
      const newCounts = { ...state.counts };
      if (isRemoving) {
        newCounts[clickedType] = Math.max(0, (newCounts[clickedType] || 1) - 1);
        return { counts: newCounts, activeType: null };
      }
      if (state.activeType) {
        newCounts[state.activeType] = Math.max(0, (newCounts[state.activeType] || 1) - 1);
      }
      newCounts[clickedType] = (newCounts[clickedType] || 0) + 1;
      return { counts: newCounts, activeType: clickedType };
    }
  );

  const handleToggle = (type: ReactionType) => {
    startTransition(async () => {
      setOptimisticReaction(type);
      await toggleReactionAction({ targetId, targetType: 'POST', reactionType: type });
    });
  };

  return (
    <div className="flex items-center gap-1.5 py-1.5 px-2 rounded-full bg-slate-900/60 border border-slate-700/50 backdrop-blur-md">
      {REACTIONS.map(({ type, emoji, label }) => {
        const isActive = optimisticState.activeType === type;
        const count = optimisticState.counts[type] || 0;

        return (
          <motion.button
            key={type}
            onClick={() => handleToggle(type)}
            whileHover={{ scale: 1.18 }}
            whileTap={{ scale: 0.88 }}
            transition={{ type: 'spring', stiffness: 450, damping: 20 }}
            title={label}
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-sm font-semibold transition-colors duration-200 ${
              isActive
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <span className="text-sm select-none">{emoji}</span>
            {count > 0 && <span className="text-sm font-mono leading-none">{count}</span>}
          </motion.button>
        );
      })}
    </div>
  );
}
