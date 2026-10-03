'use client';
import {useActionState,useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {Trash2} from 'lucide-react';
import {Modal} from '@/components/forms';
import {initialAction,type Tenant} from '@/lib/types';
import {deleteOwnerTenantAction} from '@/app/owner-actions';
export default function TenantDelete({tenant}:{tenant:Tenant}){
 const [open,setOpen]=useState(false);const [state,action,pending]=useActionState(deleteOwnerTenantAction,initialAction);const router=useRouter();
 useEffect(()=>{if(state.ok){setOpen(false);router.refresh()}},[state.ok,router]);
 return <><button className="button secondary small owner-danger-link" type="button" title="Hapus instansi kosong" aria-label={'Hapus '+tenant.name} onClick={()=>setOpen(true)}><Trash2 size={14}/></button>{open&&<Modal title={'Hapus instansi '+tenant.name+'?'} sub="Hanya instansi tanpa pengguna, catatan pembelajaran, transaksi, dan riwayat yang dapat dihapus." onClose={()=>setOpen(false)}><form action={action} className="modal-body"><input type="hidden" name="id" value={tenant.id}/><label className="field">Ketik HAPUS untuk konfirmasi<input required name="confirmation" autoComplete="off" placeholder="HAPUS"/></label>{state.message&&<p className="form-alert error" role="alert">{state.message}</p>}<div className="modal-footer"><button type="button" className="button secondary" onClick={()=>setOpen(false)}>Batal</button><button type="submit" disabled={pending} className="button destructive">Hapus instansi</button></div></form></Modal>}</>;
}
