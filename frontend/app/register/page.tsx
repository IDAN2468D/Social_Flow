'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Sparkles,
  User,
  UserCheck,
  Zap,
} from 'lucide-react';
import { isJwtExpired } from '@/lib/auth';

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('socialflow_user');
      if (raw) {
        const parsed = JSON.parse(raw) as { token?: string };
        if (parsed?.token && !isJwtExpired(parsed.token)) {
          router.replace('/');
        }
      }
    } catch {
      // Ignore storage errors
    }
  }, [router]);

  const avatarSeed = useMemo(() => {
    const clean = username.trim();
    return clean.length > 0 ? clean : 'creator';
  }, [username]);

  const liveAvatarUrl = useMemo(
    () => `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(avatarSeed)}`,
    [avatarSeed]
  );

  const passwordStrength = useMemo(() => {
    if (!password) return { score: 0, label: 'ללא סיסמה', barClass: 'bg-slate-700 w-0' };
    let score = 0;
    if (password.length >= 6) score += 1;
    if (password.length >= 10) score += 1;
    if (/[A-Z]/.test(password) && /[0-9]/.test(password)) score += 1;

    if (score <= 1) return { score, label: 'חלשה', barClass: 'bg-rose-500 w-1/3' };
    if (score === 2) return { score, label: 'בינונית', barClass: 'bg-amber-400 w-2/3' };
    return { score, label: 'חזקה', barClass: 'bg-emerald-400 w-full' };
  }, [password]);

  const validateForm = (): string | null => {
    const trimmedUser = username.trim();
    const trimmedEmail = email.trim();

    if (trimmedUser.length < 3) {
      return 'שם המשתמש חייב להכיל לפחות 3 תווים.';
    }
    if (!/^[a-zA-Z0-9._-]+$/.test(trimmedUser)) {
      return 'שם המשתמש יכול להכיל אותיות באנגלית, מספרים, נקודה או קו תחתון בלבד.';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return 'אנא הזן כתובת אימייל תקינה.';
    }
    if (password.length < 6) {
      return 'הסיסמה חייבת להכיל לפחות 6 תווים.';
    }
    if (password !== confirmPassword) {
      return 'הסיסמאות אינן תואמות.';
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
    const trimmedFullName = fullName.trim() || trimmedUsername;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: trimmedUsername,
          email: trimmedEmail,
          password,
          fullName: trimmedFullName,
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        let parsedMsg = errText;
        try {
          const parsedJson = JSON.parse(errText);
          parsedMsg = parsedJson.message || parsedJson.error || errText;
        } catch {
          // Keep raw text
        }
        throw new Error(parsedMsg || `שגיאה בהרשמה (${res.status})`);
      }

      const data = await res.json().catch(() => ({}));
      const resolvedUsername = data.username || trimmedUsername;
      const userObj = {
        userId: data.userId ?? 1,
        username: resolvedUsername,
        fullName: data.fullName || trimmedFullName,
        email: data.email || trimmedEmail,
        avatarUrl:
          data.avatarUrl ||
          `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(resolvedUsername)}`,
        token: data.token || '',
      };

      try {
        localStorage.setItem('socialflow_user', JSON.stringify(userObj));
      } catch {
        // Ignore storage error in restricted browser contexts
      }

      setSuccessMsg('החשבון נוצר בהצלחה! מעביר לפיד SocialFlow...');
      router.replace('/');
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
    <div
      dir="rtl"
      className="relative min-h-screen w-full overflow-hidden bg-[#090A0F] text-[#F8FAFC] flex items-center justify-center p-4 sm:p-6 lg:p-10"
    >
      {/* Ambient Liquid Glass Glow Orbs */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 -end-32 h-[420px] w-[420px] rounded-full bg-[#8B5CF6]/20 blur-[120px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 -start-32 h-[440px] w-[440px] rounded-full bg-[#6366F1]/20 blur-[130px]"
      />

      <div className="relative z-10 w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Live Creator Onboarding Showcase */}
        <motion.aside
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="lg:col-span-5 hidden lg:flex flex-col justify-between rounded-[28px] relative overflow-hidden p-8 bg-[#121521]/72 backdrop-blur-2xl border border-white/10 shadow-[0_28px_70px_-15px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.1)]"
        >
          <div className="space-y-6">
            <div className="flex items-center gap-3.5">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] flex items-center justify-center text-white shadow-[0_0_28px_rgba(139,92,246,0.55)]">
                <Zap className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-white">
                  Social<span className="text-violet-400">Flow</span>
                </h1>
                <p className="text-[11px] font-mono tracking-wider text-slate-400">
                  CREATOR ONBOARDING
                </p>
              </div>
            </div>

            {/* Live Avatar Preview Card */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_0_32px_-12px_rgba(139,92,246,0.45)]">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-2xl p-0.5 bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] shrink-0">
                  <img
                    src={liveAvatarUrl}
                    alt="תצוגה מקדימה של אווטאר"
                    className="h-full w-full rounded-[14px] bg-[#090A0F] object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-violet-200 mb-1">
                    <Sparkles className="h-3 w-3" />
                    אווטאר חי
                  </span>
                  <p dir="auto" className="text-sm font-bold text-white truncate">
                    {fullName.trim() || 'השם שלך כאן'}
                  </p>
                  <p className="text-xs font-mono text-slate-400 truncate">@{avatarSeed}</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-2xl font-extrabold leading-snug text-white">
                מצטרפים לקהילת SocialFlow תוך שניות.
              </h2>
              <p className="text-sm leading-relaxed text-slate-300/90">
                עם פתיחת החשבון תקבל גישה מלאה לפרסום פוסטים, סטוריז חיים, מעקב אחר
                התראות Kafka ושימוש בעוזר ה-AI RAG.
              </p>
            </div>
          </div>

          <div className="pt-6 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>IDENTITY PROVISIONING</span>
            <span className="inline-flex items-center gap-1.5 text-violet-300">
              <UserCheck className="h-3.5 w-3.5" />
              JWT READY
            </span>
          </div>
        </motion.aside>

        {/* Register Form Card */}
        <motion.main
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
          className="lg:col-span-7 rounded-[28px] p-6 sm:p-9 bg-[#121521]/82 backdrop-blur-2xl border border-white/12 shadow-[0_28px_70px_-15px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.1)] flex flex-col justify-between"
        >
          <div className="space-y-5">
            {/* Mobile Brand Header */}
            <div className="flex items-center justify-between lg:hidden">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] flex items-center justify-center text-white shadow-[0_0_20px_rgba(139,92,246,0.5)]">
                  <Zap className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-lg font-extrabold text-white">
                    Social<span className="text-violet-400">Flow</span>
                  </span>
                  <p className="text-[10px] font-mono text-slate-400">LIQUID GLASS 4.0 PRO</p>
                </div>
              </div>
            </div>

            {/* Segmented Auth Mode Switcher */}
            <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-white/10 bg-[#090A0F]/75 p-1.5">
              <Link
                href="/login"
                className="flex items-center justify-center rounded-xl py-2.5 text-sm font-semibold text-slate-300 hover:text-white hover:bg-white/[0.04] transition-all no-underline"
              >
                התחברות
              </Link>
              <div className="flex items-center justify-center rounded-xl bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] py-2.5 text-sm font-bold text-white shadow-[0_0_24px_rgba(139,92,246,0.38)]">
                הרשמה
              </div>
            </div>

            <div className="space-y-1">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                יצירת חשבון חדש
              </h2>
              <p className="text-sm text-slate-400">
                מלא את הפרטים כדי להתחיל לפרסם ולהתחבר לקהילה.
              </p>
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="flex items-start gap-2.5 overflow-hidden rounded-2xl border border-rose-500/35 bg-rose-500/12 px-4 py-3 text-sm text-rose-200"
              >
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
                <span dir="auto" className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">
                  {errorMsg}
                </span>
              </div>
            )}

            {successMsg && (
              <div
                role="status"
                className="flex items-start gap-2.5 overflow-hidden rounded-2xl border border-emerald-500/35 bg-emerald-500/12 px-4 py-3 text-sm text-emerald-200"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-400" />
                <span dir="auto" className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">
                  {successMsg}
                </span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label
                    htmlFor="reg-fullname"
                    className="block text-xs font-semibold text-slate-300"
                  >
                    שם מלא
                  </label>
                  <div className="relative">
                    <UserCheck className="pointer-events-none absolute top-1/2 -translate-y-1/2 start-3.5 h-4 w-4 text-slate-400" />
                    <input
                      id="reg-fullname"
                      type="text"
                      dir="auto"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="עידן קזם"
                      className="w-full rounded-2xl border border-white/10 bg-[#090A0F]/80 ps-10 pe-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500/70 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="reg-username"
                    className="block text-xs font-semibold text-slate-300"
                  >
                    שם משתמש
                  </label>
                  <div className="relative">
                    <User className="pointer-events-none absolute top-1/2 -translate-y-1/2 start-3.5 h-4 w-4 text-slate-400" />
                    <input
                      id="reg-username"
                      type="text"
                      autoComplete="username"
                      dir="ltr"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="idankzm"
                      className="w-full rounded-2xl border border-white/10 bg-[#090A0F]/80 ps-10 pe-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500/70 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="reg-email"
                  className="block text-xs font-semibold text-slate-300"
                >
                  אימייל
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute top-1/2 -translate-y-1/2 start-3.5 h-4 w-4 text-slate-400" />
                  <input
                    id="reg-email"
                    type="email"
                    autoComplete="email"
                    dir="ltr"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full rounded-2xl border border-white/10 bg-[#090A0F]/80 ps-10 pe-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500/70 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label
                    htmlFor="reg-password"
                    className="block text-xs font-semibold text-slate-300"
                  >
                    סיסמה
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute top-1/2 -translate-y-1/2 start-3.5 h-4 w-4 text-slate-400" />
                    <input
                      id="reg-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="לפחות 6 תווים"
                      className="w-full rounded-2xl border border-white/10 bg-[#090A0F]/80 ps-10 pe-10 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500/70 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'הסתר סיסמה' : 'הצג סיסמה'}
                      className="absolute top-1/2 -translate-y-1/2 end-3 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="reg-confirm-password"
                    className="block text-xs font-semibold text-slate-300"
                  >
                    אימות סיסמה
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute top-1/2 -translate-y-1/2 start-3.5 h-4 w-4 text-slate-400" />
                    <input
                      id="reg-confirm-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="הזן שוב"
                      className="w-full rounded-2xl border border-white/10 bg-[#090A0F]/80 ps-10 pe-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500/70 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    />
                  </div>
                </div>
              </div>

              {password.length > 0 && (
                <div className="space-y-1 pt-0.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>חוזק סיסמה</span>
                    <span className="font-semibold text-slate-200">{passwordStrength.label}</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${passwordStrength.barClass}`}
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] py-3.5 text-sm font-bold text-white shadow-[0_10px_30px_-6px_rgba(139,92,246,0.55)] hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                {isSubmitting ? (
                  <span>יוצר חשבון...</span>
                ) : (
                  <>
                    <span>צור חשבון והיכנס</span>
                    <ArrowLeft className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="mt-6 pt-4 border-t border-white/10 text-center text-xs text-slate-400">
            כבר יש לך חשבון ב-SocialFlow?{' '}
            <Link
              href="/login"
              className="font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              התחבר כאן
            </Link>
          </div>
        </motion.main>
      </div>
    </div>
  );
}
