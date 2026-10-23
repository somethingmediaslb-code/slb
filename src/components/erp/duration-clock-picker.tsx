import { useMemo } from 'react';
import { Clock, ChevronUp, ChevronDown, Zap, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DurationClockPickerProps {
  hours: number;
  minutes: number;
  seconds: number;
  onChange: (hours: number, minutes: number, seconds: number) => void;
  startTime: string;
}

const PRESETS = [
  { label: '30s (Test)', h: 0, m: 0, s: 30, icon: Zap },
  { label: '1m', h: 0, m: 1, s: 0, icon: Zap },
  { label: '5m', h: 0, m: 5, s: 0, icon: Timer },
  { label: '15m', h: 0, m: 15, s: 0, icon: Timer },
  { label: '30m', h: 0, m: 30, s: 0, icon: Timer },
  { label: '1h', h: 1, m: 0, s: 0, icon: Clock },
  { label: '2h', h: 2, m: 0, s: 0, icon: Clock },
  { label: '4h', h: 4, m: 0, s: 0, icon: Clock },
  { label: '8h', h: 8, m: 0, s: 0, icon: Clock },
];

export function DurationClockPicker({
  hours,
  minutes,
  seconds,
  onChange,
  startTime,
}: DurationClockPickerProps) {
  const totalSeconds = useMemo(() => {
    return Math.max(1, (hours * 3600) + (minutes * 60) + seconds);
  }, [hours, minutes, seconds]);

  const completionDate = useMemo(() => {
    const base = startTime ? new Date(startTime).getTime() : Date.now();
    return new Date(base + totalSeconds * 1000);
  }, [startTime, totalSeconds]);

  const clamp = (val: number, min: number, max: number) => Math.min(max, Math.max(min, val));

  const updateHours = (newH: number) => {
    onChange(clamp(newH, 0, 24), minutes, seconds);
  };

  const updateMinutes = (newM: number) => {
    let nextM = newM;
    let nextH = hours;
    if (nextM >= 60) {
      nextM = 0;
      nextH = Math.min(24, nextH + 1);
    } else if (nextM < 0) {
      nextM = 59;
      nextH = Math.max(0, nextH - 1);
    }
    onChange(nextH, nextM, seconds);
  };

  const updateSeconds = (newS: number) => {
    let nextS = newS;
    let nextM = minutes;
    let nextH = hours;
    if (nextS >= 60) {
      nextS = 0;
      if (nextM + 1 >= 60) {
        nextM = 0;
        nextH = Math.min(24, nextH + 1);
      } else {
        nextM += 1;
      }
    } else if (nextS < 0) {
      nextS = 59;
      if (nextM - 1 < 0) {
        if (nextH > 0) {
          nextH -= 1;
          nextM = 59;
        } else {
          nextS = 0;
        }
      } else {
        nextM -= 1;
      }
    }
    onChange(nextH, nextM, nextS);
  };

  const formatSummary = () => {
    const parts: string[] = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
    return parts.join(' ');
  };

  return (
    <div className="space-y-3">
      {/* Label and Duration Readout */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-primary" />
          <span>Estimated Production Duration</span>
        </label>
        <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
          {formatSummary()} ({totalSeconds}s)
        </span>
      </div>

      {/* Quick Presets */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] text-muted-foreground mr-1">Presets:</span>
        {PRESETS.map((p) => {
          const isActive = hours === p.h && minutes === p.m && seconds === p.s;
          const Icon = p.icon;
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => onChange(p.h, p.m, p.s)}
              className={cn(
                'inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-xs ring-1 ring-primary'
                  : 'bg-secondary/70 hover:bg-secondary text-foreground/80 hover:text-foreground border border-border/60'
              )}
            >
              <Icon className="w-3 h-3" />
              <span>{p.label}</span>
            </button>
          );
        })}
      </div>

      {/* Digital Clock Stepper Container */}
      <div className="p-3.5 bg-gradient-to-b from-secondary/40 to-secondary/20 dark:from-secondary/30 dark:to-background border border-border/90 rounded-2xl shadow-xs">
        <div className="flex items-center justify-center gap-3 sm:gap-4 select-none py-1">
          {/* HOURS */}
          <div className="flex flex-col items-center">
            <button
              type="button"
              aria-label="Increase hours"
              onClick={() => updateHours(hours + 1)}
              className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <input
              type="number"
              min={0}
              max={24}
              value={hours}
              onChange={(e) => updateHours(parseInt(e.target.value, 10) || 0)}
              className="w-14 sm:w-16 h-12 text-center text-xl sm:text-2xl font-mono font-bold bg-background/90 border border-border rounded-xl shadow-inner text-foreground focus:ring-2 focus:ring-primary focus:border-primary outline-none"
            />
            <button
              type="button"
              aria-label="Decrease hours"
              onClick={() => updateHours(hours - 1)}
              className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-0.5">
              Hours
            </span>
          </div>

          <span className="text-2xl font-bold font-mono text-muted-foreground/50 pb-5 animate-pulse">:</span>

          {/* MINUTES */}
          <div className="flex flex-col items-center">
            <button
              type="button"
              aria-label="Increase minutes"
              onClick={() => updateMinutes(minutes + 1)}
              className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <input
              type="number"
              min={0}
              max={59}
              value={minutes}
              onChange={(e) => updateMinutes(parseInt(e.target.value, 10) || 0)}
              className="w-14 sm:w-16 h-12 text-center text-xl sm:text-2xl font-mono font-bold bg-background/90 border border-border rounded-xl shadow-inner text-foreground focus:ring-2 focus:ring-primary focus:border-primary outline-none"
            />
            <button
              type="button"
              aria-label="Decrease minutes"
              onClick={() => updateMinutes(minutes - 1)}
              className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-0.5">
              Minutes
            </span>
          </div>

          <span className="text-2xl font-bold font-mono text-muted-foreground/50 pb-5 animate-pulse">:</span>

          {/* SECONDS */}
          <div className="flex flex-col items-center">
            <button
              type="button"
              aria-label="Increase seconds"
              onClick={() => updateSeconds(seconds + 1)}
              className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <input
              type="number"
              min={0}
              max={59}
              value={seconds}
              onChange={(e) => updateSeconds(parseInt(e.target.value, 10) || 0)}
              className="w-14 sm:w-16 h-12 text-center text-xl sm:text-2xl font-mono font-bold bg-background/90 border border-border rounded-xl shadow-inner text-primary font-bold focus:ring-2 focus:ring-primary focus:border-primary outline-none"
            />
            <button
              type="button"
              aria-label="Decrease seconds"
              onClick={() => updateSeconds(seconds - 1)}
              className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
            <span className="text-[10px] font-semibold text-primary uppercase tracking-wider mt-0.5">
              Seconds
            </span>
          </div>
        </div>

        {/* Live Completion Target Preview */}
        <div className="mt-2.5 pt-2 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground px-1">
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
            Auto-completes at:
          </span>
          <strong className="text-foreground font-mono">
            {completionDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}, {completionDate.toLocaleDateString([], { month: 'short', day: 'numeric' })}
          </strong>
        </div>
      </div>
    </div>
  );
}
