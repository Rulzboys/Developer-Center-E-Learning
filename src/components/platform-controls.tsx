'use client';
import {useActionState,useEffect,useState} from 'react';
import {AlertTriangle,CalendarClock,Download,ExternalLink,ImagePlus,LockKeyhole,MessageSquareText,Power,Save,Send,ShieldAlert,Trash2,Users} from 'lucide-react';
import {savePlatformPosterAction,saveRuntimePolicyAction,scheduleMaintenanceAction,sendPlatformMessageAction,setMobileAccessAction} from '@/app/actions';
import {initialAction} from '@/lib/types';
import {useRouter} from 'next/navigation';

type Setting={
 mobile_enabled:boolean;maintenance_message:string;maintenance_starts_at:string|null;maintenance_ends_at:string|null;
 read_only:boolean;minimum_app_version:string;latest_app_version:string;force_update:boolean;update_message:string;update_url:string;
 poster_enabled:boolean;poster_url:string;poster_title:string;poster_message:string;poster_updated_at:string|null;
};
type TenantOption={id:string;name:string;code:string};
function jakartaLocal(value:string|null){if(!value)return '';return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(value)).replace(' ','T');}
function Notice({state}:{state:{ok:boolean;message:string}}){return state.message?<div role="status" className={'form-alert '+(state.ok?'ok':'error')}>{state.message}</div>:null;}
function Toggle({value,onChange,label}:{value:boolean;onChange:(next:boolean)=>void;label:string}){return <button type="button" className={'switch '+(value?'on':'')} role="switch" aria-checked={value} aria-label={label} onClick={()=>onChange(!value)}><span>{value?'✓':''}</span></button>;}

export default function PlatformControls({settings,tenants}:{settings:Setting;tenants:TenantOption[]}){
 const router=useRouter();
 const [confirmation,setConfirmation]=useState('');
 const [message,setMessage]=useState(settings.maintenance_message);
 const [readOnly,setReadOnly]=useState(settings.read_only);
 const [forceUpdate,setForceUpdate]=useState(settings.force_update);
 const [state,submit,pending]=useActionState(setMobileAccessAction,initialAction);
 const [scheduleState,submitSchedule,schedulePending]=useActionState(scheduleMaintenanceAction,initialAction);
 const [runtimeState,submitRuntime,runtimePending]=useActionState(saveRuntimePolicyAction,initialAction);
 const [messageState,submitMessage,messagePending]=useActionState(sendPlatformMessageAction,initialAction);
 const [posterState,submitPoster,posterPending]=useActionState(savePlatformPosterAction,initialAction);
 const nextEnabled=!settings.mobile_enabled;
 const expected=nextEnabled?'AKTIFKAN APLIKASI':'MATIKAN APLIKASI';
 useEffect(()=>{if(state.ok||scheduleState.ok||runtimeState.ok||messageState.ok||posterState.ok){setConfirmation('');router.refresh();}},[state,scheduleState,runtimeState,messageState,posterState,router]);
 useEffect(()=>{const id=window.setInterval(()=>router.refresh(),60_000);return ()=>window.clearInterval(id);},[router]);
 return <div className="control-forms">
   <section className="control-panel"><div className="control-panel-header"><span className={'control-icon '+(settings.mobile_enabled?'success':'danger')}><Power size={22}/></span><div><h2>Kontrol akses global</h2><p>Matikan atau aktifkan aplikasi mobile untuk seluruh pengguna.</p></div></div>
    <div className={'current-state '+(settings.mobile_enabled?'enabled':'disabled')}><span className="current-state-dot"/><div><b>{settings.mobile_enabled?'Sakelar global aktif':'Sakelar global nonaktif'}</b><p>{settings.mobile_enabled?'Status efektif juga mengikuti jadwal maintenance.':'Semua pengguna mobile akan diblokir pada pemeriksaan status berikutnya.'}</p></div></div>
    <form action={submit} className="control-form"><input type="hidden" name="enabled" value={String(nextEnabled)}/><label>Pesan kepada pengguna<textarea name="message" maxLength={500} required rows={3} value={message} onChange={e=>setMessage(e.target.value)}/><small>{message.length}/500 karakter</small></label><div className="danger-confirm"><LockKeyhole size={18}/><div><b>Konfirmasi tindakan</b><p>Ketik <strong>{expected}</strong> untuk melanjutkan. Aksi ini dicatat dalam audit log.</p><input name="confirmation" value={confirmation} onChange={e=>setConfirmation(e.target.value)} placeholder={expected} autoComplete="off"/></div></div><Notice state={state}/><button className={'button '+(nextEnabled?'primary':'destructive')} type="submit" disabled={pending||confirmation!==expected||!message.trim()}><Power size={17}/>{pending?'Memproses…':nextEnabled?'Aktifkan kembali aplikasi':'Nonaktifkan aplikasi'}</button></form>
   </section>

   <section className="control-panel"><div className="control-panel-header"><span className="control-icon purple"><CalendarClock size={22}/></span><div><h2>Jadwal maintenance</h2><p>Atur jendela pemeliharaan otomatis dalam zona waktu WIB (UTC+7).</p></div></div><form action={submitSchedule} className="control-form"><input type="hidden" name="message" value={message}/><div className="form-grid"><label className="field">Mulai (WIB)<input name="starts" type="datetime-local" defaultValue={jakartaLocal(settings.maintenance_starts_at)} required/></label><label className="field">Selesai (WIB, opsional)<input name="ends" type="datetime-local" defaultValue={jakartaLocal(settings.maintenance_ends_at)}/></label></div><p className="helper">Jika waktu selesai diisi, scheduler server akan otomatis mengirim notifikasi “Maintenance selesai” lalu membersihkan tanggal mulai/selesai setelah waktunya terlewati. Jadwal tanpa waktu selesai tetap berlaku sampai dibatalkan.</p><Notice state={scheduleState}/><div className="control-form-actions"><button className="button primary" type="submit" name="operation" value="schedule" disabled={schedulePending}><Save size={17}/> Simpan jadwal</button><button className="button secondary" type="submit" name="operation" value="clear" formNoValidate disabled={schedulePending||!settings.maintenance_starts_at}><Trash2 size={17}/> Hapus jadwal</button></div></form><div className="control-warning"><AlertTriangle size={18}/><p>Jadwal maintenance tidak menghidupkan aplikasi apabila sakelar global sedang nonaktif.</p></div></section>


   <section className="control-panel control-panel-wide"><div className="control-panel-header"><span className="control-icon success"><MessageSquareText size={22}/></span><div><h2>Kirim pesan ke pengguna</h2><p>Kirim pemberitahuan umum di luar aplikasi melalui FCM dan simpan pesan yang sama di pusat pemberitahuan Flutter.</p></div></div>
    <form action={submitMessage} className="control-form">
      <div className="form-grid">
        <label className="field">Target instansi<select name="tenant_id" defaultValue=""><option value="">Semua instansi</option>{tenants.map((tenant)=><option key={tenant.id} value={tenant.id}>{tenant.name} ({tenant.code})</option>)}</select></label>
        <label className="field">Target role<select name="role" defaultValue=""><option value="">Semua role</option><option value="student">Student</option><option value="teacher">Teacher</option><option value="admin">Admin</option><option value="leader">Pimpinan</option><option value="developer">Developer</option></select></label>
      </div>
      <label className="field">Judul pesan<input name="title" maxLength={180} required placeholder="Contoh: Informasi kegiatan sekolah"/></label>
      <label className="field">Isi pesan<textarea name="body" maxLength={1000} rows={4} required placeholder="Tulis informasi yang ingin disampaikan kepada pengguna..."/><small>Pesan akan tampil sebagai push notification dan masuk ke menu Pemberitahuan.</small></label>
      <div className="control-warning"><Users size={18}/><p>Jika instansi dan role dibiarkan “Semua”, pesan dikirim ke seluruh perangkat aktif yang terdaftar.</p></div>
      <Notice state={messageState}/><button className="button primary" type="submit" disabled={messagePending}><Send size={17}/>{messagePending?'Mengirim…':'Kirim pesan'}</button>
    </form>
   </section>

   <section className="control-panel control-panel-wide"><div className="control-panel-header"><span className="control-icon success"><ImagePlus size={22}/></span><div><h2>Poster beranda mobile</h2><p>Publikasikan poster global yang tampil halus setelah pengguna login dan masuk ke Beranda.</p></div></div>
    <form action={submitPoster} className="control-form">
      {settings.poster_enabled&&settings.poster_url&&<div className="poster-admin-preview"><img src={settings.poster_url} alt="Poster aktif"/><div><b>Poster aktif</b><p>{settings.poster_title||'Tanpa judul'}</p>{settings.poster_updated_at&&<small>Terakhir diperbarui {new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Jakarta'}).format(new Date(settings.poster_updated_at))} WIB</small>}</div></div>}
      <div className="form-grid">
        <label className="field">Gambar poster<input name="poster" type="file" accept="image/jpeg,image/png,image/webp"/><small>JPG, PNG, atau WebP. Maksimal 4 MB. Jika poster sudah ada, file boleh dikosongkan untuk mengubah teks saja.</small></label>
        <label className="field">Judul poster<input name="title" maxLength={180} defaultValue={settings.poster_title||''} placeholder="Contoh: Penerimaan santri baru"/></label>
      </div>
      <label className="field">Keterangan poster<textarea name="message" maxLength={1000} rows={3} defaultValue={settings.poster_message||''} placeholder="Keterangan singkat yang tampil di bawah poster pada aplikasi mobile."/></label>
      <div className="control-warning"><Users size={18}/><p>Di Flutter, poster tampil sekali pada setiap sesi aplikasi. Pengguna dapat mencentang “Jangan tampilkan lagi hari ini”; poster akan muncul kembali besok atau segera jika Anda mengunggah poster baru.</p></div>
      <Notice state={posterState}/>
      <div className="control-form-actions"><button className="button primary" type="submit" name="operation" value="save" disabled={posterPending}><ImagePlus size={17}/>{posterPending?'Menyimpan…':settings.poster_enabled?'Perbarui poster':'Publikasikan poster'}</button><button className="button secondary" type="submit" name="operation" value="clear" formNoValidate disabled={posterPending||!settings.poster_enabled}><Trash2 size={17}/> Hapus poster</button></div>
    </form>
   </section>

   <section className="control-panel control-panel-wide"><div className="control-panel-header"><span className="control-icon blue"><ShieldAlert size={22}/></span><div><h2>Kebijakan runtime & versi</h2><p>Atur versi aplikasi, link rilis terbaru, mode hanya-baca, dan pembaruan wajib tanpa menerbitkan ulang konfigurasi website.</p></div></div>
    <form action={submitRuntime} className="control-form runtime-policy-form">
      <input type="hidden" name="read_only" value={String(readOnly)}/><input type="hidden" name="force_update" value={String(forceUpdate)}/>
      <div className="runtime-toggle-row"><div><b>Mode hanya-baca</b><p>Pengguna tetap dapat melihat data, tetapi operasi penyimpanan dari aplikasi mobile ditolak.</p></div><Toggle value={readOnly} onChange={setReadOnly} label="Mode hanya-baca"/></div>
      <div className="form-grid"><label className="field">Versi minimum<input name="minimum_app_version" defaultValue={settings.minimum_app_version||'1.0.0'} pattern="[0-9]+(\.[0-9]+){0,3}" required placeholder="1.0.0"/></label><label className="field">Versi terbaru<input name="latest_app_version" defaultValue={settings.latest_app_version||'1.0.0'} pattern="[0-9]+(\.[0-9]+){0,3}" required placeholder="1.4.2"/></label></div>
      <p className="helper">Flutter membaca versi terpasang dari <code>pubspec.yaml</code> melalui <code>package_info_plus</code>. Versi di bawah minimum dianggap tidak didukung; ketika “Paksa pembaruan” aktif, pengguna juga diwajibkan memakai versi terbaru.</p>
      <label className="field">Link aplikasi versi terbaru<input name="update_url" type="url" defaultValue={settings.update_url||''} maxLength={1000} placeholder="https://example.com/aplikasi-terbaru"/><small>Digunakan tombol “Update aplikasi” di Flutter. Wajib diisi saat pembaruan dipaksa.</small></label>
      {settings.update_url&&<a className="button secondary small" href={settings.update_url} target="_blank" rel="noreferrer"><ExternalLink size={16}/> Cek link update</a>}
      <div className="runtime-toggle-row"><div><b>Paksa pembaruan</b><p>Jika aktif, aplikasi versi lama akan berhenti di layar pembaruan sampai versi terbaru dipasang.</p></div><Toggle value={forceUpdate} onChange={setForceUpdate} label="Paksa pembaruan aplikasi"/></div>
      <label>Pesan pembaruan<textarea name="update_message" maxLength={500} rows={3} defaultValue={settings.update_message||'Versi aplikasi yang Anda gunakan sudah terlalu lama. Silakan perbarui aplikasi.'} required/></label>
      <Notice state={runtimeState}/><button className="button primary" type="submit" disabled={runtimePending}><Download size={17}/>{runtimePending?'Menyimpan…':'Simpan kebijakan runtime'}</button>
    </form>
   </section>
  </div>;
}
