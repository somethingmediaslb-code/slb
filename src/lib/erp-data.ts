import type { Database } from '@/integrations/supabase/types';
export type Row<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export interface FactoryData { parties:Row<'party_master'>[]; catalog:Row<'item_master'>[]; orders:Row<'orders'>[]; items:Row<'order_items'>[]; workers:Row<'labour_master'>[]; allocations:Row<'production_allocations'>[]; challans:Row<'delivery_challans'>[]; challanItems:Row<'challan_items'>[]; expenses:Row<'expenses'>[]; borrowings:Row<'labour_borrowings'>[]; payroll:Row<'labour_payroll'>[]; notifications:Row<'factory_notifications'>[]; roles:Row<'user_roles'>[]; }
export const emptyData:FactoryData={parties:[],catalog:[],orders:[],items:[],workers:[],allocations:[],challans:[],challanItems:[],expenses:[],borrowings:[],payroll:[],notifications:[],roles:[]};
export const money=(n:number)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n);
export const number=(n:number)=>new Intl.NumberFormat('en-IN').format(n);
export const today=()=>new Date().toISOString().slice(0,10);
export const dateLabel=(value:string)=>new Date(value).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
export function finance(d:FactoryData) {
 const dispatched=d.challans.filter(c=>c.status==='Dispatched');
 const shared=d.expenses.filter(e=>!e.reference_dc_id).reduce((s,e)=>s+e.amount,0);
 const totalQty=d.challanItems.filter(i=>dispatched.some(c=>c.id===i.challan_id)).reduce((s,i)=>s+i.dispatched_qty,0);
 return dispatched.map(c=>{const lines=d.challanItems.filter(i=>i.challan_id===c.id); const qty=lines.reduce((s,i)=>s+i.dispatched_qty,0); const revenue=lines.reduce((s,i)=>s+i.dispatched_qty*(d.items.find(x=>x.id===i.order_item_id)?.unit_rate??0),0); const labour=lines.reduce((s,i)=>s+i.direct_labour_cost,0);const expenses=d.expenses.filter(e=>e.reference_dc_id===c.id).reduce((s,e)=>s+e.amount,0)+(totalQty?shared*qty/totalQty:0); const profit=revenue-labour-c.freight_charges-expenses;return {...c,qty,revenue,labour,expenses,profit,margin:revenue?profit/revenue*100:0};});
}
export function downloadCsv(name:string,rows:Record<string,unknown>[]){const keys=Object.keys(rows[0]??{});const text=[keys,...rows.map(r=>keys.map(k=>r[k]??''))].map(r=>r.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\n');const url=URL.createObjectURL(new Blob([text],{type:'text/csv'}));const a=document.createElement('a');a.href=url;a.download=name+'.csv';a.click();URL.revokeObjectURL(url);}
export function meta(title:string,description:string){return {meta:[{title:title+' — CrateERP'},{name:'description',content:description},{property:'og:title',content:title+' — CrateERP'},{property:'og:description',content:description},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]};}
