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
  const [resending, setResending] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState('');
  const [showResend, setShowResend] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [infoNotice, setInfoNotice] = useState('');
  const navigate = useNavigate();
  const { user } = useFactory();

  // Detect URL auth errors (e.g., expired confirmation links or OAuth errors)
  useState(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const errDesc = searchParams.get('error_description') || hashParams.get('error_description');
      const errCode = searchParams.get('error_code') || hashParams.get('error_code');
      if (errDesc) {
        setError(decodeURIComponent(errDesc.replace(/\+/g, ' ')));
        setShowResend(true);
      } else if (errCode) {
        setError(`Authentication error: ${errCode}`);
      }
    }
  });

  const handleGoogleSignIn = async () => {
    setBusy(true);
    setError('');
    setInfoNotice('');
    try {
      // Safe check: probe whether Google OAuth is enabled in Supabase backend
      const authUrl = `https://noiuvevcvxlxqmrkqjpn.supabase.co/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(window.location.origin + '/')}`;
      const probeRes = await fetch(authUrl, {
        headers: { apikey: 'sb_publishable_84PrxDpyFtaSiS55VLVNRg_Zjog4Hxy' },
      }).catch(() => null);

      if (probeRes && !probeRes.ok) {
        const body = await probeRes.json().catch(() => null);
        if (body?.msg?.includes('not enabled') || body?.error_code === 'validation_failed') {
          setError('Google Sign-In is not enabled on this Supabase project yet. Please sign in using your work email & password below.');
          setBusy(false);
          return;
        }
      }

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
    setInfoNotice('');
    setShowResend(false);
    try {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) throw signInError;

      // Ensure profile record exists in profiles table
      if (signInData?.user) {
        try {
          const userMeta = signInData.user.user_metadata || {};
          const displayName = userMeta['display_name'] || userMeta['full_name'] || email.trim().split('@')[0];
          await supabase.from('profiles').upsert({
            id: signInData.user.id,
            email: email.trim(),
            display_name: displayName,
            full_name: userMeta['full_name'] || displayName,
          }, { onConflict: 'id' });
        } catch {
          // Non-blocking: background trigger also guarantees profile
        }
      }

      toast.success('Signed in successfully');
      navigate({ to: '/' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to sign in. Please verify your credentials.';
      const lower = msg.toLowerCase();
      if (lower.includes('invalid login credentials') || lower.includes('invalid_credentials')) {
        setError('Invalid email or password. If you recently created your account, your email may still be unconfirmed.');
        setShowResend(true);
      } else if (lower.includes('email not confirmed')) {
        setError('Your email is not verified yet. Please click the activation link in your email, or resend below.');
        setShowResend(true);
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleResendEmail = async () => {
    if (!email.trim()) {
      toast.error('Please enter your email address first');
      return;
    }
    setResending(true);
    try {
      const { error: resendErr } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      });
      if (resendErr) throw resendErr;
      toast.success(`Verification email sent to ${email.trim()}!`);
      setInfoNotice(`Verification email sent to ${email.trim()}. Please check your inbox and spam folder.`);
      setError('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not resend email';
      if (msg.includes('rate_limit') || msg.includes('over_email_send_rate_limit')) {
        toast.error('Supabase email limit reached. Please wait a few minutes or disable "Confirm email" in Supabase settings.');
      } else {
        toast.error(msg);
      }
    } finally {
      setResending(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      toast.error('Please enter your email above to receive password reset instructions');
      return;
    }
    setResetting(true);
    try {
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (resetErr) throw resetErr;
      toast.success('Password reset link sent to your email');
      setInfoNotice(`Password reset instructions sent to ${email.trim()}. Check your inbox.`);
      setError('');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not send reset email');
    } finally {
      setResetting(false);
    }
  };

  if (user) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center p-4 bg-background text-foreground">
        <div className="w-full max-w-[390px] p-8 rounded-3xl border border-border bg-card text-center space-y-5" style={{ boxShadow: 'none' }}>
          <div className="w-10 h-10 rounded-full bg-secondary text-foreground mx-auto flex items-center justify-center font-semibold text-sm" style={{ boxShadow: 'none' }}>
            <CheckCircle2 className="w-5 h-5 text-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            Signed in as <span className="text-foreground font-medium">{user.email}</span>
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <button
              type="button"
              onClick={() => navigate({ to: '/' })}
              className="w-full h-11 px-5 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium transition-colors cursor-pointer"
              style={{ boxShadow: 'none' }}
            >
              Continue to Workspace
            </button>
            <button
              type="button"
              onClick={() => supabase.auth.signOut()}
              className="w-full h-11 px-5 rounded-full border border-border bg-transparent hover:bg-secondary text-muted-foreground hover:text-foreground text-xs font-medium transition-colors cursor-pointer"
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
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-background text-foreground">
      <div
        className="w-full max-w-[400px] p-7 sm:p-8 rounded-3xl border border-border bg-card flex flex-col gap-5 text-card-foreground shadow-sm"
        style={{ boxShadow: 'none' }}
      >
        {/* Brand emblem pill */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold text-foreground tracking-tight">SLBW</span>
          </div>

          <Link
            to="/"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            style={{ boxShadow: 'none' }}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>App</span>
          </Link>
        </div>

        {/* Tab switcher pill */}
        <div
          className="p-1 rounded-full border border-border bg-secondary grid grid-cols-2 gap-1"
          style={{ boxShadow: 'none' }}
        >
          <span
            className="flex items-center justify-center py-1.5 px-3 rounded-full bg-card text-foreground text-xs font-medium cursor-default shadow-sm"
            style={{ boxShadow: 'none' }}
          >
            Sign in
          </span>
          <Link
            to="/signup"
            className="flex items-center justify-center py-1.5 px-3 rounded-full text-muted-foreground hover:text-foreground text-xs font-medium transition-colors"
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
          className="w-full flex items-center justify-center gap-2.5 h-11 px-5 rounded-full border border-border bg-secondary hover:bg-muted text-foreground text-sm font-medium transition-colors cursor-pointer disabled:opacity-50"
          style={{ boxShadow: 'none' }}
        >
          <GoogleIcon />
          <span>Sign in with Google</span>
        </button>

        {/* Minimalist Divider */}
        <div className="relative flex items-center justify-center py-0.5">
          <div className="w-full border-t border-border" />
          <span className="absolute bg-card px-3 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            or
          </span>
        </div>

        {/* Feedback messages */}
        {error && (
          <div
            className="p-3.5 rounded-2xl border border-destructive/20 bg-destructive/10 text-destructive text-xs flex flex-col gap-2"
            style={{ boxShadow: 'none' }}
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>

            {showResend && (
              <div className="pt-1 flex items-center gap-2">
                <button
                  type="button"
                  disabled={resending}
                  onClick={handleResendEmail}
                  className="px-3 py-1.5 rounded-full bg-destructive/15 hover:bg-destructive/25 text-destructive font-medium text-[11px] transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  {resending ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                  <span>Resend verification email</span>
                </button>
              </div>
            )}
          </div>
        )}

        {infoNotice && (
          <div
            className="p-3 rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-500 text-xs flex items-center gap-2"
            style={{ boxShadow: 'none' }}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span className="leading-relaxed">{infoNotice}</span>
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
            className="w-full h-11 px-5 rounded-full border border-border bg-input/40 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none transition-colors"
            style={{ boxShadow: 'none' }}
          />

          <div className="flex flex-col gap-1">
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full h-11 px-5 rounded-full border border-border bg-input/40 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none transition-colors"
              style={{ boxShadow: 'none' }}
            />
            <div className="flex justify-end px-1 pt-1">
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={resetting}
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                {resetting ? 'Sending link…' : 'Forgot password?'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 h-11 px-5 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 mt-1"
            style={{ boxShadow: 'none' }}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            <span>{busy ? 'Signing in…' : 'Sign in'}</span>
          </button>
        </form>

        {/* Bottom switch link */}
        <div className="text-center pt-1 flex flex-col gap-2">
          <Link
            to="/signup"
            className="inline-block px-4 py-1.5 rounded-full text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
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
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [successNotice, setSuccessNotice] = useState('');
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const navigate = useNavigate();
  const { user } = useFactory();

  const handleGoogleSignUp = async () => {
    setBusy(true);
    setError('');
    setSuccessNotice('');
    try {
      // Safe check: probe whether Google OAuth is enabled in Supabase backend
      const authUrl = `https://noiuvevcvxlxqmrkqjpn.supabase.co/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(window.location.origin + '/')}`;
      const probeRes = await fetch(authUrl, {
        headers: { apikey: 'sb_publishable_84PrxDpyFtaSiS55VLVNRg_Zjog4Hxy' },
      }).catch(() => null);

      if (probeRes && !probeRes.ok) {
        const body = await probeRes.json().catch(() => null);
        if (body?.msg?.includes('not enabled') || body?.error_code === 'validation_failed') {
          setError('Google Sign-In is not enabled on this Supabase project yet. Please create your account with work email & password below.');
          setBusy(false);
          return;
        }
      }

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
    if (!fullName.trim()) {
      setError('Please enter your full name');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }
    setBusy(true);
    setError('');
    setSuccessNotice('');
    setAlreadyRegistered(false);
    try {
      const nameVal = fullName.trim();
      const emailVal = email.trim();

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: emailVal,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: nameVal,
            display_name: nameVal,
          },
        },
      });
      if (signUpError) throw signUpError;

      // Upsert profile immediately if session or user was returned
      if (data?.user) {
        try {
          await supabase.from('profiles').upsert({
            id: data.user.id,
            email: emailVal,
            full_name: nameVal,
            display_name: nameVal,
          }, { onConflict: 'id' });
        } catch {
          // Non-blocking: database trigger on auth.users will also insert
        }
      }

      if (!data.session) {
        // If identities is an empty array, the user already exists in Supabase
        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          setError('An account with this email already exists. Please sign in instead.');
          setAlreadyRegistered(true);
        } else {
          setSuccessNotice(`Verification email sent to ${email.trim()}! Please check your inbox and spam folder to activate your account.`);
          toast.success('Account created! Please check your email.');
        }
      } else {
        toast.success('Account created successfully');
        navigate({ to: '/' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to create account';
      if (msg.toLowerCase().includes('weak') || msg.toLowerCase().includes('pwned') || msg.toLowerCase().includes('easy to guess')) {
        setError('This password is too common or easily guessed. Please use a stronger password with a combination of letters, numbers, and symbols.');
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleResendSignupEmail = async () => {
    if (!email.trim()) return;
    setResending(true);
    try {
      const { error: resendErr } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      });
      if (resendErr) throw resendErr;
      toast.success('Verification email resent! Check your inbox.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not resend email';
      toast.error(msg);
    } finally {
      setResending(false);
    }
  };

  if (user) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center p-4 bg-background text-foreground">
        <div className="w-full max-w-[390px] p-8 rounded-3xl border border-border bg-card text-center space-y-5" style={{ boxShadow: 'none' }}>
          <div className="w-10 h-10 rounded-full bg-secondary text-foreground mx-auto flex items-center justify-center font-semibold text-sm" style={{ boxShadow: 'none' }}>
            <CheckCircle2 className="w-5 h-5 text-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            Signed in as <span className="text-foreground font-medium">{user.email}</span>
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <button
              type="button"
              onClick={() => navigate({ to: '/' })}
              className="w-full h-11 px-5 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium transition-colors cursor-pointer"
              style={{ boxShadow: 'none' }}
            >
              Continue to Workspace
            </button>
            <button
              type="button"
              onClick={() => supabase.auth.signOut()}
              className="w-full h-11 px-5 rounded-full border border-border bg-transparent hover:bg-secondary text-muted-foreground hover:text-foreground text-xs font-medium transition-colors cursor-pointer"
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
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-background text-foreground">
      <div
        className="w-full max-w-[400px] p-7 sm:p-8 rounded-3xl border border-border bg-card flex flex-col gap-5 text-card-foreground shadow-sm"
        style={{ boxShadow: 'none' }}
      >
        {/* Brand emblem pill */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold text-foreground tracking-tight">SLBW</span>
          </div>

          <Link
            to="/"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            style={{ boxShadow: 'none' }}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>App</span>
          </Link>
        </div>

        {/* Tab switcher pill */}
        <div
          className="p-1 rounded-full border border-border bg-secondary grid grid-cols-2 gap-1"
          style={{ boxShadow: 'none' }}
        >
          <Link
            to="/login"
            className="flex items-center justify-center py-1.5 px-3 rounded-full text-muted-foreground hover:text-foreground text-xs font-medium transition-colors"
            style={{ boxShadow: 'none' }}
          >
            Sign in
          </Link>
          <span
            className="flex items-center justify-center py-1.5 px-3 rounded-full bg-card text-foreground text-xs font-medium cursor-default shadow-sm"
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
          className="w-full flex items-center justify-center gap-2.5 h-11 px-5 rounded-full border border-border bg-secondary hover:bg-muted text-foreground text-sm font-medium transition-colors cursor-pointer disabled:opacity-50"
          style={{ boxShadow: 'none' }}
        >
          <GoogleIcon />
          <span>Sign up with Google</span>
        </button>

        {/* Minimalist Divider */}
        <div className="relative flex items-center justify-center py-0.5">
          <div className="w-full border-t border-border" />
          <span className="absolute bg-card px-3 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            or
          </span>
        </div>

        {/* Feedback messages */}
        {error && (
          <div
            className="p-3.5 rounded-2xl border border-destructive/20 bg-destructive/10 text-destructive text-xs flex flex-col gap-2"
            style={{ boxShadow: 'none' }}
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>

            {alreadyRegistered && (
              <div className="pt-1">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-destructive/15 hover:bg-destructive/25 text-destructive font-medium text-[11px] transition-colors"
                >
                  Go to Sign in &rarr;
                </Link>
              </div>
            )}
          </div>
        )}

        {successNotice && (
          <div
            className="p-3.5 rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-500 text-xs flex flex-col gap-2.5"
            style={{ boxShadow: 'none' }}
          >
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{successNotice}</span>
            </div>

            <div className="flex items-center gap-2 pt-0.5">
              <button
                type="button"
                disabled={resending}
                onClick={handleResendSignupEmail}
                className="px-3 py-1 rounded-full bg-blue-500/15 hover:bg-blue-500/25 text-blue-500 font-medium text-[11px] transition-colors cursor-pointer flex items-center gap-1.5"
              >
                {resending ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                <span>Resend email</span>
              </button>
              <Link
                to="/login"
                className="text-[11px] font-medium underline hover:text-blue-600 transition-colors"
              >
                Go to Sign in
              </Link>
            </div>
          </div>
        )}

        {/* Auth Form with UX placeholders acting as headings */}
        <form onSubmit={handleSignup} className="flex flex-col gap-3">
          <input
            type="text"
            required
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Full Name (e.g. Rahul Sharma)"
            className="w-full h-11 px-5 rounded-full border border-border bg-input/40 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none transition-colors"
            style={{ boxShadow: 'none' }}
          />

          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your work email to create an account"
            className="w-full h-11 px-5 rounded-full border border-border bg-input/40 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none transition-colors"
            style={{ boxShadow: 'none' }}
          />

          <input
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Choose password (min 8 characters)"
            className="w-full h-11 px-5 rounded-full border border-border bg-input/40 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none transition-colors"
            style={{ boxShadow: 'none' }}
          />

          <input
            type="password"
            required
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm your password"
            className="w-full h-11 px-5 rounded-full border border-border bg-input/40 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none transition-colors"
            style={{ boxShadow: 'none' }}
          />

          <button
            type="submit"
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 h-11 px-5 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 mt-1"
            style={{ boxShadow: 'none' }}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            <span>{busy ? 'Creating account…' : 'Create account'}</span>
          </button>
        </form>

        {/* Bottom switch link */}
        <div className="text-center pt-1 flex flex-col gap-2">
          <Link
            to="/login"
            className="inline-block px-4 py-1.5 rounded-full text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            style={{ boxShadow: 'none' }}
          >
            Already have an account? Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
