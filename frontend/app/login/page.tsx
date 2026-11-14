'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Cpu,
  Eye,
  EyeOff,
  Lock,
  Radio,
  Search,
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

interface DemoAccount {
  username: string;
  password: string;
  role: string;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  { username: 'idan', password: 'password123', role: 'Architect' },
  { username: 'testuser99', password: 'password123', role: 'Creator' },
  { username: 'david', password: 'password123', role: 'Developer' },
];

export default function LoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleQuickFill = (account: DemoAccount) => {
    setUsername(account.username);
    setPassword(account.password);
    setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const trimmedUsername = username.trim();
    if (!trimmedUsername || !password) {
      setErrorMsg('נא למלא שם משתמש וסיסמה / Please enter username and password.');
      return;
    }

    try {
      setIsSubmitting(true);

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username: trimmedUsername,
          password,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const fallbackMsg =
          res.status === 401
            ? 'שם משתמש או סיסמה שגויים'
            : `שגיאת התחברות מהשרת (${res.status})`;
        throw new Error(errData?.message || errData?.error || fallbackMsg);
      }

      const data = await res.json().catch(() => ({}));

      try {
        const userObj = {
          userId: data.userId ?? 1,
          username: data.username || trimmedUsername,
          fullName: data.fullName || data.username || trimmedUsername,
          email: data.email || '',
          token: data.token || '',
        };
        localStorage.setItem('socialflow_user', JSON.stringify(userObj));
      } catch {
        // Ignore storage error in restricted browser contexts
      }

      setSuccessMsg('התחברת בהצלחה! מעביר לפיד...');
      router.push('/');
      router.refresh();
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'אירעה שגיאה בעת ההתחברות. ודא ששירותי המערכת פועלים.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-[#090A0F] text-[#F8FAFC] flex items-center justify-center p-4 sm:p-6 lg:p-10">
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Split-Screen Showcase Panel */}
        <motion.aside
          initial={{ opacity: 0, x: 18 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35 }}
          className="lg:col-span-6 hidden lg:flex flex-col justify-between rounded-3xl relative overflow-hidden p-8 bg-[rgba(18,21,33,0.72)] backdrop-blur-xl border border-white/10 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.65)]"
        >
          {/* Ambient Glow Layers */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 -end-20 h-72 w-72 rounded-full bg-indigo-500/25 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-24 -start-20 h-72 w-72 rounded-full bg-violet-500/20 blur-3xl"
          />

          <div className="relative z-10 space-y-6">
            <div className="flex items-center justify-between">
              <Link href="/" className="inline-flex items-center gap-3 group">
                <span className="h-11 w-11 rounded-2xl bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] flex items-center justify-center text-white shadow-[0_0_24px_rgba(99,102,241,0.5)]">
                  <Zap className="h-5 w-5" />
                </span>
                <div>
                  <span className="text-xl font-extrabold tracking-tight text-white">
                    Social<span className="text-indigo-400">Flow</span>
                  </span>
                  <p className="text-[11px] font-mono text-slate-400">
                    OBSIDIAN LIQUID GLASS 2026
                  </p>
                </div>
              </Link>

              <BadgePill variant="emerald" pulseDot size="sm">
                Gateway :8088 Online
              </BadgePill>
            </div>

            <div className="space-y-3 pt-4">
              <BadgePill variant="indigo" icon={<Sparkles className="h-3 w-3" />}>
                AI-Native Microservices Network
              </BadgePill>
              <h2 className="text-3xl font-extrabold leading-tight text-slate-50">
                שיחות בזמן אמת, חיפוש חכם וסוכני AI אוטונומיים.
              </h2>
              <p dir="auto" className="text-sm text-slate-300 leading-relaxed max-w-md">
                Connect across Spring Boot 3 microservices, Apache Kafka streams, Elasticsearch
                instant discovery, and LangGraph RAG intelligence.
              </p>
            </div>

            {/* Mini Bento Feature Grid */}
            <div className="grid grid-cols-2 gap-3.5 pt-2">
              <BentoTile
                label="Real-Time Stream"
                value="STOMP WS"
                sublabel="התראות וריאקציות ב-0ms"
                accent="emerald"
                icon={<Radio className="h-4 w-4" />}
              />
              <BentoTile
                label="Instant Search"
                value="Elastic 8"
                sublabel="חיפוש פוסטים ותגיות Ctrl+K"
                accent="indigo"
                icon={<Search className="h-4 w-4" />}
              />
              <BentoTile
                label="Autonomous AI"
                value="LangGraph"
                sublabel="מחקר טרנדים ומנוע RAG"
                accent="violet"
                icon={<Cpu className="h-4 w-4" />}
              />
              <BentoTile
                label="Zero-Trust Auth"
                value="HttpOnly JWT"
                sublabel="אימות מאובטח מבוסס Cookies"
                accent="cyan"
                icon={<Lock className="h-4 w-4" />}
              />
            </div>
          </div>

          <div className="relative z-10 pt-6 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
            <span>תמיכה מלאה בעברית ואנגלית (RTL / LTR)</span>
            <span className="font-mono text-indigo-300">v2.0 • Next.js 15</span>
          </div>
        </motion.aside>

        {/* Right Split-Screen Auth Form Panel */}
        <motion.main
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="lg:col-span-6 flex flex-col justify-center"
        >
          <GlassCard padding="lg" glow="indigo" className="rounded-3xl space-y-6">
            {/* Mobile Brand Header + Back Navigation */}
            <div className="flex items-center justify-between gap-3">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 rounded-full bg-white/5 border border-white/10 hover:border-indigo-500/40 px-3.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-white transition-all"
              >
                <ArrowRight className="h-3.5 w-3.5" />
                <span>חזרה לפיד</span>
              </Link>

              <div className="flex items-center gap-2 lg:hidden">
                <span className="h-8 w-8 rounded-xl bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] flex items-center justify-center text-white">
                  <Zap className="h-4 w-4" />
                </span>
                <span className="font-extrabold text-base text-white">
                  Social<span className="text-indigo-400">Flow</span>
                </span>
              </div>

              <BadgePill variant="indigo" size="sm">
                כניסה למערכת
              </BadgePill>
            </div>

            <div className="space-y-1.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-50 tracking-tight">
                ברוך שובך 👋
              </h1>
              <p className="text-sm text-slate-400">
                התחבר לחשבונך כדי לפרסם פוסטים, להגיב ולנהל את הפיד שלך.
              </p>
            </div>

            {/* Alert Banner */}
            <AnimatePresence mode="wait">
              {errorMsg && (
                <motion.div
                  key="login-error"
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
                  key="login-success"
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

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="login-username"
                  className="block text-xs font-semibold text-slate-300 mb-1.5"
                >
                  שם משתמש / Username
                </label>
                <div className="relative">
                  <User className="pointer-events-none absolute top-1/2 -translate-y-1/2 start-3.5 h-4 w-4 text-slate-400" />
                  <input
                    id="login-username"
                    type="text"
                    autoComplete="username"
                    autoFocus
                    required
                    dir="ltr"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="idan"
                    className="w-full rounded-xl bg-[#090A0F]/80 border border-white/10 ps-10 pe-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="login-password"
                  className="block text-xs font-semibold text-slate-300 mb-1.5"
                >
                  סיסמה / Password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute top-1/2 -translate-y-1/2 start-3.5 h-4 w-4 text-slate-400" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    dir="ltr"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl bg-[#090A0F]/80 border border-white/10 ps-10 pe-11 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20 transition-all"
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
              </div>

              {/* Quick Fill Demo Accounts */}
              <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-3 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold text-slate-400">
                  מילוי מהיר (Demo):
                </span>
                {DEMO_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.username}
                    type="button"
                    onClick={() => handleQuickFill(acc)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 hover:bg-indigo-500/25 border border-indigo-500/30 px-2.5 py-1 text-[11px] font-mono text-indigo-200 transition-colors cursor-pointer"
                  >
                    <span>@{acc.username}</span>
                    <span className="text-slate-400">• {acc.role}</span>
                  </button>
                ))}
              </div>

              <GradientButton
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                isLoading={isSubmitting}
              >
                {isSubmitting ? 'מתחבר למערכת...' : 'התחבר עכשיו'}
              </GradientButton>
            </form>

            {/* Footer Switch & Guest Navigation */}
            <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="text-slate-400">
                <span>עדיין אין לך חשבון? </span>
                <Link
                  href="/register"
                  className="font-semibold text-indigo-300 hover:text-indigo-200 underline underline-offset-4"
                >
                  צור חשבון חדש בחינם
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
