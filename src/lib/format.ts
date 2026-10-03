import type { Tenant } from '@/lib/types';
export const rupiah = (n:number)=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n || 0);
export const integer = (n:number)=>new Intl.NumberFormat('id-ID').format(n || 0);
export const date = (v?:string|null)=> v ? new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',day:'2-digit',month:'short',year:'numeric'}).format(new Date(v)) : '—';
export const datetime = (v?:string|null)=> v ? new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(v))+' WIB' : '—';
export function accessStatus(t:Pick<Tenant,'status'|'expires_at'>) {
 if(t.status === 'suspended')return {text:'Ditangguhkan',tone:'danger' as const};
 if(new Date(t.expires_at).getTime()<=Date.now())return {text:'Kedaluwarsa',tone:'warning' as const};
 return {text:'Aktif',tone:'success' as const};
}
export function toLocalDate(v?:string|null) {
 if(!v)return '';
 const d=new Date(new Date(v).getTime()-1000);
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);
 const part=(t:string)=>parts.find(p=>p.type===t)?.value||'';return `${part('year')}-${part('month')}-${part('day')}`;
}
/** expires_at is the EXCLUSIVE next-day midnight in Jakarta (the Flutter contract). */
export function endOfJakartaDay(day:string) {
 return new Date(Date.parse(day+'T00:00:00+07:00')+86400000).toISOString();
}
export const shortId = (value:string)=>value.length>8 ? value.slice(0,8)+'…':value;
