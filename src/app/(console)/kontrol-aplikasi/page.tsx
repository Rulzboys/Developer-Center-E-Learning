import {CalendarClock,Info,Power,ScrollText,ShieldCheck,SlidersHorizontal} from 'lucide-react';
import {PageHead,Pill} from '@/components/ui';
import {adminClient,requireDeveloper} from '@/lib/supabase';
import PlatformControls from '@/components/platform-controls';
import PlatformFeatureControls,{type FeatureDefinition,type FeatureFlag,type TenantOption} from '@/components/platform-feature-controls';
import {datetime} from '@/lib/format';

type Row={
 mobile_enabled:boolean;maintenance_message:string;maintenance_starts_at:string|null;maintenance_ends_at:string|null;
 updated_at:string;updated_by:string|null;read_only?:boolean;minimum_app_version?:string;latest_app_version?:string;
 force_update?:boolean;update_message?:string;update_url?:string;
 poster_enabled?:boolean;poster_url?:string|null;poster_title?:string;poster_message?:string;poster_updated_at?:string|null;
 theme_background_color?:string;theme_text_primary_color?:string;theme_text_secondary_color?:string;theme_updated_at?:string|null;
};

const actionLabels:Record<string,string>={
 manual:'Kontrol global',schedule:'Jadwal disimpan',clear_schedule:'Jadwal dibatalkan',maintenance_complete:'Maintenance selesai',runtime_policy:'Kebijakan runtime',
 feature_flag:'Fitur diubah',feature_flag_clear:'Override dihapus',poster_update:'Poster dipublikasikan',poster_clear:'Poster dihapus',theme_update:'Tema mobile diperbarui',
};

export default async function ApplicationControl(){
 await requireDeveloper();
 const db=adminClient();
 const [settingRes,auditRes,featureRes,flagRes,tenantRes]=await Promise.all([
  db.from('platform_settings').select('*').eq('id',true).maybeSingle(),
  db.from('platform_audit').select('id,action,created_at,before_data,after_data,actor_id').order('created_at',{ascending:false}).limit(20),
  db.from('platform_feature_catalog').select('feature_key,label,description,category,sort_order,roles').order('sort_order'),
  db.from('platform_feature_flags').select('feature_key,scope_type,scope_key,tenant_id,role,enabled,updated_at'),
  db.from('tenants').select('id,name,code').order('name'),
 ]);
 const configured=!settingRes.error&&!!settingRes.data;
 const v4Ready=configured&&!featureRes.error&&!flagRes.error;
 const settings=settingRes.data as Row|null;
 const now=new Date();
 const scheduleActive=!!settings?.maintenance_starts_at&&new Date(settings.maintenance_starts_at)<=now&&(!settings.maintenance_ends_at||new Date(settings.maintenance_ends_at)>now);
 const enabled=!!settings?.mobile_enabled&&!scheduleActive;
 const effectiveMode=!enabled?'MAINTENANCE':settings?.read_only?'READ ONLY':'ONLINE';
 let names:Record<string,string>={};
 if(!auditRes.error&&auditRes.data?.length){
  const ids=[...new Set(auditRes.data.map((r)=>r.actor_id).filter(Boolean))] as string[];
  if(ids.length){const {data}=await db.from('profiles').select('id,name').in('id',ids);names=Object.fromEntries((data||[]).map((p)=>[p.id,p.name]));}
 }
 const scheduleText=settings?.maintenance_starts_at?`${datetime(settings.maintenance_starts_at)}${settings.maintenance_ends_at?' → '+datetime(settings.maintenance_ends_at):' → sampai dibatalkan'}`:'Belum ada maintenance terjadwal.';
 const features=(featureRes.data||[]) as FeatureDefinition[];
 const flags=(flagRes.data||[]) as FeatureFlag[];
 const tenants=(tenantRes.data||[]) as TenantOption[];
 const disabledGlobal=features.filter((f)=>flags.some((x)=>x.feature_key===f.feature_key&&x.scope_type==='global'&&x.enabled===false)).length;

 return <>
  <PageHead overline="PENGATURAN / PLATFORM" title="Kontrol aplikasi" description="Kendalikan ketersediaan, fitur, scope instansi/role, mode hanya-baca, maintenance, dan kebijakan versi aplikasi Flutter dari satu tempat."/>
  <div className="control-top control-overview-grid">
   <div className={'control-status-card '+(enabled?'is-on':'is-off')}><span className="control-status-mark"><Power size={29}/></span><div><small>STATUS EFEKTIF</small><h2>{configured?effectiveMode:'Belum dikonfigurasi'}</h2><p>{!configured?'Jalankan migrasi Platform Control Center terlebih dahulu.':!enabled?'Pengguna mobile sedang diblokir oleh sakelar global atau maintenance.':settings?.read_only?'Aplikasi dapat dibuka, tetapi perubahan data dari mobile dibatasi.':'Aplikasi beroperasi normal.'}</p></div>{configured&&<Pill text={effectiveMode} tone={!enabled?'danger':settings?.read_only?'warning':'success'}/>}</div>
   <div className="control-status-card is-neutral"><span className="control-status-mark"><CalendarClock size={29}/></span><div><small>MAINTENANCE</small><h2>{settings?.maintenance_starts_at?'Terjadwal':'Tidak terjadwal'}</h2><p>{scheduleText}</p></div></div>
   <div className="control-status-card is-neutral"><span className="control-status-mark"><SlidersHorizontal size={29}/></span><div><small>KONTROL FITUR</small><h2>{v4Ready?`${features.length} fitur terdaftar`:'Migrasi diperlukan'}</h2><p>{v4Ready?`${disabledGlobal} fitur dinonaktifkan pada scope global. Override instansi/role tetap dihitung terpisah.`:'Feature flag belum tersedia di database.'}</p></div></div>
   <div className="control-status-card is-neutral"><span className="control-status-mark"><ShieldCheck size={29}/></span><div><small>VERSI MOBILE</small><h2>{v4Ready?`Minimum ${settings?.minimum_app_version||'1.0.0'}`:'Belum tersedia'}</h2><p>{v4Ready?`Versi terbaru ${settings?.latest_app_version||'-'}${settings?.force_update?' • force update aktif':''}${settings?.update_url?' • link update siap':''}`:'Jalankan migration V4 untuk remote version policy.'}</p></div></div>
  </div>

  {!v4Ready?<div className="control-setup"><Info size={24}/><div><h2>Platform Control Center V4 belum siap</h2><p>Jalankan migration <code>edulink-platform-control-center-v4.sql</code> di Supabase SQL Editor, lalu muat ulang halaman. Migration ini meng-upgrade kontrol global lama dan menambahkan feature flag, read-only, serta version policy.</p></div></div>:<PlatformControls settings={{
   mobile_enabled:settings!.mobile_enabled,maintenance_message:settings!.maintenance_message,maintenance_starts_at:settings!.maintenance_starts_at,maintenance_ends_at:settings!.maintenance_ends_at,
   read_only:settings!.read_only??false,minimum_app_version:settings!.minimum_app_version??'1.0.0',latest_app_version:settings!.latest_app_version??'1.0.0',force_update:settings!.force_update??false,
   update_message:settings!.update_message??'Versi aplikasi yang Anda gunakan sudah terlalu lama. Silakan perbarui aplikasi.',update_url:settings!.update_url??'',
   poster_enabled:settings!.poster_enabled??false,poster_url:settings!.poster_url??'',poster_title:settings!.poster_title??'',poster_message:settings!.poster_message??'',poster_updated_at:settings!.poster_updated_at??null,
   theme_background_color:settings!.theme_background_color??'#F7F9F7',theme_text_primary_color:settings!.theme_text_primary_color??'#17231F',theme_text_secondary_color:settings!.theme_text_secondary_color??'#6D7D76',theme_updated_at:settings!.theme_updated_at??null,
  }} tenants={tenants}/>} 
  {v4Ready&&<PlatformFeatureControls features={features} flags={flags} tenants={tenants}/>} 

  <section className="surface control-audit"><div className="surface-heading"><div><h2><ScrollText size={20}/> Riwayat kontrol platform</h2><p>Perubahan status, jadwal, runtime policy, dan feature flag tercatat untuk audit.</p></div></div>
   {!configured?<p className="surface-pad">Riwayat tersedia setelah migration.</p>:!auditRes.data?.length?<p className="surface-pad">Belum ada perubahan status platform.</p>:<div className="table-scroll"><table className="data-table control-audit-table"><thead><tr><th className="col-time">WAKTU (WIB)</th><th className="col-action">AKSI</th><th className="col-actor">AKTOR</th><th>RINGKASAN</th></tr></thead><tbody>{auditRes.data.map((a)=>{
    const after=(a.after_data||{}) as Record<string,unknown>;
    const summary=a.action==='feature_flag'?`${String(after.feature_key||'Fitur')} • ${String(after.scope_type||'scope')} • ${after.enabled===true?'Aktif':'Nonaktif'}`:a.action==='runtime_policy'?`Read only ${after.read_only===true?'aktif':'nonaktif'} • min ${String(after.minimum_app_version||'-')}`:a.action==='maintenance_complete'?'Waktu selesai tercapai • jadwal maintenance dibersihkan otomatis':a.action==='poster_update'?'Poster beranda dipublikasikan atau diperbarui':a.action==='poster_clear'?'Poster beranda dinonaktifkan':a.action==='theme_update'?'Warna background dan tulisan aplikasi mobile diperbarui':typeof after.mobile_enabled==='boolean'?(after.mobile_enabled?'Akses global diizinkan':'Akses global dinonaktifkan'):'Konfigurasi diperbarui';
    return <tr key={a.id}><td className="col-time">{datetime(a.created_at)}</td><td className="col-action"><Pill text={actionLabels[a.action]||a.action} tone="info"/></td><td className="col-actor">{(a.actor_id&&names[a.actor_id])||'Developer'}</td><td>{summary}</td></tr>;
   })}</tbody></table></div>}
  </section>
 </>;
}
