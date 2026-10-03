'use client';
import {useActionState,useEffect,useState} from 'react';
import {AlertTriangle,CalendarClock,Download,LockKeyhole,Power,RotateCcw,Save,ShieldAlert} from 'lucide-react';
import {saveRuntimePolicyAction,scheduleMaintenanceAction,setMobileAccessAction} from '@/app/actions';
import {initialAction} from '@/lib/types';
import {useRouter} from 'next/navigation';

type Setting={
 mobile_enabled:boolean;maintenance_message:string;maintenance_starts_at:string|null;maintenance_ends_at:string|null;
 read_only:boolean;minimum_app_version:string;latest_app_version:string;force_update:boolean;update_message:string;
};
function jakartaLocal(value:string|null){if(!value)return '';return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(value)).replace(' ','T');}
function Notice({state}:{state:{ok:boolean;message:string}}){return state.message?<div role="status" className={'form-alert '+(state.ok?'ok':'error')}>{state.message}</div>:null;}
function Toggle({value,onChange,label}:{value:boolean;onChange:(next:boolean)=>void;label:string}){return <button type="button" className={'switch '+(value?'on':'')} role="switch" aria-checked={value} aria-label={label} onClick={()=>onChange(!value)}><span>{value?'✓':''}</span></button>;}

export default function PlatformControls({settings}:{settings:Setting}){
 const router=useRouter();
 const [confirmation,setConfirmation]=useState('');
 const [message,setMessage]=useState(settings.maintenance_message);
 const [readOnly,setReadOnly]=useState(settings.read_only);
 const [forceUpdate,setForceUpdate]=useState(settings.force_update);
 const [state,submit,pending]=useActionState(setMobileAccessAction,initialAction);
 const [scheduleState,submitSchedule,schedulePending]=useActionState(scheduleMaintenanceAction,initialAction);
 const [runtimeState,submitRuntime,runtimePending]=useActionState(saveRuntimePolicyAction,initialAction);
 const nextEnabled=!settings.mobile_enabled;
 const expected=nextEnabled?'AKTIFKAN APLIKASI':'MATIKAN APLIKASI';
 useEffect(()=>{if(state.ok||scheduleState.ok||runtimeState.ok){setConfirmation('');router.refresh();}},[state,scheduleState,runtimeState,router]);
 useEffect(()=>{const id=window.setInterval(()=>router.refresh(),60_000);return ()=>window.clearInterval(id);},[router]);
 return <div className="control-forms">
   <section className="control-panel"><div className="control-panel-header"><span className={'control-icon '+(settings.mobile_enabled?'success':'danger')}><Power size={22}/></span><div><h2>Kontrol akses global</h2><p>Matikan atau aktifkan aplikasi mobile untuk seluruh pengguna.</p></div></div>
    <div className={'current-state '+(settings.mobile_enabled?'enabled':'disabled')}><span className="current-state-dot"/><div><b>{settings.mobile_enabled?'Sakelar global aktif':'Sakelar global nonaktif'}</b><p>{settings.mobile_enabled?'Status efektif juga mengikuti jadwal maintenance.':'Semua pengguna mobile akan diblokir pada pemeriksaan status berikutnya.'}</p></div></div>
    <form action={submit} className="control-form"><input type="hidden" name="enabled" value={String(nextEnabled)}/><label>Pesan kepada pengguna<textarea name="message" maxLength={500} required rows={3} value={message} onChange={e=>setMessage(e.target.value)}/><small>{message.length}/500 karakter</small></label><div className="danger-confirm"><LockKeyhole size={18}/><div><b>Konfirmasi tindakan</b><p>Ketik <strong>{expected}</strong> untuk melanjutkan. Aksi ini dicatat dalam audit log.</p><input name="confirmation" value={confirmation} onChange={e=>setConfirmation(e.target.value)} placeholder={expected} autoComplete="off"/></div></div><Notice state={state}/><button className={'button '+(nextEnabled?'primary':'destructive')} type="submit" disabled={pending||confirmation!==expected||!message.trim()}><Power size={17}/>{pending?'Memproses…':nextEnabled?'Aktifkan kembali aplikasi':'Nonaktifkan aplikasi'}</button></form>
   </section>

   <section className="control-panel"><div className="control-panel-header"><span className="control-icon purple"><CalendarClock size={22}/></span><div><h2>Jadwal maintenance</h2><p>Atur jendela pemeliharaan otomatis dalam zona waktu WIB (UTC+7). Aplikasi mobile menampilkan banner dan notifikasi sistem setelah jadwal tersinkron.</p></div></div><form action={submitSchedule} className="control-form"><input type="hidden" name="message" value={message}/><div className="form-grid"><label className="field">Mulai (WIB)<input name="starts" type="datetime-local" defaultValue={jakartaLocal(settings.maintenance_starts_at)} required/></label><label className="field">Selesai (WIB, opsional)<input name="ends" type="datetime-local" defaultValue={jakartaLocal(settings.maintenance_ends_at)}/></label></div><p className="helper">Jadwal tanpa waktu selesai berlaku sampai dibatalkan.</p><Notice state={scheduleState}/><div className="control-form-actions"><button className="button primary" type="submit" name="operation" value="schedule" disabled={schedulePending}><Save size={17}/> Simpan jadwal</button><button className="button secondary" type="submit" name="operation" value="clear" formNoValidate disabled={schedulePending||!settings.maintenance_starts_at}><RotateCcw size={17}/> Batalkan jadwal</button></div></form><div className="control-warning"><AlertTriangle size={18}/><p>Jadwal maintenance tidak menghidupkan aplikasi apabila sakelar global sedang nonaktif.</p></div></section>

   <section className="control-panel control-panel-wide"><div className="control-panel-header"><span className="control-icon blue"><ShieldAlert size={22}/></span><div><h2>Kebijakan runtime & versi</h2><p>Aktifkan mode hanya-baca dan paksa pembaruan versi aplikasi tanpa menerbitkan ulang konfigurasi website.</p></div></div>
    <form action={submitRuntime} className="control-form runtime-policy-form">
      <input type="hidden" name="read_only" value={String(readOnly)}/><input type="hidden" name="force_update" value={String(forceUpdate)}/>
      <div className="runtime-toggle-row"><div><b>Mode hanya-baca</b><p>Pengguna tetap dapat melihat data, tetapi operasi penyimpanan dari aplikasi mobile ditolak.</p></div><Toggle value={readOnly} onChange={setReadOnly} label="Mode hanya-baca"/></div>
      <div className="form-grid"><label className="field">Versi minimum<input name="minimum_app_version" defaultValue={settings.minimum_app_version||'1.0.0'} pattern="[0-9]+(\.[0-9]+){0,3}" required placeholder="1.0.0"/></label><label className="field">Versi terbaru<input name="latest_app_version" defaultValue={settings.latest_app_version||'1.0.0'} pattern="[0-9]+(\.[0-9]+){0,3}" required placeholder="1.4.2"/></label></div>
      <p className="helper">Flutter membaca versi aplikasi dari <code>version:</code> di <code>pubspec.yaml</code> melalui <code>package_info_plus</code>, lalu membandingkannya dengan versi minimum.</p>
      <div className="runtime-toggle-row"><div><b>Paksa pembaruan</b><p>Flutter akan memblokir versi di bawah versi minimum ketika opsi ini aktif.</p></div><Toggle value={forceUpdate} onChange={setForceUpdate} label="Paksa pembaruan aplikasi"/></div>
      <label>Pesan pembaruan<textarea name="update_message" maxLength={500} rows={3} defaultValue={settings.update_message||'Versi aplikasi yang Anda gunakan sudah terlalu lama. Silakan perbarui aplikasi.'} required/></label>
      <Notice state={runtimeState}/><button className="button primary" type="submit" disabled={runtimePending}><Download size={17}/>{runtimePending?'Menyimpan…':'Simpan kebijakan runtime'}</button>
    </form>
   </section>
  </div>;
}
