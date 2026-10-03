import Link from 'next/link';
import type {ReactNode} from 'react';
import {ArrowRight,Inbox} from 'lucide-react';
export function PageHead({overline,title,description,actions}:{overline:string,title:string,description:string,actions?:ReactNode}){
 return <div className="page-heading"><div><p className="eyebrow">{overline}</p><h1>{title}</h1><p className="page-description">{description}</p></div>{actions&&<div className="page-actions">{actions}</div>}</div>;
}
export function Pill({text,tone='neutral'}:{text:string,tone?:'success'|'danger'|'warning'|'info'|'neutral'}){return <span className={'pill '+tone}><span className="pill-dot"/>{text}</span>}
export function Stat({label,value,detail,icon,trend}:{label:string,value:ReactNode,detail?:string,icon:ReactNode,trend?:ReactNode}){
 return <article className="stat-card"><div className="stat-top"><span className="stat-label">{label}</span><span className="stat-icon">{icon}</span></div><div className="stat-value">{value}</div><div className="stat-bottom">{trend}{detail&&<span>{detail}</span>}</div></article>;
}
export function Surface({title,subtitle,action,children}:{title:string,subtitle?:string,action?:{label:string,href:string},children:ReactNode}){
 return <section className="surface"><div className="surface-heading"><div><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div>{action&&<Link href={action.href} className="surface-link">{action.label} <ArrowRight size={16}/></Link>}</div>{children}</section>;
}
export function Empty({text='Belum ada data untuk ditampilkan.'}:{text?:string}){return <div className="empty"><div className="empty-icon"><Inbox size={25}/></div><b>Tidak ada data</b><p>{text}</p></div>}
export function Pager({base,page,count,pageSize=20,filters}:{base:string,page:number,count:number,pageSize?:number,filters?:Record<string,string|undefined>}){
 const max=Math.max(1,Math.ceil(count/pageSize));
 const url=(p:number)=>{const q=new URLSearchParams();for(const [key,val] of Object.entries(filters||{})){if(val)q.set(key,val)}q.set('page',String(p));return `${base}?${q}`};
 return <div className="pager"><span>Halaman {page} dari {max} · {count.toLocaleString('id-ID')} data</span><div><Link aria-disabled={page<=1} className={'pager-arrow '+(page<=1?'disabled':'')} href={url(Math.max(1,page-1))}>← Sebelumnya</Link><Link aria-disabled={page>=max} className={'pager-arrow '+(page>=max?'disabled':'')} href={url(Math.min(max,page+1))}>Berikutnya →</Link></div></div>;
}
export function FilterBar({action,query,children,placeholder='Cari data...',hideSearch=false}:{action:string,query?:string,children?:ReactNode,placeholder?:string,hideSearch?:boolean}){
 return <form className="filter-bar" action={action}>{!hideSearch&&<div className="filter-search"><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/></svg><input name="q" defaultValue={query} placeholder={placeholder} /></div>}{children}<button type="submit" className="button secondary">Terapkan</button></form>;
}
export function TenantSelect({value,tenants}:{value?:string,tenants:{id:string,name:string}[]}){
 return <select aria-label="Filter instansi" name="tenant" defaultValue={value||''}><option value="">Semua instansi</option>{tenants.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select>;
}
