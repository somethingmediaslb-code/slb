import { useState, type ReactNode } from 'react';
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

export function Empty({columns,label='No records yet'}:{columns:number;label?:string}){
  const {loading,error}=useFactory();
  return (
    <tr>
      <td colSpan={columns} className="empty-cell">
        <PackageOpen/>
        {loading?'Loading records…':error?'Records could not be loaded. Please try again.':label}
      </td>
    </tr>
  );
}

export function AccessNotice(){
  const {error,refresh}=useFactory();
  if(error)return <div className="notice error-notice">{error}<Button variant="ghost" size="sm" onClick={refresh}>Try again</Button></div>;
  return null;
}

export function SearchFilter({value,onChange,placeholder='Search records…'}:{value:string;onChange:(v:string)=>void;placeholder?:string}){
  return (
    <div className="crm-search-pill">
      <Search className="size-3 text-muted-foreground shrink-0"/>
      <input aria-label="Search records" placeholder={placeholder} value={value} onChange={e=>onChange(e.target.value)}/>
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

export function Pill({value}:{value:string}){
  const normalized = value === 'Amber' ? 'Yellow' : value;
  return <span className={'pill '+normalized}>{normalized}</span>;
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
        className={`segmented-filter-pill group ${isActive ? 'is-active' : ''} border-0 bg-secondary text-secondary-foreground shadow-sm h-8 px-0`}
      >
        <span className="filter-pill-label">{label}</span>
        <span className="filter-pill-divider" aria-hidden="true" />
        <div className="filter-pill-select-wrapper">
          <span className="filter-pill-value">
            <span className="truncate max-w-[140px]">{displayLabel}</span>
          </span>
        </div>
      </SelectTrigger>
      <SelectContent align="start" className="min-w-[160px]">
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
    <div className="relative w-full">
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
}: {
  value: string;
  onChange: (val: string) => void;
  onClose: () => void;
}) {
  const today = new Date();
  const currentTodayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const parts = value && value.includes('-') ? value.split('-') : [];
  const initialDate = parts.length >= 2
    ? {
        year: parseInt(parts[0] ?? String(today.getFullYear()), 10),
        month: parseInt(parts[1] ?? '1', 10) - 1,
      }
    : {
        year: today.getFullYear(),
        month: today.getMonth(),
      };

  const [viewYear, setViewYear] = useState(initialDate.year);
  const [viewMonth, setViewMonth] = useState(initialDate.month);

  function prevMonth() {
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

  return (
    <div className="crm-calendar-root" role="dialog" aria-label="Calendar">
      <div className="crm-calendar-header">
        <span className="crm-calendar-title">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <div className="crm-calendar-nav">
          <button
            type="button"
            className="crm-calendar-nav-btn"
            onClick={prevMonth}
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

          return (
            <button
              key={`curr-${d}`}
              type="button"
              className={`crm-calendar-day ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
              onClick={() => {
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
          className="crm-calendar-action-btn today"
          onClick={() => {
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
          className={`segmented-filter-pill group ${isActive ? 'is-active' : ''}`}
          data-active={isActive ? "true" : "false"}
        >
          <span className="filter-pill-label">{label}</span>
          <span className="filter-pill-divider" aria-hidden="true" />
          <div className="filter-pill-select-wrapper">
            <span className="filter-pill-value">
              <span className="truncate max-w-[120px]">{displayLabel}</span>
              {isActive ? (
                <span
                  role="button"
                  tabIndex={0}
                  className="filter-pill-clear-btn ml-1"
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
                <CalendarIcon className="filter-pill-chevron" />
              )}
            </span>
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
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
}) {
  const [open, setOpen] = useState(false);
  const [internalVal, setInternalVal] = useState(defaultValue ?? '');
  const activeVal = value !== undefined ? value : internalVal;

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
              "flex h-[38px] min-h-[38px] w-full items-center justify-between rounded-lg border border-border bg-[var(--input-bg)] px-3 py-2 text-sm text-foreground shadow-sm hover:border-primary/50 dark:hover:border-[#484848] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary dark:focus:ring-ring dark:focus:ring-offset-1 dark:focus:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 transition-colors text-left",
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
          className="w-[264px] p-0 border border-border bg-card rounded-xl shadow-2xl text-foreground z-[9999] overflow-hidden"
        >
          <ThemedCalendar
            value={activeVal}
            onChange={handleSelect}
            onClose={() => setOpen(false)}
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

