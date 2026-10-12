import type {ReactNode} from 'react';
import {Search,PackageOpen,Download,Plus} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {useFactory} from './provider';
export function Heading({title,children}:{title:string;children?:ReactNode}){return <div className="page-heading"><h1>{title}</h1><div className="heading-actions">{children}</div></div>;}
export function Empty({columns,label='No records yet'}:{columns:number;label?:string}){const {loading,error}=useFactory();return <tr><td colSpan={columns} className="empty-cell"><PackageOpen/>{loading?'Loading records…':error?'Records could not be loaded. Please try again.':label}</td></tr>;}
export function AccessNotice(){const {user,error,signIn,refresh}=useFactory();if(error)return <div className="notice error-notice">{error}<Button variant="ghost" size="sm" onClick={refresh}>Try again</Button></div>;return !user?<div className="notice flex justify-between items-center"><span>Sign in to access your factory records.</span><Button variant="ghost" size="sm" onClick={signIn}>Sign in</Button></div>:null;}
export function SearchFilter({value,onChange,placeholder='Search records…'}:{value:string;onChange:(v:string)=>void;placeholder?:string}){return <div className="filter-search"><Search/><input aria-label="Search records" placeholder={placeholder} value={value} onChange={e=>onChange(e.target.value)}/></div>;}
export function ExportButton({onClick}:{onClick:()=>void}){return <Button variant="outline" onClick={onClick}><Download/>Export</Button>;}
export function AddButton({onClick,children}:{onClick:()=>void;children:ReactNode}){return <Button onClick={onClick}><Plus/>{children}</Button>;}
export function Pill({value}:{value:string}){return <span className={'pill '+value}>{value==='Red'?'High':value==='Yellow'?'Medium':value==='Green'?'Low':value}</span>;}
