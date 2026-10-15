import { useState, useEffect } from 'react';
import { Clock, Copy, Check, LogOut, RefreshCw, ShieldCheck, Database, UserCheck } from 'lucide-react';
import { useFactory } from './provider';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function PendingVerificationPage() {
  const { user, profile, refresh } = useFactory();
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);

  // Real-time subscription to user_roles for instant handover unlock
  useEffect(() => {
    if (!user?.id) return;

    // Direct channel subscription to role table for this specific user
    const channel = supabase
      .channel(`pending-role-sync-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_roles',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          const newRole = (payload.new as any)?.role;
          if (newRole && newRole !== 'pending') {
            toast.success(`Access granted! You have been assigned the "${newRole}" role.`);
            await refresh();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        async () => {
          await refresh();
        }
      )
      .subscribe();

    // Fallback polling every 4 seconds in case WebSockets are interrupted
    const interval = setInterval(() => {
      refresh();
    }, 4000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [user?.id, refresh]);

  const handleCopyId = () => {
    if (!user?.id) return;
    navigator.clipboard.writeText(user.id);
    setCopied(true);
    toast.success('User ID copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCheckStatus = async () => {
    setChecking(true);
    try {
      await refresh();
      toast.info('Verification status re-checked');
    } catch {
      toast.error('Could not refresh status');
    } finally {
      setTimeout(() => setChecking(false), 400);
    }
  };

  const displayName = profile?.display_name || profile?.full_name || user?.user_metadata?.['display_name'] || user?.user_metadata?.['full_name'] || user?.email?.split('@')[0] || 'Team Member';

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-background text-foreground">
      <div
        className="w-full max-w-[440px] p-8 sm:p-9 rounded-3xl border border-border bg-card flex flex-col items-center text-center gap-6 shadow-sm"
      >
        {/* Animated Mid-size Clock Icon */}
        <div
          className="relative w-16 h-16 rounded-full border border-amber-500/30 bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0"
        >
          <Clock className="w-8 h-8 animate-pulse text-amber-500" strokeWidth={1.75} />
          <span className="absolute top-0 right-0 w-3.5 h-3.5 rounded-full bg-amber-500 ring-4 ring-card" />
        </div>

        {/* Minimalist Text */}
        <div className="flex flex-col gap-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-500 border border-amber-500/25 mx-auto">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
            <span>Awaiting Role Handover</span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Welcome, {displayName}
          </h1>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-[340px] mx-auto">
            Your account profile has been recorded in the database.
            An administrator must assign your role before you can access workspace operations.
          </p>
        </div>

        {/* User Account Info Card */}
        <div
          className="w-full p-4 rounded-2xl border border-border bg-secondary/50 flex flex-col gap-2.5 text-left text-xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Full Name</span>
            <span className="text-foreground font-medium truncate max-w-[220px]">
              {displayName}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Work Email</span>
            <span className="text-foreground font-medium truncate max-w-[220px]">
              {user?.email || 'Authenticated User'}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Database Status</span>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-500">
              <Check className="w-3 h-3" /> Profile & Role Initialized
            </span>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <span className="text-muted-foreground">User ID</span>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[11px] text-muted-foreground">
                {user?.id ? `${user.id.slice(0, 8)}…${user.id.slice(-4)}` : '—'}
              </span>
              <button
                type="button"
                onClick={handleCopyId}
                aria-label="Copy User ID"
                title="Copy User ID to share with administrator"
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Live sync indication info banner */}
        <div className="w-full p-3 rounded-2xl border border-border bg-muted/40 text-[11px] text-muted-foreground flex items-center gap-2.5 text-left">
          <Database className="w-4 h-4 text-primary shrink-0" />
          <span className="leading-relaxed">
            Real-time listener active. As soon as an admin assigns your role in the system or database, this screen will instantly unlock.
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2.5 w-full pt-1">
          <button
            type="button"
            disabled={checking}
            onClick={handleCheckStatus}
            className="w-full h-11 px-5 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-none"
            style={{ boxShadow: 'none' }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
            <span>{checking ? 'Checking Status…' : 'Check Verification Status Now'}</span>
          </button>

          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            className="w-full h-11 px-5 rounded-full border border-border bg-transparent hover:bg-secondary text-muted-foreground hover:text-foreground text-xs font-medium transition-colors cursor-pointer flex items-center justify-center gap-2"
            style={{ boxShadow: 'none' }}
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
