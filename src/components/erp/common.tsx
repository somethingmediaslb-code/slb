import type {ReactNode} from 'react';
import {Search,PackageOpen,Download,Plus,ChevronDown} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {useFactory} from './provider';

export function Heading({
  title,
  badge = 'Active',
  children
}:{
  title: string;
  badge?: string;
  children?: ReactNode;
}){
  return (
    <div className="page-heading">
      <div className="heading-title-group">
        <h1>{title}</h1>
        {badge && (
          <span className="live-status-pill">
            <span className="live-status-dot" />
            {badge}
          </span>
        )}
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
  const {user,error,signIn,refresh}=useFactory();
  if(error)return <div className="notice error-notice">{error}<Button variant="ghost" size="sm" onClick={refresh}>Try again</Button></div>;
  return !user?<div className="notice flex justify-between items-center"><span>Sign in to access your factory records.</span><Button variant="ghost" size="sm" onClick={signIn}>Sign in</Button></div>:null;
}

export function SearchFilter({value,onChange,placeholder='Search records…'}:{value:string;onChange:(v:string)=>void;placeholder?:string}){
  return (
    <div className="crm-search-pill">
      <Search className="size-3 text-muted-foreground"/>
      <input aria-label="Search records" placeholder={placeholder} value={value} onChange={e=>onChange(e.target.value)}/>
    </div>
  );
}

export function ExportButton({onClick}:{onClick:()=>void}){
  return (
    <button type="button" className="crm-btn crm-btn-secondary" onClick={onClick}>
      <Download className="size-3" />
      <span>Export</span>
    </button>
  );
}

export function AddButton({onClick,children}:{onClick:()=>void;children:ReactNode}){
  return (
    <button type="button" className="crm-btn crm-btn-primary" onClick={onClick}>
      <Plus className="size-3" />
      <span>{children}</span>
    </button>
  );
}

export function Pill({value}:{value:string}){
  return <span className={'pill '+value}>{value==='Red'?'High':value==='Yellow'?'Medium':value==='Green'?'Low':value}</span>;
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
    <div className={`segmented-filter-pill ${isActive ? 'is-active' : ''}`}>
      <span className="filter-pill-label">{label}</span>
      <span className="filter-pill-divider" aria-hidden="true" />
      <div className="filter-pill-select-wrapper">
        <span className="filter-pill-value">
          {displayLabel}
          <ChevronDown className="filter-pill-chevron" />
        </span>
        <select
          aria-label={label}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="filter-pill-native-select"
        >
          {normalizedOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
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
