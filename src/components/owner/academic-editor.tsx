'use client';
import {useActionState,useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {Pencil,Plus,Trash2} from 'lucide-react';
import {Modal} from '@/components/forms';
import {saveOwnerEntityAction,deleteOwnerEntityAction} from '@/app/owner-actions';
import {initialAction,type LearningEntity,type Tenant} from '@/lib/types';
import {academicFields,type Field} from '@/lib/owner/academic-config';
import type {Options} from '@/lib/owner/academic-repository';

function relationList(field:Field,options:Options,tenant:string,record:Record<string,unknown>){
 const list=field.rel==='teacher'?options.teachers:field.rel==='student'?options.students:
  field.rel==='classroom'?options.classes:field.rel==='subject'?options.subjects:options.assignments;
 return list.filter(row=>row.tenant_id===tenant).filter(row=>{
  if(field.rel==='student'&&record.classId)return 'class_id' in row&&row.class_id===record.classId;
  if(field.rel==='assignment'&&record.classId)return 'data' in row&&row.data.classId===record.classId;
  return true;
 }).map(row=>({id:row.id,name:'name' in row?row.name:String(row.data.name||row.data.title||row.id)}));
}
export function AcademicEditor({kind,tenants,options,record,defaultTenant}:{kind:string;tenants:Tenant[];options:Options;record?:LearningEntity;defaultTenant?:string}){
 const [open,setOpen]=useState(false);const [state,action,pending]=useActionState(saveOwnerEntityAction,initialAction);
 const [tenant,setTenant]=useState(record?.tenant_id||defaultTenant||'');const [formData,setFormData]=useState<Record<string,unknown>>(record?.data||{});
 const [currentOptions,setCurrentOptions]=useState(options),[loadingOptions,setLoadingOptions]=useState(false),[optionsError,setOptionsError]=useState('');
 async function loadTenant(next:string){setTenant(next);setOptionsError('');if(!next)return;setLoadingOptions(true);try{const response=await fetch('/api/owner/options?tenant='+encodeURIComponent(next),{cache:'no-store'});if(!response.ok)throw new Error('Gagal memuat pilihan terkait instansi.');setCurrentOptions(await response.json() as Options)}catch{setOptionsError('Gagal memuat pilihan. Tutup form lalu coba lagi.')}finally{setLoadingOptions(false)}}
 const router=useRouter();useEffect(()=>{if(state.ok){setOpen(false);router.refresh()}},[state.ok,router]);
 const fields=academicFields[kind]||[];
 const selected=(key:string)=>{const raw=String(formData[key]??'');if(key==='dueAt'&&/(Z|[+-]\d\d:\d\d)$/.test(raw)){const date=new Date(raw);return Number.isNaN(date.getTime())?'':new Date(date.getTime()+7*3600000).toISOString().slice(0,16)}return raw};
 return <><button type="button" className={'button '+(record?'secondary small':'primary')} onClick={()=>{setOpen(true);if(record?.tenant_id)void loadTenant(record.tenant_id);else if(defaultTenant)void loadTenant(defaultTenant)}}>{record?<><Pencil size={14}/> Ubah</>:<><Plus size={17}/> Tambah data</>}</button>
 {open&&<Modal title={record?'Ubah data '+kind:'Tambah data '+kind} sub="Pilih instansi dengan cermat. Setiap perubahan dicatat sebagai aktivitas Developer." onClose={()=>setOpen(false)}><form action={action} className="modal-body form-grid owner-form">
 <input type="hidden" name="id" value={record?.id||''}/><input type="hidden" name="kind" value={kind}/>
 <label className="field wide">Instansi<select name="tenant_id" disabled={!!record} value={tenant} required onChange={e=>{void loadTenant(e.target.value);setFormData({})}}><option value="">Pilih instansi</option>{tenants.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select>{record&&<input type="hidden" name="tenant_id" value={record.tenant_id}/>}</label>
 {fields.map(field=>{
  const optionsForField=field.type==='relation'?relationList(field,currentOptions,tenant,formData):field.choices;
  const content=field.type==='textarea'?<textarea name={'field_'+field.key} rows={4} maxLength={field.key==='content'?12000:4000} value={selected(field.key)} required={field.required} onChange={e=>setFormData(p=>({...p,[field.key]:e.target.value}))}/>:
   field.type==='relation'||field.type==='select'?<select name={'field_'+field.key} disabled={!tenant} value={selected(field.key)} required={field.required} onChange={e=>{const value=e.target.value;setFormData(p=>({...p,[field.key]:value,...(field.key==='classId'?{studentId:'',assignmentId:''}:{})}))}}><option value="">{field.required?'Pilih '+field.label:'Semua / tidak dipilih'}</option>{(optionsForField||[]).map(row=><option key={'id' in row?row.id:row.value} value={'id' in row?row.id:row.value}>{'name' in row?row.name:row.label}</option>)}</select>:
   <input name={'field_'+field.key} type={field.type||'text'} required={field.required} value={selected(field.key)} onChange={e=>setFormData(p=>({...p,[field.key]:e.target.value}))} min={field.type==='number'?'0':undefined} max={field.key==='score'||['fluency','tajwid','makhraj'].includes(field.key)?100:undefined}/>;
  return <label key={field.key} className={'field '+(field.type==='textarea'?'wide':'')}>{field.label}{content}</label>;
 })}
 {loadingOptions&&<div className="wide muted" role="status">Memuat referensi instansi…</div>}{optionsError&&<div className="wide form-alert error" role="alert">{optionsError}</div>}
 {state.message&&<div className={'form-alert wide '+(state.ok?'ok':'error')} role="status">{state.message}</div>}
 <div className="wide modal-footer"><button type="button" className="button secondary" onClick={()=>setOpen(false)}>Batal</button><button type="submit" className="button primary" disabled={!tenant||pending||loadingOptions||!!optionsError}>{pending?'Menyimpan…':'Simpan perubahan'}</button></div></form></Modal>}
 </>;
}
export function AcademicDelete({record}:{record:LearningEntity}){
 const [open,setOpen]=useState(false);const [state,action,pending]=useActionState(deleteOwnerEntityAction,initialAction);const router=useRouter();
 useEffect(()=>{if(state.ok){setOpen(false);router.refresh()}},[state.ok,router]);
 return <><button type="button" className="button secondary small owner-danger-link" onClick={()=>setOpen(true)} aria-label="Hapus data"><Trash2 size={14}/></button>{open&&<Modal title="Hapus data permanen?" sub="Penghapusan ditolak jika data masih digunakan kelas, siswa, tugas, atau riwayat lain." onClose={()=>setOpen(false)}><form action={action} className="modal-body"><input type="hidden" name="id" value={record.id}/><label className="field">Ketik HAPUS untuk melanjutkan<input autoComplete="off" name="confirmation" required placeholder="HAPUS"/></label>{state.message&&<div className="form-alert error" role="alert">{state.message}</div>}<div className="modal-footer"><button className="button secondary" type="button" onClick={()=>setOpen(false)}>Batal</button><button disabled={pending} type="submit" className="button destructive">{pending?'Menghapus…':'Hapus permanen'}</button></div></form></Modal>}</>;
}
