'use client';
import {useActionState,useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {Archive,ArchiveRestore,Pencil,Plus,ShieldCheck,Trash2} from 'lucide-react';
import {Modal} from '@/components/forms';
import {initialAction,type Invoice,type Payment,type Tenant} from '@/lib/types';
import {saveOwnerInvoiceAction,deleteOwnerInvoiceAction,archiveOwnerInvoiceAction,reviewOwnerPaymentAction} from '@/app/owner-actions';
import type {Options} from '@/lib/owner/academic-repository';
export function InvoiceEditor({invoice,tenants,options,defaultTenant}:{invoice?:Invoice;tenants:Tenant[];options:Options;defaultTenant?:string}){
 const [open,setOpen]=useState(false),[tenant,setTenant]=useState(invoice?.tenant_id||defaultTenant||'');
 const [state,action,pending]=useActionState(saveOwnerInvoiceAction,initialAction);const router=useRouter();
 const [currentOptions,setCurrentOptions]=useState(options),[optionsError,setOptionsError]=useState('');
 async function chooseTenant(next:string){setTenant(next);setOptionsError('');if(!next)return;try{const response=await fetch('/api/owner/options?tenant='+encodeURIComponent(next),{cache:'no-store'});if(!response.ok)throw new Error();setCurrentOptions(await response.json() as Options)}catch{setOptionsError('Daftar siswa gagal dimuat. Coba pilih instansi lagi.')}}
 useEffect(()=>{if(state.ok){setOpen(false);router.refresh()}},[state.ok,router]);
 const students=currentOptions.students.filter(s=>s.tenant_id===tenant);
 return <><button className={'button '+(invoice?'secondary small':'primary')} type="button" onClick={()=>{setOpen(true);if(invoice?.tenant_id)void chooseTenant(invoice.tenant_id);else if(defaultTenant)void chooseTenant(defaultTenant)}}>{invoice?<><Pencil size={14}/> Ubah</>:<><Plus size={16}/> Buat tagihan</>}</button>
 {open&&<Modal title={invoice?'Ubah tagihan':'Buat tagihan SPP'} sub="Tagihan yang memiliki transaksi tidak dapat diubah atau dihapus." onClose={()=>setOpen(false)}><form action={action} className="modal-body form-grid owner-form"><input type="hidden" name="id" value={invoice?.id||''}/>
 <label className="field">Instansi<select name="tenant_id" required value={tenant} disabled={!!invoice} onChange={e=>void chooseTenant(e.target.value)}><option value="">Pilih instansi</option>{tenants.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select>{invoice&&<input type="hidden" name="tenant_id" value={invoice.tenant_id}/>}</label>
 <label className="field">Siswa<select name="student_id" required defaultValue={invoice?.student_id||''} disabled={!!invoice||!tenant}><option value="">Pilih siswa</option>{students.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>{invoice&&<input type="hidden" name="student_id" value={invoice.student_id}/>}</label>
 <label className="field wide">Jenis tagihan<input name="title" required maxLength={160} defaultValue={invoice?.title||''} placeholder="SPP bulanan"/></label>
 <label className="field">Periode<input required name="period" maxLength={60} defaultValue={invoice?.period||''} placeholder="Oktober 2026"/></label>
 <label className="field">Nominal (Rp)<input type="number" required name="amount" min={1} max={1000000000} defaultValue={invoice?.amount||''}/></label>
 <label className="field">Jatuh tempo<input name="due_date" required type="date" defaultValue={invoice?.due_date||''}/></label>
 <label className="field">Cicilan<select name="allow_partial" defaultValue={invoice?.allow_partial===false?'false':'true'}><option value="true">Diizinkan</option><option value="false">Tidak</option></select></label>
 <label className="field">Status<select name="archived" defaultValue={invoice?.archived?'true':'false'}><option value="false">Aktif</option><option value="true">Diarsipkan</option></select></label>
 {optionsError&&<div role="alert" className="form-alert error wide">{optionsError}</div>}
 {state.message&&<div role="status" className={'form-alert wide '+(state.ok?'ok':'error')}>{state.message}</div>}
 <div className="modal-footer wide"><button type="button" className="button secondary" onClick={()=>setOpen(false)}>Batal</button><button disabled={pending||!!optionsError||!tenant} type="submit" className="button primary">{pending?'Menyimpan…':'Simpan tagihan'}</button></div></form></Modal>}</>;
}
export function InvoiceDelete({invoice}:{invoice:Invoice}){
 const [open,setOpen]=useState(false),[state,action,pending]=useActionState(deleteOwnerInvoiceAction,initialAction);const router=useRouter();
 useEffect(()=>{if(state.ok){setOpen(false);router.refresh()}},[state.ok,router]);
 return <><button aria-label="Hapus tagihan" className="button secondary small owner-danger-link" type="button" onClick={()=>setOpen(true)}><Trash2 size={14}/></button>{open&&<Modal title="Hapus tagihan?" sub="Sistem akan menolak penghapusan tagihan dengan transaksi." onClose={()=>setOpen(false)}><form className="modal-body" action={action}><input name="id" type="hidden" value={invoice.id}/><label className="field">Ketik HAPUS<input name="confirmation" required autoComplete="off"/></label>{state.message&&<p className="form-alert error" role="alert">{state.message}</p>}<div className="modal-footer"><button className="button secondary" type="button" onClick={()=>setOpen(false)}>Batal</button><button className="button destructive" disabled={pending} type="submit">Hapus</button></div></form></Modal>}</>;
}
export function InvoiceArchive({invoice}:{invoice:Invoice}){
 const [open,setOpen]=useState(false),[state,action,pending]=useActionState(archiveOwnerInvoiceAction,initialAction);const router=useRouter();
 useEffect(()=>{if(state.ok){setOpen(false);router.refresh()}},[state.ok,router]);
 return <><button type="button" className="button secondary small" aria-label={invoice.archived?'Aktifkan tagihan':'Arsipkan tagihan'} onClick={()=>setOpen(true)}>{invoice.archived?<ArchiveRestore size={14}/>:<Archive size={14}/>}</button>
 {open&&<Modal title={invoice.archived?'Aktifkan kembali tagihan?':'Arsipkan tagihan?'} sub="Pengarsipan aman untuk tagihan yang sudah mempunyai riwayat pembayaran; transaksi tidak dihapus." onClose={()=>setOpen(false)}><form action={action} className="modal-body"><input type="hidden" name="id" value={invoice.id}/><label className="field">Ketik ARSIP untuk konfirmasi<input required name="confirmation" autoComplete="off" placeholder="ARSIP"/></label>{state.message&&<p className={'form-alert '+(state.ok?'ok':'error')} role="status">{state.message}</p>}<div className="modal-footer"><button type="button" className="button secondary" onClick={()=>setOpen(false)}>Batal</button><button type="submit" disabled={pending} className="button primary">{pending?'Memproses…':invoice.archived?'Aktifkan tagihan':'Arsipkan tagihan'}</button></div></form></Modal>}</>;
}
export function PaymentReview({payment}:{payment:Payment}){
 const [open,setOpen]=useState(false),[state,action,pending]=useActionState(reviewOwnerPaymentAction,initialAction);const [status,setStatus]=useState('matched');const router=useRouter();
 useEffect(()=>{if(state.ok){setOpen(false);router.refresh()}},[state.ok,router]);
 return <><button className="button secondary small" type="button" onClick={()=>setOpen(true)}><ShieldCheck size={14}/> Review</button>{open&&<Modal title="Verifikasi QRIS manual" sub="Cocokkan dana dengan mutasi bank sebelum memilih Terverifikasi. Keputusan dicatat pada audit." onClose={()=>setOpen(false)}><form action={action} className="modal-body"><input name="id" type="hidden" value={payment.id}/><label className="field">Keputusan<select name="status" value={status} onChange={e=>setStatus(e.target.value)}><option value="matched">Terverifikasi (cocok dengan bank)</option><option value="disputed">Disengketakan</option></select></label>{status==='matched'&&<label className="field">Nomor referensi mutasi bank<input name="bank_reference" maxLength={160} required/></label>}<label className="field">Catatan pemeriksaan<textarea name="note" rows={3} minLength={4} maxLength={500} required/></label>{state.message&&<p className={'form-alert '+(state.ok?'ok':'error')} role="status">{state.message}</p>}<div className="modal-footer"><button type="button" className="button secondary" onClick={()=>setOpen(false)}>Batal</button><button type="submit" disabled={pending} className="button primary">{pending?'Memproses…':'Simpan review'}</button></div></form></Modal>}</>;
}
