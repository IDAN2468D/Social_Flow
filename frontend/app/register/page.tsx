'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  User,
  Zap,
} from 'lucide-react';
import {
  BadgePill,
  BentoTile,
  GlassCard,
  GradientButton,
} from '@/components/ui/GlassPrimitives';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterPage() {
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const avatarSeed = username.trim() || 'newuser';
  const liveAvatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(
    avatarSeed
  )}`;

  const passwordStrength = useMemo(() => {
    if (!password) return { score: 0, label: '', color: 'bg-white/10' };
    let score = 0;
    if (password.length >= 6) score += 1;
    if (password.length >= 10) score += 1;
    if (/[A-Z]/.test(password) && /[0-9]/.test(password)) score += 1;

    if (score <= 1) return { score: 1, label: 'בסיסית', color: 'bg-amber-400' };
    if (score === 2) return { score: 2, label: 'טובה', color: 'bg-indigo-400' };
    return { score: 3, label: 'חזקה', color: 'bg-emerald-400' };
  }, [password]);

  const validateForm = (): string | null => {
    const trimmedUser = username.trim();
    const trimmedEmail = email.trim();

    if (!trimmedUser || !trimmedEmail || !password || !confirmPassword) {
      return 'נא למלא את כל שדות החובה המסומנים בכוכבית (*).';
    }
    if (trimmedUser.length < 3 || trimmedUser.length > 50) {
      return 'שם המשתמש חייב להכיל בין 3 ל-50 תווים.';
    }
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      return 'כתובת הדוא״ל שהוזנה אינה תקינה.';
    }
    if (password.length < 6) {
      return 'הסיסמה חייבת להכיל לפחות 6 תווים.';
    }
    if (password !== confirmPassword) {
      return 'הסיסמאות שהזנת אינן תואמות.';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const validationError = validateForm();
    if (validationError) {
      setErrorMsg(validationError);
      return;
    }

    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim();

    try {
      setIsSubmitting(true);

      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username: trimmedUsername,
          email: trimmedEmail,
          password,
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        let parsedMsg = '';
        try {
          const errJson = JSON.parse(errText);
          parsedMsg = errJson.message || errJson.error || '';
        } catch {
          parsedMsg = errText;
        }

        if (res.status === 409 || parsedMsg.toLowerCase().includes('exists')) {
          throw new Error('שם המשתמש או כתובת הדוא״ל כבר תפוסים במערכת.');
        }
        throw new Error(parsedMsg || `שגיאה בהרשמה (${res.status})`);
      }

      const data = await res.json().catch(() => ({}));

      try {
        const userObj = {
          userId: data.userId ?? 1,
          username: data.username || trimmedUsername,
          fullName: data.fullName || data.username || trimmedUsername,
          email: data.email || trimmedEmail,
          token: data.token || '',
        };
        localStorage.setItem('socialflow_user', JSON.stringify(userObj));
      } catch {
        // Ignore storage error in restricted browser contexts
      }

      setSuccessMsg('החשבון נוצר בהצלחה! מעביר לפיד...');
      router.push('/');
      router.refresh();
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'אירעה שגיאה בעת ההרשמה. אנא נסה שוב.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-[#090A0F] text-[#F8FAFC] flex items-center justify-center p-4 sm:p-6 lg:p-10">
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Split-Screen Showcase & Live Avatar Preview Panel */}
        <motion.aside
          initial={{ opacity: 0, x: 18 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35 }}
          className="lg:col-span-5 hidden lg:flex flex-col justify-between rounded-3xl relative overflow-hidden p-8 bg-[rgba(18,21,33,0.72)] backdrop-blur-xl border border-white/10 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.65)]"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-20 -end-20 h-64 w-64 rounded-full bg-violet-500/25 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-24 -start-16 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl"
          />

          <div className="relative z-10 space-y-6">
            <div className="flex items-center justify-between">
              <Link href="/" className="inline-flex items-center gap-3">
                <span className="h-11 w-11 rounded-2xl bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] flex items-center justify-center text-white shadow-[0_0_24px_rgba(139,92,246,0.5)]">
                  <Zap className="h-5 w-5" />
                </span>
                <div>
                  <span className="text-xl font-extrabold tracking-tight text-white">
                    Social<span className="text-violet-400">Flow</span>
                  </span>
                  <p className="text-[11px] font-mono text-slate-400">CREATOR ONBOARDING</p>
                </div>
              </Link>
            </div>

            {/* Live Dynamic Avatar Card */}
            <GlassCard padding="md" glow="violet" className="rounded-2xl space-y-3">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-2xl p-0.5 bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] shrink-0">
                  <img
                    src={liveAvatarUrl}
                    alt="תצוגה מקדימה של אווטאר"
                    className="h-full w-full rounded-[14px] bg-[#090A0F] object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <BadgePill variant="violet" size="sm" className="mb-1">
                    Live Avatar Preview
                  </BadgePill>
                  <p className="text-sm font-bold text-slate-100 truncate font-mono">
                    @{avatarSeed}
                  </p>
                  <p className="text-xs text-slate-400">
                    האווטאר נוצר דינמית לפי שם המשתמש שתבחר
                  </p>
                </div>
              </div>
            </GlassCard>

            <div className="space-y-3">
              <h2 className="text-2xl font-extrabold leading-snug text-slate-50">
                הצטרף לקהילת המפתחים והיוצרים של SocialFlow.
              </h2>
              <p dir="auto" className="text-sm text-slate-300 leading-relaxed">
                Publish rich media with MinIO S3, create interactive polls, explore AI-curated
                trends, and connect in real time.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <BentoTile
                label="Media Storage"
                value="MinIO S3"
                sublabel="העלאה מאובטחת ב-Presigned URL"
                accent="indigo"
                icon={<Sparkles className="h-4 w-4" />}
              />
              <BentoTile
                label="Security"
                value="JWT + Cookie"
                sublabel="הצפנת BCrypt ואימות מלא"
                accent="emerald"
                icon={<ShieldCheck className="h-4 w-4" />}
              />
            </div>
          </div>

          <div className="relative z-10 pt-5 border-t border-white/10 text-xs text-slate-400 flex items-center justify-between">
            <span>הרשמה חינמית ומהירה</span>
            <span className="font-mono text-violet-300">/api/auth/register</span>
          </div>
        </motion.aside>

        {/* Right Split-Screen Register Form Panel */}
        <motion.main
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="lg:col-span-7 flex flex-col justify-center"
        >
          <GlassCard padding="lg" glow="violet" className="rounded-3xl space-y-5">
            <div className="flex items-center justify-between gap-3">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 rounded-full bg-white/5 border border-white/10 hover:border-indigo-500/40 px-3.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-white transition-all"
              >
                <ArrowRight className="h-3.5 w-3.5" />
                <span>חזרה לפיד</span>
              </Link>

              <div className="flex items-center gap-2 lg:hidden">
                <img
                  src={liveAvatarUrl}
                  alt="Avatar preview"
                  className="h-8 w-8 rounded-full border border-violet-400/50 bg-[#090A0F]"
                />
                <span className="font-extrabold text-sm text-white">
                  Social<span className="text-violet-400">Flow</span>
                </span>
              </div>

              <BadgePill variant="violet" size="sm">
                הרשמה מהירה
              </BadgePill>
            </div>

            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-50 tracking-tight">
                יצירת חשבון חדש 🚀
              </h1>
              <p className="text-sm text-slate-400">
                צור חשבון חדש בחינם והתחל לשתף פוסטים, סקרים ומדיה בזמן אמת.
              </p>
            </div>

            <AnimatePresence mode="wait">
              {errorMsg && (
                <motion.div
                  key="reg-error"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  role="alert"
                  className="flex items-start gap-2.5 rounded-2xl bg-rose-500/15 border border-rose-500/35 px-4 py-3 text-xs sm:text-sm text-rose-200"
                >
                  <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                  <span dir="auto">{errorMsg}</span>
                </motion.div>
              )}

              {successMsg && (
                <motion.div
                  key="reg-success"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  role="status"
                  className="flex items-start gap-2.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/35 px-4 py-3 text-xs sm:text-sm text-emerald-200"
                >
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{successMsg}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="reg-username"
                    className="block text-xs font-semibold text-slate-300 mb-1.5"
                  >
                    שם משתמש * / Username
                  </label>
                  <div className="relative">
                    <User className="pointer-events-none absolute top-1/2 -translate-y-1/2 start-3.5 h-4 w-4 text-slate-400" />
                    <input
                      id="reg-username"
                      type="text"
                      autoComplete="username"
                      autoFocus
                      required
                      minLength={3}
                      maxLength={50}
                      dir="ltr"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="noa_cohen"
                      className="w-full rounded-xl bg-[#090A0F]/80 border border-white/10 ps-10 pe-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="reg-email"
                    className="block text-xs font-semibold text-slate-300 mb-1.5"
                  >
                    כתובת דוא״ל * / Email
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute top-1/2 -translate-y-1/2 start-3.5 h-4 w-4 text-slate-400" />
                    <input
                      id="reg-email"
                      type="email"
                      autoComplete="email"
                      required
                      dir="ltr"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full rounded-xl bg-[#090A0F]/80 border border-white/10 ps-10 pe-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label
                  htmlFor="reg-password"
                  className="block text-xs font-semibold text-slate-300 mb-1.5"
                >
                  סיסמה * (לפחות 6 תווים)
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute top-1/2 -translate-y-1/2 start-3.5 h-4 w-4 text-slate-400" />
                  <input
                    id="reg-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    minLength={6}
                    dir="ltr"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="לפחות 6 תווים..."
                    className="w-full rounded-xl bg-[#090A0F]/80 border border-white/10 ps-10 pe-11 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'הסתר סיסמה' : 'הצג סיסמה'}
                    className="absolute top-1/2 -translate-y-1/2 end-3 p-1 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>

                {password.length > 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 grid grid-cols-3 gap-1.5">
                      {[1, 2, 3].map((level) => (
                        <div
                          key={level}
                          className={`h-1.5 rounded-full transition-colors ${
                            passwordStrength.score >= level
                              ? passwordStrength.color
                              : 'bg-white/10'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-[11px] font-medium text-slate-400">
                      חוזק: {passwordStrength.label}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label
                  htmlFor="reg-confirm-password"
                  className="block text-xs font-semibold text-slate-300 mb-1.5"
                >
                  אימות סיסמה * / Confirm Password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute top-1/2 -translate-y-1/2 start-3.5 h-4 w-4 text-slate-400" />
                  <input
                    id="reg-confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    minLength={6}
                    dir="ltr"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="הזן את הסיסמה בשנית..."
                    className="w-full rounded-xl bg-[#090A0F]/80 border border-white/10 ps-10 pe-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  />
                </div>
              </div>

              <GradientButton
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                isLoading={isSubmitting}
              >
                {isSubmitting ? 'יוצר חשבון...' : 'צור חשבון והתחבר'}
              </GradientButton>
            </form>

            <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="text-slate-400">
                <span>כבר יש לך חשבון? </span>
                <Link
                  href="/login"
                  className="font-semibold text-indigo-300 hover:text-indigo-200 underline underline-offset-4"
                >
                  התחבר כאן
                </Link>
              </div>
              <Link
                href="/"
                className="text-slate-400 hover:text-slate-200 transition-colors"
              >
                המשך כצופה אורח →
              </Link>
            </div>
          </GlassCard>
        </motion.main>
      </div>
    </div>
  );
}
