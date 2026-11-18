'use client';

import React, { useEffect, useState } from 'react';
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
  Radio,
  ShieldCheck,
  Sparkles,
  User,
  Zap,
} from 'lucide-react';
import { isJwtExpired } from '@/lib/auth';

interface DemoAccount {
  label: string;
  username: string;
  password: string;
  role: string;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    label: 'חשבון יוצר (עידן)',
    username: 'idan',
    password: 'password123',
    role: 'AI Architect',
  },
  {
    label: 'חשבון יוצרת (מאיה)',
    username: 'maya',
    password: 'password123',
    role: 'Product Lead',
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
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

  const handleQuickFill = (account: DemoAccount) => {
    setUsername(account.username);
    setPassword(account.password);
    setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const trimmedUser = username.trim();
    if (!trimmedUser || !password) {
      setErrorMsg('אנא הזן שם משתמש וסיסמה כדי להתחבר.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: trimmedUser,
          password,
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
        throw new Error(parsedMsg || `ההתחברות נכשלה (${res.status})`);
      }

      const data = await res.json().catch(() => ({}));
      const resolvedUsername = data.username || trimmedUser;
      const userObj = {
        userId: data.userId ?? 1,
        username: resolvedUsername,
        fullName: data.fullName || resolvedUsername,
        email: data.email || `${resolvedUsername}@socialflow.ai`,
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

      setSuccessMsg('התחברת בהצלחה! נכנסים לפיד SocialFlow...');
      router.replace('/');
      router.refresh();
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'אירעה שגיאה בעת ההתחברות. אנא נסה שוב.'
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
        className="pointer-events-none absolute -top-40 -end-32 h-[420px] w-[420px] rounded-full bg-[#6366F1]/20 blur-[120px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 -start-32 h-[440px] w-[440px] rounded-full bg-[#8B5CF6]/20 blur-[130px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[320px] w-[320px] rounded-full bg-cyan-500/10 blur-[140px]"
      />

      <div className="relative z-10 w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Showcase Panel */}
        <motion.aside
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="lg:col-span-5 hidden lg:flex flex-col justify-between rounded-[28px] relative overflow-hidden p-8 bg-[#121521]/72 backdrop-blur-2xl border border-white/10 shadow-[0_28px_70px_-15px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.1)]"
        >
          <div className="space-y-7">
            <div className="flex items-center gap-3.5">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] flex items-center justify-center text-white shadow-[0_0_28px_rgba(99,102,241,0.55)]">
                <Zap className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-white">
                  Social<span className="text-indigo-400">Flow</span>
                </h1>
                <p className="text-[11px] font-mono tracking-wider text-slate-400">
                  DARK LIQUID GLASS 4.0 PRO
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-400/30 bg-indigo-500/15 px-3 py-1 text-xs font-semibold text-indigo-200">
                <Sparkles className="h-3.5 w-3.5 text-indigo-300" />
                סביבת קהילה ו-AI בזמן אמת
              </span>
              <h2 className="text-2xl font-extrabold leading-snug text-white">
                מתחברים לפיד חכם, סטוריז חיים ושיח מבוסס Kafka &amp; AI.
              </h2>
              <p className="text-sm leading-relaxed text-slate-300/90">
                כל פרסום, תגובה והתראה מסונכרנים בזמן אמת מול שרת Spring Boot,
                מועשרים בתובנות Gemini RAG ונשמרים במאגר הענן.
              </p>
            </div>

            <div className="space-y-2.5 pt-2">
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <Radio className="h-4 w-4 text-emerald-400 shrink-0" />
                <div className="text-xs">
                  <p className="font-bold text-slate-100">אירועים חיים ב-Kafka</p>
                  <p className="text-slate-400">עדכונים מיידיים בפיד ובהתראות</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <ShieldCheck className="h-4 w-4 text-indigo-400 shrink-0" />
                <div className="text-xs">
                  <p className="font-bold text-slate-100">אבטחת JWT מלאה</p>
                  <p className="text-slate-400">גישה מאובטחת לפרופיל, לסטוריז ולסימניות</p>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>AUTH GATEWAY</span>
            <span className="inline-flex items-center gap-1.5 text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              SYSTEM ONLINE
            </span>
          </div>
        </motion.aside>

        {/* Login Form Card */}
        <motion.main
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
          className="lg:col-span-7 rounded-[28px] p-6 sm:p-9 bg-[#121521]/82 backdrop-blur-2xl border border-white/12 shadow-[0_28px_70px_-15px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.1)] flex flex-col justify-between"
        >
          <div className="space-y-6">
            {/* Mobile Brand Header */}
            <div className="flex items-center justify-between lg:hidden">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] flex items-center justify-center text-white shadow-[0_0_20px_rgba(99,102,241,0.5)]">
                  <Zap className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-lg font-extrabold text-white">
                    Social<span className="text-indigo-400">Flow</span>
                  </span>
                  <p className="text-[10px] font-mono text-slate-400">LIQUID GLASS 4.0 PRO</p>
                </div>
              </div>
            </div>

            {/* Segmented Auth Mode Switcher */}
            <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-white/10 bg-[#090A0F]/75 p-1.5">
              <div className="flex items-center justify-center rounded-xl bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] py-2.5 text-sm font-bold text-white shadow-[0_0_24px_rgba(99,102,241,0.38)]">
                התחברות
              </div>
              <Link
                href="/register"
                className="flex items-center justify-center rounded-xl py-2.5 text-sm font-semibold text-slate-300 hover:text-white hover:bg-white/[0.04] transition-all no-underline"
              >
                הרשמה
              </Link>
            </div>

            <div className="space-y-1.5">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                ברוך הבא חזרה
              </h2>
              <p className="text-sm text-slate-400">
                הזן את פרטי החשבון שלך כדי להיכנס לפיד SocialFlow.
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

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="login-username"
                  className="block text-xs font-semibold text-slate-300"
                >
                  שם משתמש או אימייל
                </label>
                <div className="relative">
                  <User className="pointer-events-none absolute top-1/2 -translate-y-1/2 start-3.5 h-4 w-4 text-slate-400" />
                  <input
                    id="login-username"
                    type="text"
                    autoComplete="username"
                    dir="auto"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="לדוגמה: idankzm או name@example.com"
                    className="w-full rounded-2xl border border-white/10 bg-[#090A0F]/80 ps-10 pe-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500/70 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="login-password"
                  className="block text-xs font-semibold text-slate-300"
                >
                  סיסמה
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute top-1/2 -translate-y-1/2 start-3.5 h-4 w-4 text-slate-400" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-2xl border border-white/10 bg-[#090A0F]/80 ps-10 pe-11 py-3 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500/70 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
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

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] py-3.5 text-sm font-bold text-white shadow-[0_10px_30px_-6px_rgba(99,102,241,0.55)] hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                {isSubmitting ? (
                  <span>מתחבר למערכת...</span>
                ) : (
                  <>
                    <span>התחבר ל-SocialFlow</span>
                    <ArrowLeft className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="mt-7 pt-5 border-t border-white/10 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-slate-400">מילוי מהיר לחשבון הדגמה:</span>
              <div className="flex flex-wrap gap-2">
                {DEMO_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.username}
                    type="button"
                    onClick={() => handleQuickFill(acc)}
                    className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-indigo-500/40 hover:bg-indigo-500/10 transition-colors cursor-pointer"
                  >
                    {acc.label}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-center text-xs text-slate-400">
              עדיין אין לך חשבון?{' '}
              <Link
                href="/register"
                className="font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                צור חשבון חדש עכשיו
              </Link>
            </p>
          </div>
        </motion.main>
      </div>
    </div>
  );
}
