'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  BadgeCheck,
  Calendar,
  Edit3,
  FileText,
  Globe,
  Link2,
  MapPin,
  Share2,
  Sparkles,
  UserCheck,
  UserPlus,
  Users,
  X,
  Check,
  Image as ImageIcon,
} from 'lucide-react';
import {
  BadgePill,
  BentoTile,
  GlassCard,
  GradientButton,
  SkeletonPulse,
} from '@/components/ui/GlassPrimitives';

export interface ProfileStats {
  posts: number;
  followers: number;
  following: number;
  engagementImpact: string | number;
  engagementDelta?: string;
}

export interface UserProfileData {
  id?: number | string;
  username: string;
  fullName: string;
  bio: string;
  avatarUrl: string;
  coverUrl?: string;
  location?: string;
  website?: string;
  verified?: boolean;
  roleBadge?: string;
  joinedAt?: string;
  isFollowing?: boolean;
  isOwnProfile?: boolean;
  stats: ProfileStats;
}

export interface ProfileUpdatePayload {
  fullName: string;
  bio: string;
  location?: string;
  website?: string;
  avatarUrl?: string;
  coverUrl?: string;
}

export interface BentoProfileHeaderProps {
  profile: UserProfileData;
  onUpdateProfile?: (updated: ProfileUpdatePayload) => void | Promise<void>;
  onToggleFollow?: () => void | Promise<void>;
  backHref?: string;
  isLoading?: boolean;
}

const COVER_PRESETS = [
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1400&q=80',
];

function formatCompactCount(val: number | string): string {
  if (typeof val === 'string') return val;
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
  return String(val);
}

export function BentoProfileHeader({
  profile,
  onUpdateProfile,
  onToggleFollow,
  backHref = '/',
  isLoading = false,
}: BentoProfileHeaderProps) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

  const [formFullName, setFormFullName] = useState(profile.fullName);
  const [formBio, setFormBio] = useState(profile.bio);
  const [formLocation, setFormLocation] = useState(profile.location || '');
  const [formWebsite, setFormWebsite] = useState(profile.website || '');
  const [formAvatarUrl, setFormAvatarUrl] = useState(profile.avatarUrl);
  const [formCoverUrl, setFormCoverUrl] = useState(profile.coverUrl || COVER_PRESETS[0]);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setFormFullName(profile.fullName);
    setFormBio(profile.bio);
    setFormLocation(profile.location || '');
    setFormWebsite(profile.website || '');
    setFormAvatarUrl(profile.avatarUrl);
    setFormCoverUrl(profile.coverUrl || COVER_PRESETS[0]);
  }, [profile]);

  useEffect(() => {
    if (!isEditOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsEditOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditOpen]);

  const handleShareProfile = async () => {
    try {
      const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
      if (navigator.clipboard && shareUrl) {
        await navigator.clipboard.writeText(shareUrl);
        setCopiedShare(true);
        setTimeout(() => setCopiedShare(false), 2000);
      }
    } catch {
      // Clipboard fallback ignored
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formFullName.trim()) {
      setFormError('שם תצוגה הוא שדה חובה / Display name is required');
      return;
    }

    try {
      setIsSaving(true);
      await onUpdateProfile?.({
        fullName: formFullName.trim(),
        bio: formBio.trim(),
        location: formLocation.trim() || undefined,
        website: formWebsite.trim() || undefined,
        avatarUrl: formAvatarUrl.trim() || profile.avatarUrl,
        coverUrl: formCoverUrl.trim() || COVER_PRESETS[0],
      });
      setIsEditOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'שגיאה בעדכון הפרופיל');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <section className="space-y-4">
        <SkeletonPulse variant="card" className="h-64 rounded-3xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <SkeletonPulse variant="card" className="h-28" />
          <SkeletonPulse variant="card" className="h-28" />
          <SkeletonPulse variant="card" className="h-28" />
          <SkeletonPulse variant="card" className="h-28" />
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="space-y-4">
        {/* Hero Cover + Glass Profile Card */}
        <GlassCard padding="none" glow="indigo" className="overflow-hidden rounded-3xl">
          {/* Cover Banner */}
          <div className="relative h-44 sm:h-56 w-full overflow-hidden bg-[#0D111A]">
            {profile.coverUrl ? (
              <img
                src={profile.coverUrl}
                alt={`${profile.fullName} cover`}
                className="h-full w-full object-cover opacity-80 transition-transform duration-700 hover:scale-105"
              />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-indigo-600/40 via-violet-600/30 to-cyan-500/20" />
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-[#090A0F] via-[#090A0F]/45 to-transparent" />

            {/* Top Floating Cover Controls */}
            <div className="absolute top-4 inset-x-4 flex items-center justify-between gap-3">
              <Link
                href={backHref}
                className="inline-flex items-center gap-2 rounded-full bg-[rgba(9,10,15,0.72)] backdrop-blur-xl border border-white/15 px-3.5 py-1.5 text-xs font-semibold text-slate-100 hover:border-indigo-400/50 hover:text-white transition-all"
              >
                <ArrowRight className="h-3.5 w-3.5" />
                <span>חזרה לפיד</span>
              </Link>

              <div className="flex items-center gap-2">
                {profile.roleBadge && (
                  <BadgePill variant="violet" pulseDot size="sm">
                    {profile.roleBadge}
                  </BadgePill>
                )}
              </div>
            </div>
          </div>

          {/* Avatar + Identity + Actions */}
          <div className="relative px-5 sm:px-7 pb-6 -mt-14 sm:-mt-16">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              {/* Avatar Frame */}
              <div className="flex items-end gap-4">
                <motion.div
                  initial={{ scale: 0.92, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.25 }}
                  className="relative h-24 w-24 sm:h-28 sm:w-28 rounded-3xl p-1 bg-gradient-to-br from-[#6366F1] via-[#8B5CF6] to-cyan-400 shadow-[0_12px_32px_rgba(99,102,241,0.45)] shrink-0"
                >
                  <img
                    src={profile.avatarUrl}
                    alt={profile.fullName}
                    className="h-full w-full rounded-[20px] object-cover bg-[#090A0F] border-2 border-[#090A0F]"
                  />
                  <span
                    title="Online"
                    className="absolute -bottom-1 -end-1 h-4 w-4 rounded-full bg-emerald-400 border-2 border-[#090A0F] shadow-[0_0_12px_#10B981]"
                  />
                </motion.div>

                <div className="pb-1 space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1
                      dir="auto"
                      className="text-xl sm:text-2xl font-extrabold text-slate-50 tracking-tight truncate"
                    >
                      {profile.fullName}
                    </h1>
                    {profile.verified && (
                      <BadgeCheck
                        className="h-5 w-5 text-indigo-400 shrink-0"
                        aria-label="Verified account"
                      />
                    )}
                  </div>
                  <p className="text-sm font-mono text-slate-400">@{profile.username}</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2.5 flex-wrap">
                <GradientButton
                  variant="secondary"
                  size="sm"
                  onClick={handleShareProfile}
                  leftIcon={
                    copiedShare ? (
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <Share2 className="h-3.5 w-3.5" />
                    )
                  }
                >
                  {copiedShare ? 'הקישור הועתק' : 'שיתוף'}
                </GradientButton>

                {profile.isOwnProfile !== false ? (
                  <GradientButton
                    variant="primary"
                    size="sm"
                    onClick={() => setIsEditOpen(true)}
                    leftIcon={<Edit3 className="h-3.5 w-3.5" />}
                  >
                    ערוך פרופיל
                  </GradientButton>
                ) : (
                  <GradientButton
                    variant={profile.isFollowing ? 'secondary' : 'primary'}
                    size="sm"
                    onClick={onToggleFollow}
                    leftIcon={
                      profile.isFollowing ? (
                        <UserCheck className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <UserPlus className="h-3.5 w-3.5" />
                      )
                    }
                  >
                    {profile.isFollowing ? 'עוקב' : 'עקוב'}
                  </GradientButton>
                )}
              </div>
            </div>

            {/* Bio & Metadata */}
            <div className="mt-5 space-y-3">
              {profile.bio && (
                <p
                  dir="auto"
                  className="text-sm sm:text-[15px] leading-relaxed text-slate-200 max-w-2xl whitespace-pre-line"
                >
                  {profile.bio}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-400">
                {profile.location && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-indigo-400" />
                    <span dir="auto">{profile.location}</span>
                  </span>
                )}
                {profile.website && (
                  <a
                    href={
                      profile.website.startsWith('http')
                        ? profile.website
                        : `https://${profile.website}`
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-indigo-300 hover:text-indigo-200 transition-colors"
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    <span className="font-mono">{profile.website}</span>
                  </a>
                )}
                {profile.joinedAt && (
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-violet-400" />
                    <span>הצטרף ב-{profile.joinedAt}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </GlassCard>

        {/* 4-Tile Bento Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <BentoTile
            label="פוסטים / Posts"
            value={formatCompactCount(profile.stats.posts)}
            sublabel="תוכן שפורסם בקהילה"
            accent="indigo"
            icon={<FileText className="h-4 w-4" />}
          />
          <BentoTile
            label="עוקבים / Followers"
            value={formatCompactCount(profile.stats.followers)}
            sublabel="קהל פעיל בזמן אמת"
            accent="violet"
            icon={<Users className="h-4 w-4" />}
          />
          <BentoTile
            label="נעקבים / Following"
            value={formatCompactCount(profile.stats.following)}
            sublabel="יוצרים וקהילות במעקב"
            accent="emerald"
            icon={<UserPlus className="h-4 w-4" />}
          />
          <BentoTile
            label="Engagement Impact"
            value={formatCompactCount(profile.stats.engagementImpact)}
            trend={profile.stats.engagementDelta || '+18.4%'}
            sublabel="מדד השפעה ואינטראקציות"
            accent="rose"
            icon={<Sparkles className="h-4 w-4" />}
          />
        </div>
      </section>

      {/* Edit Profile Modal */}
      <AnimatePresence>
        {isEditOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditOpen(false)}
              className="absolute inset-0 bg-[#090A0F]/80 backdrop-blur-md"
            />

            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="edit-profile-title"
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ type: 'spring', stiffness: 360, damping: 28 }}
              className="relative z-10 w-full max-w-lg rounded-3xl bg-[rgba(18,21,33,0.92)] backdrop-blur-2xl border border-white/15 shadow-[0_24px_60px_rgba(0,0,0,0.75)] p-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-300">
                    <Edit3 className="h-4 w-4" />
                  </span>
                  <div>
                    <h2 id="edit-profile-title" className="text-base font-bold text-slate-50">
                      עריכת פרופיל
                    </h2>
                    <p className="text-xs text-slate-400">עדכון פרטי תצוגה, ביו ותמונת רקע</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="h-8 w-8 rounded-full inline-flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  aria-label="Close modal"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSaveProfile} className="mt-5 space-y-4">
                {formError && (
                  <div className="rounded-xl bg-rose-500/15 border border-rose-500/30 px-3.5 py-2.5 text-xs font-medium text-rose-200">
                    {formError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    שם מלא / Display Name
                  </label>
                  <input
                    type="text"
                    dir="auto"
                    value={formFullName}
                    onChange={(e) => setFormFullName(e.target.value)}
                    placeholder="למשל: עידן קזם"
                    className="w-full rounded-xl bg-[#090A0F]/75 border border-white/10 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/60"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    ביו / Bio (תומך עברית ואנגלית)
                  </label>
                  <textarea
                    rows={3}
                    dir="auto"
                    value={formBio}
                    onChange={(e) => setFormBio(e.target.value)}
                    placeholder="ספר לקהילה על תחומי העניין והפרויקטים שלך..."
                    className="w-full rounded-xl bg-[#090A0F]/75 border border-white/10 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-indigo-400" />
                        <span>מיקום</span>
                      </span>
                    </label>
                    <input
                      type="text"
                      dir="auto"
                      value={formLocation}
                      onChange={(e) => setFormLocation(e.target.value)}
                      placeholder="תל אביב, ישראל"
                      className="w-full rounded-xl bg-[#090A0F]/75 border border-white/10 px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/60"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      <span className="inline-flex items-center gap-1">
                        <Globe className="h-3 w-3 text-violet-400" />
                        <span>אתר / קישור</span>
                      </span>
                    </label>
                    <input
                      type="text"
                      dir="ltr"
                      value={formWebsite}
                      onChange={(e) => setFormWebsite(e.target.value)}
                      placeholder="github.com/IDAN2468D"
                      className="w-full rounded-xl bg-[#090A0F]/75 border border-white/10 px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    קישור לאווטאר (Avatar URL)
                  </label>
                  <div className="flex items-center gap-3">
                    <img
                      src={formAvatarUrl || profile.avatarUrl}
                      alt="Avatar preview"
                      className="h-11 w-11 rounded-xl border border-white/15 object-cover bg-[#090A0F] shrink-0"
                    />
                    <input
                      type="url"
                      dir="ltr"
                      value={formAvatarUrl}
                      onChange={(e) => setFormAvatarUrl(e.target.value)}
                      className="flex-1 rounded-xl bg-[#090A0F]/75 border border-white/10 px-3.5 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500/60"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">
                    <span className="inline-flex items-center gap-1">
                      <ImageIcon className="h-3.5 w-3.5 text-cyan-400" />
                      <span>תמונת רקע (Cover Banner)</span>
                    </span>
                  </label>
                  <div className="grid grid-cols-3 gap-2.5">
                    {COVER_PRESETS.map((presetUrl, idx) => (
                      <button
                        key={presetUrl}
                        type="button"
                        onClick={() => setFormCoverUrl(presetUrl)}
                        className={`relative h-16 rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                          formCoverUrl === presetUrl
                            ? 'border-indigo-400 ring-2 ring-indigo-500/30'
                            : 'border-white/10 opacity-70 hover:opacity-100'
                        }`}
                      >
                        <img
                          src={presetUrl}
                          alt={`Cover preset ${idx + 1}`}
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/10">
                  <GradientButton
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsEditOpen(false)}
                  >
                    ביטול
                  </GradientButton>
                  <GradientButton
                    type="submit"
                    variant="primary"
                    size="sm"
                    isLoading={isSaving}
                  >
                    שמור שינויים
                  </GradientButton>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
