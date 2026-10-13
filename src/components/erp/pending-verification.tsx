import { useState } from 'react';
import { Clock, Copy, Check, LogOut, RefreshCw, ShieldAlert } from 'lucide-react';
import { useFactory } from './provider';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function PendingVerificationPage() {
  const { user, refresh } = useFactory();
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);

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
      toast.info('Status re-checked');
    } catch {
      toast.error('Could not refresh status');
    } finally {
      setTimeout(() => setChecking(false), 400);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-[#111111] text-[#ededed]">
      <div
        className="w-full max-w-[420px] p-8 sm:p-9 rounded-3xl border border-[#232323] bg-[#171717] flex flex-col items-center text-center gap-6"
        style={{ boxShadow: 'none' }}
      >
        {/* Mid-size Icon */}
        <div
          className="w-16 h-16 rounded-full border border-[#262626] bg-[#1a1a1a] flex items-center justify-center text-[#ededed] shrink-0"
          style={{ boxShadow: 'none' }}
        >
          <Clock className="w-8 h-8 text-[#d6d6d6]" strokeWidth={1.5} />
        </div>

        {/* Minimalist Text */}
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-medium tracking-tight text-[#f1f1f1]">
            Pending Verification
          </h1>
          <p className="text-xs text-[#8e8e8e] leading-relaxed max-w-[320px] mx-auto">
            Your account is awaiting role assignment from the factory administrator.
            You will gain access once an admin hands over your workspace role.
          </p>
        </div>

        {/* User Account Info Pill */}
        <div
          className="w-full p-4 rounded-2xl border border-[#242424] bg-[#131313] flex flex-col gap-2.5 text-left text-xs"
          style={{ boxShadow: 'none' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[#777777]">Account</span>
            <span className="text-[#e2e2e2] font-medium truncate max-w-[200px]">
              {user?.email || 'Authenticated User'}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[#777777]">Status</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#242424] text-[#cfcfcf]">
              Awaiting Role Handover
            </span>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-[#222222]">
            <span className="text-[#777777]">User ID</span>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[11px] text-[#999999]">
                {user?.id ? `${user.id.slice(0, 8)}…${user.id.slice(-4)}` : '—'}
              </span>
              <button
                type="button"
                onClick={handleCopyId}
                aria-label="Copy User ID"
                title="Copy User ID to share with admin"
                className="p-1 rounded-md text-[#777777] hover:text-[#ededed] hover:bg-[#202020] transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Pill Action Buttons */}
        <div className="flex flex-col gap-2.5 w-full pt-1">
          <button
            type="button"
            disabled={checking}
            onClick={handleCheckStatus}
            className="w-full h-11 px-5 rounded-full bg-[#f1f1f1] hover:bg-white text-[#111111] text-xs font-medium transition-colors cursor-pointer flex items-center justify-center gap-2"
            style={{ boxShadow: 'none' }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
            <span>{checking ? 'Checking…' : 'Check Verification Status'}</span>
          </button>

          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            className="w-full h-11 px-5 rounded-full border border-[#2a2a2a] bg-transparent hover:bg-[#202020] text-[#888888] hover:text-[#f1f1f1] text-xs font-medium transition-colors cursor-pointer flex items-center justify-center gap-2"
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
