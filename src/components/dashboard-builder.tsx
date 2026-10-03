'use client';
import {useState,useTransition} from 'react';
import {ArrowDown,ArrowUp,Check,Eye,EyeOff,GripVertical,LayoutGrid,RotateCcw,Save,Settings2,X} from 'lucide-react';
import {saveDashboardLayoutAction} from '@/app/actions';
import {defaultLayout,normalizeLayout,validWidgetIds,type DashboardPreference,type WidgetId,type WidgetSize} from '@/lib/dashboard-layout';
import type {ReactNode} from 'react';

type Widget={id:WidgetId;title:string;size:WidgetSize;content:ReactNode};
export default function DashboardBuilder({widgets,initial}:{widgets:Widget[];initial:DashboardPreference[]}){
 const [layout,setLayout]=useState(()=>normalizeLayout(initial));
 const [editing,setEditing]=useState(false);
 const [saving,startTransition]=useTransition();
 const [notice,setNotice]=useState('');
 const [dragged,setDragged]=useState<WidgetId|null>(null);
 const map=new Map(widgets.map(w=>[w.id,w]));
 const visibleCount=layout.filter(w=>w.visible).length;
 function reorder(source:WidgetId,target:WidgetId){
  if(source===target)return;
  setLayout(prev=>{const next=[...prev];const from=next.findIndex(x=>x.id===source);const to=next.findIndex(x=>x.id===target);if(from<0||to<0)return prev;next.splice(to,0,next.splice(from,1)[0]);return next;});
 }
 function move(id:WidgetId,delta:number){
  setLayout(prev=>{const next=[...prev];const idx=next.findIndex(x=>x.id===id);const nextIdx=idx+delta;if(idx<0||nextIdx<0||nextIdx>=next.length)return prev;[next[idx],next[nextIdx]]=[next[nextIdx],next[idx]];return next;});
 }
 function save(){startTransition(async()=>{try{const result=await saveDashboardLayoutAction(layout);setNotice(result.message);if(result.ok)setEditing(false);}catch{setNotice('Sambungan gagal. Periksa koneksi lalu ulangi.');}});}
 return <div className="builder-root">
  <div className="builder-toolbar"><div><LayoutGrid size={20}/><div><b>Dashboard personal</b><p>{visibleCount} widget tampil · susun sesuai kebutuhan</p></div></div><div className="builder-buttons">
   {editing?<><button type="button" onClick={()=>{setLayout(defaultLayout.map(x=>({...x})));setNotice('Susunan direset. Klik Simpan untuk menerapkan.');}} className="button secondary small"><RotateCcw size={16}/> Reset</button><button type="button" onClick={()=>setEditing(false)} className="button secondary small"><X size={16}/> Tutup</button><button type="button" disabled={saving} onClick={save} className="button primary small"><Save size={16}/> {saving?'Menyimpan…':'Simpan tata letak'}</button></>:<button type="button" onClick={()=>{setEditing(true);setNotice('');}} className="button secondary small"><Settings2 size={16}/> Atur widget</button>}
  </div></div>
  {notice&&<p className="builder-notice" role="status">{notice}</p>}
  {editing&&<section className="widget-palette" aria-label="Pengaturan visibilitas widget"><div><b>Tampilkan / sembunyikan</b><p>Seret widget pada area dashboard, atau gunakan tombol naik/turun. Tata letak disimpan per akun Developer.</p></div><div className="palette-items">{layout.map(row=>{const widget=map.get(row.id);if(!widget)return null;return <button type="button" key={row.id} className={'palette-chip '+(row.visible?'chosen':'')} onClick={()=>{if(row.visible&&visibleCount===1)return;setLayout(prev=>prev.map(item=>item.id===row.id?{...item,visible:!item.visible}:item));}}>{row.visible?<Eye size={15}/>:<EyeOff size={15}/>} {widget.title} {row.visible&&<Check size={13}/>}</button>})}</div></section>}
  <div className={'widget-grid '+(editing?'is-editing':'')}>
   {layout.filter(r=>r.visible).map(row=>{const w=map.get(row.id);if(!w)return null;return <section key={w.id} draggable={editing} onDragStart={e=>{setDragged(w.id);e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',w.id);}} onDragOver={e=>{if(editing)e.preventDefault();}} onDrop={e=>{e.preventDefault();const source=e.dataTransfer.getData('text/plain');if(validWidgetIds.has(source))reorder(source as WidgetId,w.id);setDragged(null);}} onDragEnd={()=>setDragged(null)} className={'widget-item widget-'+w.size+(dragged===w.id?' is-dragging':'')}>
    {editing&&<div className="widget-edit-head"><div><GripVertical size={16}/> <span>{w.title}</span></div><div><button title="Geser ke atas" aria-label={'Naikkan '+w.title} onClick={()=>move(w.id,-1)}><ArrowUp size={15}/></button><button title="Geser ke bawah" aria-label={'Turunkan '+w.title} onClick={()=>move(w.id,1)}><ArrowDown size={15}/></button><button title="Sembunyikan" aria-label={'Sembunyikan '+w.title} disabled={visibleCount===1} onClick={()=>{if(visibleCount>1)setLayout(prev=>prev.map(item=>item.id===w.id?{...item,visible:false}:item));}}><EyeOff size={15}/></button></div></div>}
    {w.content}
   </section>})}
  </div>
 </div>;
}
