'use client';
import {useActionState,useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {Pencil,Plus,Trash2} from 'lucide-react';
import {Modal} from '@/components/forms';
import {initialAction,type Profile,type Role,type Tenant} from '@/lib/types';
import {saveOwnerProfileAction,deleteOwnerProfileAction} from '@/app/owner-actions';
import type {Options} from '@/lib/owner/academic-repository';
const roleLabels:Record<Role,string>={developer:'Developer',leader:'Pimpinan',admin:'Admin',teacher:'Guru',student:'Siswa'};
export function UserEditor({user,tenants,options,defaultRole='student',defaultTenant}:{user?:Profile;tenants:Tenant[];options:Options;defaultRole?:Role;defaultTenant?:string}){
 const [open,setOpen]=useState(false),[role,setRole]=useState<Role>(user?.role||defaultRole),[tenant,setTenant]=useState(user?.tenant_id||defaultTenant||'');
 const [state,action,pending]=useActionState(saveOwnerProfileAction,initialAction);const router=useRouter();
 const [currentOptions,setCurrentOptions]=useState(options),[optionsError,setOptionsError]=useState('');
 async function chooseTenant(next:string){setTenant(next);setOptionsError('');if(!next)return;try{const response=await fetch('/api/owner/options?tenant='+encodeURIComponent(next),{cache:'no-store'});if(!response.ok)throw new Error();setCurrentOptions(await response.json() as Options)}catch{setOptionsError('Kelas instansi gagal dimuat. Coba pilih instansi kembali.')}}
 useEffect(()=>{if(state.ok){setOpen(false);router.refresh()}},[state.ok,router]);
 const classes=currentOptions.classes.filter(c=>c.tenant_id===tenant);
 return <><button className={'button '+(user?'secondary small':'primary')} onClick={()=>{setOpen(true);if(user?.tenant_id)void chooseTenant(user.tenant_id);else if(defaultTenant)void chooseTenant(defaultTenant)}} type="button">{user?<><Pencil size={14}/> Ubah</>:<><Plus size={16}/> Tambah akun</>}</button>
 {open&&<Modal title={user?'Ubah profil pengguna':'Buat akun baru'} sub="Role dan instansi diverifikasi ulang di backend. Akun baru dibuat di Supabase Auth." onClose={()=>setOpen(false)}><form action={action} className="modal-body form-grid owner-form">
 <input type="hidden" name="id" value={user?.id||''}/>
 <label className="field wide">Nama lengkap<input name="name" required maxLength={160} defaultValue={user?.name||''}/></label>
 <label className="field wide">Email<input name="email" required type="email" maxLength={254} defaultValue={user?.email||''} readOnly={!!user}/></label>
 <label className="field">Role<select name="role" value={role} onChange={e=>{setRole(e.target.value as Role);if(e.target.value==='developer')setTenant('')}}>{Object.entries(roleLabels).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
 <label className="field">Instansi<select name="tenant_id" required={role!=='developer'} value={tenant} disabled={role==='developer'} onChange={e=>void chooseTenant(e.target.value)}><option value="">{role==='developer'?'Platform':'Pilih instansi'}</option>{tenants.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
 {role==='student'&&<label className="field">Kelas<select name="class_id" defaultValue={user?.class_id||''} disabled={!tenant}><option value="">Belum memiliki kelas</option>{classes.map(c=><option key={c.id} value={c.id}>{String(c.data.name||c.id)}</option>)}</select></label>}
 <label className="field">Nomor induk / identitas<input name="number" maxLength={80} defaultValue={user?.number||''}/></label>
 <label className="field">Telepon<input name="phone" maxLength={40} defaultValue={user?.phone||''}/></label>
 <label className="field">Status<select name="active" defaultValue={user?.active===false?'false':'true'}><option value="true">Aktif</option><option value="false">Nonaktif</option></select></label>
 {!user&&<label className="field wide">Password awal<input required name="password" type="password" autoComplete="new-password" minLength={12} maxLength={72}/><span className="helper">Minimal 12 karakter. Berikan hanya melalui saluran aman.</span></label>}
 {optionsError&&<div role="alert" className="form-alert error wide">{optionsError}</div>}
 {state.message&&<div role="status" className={'form-alert wide '+(state.ok?'ok':'error')}>{state.message}</div>}
 <div className="modal-footer wide"><button type="button" className="button secondary" onClick={()=>setOpen(false)}>Batal</button><button type="submit" disabled={pending||!!optionsError||(role!=='developer'&&!tenant)} className="button primary">{pending?'Menyimpan…':'Simpan akun'}</button></div>
 </form></Modal>}</>;
}
export function UserDelete({user}:{user:Profile}){
 const [open,setOpen]=useState(false),[state,action,pending]=useActionState(deleteOwnerProfileAction,initialAction);const router=useRouter();
 useEffect(()=>{if(state.ok){setOpen(false);router.refresh()}},[state.ok,router]);
 return <><button type="button" className="button small secondary owner-danger-link" aria-label={'Hapus '+user.name} onClick={()=>setOpen(true)}><Trash2 size={14}/></button>{open&&<Modal title={'Hapus '+user.name+'?'} sub="Jika pengguna memiliki riwayat belajar, tagihan atau transaksi, nonaktifkan daripada menghapus." onClose={()=>setOpen(false)}><form action={action} className="modal-body"><input type="hidden" name="id" value={user.id}/><label className="field">Ketik HAPUS untuk konfirmasi<input name="confirmation" autoComplete="off" required placeholder="HAPUS"/></label>{state.message&&<p role="alert" className="form-alert error">{state.message}</p>}<div className="modal-footer"><button className="button secondary" type="button" onClick={()=>setOpen(false)}>Batal</button><button disabled={pending} className="button destructive" type="submit">{pending?'Menghapus…':'Hapus akun'}</button></div></form></Modal>}</>;
}
