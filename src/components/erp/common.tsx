import { useState, useRef, useEffect, type ReactNode } from 'react';
import { Search, PackageOpen, Download, Plus, ChevronDown, ChevronLeft, ChevronRight, Calendar as CalendarIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useFactory } from './provider';

export function Heading({
  title,
  children
}:{
  title: string;
  children?: ReactNode;
}){
  return (
    <div className="page-heading">
      <div className="heading-title-group">
        <h1>{title}</h1>
      </div>
      <div className="heading-actions">{children}</div>
    </div>
  );
}

export function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
    </svg>
  );
}

export function Empty({columns,label='No records yet',asBlock}:{columns?:number;label?:string;asBlock?:boolean}){
  const {loading,error}=useFactory();
  const text = loading ? 'Loading records…' : error ? 'Records could not be loaded. Please try again.' : label;
  
  if (asBlock || columns === 1) {
    return (
      <div className="empty-cell py-8 text-center flex flex-col items-center justify-center gap-2 text-muted-foreground">
        <PackageOpen className="size-6 text-muted-foreground/60"/>
        <span className="text-xs">{text}</span>
      </div>
    );
  }

  return (
    <tr>
      <td colSpan={columns || 1} className="empty-cell">
        <PackageOpen/>
        {text}
      </td>
    </tr>
  );
}

export function AccessNotice(){
  const {error,refresh}=useFactory();
  if(error)return <div className="notice error-notice">{error}<Button variant="ghost" size="sm" onClick={refresh}>Try again</Button></div>;
  return null;
}

export function SearchFilter({
  value,
  onChange,
  placeholder = 'Search records…'
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="crm-search-pill group" onClick={() => inputRef.current?.focus()}>
      <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0 pointer-events-none transition-colors group-focus-within:text-primary" />
      <input
        ref={inputRef}
        type="search"
        inputMode="search"
        autoComplete="off"
        aria-label="Search records"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="crm-search-input"
      />
      {value && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onChange('');
            inputRef.current?.focus();
          }}
          className="filter-pill-clear-btn shrink-0"
          title="Clear search"
        >
          <X size={11} />
        </button>
      )}
    </div>
  );
}

export function ExportButton({onClick}:{onClick:()=>void}){
  return (
    <Button type="button" variant="outline" size="sm" onClick={onClick} className="gap-1.5 font-medium">
      <Download className="w-3.5 h-3.5" />
      <span>Export</span>
    </Button>
  );
}

export function AddButton({onClick,children}:{onClick:()=>void;children:ReactNode}){
  return (
    <Button type="button" variant="default" size="sm" onClick={onClick} className="gap-1.5 font-medium">
      <Plus className="w-3.5 h-3.5" />
      <span>{children}</span>
    </Button>
  );
}

export function Pill({ value, className }: { value: string; className?: string }) {
  const raw = value || '—';
  const normalized = raw === 'Amber' ? 'Yellow' : raw;
  const slug = normalized.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return (
    <span
      className={cn('pill', `pill-${slug}`, normalized, className)}
      data-status={normalized}
    >
      <span className="pill-dot" aria-hidden="true" />
      <span className="pill-text">{normalized}</span>
    </span>
  );
}

export function CrmTag({
  label,
  variant = 'neutral'
}:{
  label: string;
  variant?: 'blue' | 'green' | 'orange' | 'purple' | 'red' | 'neutral';
}){
  return <span className={`crm-tag ${variant}`}>{label}</span>;
}

export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

const TAB_STATUS_DOTS: Record<string, string> = {
  'Pending': 'bg-amber-500',
  'In Production': 'bg-blue-500',
  'Partially Dispatched': 'bg-purple-500',
  'Dispatched': 'bg-sky-500',
  'Completed': 'bg-emerald-500',
  'Cancelled': 'bg-rose-500',
  'Red': 'bg-red-500',
  'Yellow': 'bg-amber-500',
  'Green': 'bg-emerald-500',
  'ready': 'bg-emerald-500',
  'history': 'bg-sky-500',
};

export function ViewTabs({
  tabs,
  active,
  onChange
}:{
  tabs: (string | TabItem)[];
  active: string;
  onChange: (id: string) => void;
}){
  return (
    <div className="crm-tabs" role="tablist">
      {tabs.map(t => {
        const id = typeof t === 'string' ? t : t.id;
        const label = typeof t === 'string' ? t : t.label;
        const count = typeof t === 'string' ? undefined : t.count;
        const isSelected = active === id;
        const dotColor = TAB_STATUS_DOTS[id];
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={isSelected}
            data-state={isSelected ? "active" : "inactive"}
            className={`crm-tab ${isSelected ? 'active' : ''}`}
            onClick={() => onChange(id)}
          >
            {dotColor && <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotColor)} aria-hidden="true" />}
            <span>{label}</span>
            {count !== undefined && <span className="crm-tab-count">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function FilterToken({
  label,
  value,
  options,
  onChange,
  allValue = 'All'
}:{
  label: string;
  value: string;
  options: { value: string; label: string }[] | string[];
  onChange: (v: string) => void;
  allValue?: string;
}){
  const normalizedOptions = options.map(opt => typeof opt === 'string' ? { value: opt, label: opt } : opt);
  const currentOption = normalizedOptions.find(o => o.value === value);
  const displayLabel = currentOption ? currentOption.label : (value || allValue);
  const isActive = value !== allValue && value !== '' && !value.toLowerCase().startsWith('all');

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        size="sm"
        className={cn(
          "crm-filter-btn group",
          isActive && "crm-filter-btn-active is-active"
        )}
      >
        <div className="flex items-center gap-1.5 truncate pr-1">
          {isActive ? (
            <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" aria-hidden="true" />
          ) : (
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 shrink-0" aria-hidden="true" />
          )}
          <span className="crm-filter-label shrink-0">{label}:</span>
          <span className="crm-filter-value truncate max-w-[130px] sm:max-w-[160px]">
            {displayLabel}
          </span>
        </div>
      </SelectTrigger>
      <SelectContent align="start" className="min-w-[170px] rounded-lg shadow-xl border border-border">
        {normalizedOptions.map(opt => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export interface ThemedSelectOption {
  value: string;
  label: string;
}

export function ThemedSelect({
  value,
  defaultValue,
  onChange,
  options,
  placeholder = 'Select…',
  name,
  disabled,
  required,
  size = 'default',
  className,
  wrapperClassName,
  'aria-label': ariaLabel,
}: {
  value?: string;
  defaultValue?: string;
  onChange?: (val: string) => void;
  options: (ThemedSelectOption | string)[];
  placeholder?: string;
  name?: string;
  disabled?: boolean;
  required?: boolean;
  size?: 'sm' | 'default';
  className?: string;
  wrapperClassName?: string;
  'aria-label'?: string;
}) {
  const [internalVal, setInternalVal] = useState(defaultValue ?? value ?? '');
  const activeVal = value !== undefined ? value : internalVal;

  const normalizedOptions = options.map(opt =>
    typeof opt === 'string' ? { value: opt, label: opt } : opt
  );

  const handleValueChange = (val: string) => {
    setInternalVal(val);
    onChange?.(val);
  };

  return (
    <div className={cn("relative", wrapperClassName || "w-full")}>
      {name && <input type="hidden" name={name} value={activeVal} required={required} />}
      <Select
        value={activeVal || undefined}
        onValueChange={handleValueChange}
        disabled={disabled}
      >
        <SelectTrigger size={size} className={className} aria-label={ariaLabel}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent align="start">
          {normalizedOptions.map(opt => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export interface SegmentedControlOption {
  value: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export function SegmentedControl({
  value,
  onChange,
  options,
  className,
}: {
  value: string;
  onChange: (val: string) => void;
  options: SegmentedControlOption[];
  className?: string;
}) {
  return (
    <div className={cn("segmented-control", className)} role="group">
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            data-state={active ? "active" : "inactive"}
            className={cn("segmented-control-item", active && "active")}
            onClick={() => onChange(opt.value)}
          >
            {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function ThemedCalendar({
  value,
  onChange,
  onClose,
  minDate,
}: {
  value: string;
  onChange: (val: string) => void;
  onClose: () => void;
  minDate?: string;
}) {
  const today = new Date();
  const currentTodayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const minParts = minDate && minDate.includes('-') ? minDate.split('-').map(Number) : [];
  const hasMin = minParts.length >= 2 && !isNaN(minParts[0]!) && !isNaN(minParts[1]!);
  const minYear = hasMin ? minParts[0]! : 0;
  const minMonth = hasMin ? minParts[1]! - 1 : 0;

  const parts = value && value.includes('-') ? value.split('-') : [];
  const rawInitYear = parts.length >= 2 ? parseInt(parts[0] ?? String(today.getFullYear()), 10) : today.getFullYear();
  const rawInitMonth = parts.length >= 2 ? parseInt(parts[1] ?? '1', 10) - 1 : today.getMonth();

  const isInitPast = hasMin && (rawInitYear < minYear || (rawInitYear === minYear && rawInitMonth < minMonth));
  const initYear = isInitPast ? minYear : rawInitYear;
  const initMonth = isInitPast ? minMonth : rawInitMonth;

  const [viewYear, setViewYear] = useState(initYear);
  const [viewMonth, setViewMonth] = useState(initMonth);

  const isPrevMonthDisabled = hasMin && (viewYear < minYear || (viewYear === minYear && viewMonth <= minMonth));

  function prevMonth() {
    if (isPrevMonthDisabled) return;
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(y => y - 1);
    } else {
      setViewMonth(m => m - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(y => y + 1);
    } else {
      setViewMonth(m => m + 1);
    }
  }

  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
  const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  const prevMonthDays: number[] = [];
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    prevMonthDays.push(daysInPrevMonth - i);
  }

  const currentMonthDays: number[] = [];
  for (let i = 1; i <= daysInCurrentMonth; i++) {
    currentMonthDays.push(i);
  }

  const totalSlots = (prevMonthDays.length + currentMonthDays.length) > 35 ? 42 : 35;
  const nextMonthDaysCount = totalSlots - (prevMonthDays.length + currentMonthDays.length);
  const nextMonthDays: number[] = [];
  for (let i = 1; i <= nextMonthDaysCount; i++) {
    nextMonthDays.push(i);
  }

  const currentYear = today.getFullYear();
  const startYear = hasMin ? minYear : currentYear - 5;
  const endYear = currentYear + 10;
  const yearOptions: number[] = [];
  for (let y = startYear; y <= endYear; y++) {
    yearOptions.push(y);
  }

  return (
    <div className="crm-calendar-root" role="dialog" aria-label="Calendar">
      <div className="crm-calendar-header">
        <div className="flex items-center gap-1.5">
          <span className="crm-calendar-title font-medium">
            {MONTH_NAMES[viewMonth]}
          </span>
          <select
            value={viewYear}
            onChange={(e) => {
              const newY = Number(e.target.value);
              setViewYear(newY);
              if (hasMin && newY === minYear && viewMonth < minMonth) {
                setViewMonth(minMonth);
              }
            }}
            aria-label="Select year"
            className="text-xs font-semibold bg-secondary/80 hover:bg-secondary border border-border/80 text-foreground rounded px-1.5 py-0.5 cursor-pointer outline-none focus:ring-1 focus:ring-primary transition-colors"
          >
            {yearOptions.map(y => (
              <option key={y} value={y} className="bg-popover text-popover-foreground">
                {y}
              </option>
            ))}
          </select>
        </div>
        <div className="crm-calendar-nav">
          <button
            type="button"
            className="crm-calendar-nav-btn"
            onClick={prevMonth}
            disabled={isPrevMonthDisabled}
            aria-label="Previous month"
          >
            <ChevronLeft size={13} />
          </button>
          <button
            type="button"
            className="crm-calendar-nav-btn"
            onClick={nextMonth}
            aria-label="Next month"
          >
            <ChevronRight size={13} />
          </button>
        </div>
      </div>

      <div className="crm-calendar-weekdays">
        {WEEKDAYS.map(w => (
          <span key={w} className="crm-calendar-weekday">{w}</span>
        ))}
      </div>

      <div className="crm-calendar-grid">
        {prevMonthDays.map(d => (
          <span key={`prev-${d}`} className="crm-calendar-day outside">
            {d}
          </span>
        ))}

        {currentMonthDays.map(d => {
          const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const isSelected = value === dateStr;
          const isToday = currentTodayStr === dateStr;
          const isPast = minDate ? dateStr < minDate : false;

          return (
            <button
              key={`curr-${d}`}
              type="button"
              disabled={isPast}
              className={`crm-calendar-day ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''} ${isPast ? 'disabled' : ''}`}
              onClick={() => {
                if (isPast) return;
                onChange(dateStr);
                onClose();
              }}
            >
              {d}
            </button>
          );
        })}

        {nextMonthDays.map(d => (
          <span key={`next-${d}`} className="crm-calendar-day outside">
            {d}
          </span>
        ))}
      </div>

      <div className="crm-calendar-footer">
        <button
          type="button"
          className="crm-calendar-action-btn clear"
          onClick={() => {
            onChange('');
            onClose();
          }}
        >
          Clear
        </button>
        <button
          type="button"
          disabled={Boolean(minDate && currentTodayStr < minDate)}
          className="crm-calendar-action-btn today"
          onClick={() => {
            if (minDate && currentTodayStr < minDate) return;
            onChange(currentTodayStr);
            onClose();
          }}
        >
          Today
        </button>
      </div>
    </div>
  );
}

export function DateFilterPill({
  label,
  value,
  onChange,
  placeholder = 'All'
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const isActive = Boolean(value);

  let displayLabel = placeholder;
  if (value && value.includes('-')) {
    const parts = value.split('-').map(Number);
    const y = parts[0];
    const m = parts[1];
    const d = parts[2];
    if (y !== undefined && m !== undefined && d !== undefined && m >= 1 && m <= 12 && d >= 1) {
      displayLabel = `${MONTH_SHORT[m - 1]} ${d}, ${y}`;
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "crm-filter-btn group",
            isActive && "crm-filter-btn-active is-active"
          )}
          data-active={isActive ? "true" : "false"}
        >
          <div className="flex items-center gap-1.5 truncate">
            <CalendarIcon className={cn("w-3.5 h-3.5 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
            <span className="crm-filter-label shrink-0">{label}:</span>
            <span className="crm-filter-value truncate max-w-[120px] sm:max-w-[150px]">
              {displayLabel}
            </span>
          </div>

          {isActive ? (
            <span
              role="button"
              tabIndex={0}
              className="filter-pill-clear-btn ml-1 shrink-0"
              title="Clear date"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                  onChange('');
                }
              }}
            >
              <X size={11} />
            </span>
          ) : (
            <ChevronDown className="w-3.5 h-3.5 opacity-60 shrink-0 ml-1 group-hover:opacity-100 transition-opacity" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        collisionPadding={12}
        className="w-[264px] p-0 border border-border bg-card rounded-xl shadow-2xl text-foreground z-50 overflow-hidden"
      >
        <ThemedCalendar
          value={value}
          onChange={onChange}
          onClose={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}

export function ThemedDatePicker({
  value,
  onChange,
  name,
  defaultValue,
  placeholder = 'Select date…',
  required,
  disabled,
  className,
  'aria-label': ariaLabel,
  minDate,
  disablePast = true,
}: {
  value?: string;
  onChange?: (val: string) => void;
  name?: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
  minDate?: string;
  disablePast?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const now = new Date();
  const currentTodayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const effectiveMinDate = minDate !== undefined ? minDate : (disablePast ? currentTodayStr : undefined);

  const initialVal = defaultValue ?? '';
  const [internalVal, setInternalVal] = useState(initialVal);
  const activeVal = value !== undefined ? value : internalVal;

  useEffect(() => {
    if (effectiveMinDate && activeVal && activeVal < effectiveMinDate) {
      if (value === undefined) {
        setInternalVal(effectiveMinDate);
      }
      onChange?.(effectiveMinDate);
    }
  }, [effectiveMinDate]);

  let displayLabel = placeholder;
  if (activeVal && activeVal.includes('-')) {
    const parts = activeVal.split('-').map(Number);
    const y = parts[0];
    const m = parts[1];
    const d = parts[2];
    if (y !== undefined && m !== undefined && d !== undefined && m >= 1 && m <= 12 && d >= 1) {
      displayLabel = `${MONTH_SHORT[m - 1]} ${d}, ${y}`;
    }
  }

  const handleSelect = (val: string) => {
    setInternalVal(val);
    onChange?.(val);
  };

  return (
    <div className="relative w-full">
      {name && <input type="hidden" name={name} value={activeVal} required={required} />}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-label={ariaLabel || placeholder}
            className={cn(
              "flex h-[42px] sm:h-[38px] min-h-[42px] sm:min-h-[38px] w-full items-center justify-between rounded-lg border border-border bg-[var(--input-bg)] px-3 py-2 text-sm text-foreground shadow-sm hover:border-primary/50 dark:hover:border-[#484848] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary dark:focus:ring-ring dark:focus:ring-offset-1 dark:focus:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 transition-colors text-left",
              !activeVal && "text-muted-foreground",
              className
            )}
          >
            <span className="truncate">{displayLabel}</span>
            <CalendarIcon className="h-4 w-4 opacity-60 shrink-0 ml-2" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={6}
          collisionPadding={12}
          className="w-[264px] p-0 border border-border bg-card rounded-xl shadow-2xl text-foreground z-[9999] overflow-hidden"
        >
          <ThemedCalendar
            value={activeVal}
            onChange={handleSelect}
            onClose={() => setOpen(false)}
            minDate={effectiveMinDate}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

export interface StatPill {
  label: string;
  value: string | number;
}

export function TableCalcBar({
  count,
  entityName = 'records',
  stats = []
}:{
  count: number;
  entityName?: string;
  stats?: StatPill[];
}){
  return (
    <div className="crm-calc-grid">
      <div className="calc-grid-cell">
        <strong>{count}</strong>
        <span className="text-muted-foreground">{entityName} in view</span>
      </div>
      {stats.map((s, idx) => (
        <div key={idx} className="calc-grid-cell">
          <span className="text-muted-foreground">{s.label}:</span>
          <strong>{s.value}</strong>
        </div>
      ))}
    </div>
  );
}

export function SegmentedMeter({
  value,
  total = 100,
  segmentsCount = 14
}:{
  value: number;
  total?: number;
  segmentsCount?: number;
}){
  const pct = total > 0 ? Math.min(100, Math.max(0, Math.round((value / total) * 100))) : 0;
  const activeSegments = Math.round((pct / 100) * segmentsCount);

  return (
    <div className="segmented-meter-wrap" title={`${pct}% (${value}/${total})`}>
      <div role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} className="segmented-meter">
        {Array.from({ length: segmentsCount }).map((_, i) => {
          const isActive = i < activeSegments;
          let colorClass = '';
          if (isActive) {
            const ratio = i / segmentsCount;
            if (ratio < 0.3) colorClass = 'active-danger';
            else if (ratio < 0.7) colorClass = 'active-warning';
            else colorClass = 'active-success';
          }
          return <span key={i} className={`segmented-bar ${colorClass}`} />;
        })}
      </div>
      <span className="segmented-meter-pct">{pct}%</span>
    </div>
  );
}

export function MiniSparkline({
  bars = [4, 6, 8, 5, 3, 7, 9, 7, 10, 8, 11, 7, 6, 12]
}:{
  bars?: number[];
}){
  const max = Math.max(...bars, 1);
  return (
    <div className="sparkline-mini" aria-hidden="true">
      {bars.map((h, i) => {
        const heightPct = Math.round((h / max) * 12) + 2;
        const isMuted = i % 2 === 0;
        return (
          <span
            key={i}
            className={`sparkline-bar ${isMuted ? 'muted' : ''}`}
            style={{ height: `${heightPct}px` }}
          />
        );
      })}
    </div>
  );
}

export function MiniProgress({
  current,
  total,
  label
}:{
  current: number;
  total: number;
  label?: string;
}){
  return <SegmentedMeter value={current} total={total} />;
}

export function Pagination({
  currentPage,
  totalItems,
  pageSize = 10,
  onPageChange,
}:{
  currentPage: number;
  totalItems: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
}){
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const start = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = Math.min(totalItems, currentPage * pageSize);

  if (totalItems === 0) return null;

  return (
    <div className="crm-pagination">
      <span className="crm-pagination-info">
        Showing <strong>{start}–{end}</strong> of <strong>{totalItems}</strong>
      </span>
      <div className="crm-pagination-actions flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="w-3.5 h-3.5 mr-1" />
          <span>Previous</span>
        </Button>
        <span className="text-xs text-muted-foreground px-2">
          Page {currentPage} of {totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          aria-label="Next page"
        >
          <span>Next</span>
          <ChevronRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      </div>
    </div>
  );
}

export function clearModalSearchParams(navigate?: any) {
  if (typeof window === 'undefined') return;

  const url = new URL(window.location.href);
  let changed = false;
  ['new', 'view', 'add', 'edit', 'open'].forEach(param => {
    if (url.searchParams.has(param)) {
      url.searchParams.delete(param);
      changed = true;
    }
  });

  if (changed) {
    const cleanUrl = url.pathname + (url.search ? url.search : '');
    window.history.replaceState(null, '', cleanUrl);

    if (navigate) {
      try {
        navigate({
          to: url.pathname as any,
          search: (prev: any) => {
            if (!prev) return {};
            const next = { ...prev };
            delete next.new;
            delete next.view;
            delete next.add;
            delete next.edit;
            delete next.open;
            return next;
          },
          replace: true,
        });
      } catch {
        // safe fallback
      }
    }
  }
}

export function parseBoxDimensions(str?: string): { length: string; width: string; height: string; unit: string } {
  if (!str) return { length: '', width: '', height: '', unit: 'in' };
  let unit = 'in';
  let cleanStr = str.trim();

  const unitMatch = cleanStr.match(/\b(inches|inch|in|mm|cm|ft)\b/i);
  if (unitMatch) {
    const rawUnit = unitMatch[1]!.toLowerCase();
    if (rawUnit.startsWith('in')) unit = 'in';
    else if (rawUnit === 'mm') unit = 'mm';
    else if (rawUnit === 'cm') unit = 'cm';
    cleanStr = cleanStr.replace(unitMatch[0]!, '').trim();
  }

  const numbers = cleanStr.match(/\d+(?:\.\d+)?/g);
  if (numbers && numbers.length >= 3) {
    return {
      length: numbers[0] ?? '',
      width: numbers[1] ?? '',
      height: numbers[2] ?? '',
      unit
    };
  } else if (numbers && numbers.length === 2) {
    return {
      length: numbers[0] ?? '',
      width: numbers[1] ?? '',
      height: '',
      unit
    };
  } else if (numbers && numbers.length === 1) {
    return {
      length: numbers[0] ?? '',
      width: '',
      height: '',
      unit
    };
  }
  return { length: '', width: '', height: '', unit };
}

export function formatBoxDimensions(l: string, w: string, h: string, u: string): string {
  const cleanL = l.trim();
  const cleanW = w.trim();
  const cleanH = h.trim();
  if (!cleanL && !cleanW && !cleanH) return '';
  if (cleanL && cleanW && cleanH) {
    return `${cleanL} × ${cleanW} × ${cleanH} ${u}`;
  }
  return [cleanL, cleanW, cleanH].filter(Boolean).join(' × ') + (cleanL || cleanW || cleanH ? ` ${u}` : '');
}

export function BoxDimensionInput({
  value = '',
  onChange,
  name,
  required,
  label = 'Size Dimensions',
  className
}: {
  value?: string;
  onChange?: (val: string) => void;
  name?: string;
  required?: boolean;
  label?: string;
  className?: string;
}) {
  const parsed = parseBoxDimensions(value);
  const [length, setLength] = useState(parsed.length);
  const [width, setWidth] = useState(parsed.width);
  const [height, setHeight] = useState(parsed.height);
  const [unit, setUnit] = useState(parsed.unit);

  useEffect(() => {
    const current = formatBoxDimensions(length, width, height, unit);
    if (value !== current) {
      const p = parseBoxDimensions(value);
      setLength(p.length);
      setWidth(p.width);
      setHeight(p.height);
      setUnit(p.unit);
    }
  }, [value]);

  const update = (l: string, w: string, h: string, u: string) => {
    const formatted = formatBoxDimensions(l, w, h, u);
    onChange?.(formatted);
  };

  const handleNumberInput = (field: 'length' | 'width' | 'height', rawVal: string) => {
    const numbers = rawVal.match(/\d+(?:\.\d+)?/g);
    if (numbers && numbers.length >= 3) {
      const p = parseBoxDimensions(rawVal);
      const newL = p.length || numbers[0]!;
      const newW = p.width || numbers[1]!;
      const newH = p.height || numbers[2]!;
      const newU = p.unit || unit;
      setLength(newL);
      setWidth(newW);
      setHeight(newH);
      setUnit(newU);
      update(newL, newW, newH, newU);
      return;
    }

    let val = rawVal.replace(/[^0-9.]/g, '');
    const parts = val.split('.');
    if (parts.length > 2) {
      val = parts[0] + '.' + parts.slice(1).join('');
    }

    let newL = length;
    let newW = width;
    let newH = height;
    if (field === 'length') {
      newL = val;
      setLength(val);
    } else if (field === 'width') {
      newW = val;
      setWidth(val);
    } else if (field === 'height') {
      newH = val;
      setHeight(val);
    }

    update(newL, newW, newH, unit);
  };

  const handleUnitChange = (newUnit: string) => {
    setUnit(newUnit);
    update(length, width, height, newUnit);
  };

  const isComplete = Boolean(length.trim() && width.trim() && height.trim());
  const formattedPreview = isComplete ? `${length} × ${width} × ${height} ${unit}` : '';

  return (
    <div className={cn("w-full flex flex-col justify-end", className)}>
      {name && <input type="hidden" name={name} value={formattedPreview} required={required} />}
      <div className="flex items-center justify-between mb-1.5 min-h-[18px]">
        <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
          <span>{label}</span>
          <span className="text-[11px] text-muted-foreground font-normal">(L × W × H)</span>
        </span>
        {isComplete ? (
          <span className="inline-flex items-center text-[10.5px] font-mono font-medium text-primary px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20">
            {formattedPreview}
          </span>
        ) : (
          <span className="text-[10.5px] text-muted-foreground font-normal">
            Numbers only
          </span>
        )}
      </div>

      <div className="box-dimension-widget">
        <div className="dimension-sub-field">
          <span className="dimension-badge" title="Length">L</span>
          <input
            type="text"
            inputMode="decimal"
            pattern="[0-9]*\.?[0-9]*"
            value={length}
            placeholder="0"
            onChange={e => handleNumberInput('length', e.target.value)}
            required={required}
            aria-label="Box Length"
            className="dimension-num-input"
          />
        </div>
        <span className="dimension-sep" aria-hidden="true">×</span>
        <div className="dimension-sub-field">
          <span className="dimension-badge" title="Width">W</span>
          <input
            type="text"
            inputMode="decimal"
            pattern="[0-9]*\.?[0-9]*"
            value={width}
            placeholder="0"
            onChange={e => handleNumberInput('width', e.target.value)}
            required={required}
            aria-label="Box Width"
            className="dimension-num-input"
          />
        </div>
        <span className="dimension-sep" aria-hidden="true">×</span>
        <div className="dimension-sub-field">
          <span className="dimension-badge" title="Height">H</span>
          <input
            type="text"
            inputMode="decimal"
            pattern="[0-9]*\.?[0-9]*"
            value={height}
            placeholder="0"
            onChange={e => handleNumberInput('height', e.target.value)}
            required={required}
            aria-label="Box Height"
            className="dimension-num-input"
          />
        </div>
        <div className="dimension-unit-field">
          <select
            value={unit}
            onChange={e => handleUnitChange(e.target.value)}
            aria-label="Dimension unit"
            className="dimension-unit-select"
          >
            <option value="in">in</option>
            <option value="mm">mm</option>
            <option value="cm">cm</option>
          </select>
        </div>
      </div>
    </div>
  );
}


