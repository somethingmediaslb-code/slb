import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { useFactory } from './provider';
import { ArrowLeft, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

function GoogleIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { user } = useFactory();

  const handleGoogleSignIn = async () => {
    setBusy(true);
    setError('');
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });
      if (oauthError) throw oauthError;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Google sign in failed');
      setBusy(false);
    }
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) throw signInError;
      toast.success('Signed in successfully');
      navigate({ to: '/' });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to sign in. Please verify your credentials.');
    } finally {
      setBusy(false);
    }
  };

  if (user) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center p-4 bg-[#111111] text-[#ededed]">
        <div className="w-full max-w-[390px] p-8 rounded-3xl border border-[#232323] bg-[#171717] text-center space-y-5" style={{ boxShadow: 'none' }}>
          <div className="w-10 h-10 rounded-full bg-[#232323] text-[#f1f1f1] mx-auto flex items-center justify-center font-semibold text-sm" style={{ boxShadow: 'none' }}>
            <CheckCircle2 className="w-5 h-5 text-[#ededed]" />
          </div>
          <p className="text-sm text-[#999999]">
            Signed in as <span className="text-[#f1f1f1] font-medium">{user.email}</span>
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <button
              type="button"
              onClick={() => navigate({ to: '/' })}
              className="w-full h-11 px-5 rounded-full bg-[#f1f1f1] hover:bg-white text-[#111111] text-sm font-medium transition-colors cursor-pointer"
              style={{ boxShadow: 'none' }}
            >
              Continue to Workspace
            </button>
            <button
              type="button"
              onClick={() => supabase.auth.signOut()}
              className="w-full h-11 px-5 rounded-full border border-[#2a2a2a] bg-transparent hover:bg-[#202020] text-[#999999] hover:text-[#f1f1f1] text-xs font-medium transition-colors cursor-pointer"
              style={{ boxShadow: 'none' }}
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-[#111111] text-[#ededed]">
      <div
        className="w-full max-w-[390px] p-7 sm:p-8 rounded-3xl border border-[#232323] bg-[#171717] flex flex-col gap-5"
        style={{ boxShadow: 'none' }}
      >
        {/* Brand emblem pill */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-full bg-white text-black flex items-center justify-center font-bold text-xs"
              style={{ boxShadow: 'none' }}
            >
              C
            </div>
            <span className="text-sm font-medium text-[#f1f1f1] tracking-tight">CrateERP</span>
          </div>

          <Link
            to="/"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-[#888888] hover:text-[#f1f1f1] hover:bg-[#202020] transition-colors"
            style={{ boxShadow: 'none' }}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>App</span>
          </Link>
        </div>

        {/* Tab switcher pill */}
        <div
          className="p-1 rounded-full border border-[#232323] bg-[#141414] grid grid-cols-2 gap-1"
          style={{ boxShadow: 'none' }}
        >
          <span
            className="flex items-center justify-center py-1.5 px-3 rounded-full bg-[#262626] text-[#f1f1f1] text-xs font-medium cursor-default"
            style={{ boxShadow: 'none' }}
          >
            Sign in
          </span>
          <Link
            to="/signup"
            className="flex items-center justify-center py-1.5 px-3 rounded-full text-[#777777] hover:text-[#f1f1f1] text-xs font-medium transition-colors"
            style={{ boxShadow: 'none' }}
          >
            Create account
          </Link>
        </div>

        {/* Google OAuth Button */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={busy}
          className="w-full flex items-center justify-center gap-2.5 h-11 px-5 rounded-full border border-[#282828] bg-[#1e1e1e] hover:bg-[#252525] text-[#ededed] text-sm font-medium transition-colors cursor-pointer disabled:opacity-50"
          style={{ boxShadow: 'none' }}
        >
          <GoogleIcon />
          <span>Sign in with Google</span>
        </button>

        {/* Minimalist Divider */}
        <div className="relative flex items-center justify-center py-0.5">
          <div className="w-full border-t border-[#232323]" />
          <span className="absolute bg-[#171717] px-3 text-[11px] font-medium text-[#666666] uppercase tracking-wider">
            or
          </span>
        </div>

        {/* Feedback message */}
        {error && (
          <div
            className="p-3 rounded-2xl border border-red-500/20 bg-red-950/20 text-red-400 text-xs flex items-center gap-2"
            style={{ boxShadow: 'none' }}
          >
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Auth Form with UX placeholders acting as headings */}
        <form onSubmit={handleLogin} className="flex flex-col gap-3">
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email to sign in"
            className="w-full h-11 px-5 rounded-full border border-[#282828] bg-[#141414] text-sm text-[#f1f1f1] placeholder:text-[#666666] focus:border-[#484848] focus:outline-none transition-colors"
            style={{ boxShadow: 'none' }}
          />

          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            className="w-full h-11 px-5 rounded-full border border-[#282828] bg-[#141414] text-sm text-[#f1f1f1] placeholder:text-[#666666] focus:border-[#484848] focus:outline-none transition-colors"
            style={{ boxShadow: 'none' }}
          />

          <button
            type="submit"
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 h-11 px-5 rounded-full bg-[#f1f1f1] hover:bg-white text-[#111111] text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 mt-1"
            style={{ boxShadow: 'none' }}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            <span>{busy ? 'Signing in…' : 'Sign in'}</span>
          </button>
        </form>

        {/* Bottom switch link */}
        <div className="text-center pt-1">
          <Link
            to="/signup"
            className="inline-block px-4 py-2 rounded-full text-xs text-[#888888] hover:text-[#f1f1f1] hover:bg-[#1f1f1f] transition-colors"
            style={{ boxShadow: 'none' }}
          >
            Don&apos;t have an account? Sign up
          </Link>
        </div>
      </div>
    </div>
  );
}

export function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [successNotice, setSuccessNotice] = useState('');
  const navigate = useNavigate();
  const { user } = useFactory();

  const handleGoogleSignUp = async () => {
    setBusy(true);
    setError('');
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });
      if (oauthError) throw oauthError;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Google sign up failed');
      setBusy(false);
    }
  };

  const handleSignup = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      });
      if (signUpError) throw signUpError;

      if (!data.session) {
        setSuccessNotice('Verification email sent! Click the link in your email to activate your account.');
      } else {
        toast.success('Account created successfully');
        navigate({ to: '/' });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to create account');
    } finally {
      setBusy(false);
    }
  };

  if (user) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center p-4 bg-[#111111] text-[#ededed]">
        <div className="w-full max-w-[390px] p-8 rounded-3xl border border-[#232323] bg-[#171717] text-center space-y-5" style={{ boxShadow: 'none' }}>
          <div className="w-10 h-10 rounded-full bg-[#232323] text-[#f1f1f1] mx-auto flex items-center justify-center font-semibold text-sm" style={{ boxShadow: 'none' }}>
            <CheckCircle2 className="w-5 h-5 text-[#ededed]" />
          </div>
          <p className="text-sm text-[#999999]">
            Signed in as <span className="text-[#f1f1f1] font-medium">{user.email}</span>
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <button
              type="button"
              onClick={() => navigate({ to: '/' })}
              className="w-full h-11 px-5 rounded-full bg-[#f1f1f1] hover:bg-white text-[#111111] text-sm font-medium transition-colors cursor-pointer"
              style={{ boxShadow: 'none' }}
            >
              Continue to Workspace
            </button>
            <button
              type="button"
              onClick={() => supabase.auth.signOut()}
              className="w-full h-11 px-5 rounded-full border border-[#2a2a2a] bg-transparent hover:bg-[#202020] text-[#999999] hover:text-[#f1f1f1] text-xs font-medium transition-colors cursor-pointer"
              style={{ boxShadow: 'none' }}
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-[#111111] text-[#ededed]">
      <div
        className="w-full max-w-[390px] p-7 sm:p-8 rounded-3xl border border-[#232323] bg-[#171717] flex flex-col gap-5"
        style={{ boxShadow: 'none' }}
      >
        {/* Brand emblem pill */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-full bg-white text-black flex items-center justify-center font-bold text-xs"
              style={{ boxShadow: 'none' }}
            >
              C
            </div>
            <span className="text-sm font-medium text-[#f1f1f1] tracking-tight">CrateERP</span>
          </div>

          <Link
            to="/"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-[#888888] hover:text-[#f1f1f1] hover:bg-[#202020] transition-colors"
            style={{ boxShadow: 'none' }}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>App</span>
          </Link>
        </div>

        {/* Tab switcher pill */}
        <div
          className="p-1 rounded-full border border-[#232323] bg-[#141414] grid grid-cols-2 gap-1"
          style={{ boxShadow: 'none' }}
        >
          <Link
            to="/login"
            className="flex items-center justify-center py-1.5 px-3 rounded-full text-[#777777] hover:text-[#f1f1f1] text-xs font-medium transition-colors"
            style={{ boxShadow: 'none' }}
          >
            Sign in
          </Link>
          <span
            className="flex items-center justify-center py-1.5 px-3 rounded-full bg-[#262626] text-[#f1f1f1] text-xs font-medium cursor-default"
            style={{ boxShadow: 'none' }}
          >
            Create account
          </span>
        </div>

        {/* Google OAuth Button */}
        <button
          type="button"
          onClick={handleGoogleSignUp}
          disabled={busy}
          className="w-full flex items-center justify-center gap-2.5 h-11 px-5 rounded-full border border-[#282828] bg-[#1e1e1e] hover:bg-[#252525] text-[#ededed] text-sm font-medium transition-colors cursor-pointer disabled:opacity-50"
          style={{ boxShadow: 'none' }}
        >
          <GoogleIcon />
          <span>Sign up with Google</span>
        </button>

        {/* Minimalist Divider */}
        <div className="relative flex items-center justify-center py-0.5">
          <div className="w-full border-t border-[#232323]" />
          <span className="absolute bg-[#171717] px-3 text-[11px] font-medium text-[#666666] uppercase tracking-wider">
            or
          </span>
        </div>

        {/* Feedback messages */}
        {error && (
          <div
            className="p-3 rounded-2xl border border-red-500/20 bg-red-950/20 text-red-400 text-xs flex items-center gap-2"
            style={{ boxShadow: 'none' }}
          >
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successNotice && (
          <div
            className="p-3 rounded-2xl border border-blue-500/20 bg-blue-950/20 text-blue-300 text-xs flex items-center gap-2"
            style={{ boxShadow: 'none' }}
          >
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>{successNotice}</span>
          </div>
        )}

        {/* Auth Form with UX placeholders acting as headings */}
        <form onSubmit={handleSignup} className="flex flex-col gap-3">
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your work email to create an account"
            className="w-full h-11 px-5 rounded-full border border-[#282828] bg-[#141414] text-sm text-[#f1f1f1] placeholder:text-[#666666] focus:border-[#484848] focus:outline-none transition-colors"
            style={{ boxShadow: 'none' }}
          />

          <input
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Choose password (min 8 characters)"
            className="w-full h-11 px-5 rounded-full border border-[#282828] bg-[#141414] text-sm text-[#f1f1f1] placeholder:text-[#666666] focus:border-[#484848] focus:outline-none transition-colors"
            style={{ boxShadow: 'none' }}
          />

          <input
            type="password"
            required
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm your password"
            className="w-full h-11 px-5 rounded-full border border-[#282828] bg-[#141414] text-sm text-[#f1f1f1] placeholder:text-[#666666] focus:border-[#484848] focus:outline-none transition-colors"
            style={{ boxShadow: 'none' }}
          />

          <button
            type="submit"
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 h-11 px-5 rounded-full bg-[#f1f1f1] hover:bg-white text-[#111111] text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 mt-1"
            style={{ boxShadow: 'none' }}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            <span>{busy ? 'Creating account…' : 'Create account'}</span>
          </button>
        </form>

        {/* Bottom switch link */}
        <div className="text-center pt-1">
          <Link
            to="/login"
            className="inline-block px-4 py-2 rounded-full text-xs text-[#888888] hover:text-[#f1f1f1] hover:bg-[#1f1f1f] transition-colors"
            style={{ boxShadow: 'none' }}
          >
            Already have an account? Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
