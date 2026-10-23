import { useEffect, useState, useRef } from 'react';
import { useRouterState } from '@tanstack/react-router';
import { Package, Sparkles } from 'lucide-react';
import { useFactory } from './provider';

/**
 * TopProgressBar
 * High-performance nano progress bar at the very top of the screen.
 * Triggers instantly when clicking links or moving between pages.
 */
export function TopProgressBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isRouterLoading = useRouterState({ select: (s) => s.isLoading });
  const { loading: isDataLoading } = useFactory();

  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const prevPathRef = useRef(pathname);
  const timerRef = useRef<NodeJS.Timeout[]>([]);

  const clearTimers = () => {
    timerRef.current.forEach(clearTimeout);
    timerRef.current = [];
  };

  const triggerProgress = () => {
    clearTimers();
    setVisible(true);
    setProgress(15);

    timerRef.current.push(
      setTimeout(() => setProgress(45), 60),
      setTimeout(() => setProgress(75), 180),
      setTimeout(() => setProgress(90), 380)
    );
  };

  const completeProgress = () => {
    clearTimers();
    setProgress(100);
    timerRef.current.push(
      setTimeout(() => {
        setVisible(false);
        timerRef.current.push(
          setTimeout(() => setProgress(0), 150)
        );
      }, 220)
    );
  };

  // Trigger on route change
  useEffect(() => {
    if (prevPathRef.current !== pathname) {
      prevPathRef.current = pathname;
      triggerProgress();
      const doneTimer = setTimeout(() => {
        completeProgress();
      }, 350);
      return () => clearTimeout(doneTimer);
    }
    return undefined;
  }, [pathname]);

  // Trigger on router pending state
  useEffect(() => {
    if (isRouterLoading) {
      triggerProgress();
    } else if (visible && !isDataLoading) {
      completeProgress();
    }
  }, [isRouterLoading, isDataLoading]);

  // Global listener for clicking internal nav links to give sub-millisecond visual feedback
  useEffect(() => {
    const handleLinkClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest('a');
      if (!target) return;
      const href = target.getAttribute('href');
      if (href && href.startsWith('/') && !href.startsWith('//') && !target.hasAttribute('download') && target.getAttribute('target') !== '_blank') {
        triggerProgress();
      }
    };
    window.addEventListener('click', handleLinkClick, { capture: true });
    return () => {
      window.removeEventListener('click', handleLinkClick, { capture: true });
      clearTimers();
    };
  }, []);

  if (!visible && progress === 0) return null;

  return (
    <div className="slbw-top-progress" aria-hidden="true">
      <div
        className="slbw-top-progress-bar"
        style={{
          width: `${progress}%`,
          opacity: visible ? 1 : 0,
        }}
      >
        <div className="slbw-top-progress-glow" />
      </div>
    </div>
  );
}

/**
 * WorkspaceLoader
 * Themed full-screen workspace loading experience matching the SLBW factory dark/light theme.
 */
export function WorkspaceLoader({ message = 'Loading SLBW workspace…' }: { message?: string }) {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background text-foreground relative overflow-hidden select-none">
      {/* Background radial ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 50% 46%, rgba(65, 36, 251, 0.12) 0%, rgba(139, 92, 246, 0.05) 35%, transparent 70%)',
        }}
      />

      {/* Center Branded Loader Card */}
      <div className="relative z-10 flex flex-col items-center gap-5 p-8 max-w-sm text-center">
        {/* Animated Box Hologram Logo */}
        <div className="relative flex items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-secondary/80 border border-border/80 flex items-center justify-center shadow-lg shadow-primary/10 relative overflow-hidden slbw-box-pulse">
            <Package className="w-8 h-8 text-primary relative z-10 slbw-box-icon" />
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 via-transparent to-purple-500/20 pointer-events-none" />
          </div>

          {/* Micro pulsing ring */}
          <div className="absolute -inset-2 rounded-3xl border border-primary/20 animate-ping opacity-30 pointer-events-none" />
        </div>

        {/* Brand Text */}
        <div className="space-y-1">
          <div className="flex items-center justify-center gap-1.5">
            <span className="text-base font-bold tracking-tight text-foreground">SLBW</span>
            <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-primary/15 text-primary tracking-wider">
              Factory ERP
            </span>
          </div>
          <p className="text-xs text-muted-foreground font-normal">
            {message}
          </p>
        </div>

        {/* Sleek indeterminate loader track */}
        <div className="w-48 h-1 rounded-full bg-secondary border border-border/60 overflow-hidden relative">
          <div className="slbw-shimmer-bar" />
        </div>
      </div>
    </div>
  );
}

/**
 * PageSkeletonLoader
 * Fits cleanly inside the main page body while page data is loading or transitioning.
 */
export function PageSkeletonLoader() {
  return (
    <div className="space-y-6 animate-pulse" aria-hidden="true">
      {/* Top Header skeleton */}
      <div className="flex items-center justify-between pb-2 border-b border-border/40">
        <div className="space-y-2">
          <div className="h-6 w-44 rounded-md bg-secondary" />
          <div className="h-3 w-64 rounded bg-secondary/60" />
        </div>
        <div className="flex gap-2">
          <div className="h-8 w-24 rounded-lg bg-secondary" />
          <div className="h-8 w-28 rounded-lg bg-primary/20" />
        </div>
      </div>

      {/* KPI Cards skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-4 rounded-xl border border-border/60 bg-card/60 space-y-2">
            <div className="h-3 w-20 rounded bg-secondary/80" />
            <div className="h-7 w-28 rounded bg-secondary" />
            <div className="h-2 w-16 rounded bg-secondary/50" />
          </div>
        ))}
      </div>

      {/* Filters bar skeleton */}
      <div className="flex items-center gap-2 pt-1">
        <div className="h-8 w-60 rounded-lg bg-secondary/80" />
        <div className="h-8 w-24 rounded-lg bg-secondary/60" />
        <div className="h-8 w-24 rounded-lg bg-secondary/60" />
      </div>

      {/* Table skeleton */}
      <div className="border border-border rounded-xl bg-card overflow-hidden">
        <div className="h-10 bg-secondary/40 border-b border-border flex items-center px-4 gap-4">
          <div className="h-3.5 w-6 rounded bg-secondary" />
          <div className="h-3.5 w-32 rounded bg-secondary" />
          <div className="h-3.5 w-40 rounded bg-secondary" />
          <div className="h-3.5 w-20 rounded bg-secondary ml-auto" />
          <div className="h-3.5 w-24 rounded bg-secondary" />
        </div>
        <div className="divide-y divide-border/60">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-12 flex items-center px-4 gap-4">
              <div className="h-4 w-4 rounded bg-secondary/40" />
              <div className="h-4 w-28 rounded bg-secondary/60" />
              <div className="h-4 w-48 rounded bg-secondary/40" />
              <div className="h-4 w-16 rounded bg-secondary/50 ml-auto" />
              <div className="h-6 w-20 rounded-md bg-secondary/50" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
