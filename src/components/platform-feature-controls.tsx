'use client';

import {useMemo,useState,useTransition} from 'react';
import {Building2,Check,ChevronDown,Layers3,RotateCcw,Shield,SlidersHorizontal,Users} from 'lucide-react';
import {useRouter} from 'next/navigation';
import {clearPlatformFeatureFlagAction,setPlatformFeatureFlagAction} from '@/app/actions';

type Role='developer'|'leader'|'admin'|'teacher'|'student';
type Scope='global'|'tenant'|'role'|'tenant_role';
export type FeatureDefinition={
 feature_key:string;label:string;description:string;category:string;sort_order:number;roles:string[];
};
export type FeatureFlag={
 feature_key:string;scope_type:Scope;scope_key:string;tenant_id:string|null;role:Role|null;enabled:boolean;
};
export type TenantOption={id:string;name:string;code:string};

const roleLabels:Record<Role,string>={developer:'Developer',leader:'Pimpinan',admin:'Admin',teacher:'Guru',student:'Siswa'};
const scopeMeta:Record<Scope,{label:string;description:string;icon:typeof Layers3}>={
 global:{label:'Semua pengguna',description:'Default platform untuk seluruh instansi dan role.',icon:Layers3},
 tenant:{label:'Per instansi',description:'Override seluruh pengguna dalam satu instansi.',icon:Building2},
 role:{label:'Per role',description:'Override role yang sama di semua instansi.',icon:Users},
 tenant_role:{label:'Instansi + role',description:'Kontrol paling spesifik untuk role tertentu dalam satu instansi.',icon:Shield},
};

function scopeKey(scope:Scope,tenantId:string,role:Role){
 if(scope==='global')return 'global';
 if(scope==='tenant')return tenantId;
 if(scope==='role')return role;
 return `${tenantId}:${role}`;
}

function directFlag(flags:FeatureFlag[],feature:string,scope:Scope,tenantId:string,role:Role){
 const key=scopeKey(scope,tenantId,role);
 return flags.find((f)=>f.feature_key===feature&&f.scope_type===scope&&f.scope_key===key);
}

function inheritedForScope(flags:FeatureFlag[],feature:string,scope:Scope,tenantId:string,role:Role){
 if(scope==='tenant_role'){
  const tenant=directFlag(flags,feature,'tenant',tenantId,role);
  if(tenant)return {enabled:tenant.enabled,source:'Instansi'};
  const r=directFlag(flags,feature,'role',tenantId,role);
  if(r)return {enabled:r.enabled,source:'Role'};
 }
 const global=directFlag(flags,feature,'global',tenantId,role);
 if(global)return {enabled:global.enabled,source:'Global'};
 return {enabled:true,source:'Default sistem'};
}

export default function PlatformFeatureControls({features,flags,tenants}:{features:FeatureDefinition[];flags:FeatureFlag[];tenants:TenantOption[]}){
 const router=useRouter();
 const [scope,setScope]=useState<Scope>('global');
 const [tenantId,setTenantId]=useState(tenants[0]?.id||'');
 const [role,setRole]=useState<Role>('student');
 const [pendingKey,setPendingKey]=useState('');
 const [notice,setNotice]=useState<{ok:boolean;message:string}|null>(null);
 const [isPending,startTransition]=useTransition();
 const groups=useMemo(()=>{
  const map=new Map<string,FeatureDefinition[]>();
  for(const feature of features){
   const list=map.get(feature.category)||[];list.push(feature);map.set(feature.category,list);
  }
  return [...map.entries()];
 },[features]);
 const needsTenant=scope==='tenant'||scope==='tenant_role';
 const needsRole=scope==='role'||scope==='tenant_role';
 const scopeReady=(!needsTenant||!!tenantId)&&(!needsRole||!!role);

 function mutate(feature:FeatureDefinition,enabled:boolean){
  if(!scopeReady)return;
  setNotice(null);setPendingKey(feature.feature_key);
  startTransition(async()=>{
   const result=await setPlatformFeatureFlagAction({featureKey:feature.feature_key,scopeType:scope,tenantId:needsTenant?tenantId:null,role:needsRole?role:null,enabled});
   setNotice(result);setPendingKey('');if(result.ok)router.refresh();
  });
 }
 function clear(feature:FeatureDefinition){
  setNotice(null);setPendingKey(feature.feature_key);
  startTransition(async()=>{
   const result=await clearPlatformFeatureFlagAction({featureKey:feature.feature_key,scopeType:scope,tenantId:needsTenant?tenantId:null,role:needsRole?role:null});
   setNotice(result);setPendingKey('');if(result.ok)router.refresh();
  });
 }

 return <section className="surface feature-control-surface">
  <div className="surface-heading feature-heading">
   <div><h2><SlidersHorizontal size={20}/> Kontrol fitur mobile</h2><p>Aktif/nonaktifkan fungsi aplikasi secara global, per instansi, per role, atau kombinasi keduanya.</p></div>
   <span className="feature-count">{features.length} fitur</span>
  </div>
  <div className="feature-scope-bar">
   <div className="feature-scope-tabs" role="tablist" aria-label="Scope pengaturan fitur">
    {(Object.keys(scopeMeta) as Scope[]).map((key)=>{const Icon=scopeMeta[key].icon;return <button type="button" key={key} className={'feature-scope-tab '+(scope===key?'active':'')} onClick={()=>{setScope(key);if(key==='tenant_role'&&role==='developer')setRole('student');}}><Icon size={16}/><span><b>{scopeMeta[key].label}</b><small>{scopeMeta[key].description}</small></span></button>;})}
   </div>
   {(needsTenant||needsRole)&&<div className="feature-scope-filters">
    {needsTenant&&<label>Instansi<div className="select-wrap"><select value={tenantId} onChange={(e)=>setTenantId(e.target.value)}><option value="">Pilih instansi</option>{tenants.map((t)=><option value={t.id} key={t.id}>{t.name} ({t.code})</option>)}</select><ChevronDown size={15}/></div></label>}
    {needsRole&&<label>Role<div className="select-wrap"><select value={role} onChange={(e)=>setRole(e.target.value as Role)}>{(Object.keys(roleLabels) as Role[]).filter((r)=>scope!=='tenant_role'||r!=='developer').map((r)=><option value={r} key={r}>{roleLabels[r]}</option>)}</select><ChevronDown size={15}/></div></label>}
   </div>}
  </div>
  {notice&&<div className={'form-alert '+(notice.ok?'ok':'error')}>{notice.message}</div>}
  {!scopeReady?<div className="feature-empty">Pilih scope yang lengkap untuk mengatur fitur.</div>:<div className="feature-groups">
   {groups.map(([category,list])=><div className="feature-group" key={category}><div className="feature-group-title"><span>{category}</span><small>{list.length} fitur</small></div><div className="feature-list">
    {list.map((feature)=>{
     const direct=directFlag(flags,feature.feature_key,scope,tenantId,role);
     const resolved=inheritedForScope(flags,feature.feature_key,scope,tenantId,role);
     const shown=scope==='global'?(direct?.enabled??true):(direct?.enabled??resolved.enabled);
     const allowedForRole=!needsRole||feature.roles.includes(role);
     const busy=isPending&&pendingKey===feature.feature_key;
     return <div className={'feature-row '+(!allowedForRole?'muted':'')} key={feature.feature_key}>
      <div className="feature-copy"><div className="feature-title-line"><b>{feature.label}</b>{direct?<span className="override-badge">Override aktif</span>:scope!=='global'?<span className="inherit-badge">Mengikuti {resolved.source}</span>:null}</div><p>{feature.description}</p>{needsRole&&!allowedForRole&&<small className="feature-role-note">Fitur ini tidak digunakan oleh role {roleLabels[role]}.</small>}</div>
      <div className="feature-actions">
       <span className={'feature-state '+(shown?'on':'off')}>{shown?'Aktif':'Nonaktif'}</span>
       {direct&&<button type="button" className="icon-btn feature-reset" title="Hapus override" disabled={busy} onClick={()=>clear(feature)}><RotateCcw size={15}/></button>}
       <button type="button" className={'switch '+(shown?'on':'')} role="switch" aria-checked={shown} aria-label={`${shown?'Nonaktifkan':'Aktifkan'} ${feature.label}`} disabled={busy||!allowedForRole} onClick={()=>mutate(feature,!shown)}><span>{shown&&<Check size={12}/>}</span></button>
      </div>
     </div>;
    })}
   </div></div>)}
  </div>}
  <div className="feature-footnote"><Shield size={16}/><span>Urutan prioritas: <b>Instansi + role</b> → <b>Instansi</b> → <b>Role</b> → <b>Global</b> → default aktif. Tombol reset menghapus override dan kembali mengikuti level di atasnya.</span></div>
 </section>;
}
