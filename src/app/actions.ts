'use server';
import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {z} from 'zod';
import {adminClient,requireDeveloper,sessionClient,validateUUID} from '@/lib/supabase';
import {endOfJakartaDay} from '@/lib/format';
import type {ActionResult,Profile,Tenant} from '@/lib/types';
import {sendPushEvent,withPushStatus} from '@/lib/push';

const read=(fd:FormData,key:string)=>String(fd.get(key)||'').trim();
const fail=(error:unknown):ActionResult=>({ok:false,message:error instanceof Error?error.message:'Operasi gagal. Periksa data lalu coba lagi.'});
const success=(message:string):ActionResult=>({ok:true,message});
const isDay=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v+'T00:00:00Z'));

export async function loginAction(_:ActionResult,form:FormData):Promise<ActionResult>{
 const email=read(form,'email'),password=String(form.get('password')||'');
 if(!z.string().email().safeParse(email).success||!password)return {ok:false,message:'Isi email dan password yang valid.'};
 try{
  const db=await sessionClient();
  const {error}=await db.auth.signInWithPassword({email,password});
  if(error)return {ok:false,message:'Email atau kata sandi salah.'};
  const {data:{user}}=await db.auth.getUser();
  const {data:profile}=await db.from('profiles').select('role,active,tenant_id').eq('id',user?.id||'').maybeSingle();
  if(!profile||profile.role!=='developer'||!profile.active||profile.tenant_id!==null){await db.auth.signOut();return {ok:false,message:'Akses hanya untuk akun Developer aktif.'};}
 }catch(error){return fail(error);}
 redirect('/dashboard');
}
export async function signOutAction(){const db=await sessionClient();await db.auth.signOut();redirect('/login');}

const tenantSchema=z.object({
 name:z.string().min(1).max(160),code:z.string().regex(/^[A-Z0-9_-]{3,24}$/),
 plan:z.enum(['Dasar','Sekolah','Pesantren']),status:z.enum(['active','suspended']),
 expires:z.string().refine(isDay,'Tanggal tidak valid'),
 academic_year:z.string().min(1).max(40),semester:z.enum(['Ganjil','Genap']),
 address:z.string().max(500),contact:z.string().max(100),target_count:z.coerce.number().int().min(1).max(1000)
});
export async function saveTenantAction(_:ActionResult,fd:FormData):Promise<ActionResult>{
 await requireDeveloper();
 try{
  const id=read(fd,'id');if(id&&!validateUUID(id))return fail(new Error('ID instansi tidak valid.'));
  const input=tenantSchema.parse({
   name:read(fd,'name'),code:read(fd,'code').toUpperCase(),plan:read(fd,'plan'),status:read(fd,'status'),
   expires:read(fd,'expires'),academic_year:read(fd,'academic_year'),semester:read(fd,'semester'),
   address:read(fd,'address'),contact:read(fd,'contact'),target_count:read(fd,'target_count')
  });
  const db=await sessionClient();
  const admin=adminClient();
  const {data:existing,error:loadErr}=id?await admin.from('tenants').select('*').eq('id',id).maybeSingle():{data:null,error:null};
  if(loadErr)throw loadErr;
  if(id&&!existing)throw new Error('Instansi tidak ditemukan.');
  const tenant:Tenant={
    ...existing,
    id:id||crypto.randomUUID(),name:input.name,code:input.code,plan:input.plan,status:input.status,
    expires_at:endOfJakartaDay(input.expires),academic_year:input.academic_year,semester:input.semester,
    address:input.address,contact:input.contact,target_count:input.target_count,
    subscription_until:existing?.subscription_until??null
  };
  const {error}=await db.rpc('owner_save_tenant',{p_tenant:tenant});
  if(error)throw new Error(error.message);
  revalidatePath('/instansi');revalidatePath('/dashboard');
  return success(id?'Perubahan instansi tersimpan.':'Instansi berhasil dibuat.');
 }catch(error){if(error instanceof z.ZodError)return {ok:false,message:error.issues[0]?.message||'Data instansi tidak valid.'};return fail(error);}
}
export async function toggleTenantAction(_:ActionResult,fd:FormData):Promise<ActionResult>{
 await requireDeveloper();
 try{
  const id=read(fd,'id');if(!validateUUID(id))throw new Error('ID tidak valid.');
  const admin=adminClient();const {data:t,error:err}=await admin.from('tenants').select('*').eq('id',id).single();
  if(err||!t)throw new Error('Instansi tidak ditemukan.');
  const db=await sessionClient();const {error}=await db.rpc('owner_save_tenant',{p_tenant:{...t,status:t.status==='active'?'suspended':'active'}});
  if(error)throw new Error(error.message);
  revalidatePath('/dashboard');revalidatePath('/instansi');
  return success(t.status==='active'?'Instansi ditangguhkan.':'Instansi diaktifkan kembali.');
 }catch(error){return fail(error);}
}
const managerSchema=z.object({
 name:z.string().min(1).max(160),email:z.string().email().max(254),phone:z.string().max(40),
 role:z.enum(['admin','leader']),tenant_id:z.string().uuid(),active:z.boolean()
});
export async function saveManagerAction(_:ActionResult,fd:FormData):Promise<ActionResult>{
 const {userId}=await requireDeveloper();
 try{
  const id=read(fd,'id');const creation=!id;
  if(id&&!validateUUID(id))throw new Error('ID akun tidak valid.');
  const input=managerSchema.parse({
   name:read(fd,'name'),email:read(fd,'email').toLowerCase(),phone:read(fd,'phone'),
   role:read(fd,'role'),tenant_id:read(fd,'tenant_id'),active:read(fd,'active')==='true'
  });
  const server=adminClient();const client=await sessionClient();
  const {data:tenant}=await server.from('tenants').select('id').eq('id',input.tenant_id).maybeSingle();
  if(!tenant)throw new Error('Instansi tidak ditemukan.');
  let profile:Profile;
  let createdAuthId:string|null=null;
  if(creation){
   const password=String(fd.get('password')||'');
   if(password.length<12||password.length>72)throw new Error('Password awal harus 12–72 karakter.');
   const {data:created,error:authError}=await server.auth.admin.createUser({email:input.email,password,email_confirm:true});
   if(authError||!created.user)throw new Error(authError?.message||'Tidak dapat membuat akun Auth.');
   createdAuthId=created.user.id;
   profile={id:createdAuthId,tenant_id:input.tenant_id,name:input.name,email:input.email,role:input.role,
    class_id:null,number:'',phone:input.phone,active:input.active,photo_path:''};
  }else{
   const {data:old,error:loadErr}=await server.from('profiles').select('*').eq('id',id).single();
   if(loadErr||!old||!['admin','leader'].includes(old.role))throw new Error('Akun tidak bisa dikelola dari panel ini.');
   if(old.tenant_id!==input.tenant_id||old.role!==input.role||old.email!==input.email)throw new Error('Email, role, dan instansi akun tidak dapat diganti.');
   profile={...old,name:input.name,phone:input.phone,active:input.active};
  }
  try{
   // Calls EXISTING database authorization. Developer can only manage admin/leader.
   const {error}=await client.rpc('apply_managed_profile',{p_actor_id:userId,p_profile:profile});
   if(error)throw new Error(error.message);
  }catch(error){if(createdAuthId)await server.auth.admin.deleteUser(createdAuthId);throw error;}
  revalidatePath('/akun');revalidatePath('/dashboard');
  return success(creation?'Akun berhasil dibuat. Kirim password awal melalui saluran aman.':'Akun berhasil diperbarui.');
 }catch(error){if(error instanceof z.ZodError)return {ok:false,message:error.issues[0]?.message||'Data akun tidak valid.'};return fail(error);}
}
export async function savePricingAction(_:ActionResult,fd:FormData):Promise<ActionResult>{
 await requireDeveloper();
 const parsed=z.object({monthly:z.coerce.number().int().min(1000).max(100000000),annual:z.coerce.number().int().min(1000).max(100000000)}).safeParse({monthly:read(fd,'monthly'),annual:read(fd,'annual')});
 if(!parsed.success)return {ok:false,message:'Harga harus Rp1.000–Rp100.000.000.'};
 if(parsed.data.annual>parsed.data.monthly*12)return {ok:false,message:'Harga tahunan tidak boleh melebihi 12 kali harga bulanan.'};
 try{
  const db=await sessionClient();const {error}=await db.rpc('owner_price_action',{
   p_data:{monthly_price:parsed.data.monthly,annual_price:parsed.data.annual}
  });
  if(error)throw new Error(error.message);
  revalidatePath('/langganan');revalidatePath('/dashboard');return success('Harga langganan berhasil diperbarui.');
 }catch(error){return fail(error);}
}
export async function saveProfileAction(_:ActionResult,fd:FormData):Promise<ActionResult>{
 await requireDeveloper();
 const parsed=z.object({name:z.string().min(1).max(160),phone:z.string().max(40)}).safeParse({name:read(fd,'name'),phone:read(fd,'phone')});
 if(!parsed.success)return {ok:false,message:'Nama dan nomor telepon tidak valid.'};
 try{
  const db=await sessionClient();const {error}=await db.rpc('update_self',{p_name:parsed.data.name,p_phone:parsed.data.phone});
  if(error)throw new Error(error.message);
  revalidatePath('/pengaturan');return success('Profil berhasil diperbarui.');
 }catch(error){return fail(error);}
}
export async function savePasswordAction(_:ActionResult,fd:FormData):Promise<ActionResult>{
 await requireDeveloper();
 const password=String(fd.get('password')||''),confirm=String(fd.get('confirm')||'');
 if(password.length<12)return {ok:false,message:'Password baru minimal 12 karakter.'};
 if(password!==confirm)return {ok:false,message:'Konfirmasi password tidak sama.'};
 try{
  const db=await sessionClient();const {error}=await db.auth.updateUser({password});
  if(error)throw new Error(error.message);
  return success('Password berhasil diubah.');
 }catch(error){return fail(error);}
}

// Owner Console V2: persist per-Developer dashboard layout; never accept a user ID from browser.
export async function saveDashboardLayoutAction(input:unknown):Promise<ActionResult>{
 const {userId}=await requireDeveloper();
 try{
  const {normalizeLayout}=await import('@/lib/dashboard-layout');
  if(!Array.isArray(input)||input.length>20)throw new Error('Susunan widget tidak valid.');
  const widgets=normalizeLayout(input);
  const {error}=await adminClient().from('owner_dashboard_layouts').upsert({user_id:userId,widgets,updated_at:new Date().toISOString()},{onConflict:'user_id'});
  if(error)throw new Error('Gagal menyimpan preferensi. Pastikan migrasi SQL v2 sudah dijalankan.');
  revalidatePath('/dashboard');
  return success('Susunan dashboard tersimpan untuk akun Developer ini.');
 }catch(error){return fail(error);}
}

// Instant mobile switch: type-to-confirm is UX only; RPC enforces Developer on DB.
export async function setMobileAccessAction(_:ActionResult,form:FormData):Promise<ActionResult>{
 await requireDeveloper();
 try{
  const enabled=read(form,'enabled')==='true';
  if(read(form,'confirmation')!==(enabled?'AKTIFKAN APLIKASI':'MATIKAN APLIKASI'))
   throw new Error('Tuliskan frasa konfirmasi dengan tepat.');
  const message=z.string().min(1).max(500).parse(read(form,'message'));
  const db=await sessionClient();
  const settings=adminClient();
  const {data:current,error:loadError}=await settings.from('platform_settings').select('maintenance_starts_at,maintenance_ends_at').eq('id',true).single();
  if(loadError||!current)throw new Error('Pengaturan belum tersedia. Jalankan migrasi SQL v2 terlebih dahulu.');
  const {error}=await db.rpc('set_platform_controls',{
   p_mobile_enabled:enabled,p_message:message,
   p_schedule_start:current.maintenance_starts_at,p_schedule_end:current.maintenance_ends_at,p_action:'manual'
  });
  if(error)throw new Error(error.message);
  revalidatePath('/dashboard');revalidatePath('/kontrol-aplikasi');
  const base=enabled?'Akses manual telah diaktifkan. Jadwal maintenance yang masih berlaku tetap diterapkan.':'Akses mobile dinonaktifkan.';
  const pushWarning=await sendPushEvent({type:'platform',platform:{
   title:enabled?'Aplikasi kembali online':'Aplikasi sementara tidak tersedia',
   body:enabled?'Layanan E-Learning telah kembali online. Silakan buka aplikasi untuk melanjutkan aktivitas.':message,
   route:'/notifications',category:'maintenance',dedupe_key:`platform-access:${enabled}:${crypto.randomUUID()}`
  }});
  return success(withPushStatus(base,pushWarning));
 }catch(error){return fail(error);}
}

export async function scheduleMaintenanceAction(_:ActionResult,form:FormData):Promise<ActionResult>{
 await requireDeveloper();
 try{
  const op=read(form,'operation');
  if(op!=='schedule'&&op!=='clear')throw new Error('Operasi jadwal tidak dikenal.');
  const message=z.string().min(1).max(500).parse(read(form,'message'));
  const db=adminClient();const {data:current,error:loadError}=await db.from('platform_settings').select('mobile_enabled').eq('id',true).single();
  if(loadError||!current)throw new Error('Jalankan migrasi SQL v2 terlebih dahulu.');
  const parseJakarta=(value:string):string|null=>{
   if(!value)return null;
   if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw new Error('Format tanggal tidak valid.');
   const date=new Date(value+':00+07:00');
   if(Number.isNaN(date.getTime()))throw new Error('Tanggal tidak valid.');
   return date.toISOString();
  };
  const start=op==='clear'?null:parseJakarta(read(form,'starts'));
  const end=op==='clear'?null:parseJakarta(read(form,'ends'));
  if(op==='schedule'&&(!start||new Date(start)<=new Date()||end&&new Date(end)<=new Date(start)))
   throw new Error('Isi jadwal mulai di masa depan dan waktu selesai setelah waktu mulai.');
  const client=await sessionClient();
  const {error}=await client.rpc('set_platform_controls',{
   p_mobile_enabled:current.mobile_enabled,p_message:message,p_schedule_start:start,p_schedule_end:end,
   p_action:op==='clear'?'clear_schedule':'schedule'
  });
  if(error)throw new Error(error.message);
  revalidatePath('/kontrol-aplikasi');revalidatePath('/dashboard');
  const fmt=(iso:string|null)=>iso?new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',dateStyle:'medium',timeStyle:'short'}).format(new Date(iso)):'';
  const base=op==='clear'?'Jadwal maintenance dihapus.':'Jadwal maintenance disimpan.';
  const pushWarning=await sendPushEvent({type:'platform',platform:{
   title:op==='clear'?'Jadwal maintenance dibatalkan':'Maintenance terjadwal',
   body:op==='clear'?'Jadwal maintenance sebelumnya telah dibatalkan oleh pengelola.':`${message} Mulai ${fmt(start)}${end?` sampai ${fmt(end)}`:''}.`,
   route:'/notifications',category:'maintenance',
   dedupe_key:op==='clear'?`maintenance-clear:${crypto.randomUUID()}`:`maintenance:${start}`
  }});
  return success(withPushStatus(base,pushWarning));
 }catch(error){return fail(error);}
}


export async function sendPlatformMessageAction(_:ActionResult,form:FormData):Promise<ActionResult>{
 await requireDeveloper();
 try{
  const title=z.string().min(1,'Judul pesan wajib diisi.').max(180).parse(read(form,'title'));
  const body=z.string().min(1,'Isi pesan wajib diisi.').max(1000).parse(read(form,'body'));
  const tenantRaw=read(form,'tenant_id');
  const roleRaw=read(form,'role');
  const tenantId=tenantRaw?z.string().uuid('Instansi tidak valid.').parse(tenantRaw):null;
  const role=roleRaw?z.enum(['developer','leader','admin','teacher','student']).parse(roleRaw):null;
  if(tenantId&&role==='developer')throw new Error('Role Developer tidak terikat ke instansi. Pilih Semua instansi untuk target Developer.');
  const pushWarning=await sendPushEvent({type:'platform',platform:{
   title,body,route:'/notifications',category:'message',tenant_id:tenantId,role,
   dedupe_key:`developer-message:${crypto.randomUUID()}`
  }});
  revalidatePath('/kontrol-aplikasi');
  return success(pushWarning
   ?`Pesan tersimpan di pusat pemberitahuan, tetapi pengiriman push perlu diperiksa: ${pushWarning}`
   :'Pesan berhasil dikirim ke pengguna yang dipilih.');
 }catch(error){
  if(error instanceof z.ZodError)return {ok:false,message:error.issues[0]?.message||'Pesan tidak valid.'};
  return fail(error);
 }
}


const themeHex=z.string().regex(/^#[0-9A-Fa-f]{6}$/,'Gunakan warna HEX dengan format #RRGGBB.');
export async function savePlatformThemeAction(_:ActionResult,form:FormData):Promise<ActionResult>{
 await requireDeveloper();
 try{
  const operation=read(form,'operation')||'save';
  if(operation!=='save'&&operation!=='reset')throw new Error('Operasi tema tidak dikenal.');
  const defaults={background_color:'#F7F9F7',text_primary_color:'#17231F',text_secondary_color:'#6D7D76'};
  const values=operation==='reset'?defaults:{
   background_color:themeHex.parse(read(form,'background_color').toUpperCase()),
   text_primary_color:themeHex.parse(read(form,'text_primary_color').toUpperCase()),
   text_secondary_color:themeHex.parse(read(form,'text_secondary_color').toUpperCase()),
  };
  const {error}=await (await sessionClient()).rpc('set_platform_theme',{
   p_background_color:values.background_color,
   p_text_primary_color:values.text_primary_color,
   p_text_secondary_color:values.text_secondary_color,
  });
  if(error)throw new Error(error.message);
  revalidatePath('/kontrol-aplikasi');revalidatePath('/dashboard');
  return success(operation==='reset'?'Tema mobile dikembalikan ke warna default.':'Warna aplikasi mobile berhasil diperbarui.');
 }catch(error){
  if(error instanceof z.ZodError)return {ok:false,message:error.issues[0]?.message||'Warna tema tidak valid.'};
  return fail(error);
 }
}


export async function savePlatformPosterAction(_:ActionResult,form:FormData):Promise<ActionResult>{
 await requireDeveloper();
 try{
  const operation=read(form,'operation')||'save';
  if(operation!=='save'&&operation!=='clear')throw new Error('Operasi poster tidak dikenal.');
  const admin=adminClient();
  const {data:current,error:loadError}=await admin.from('platform_settings')
   .select('poster_path,poster_url,poster_title,poster_message').eq('id',true).single();
  if(loadError||!current)throw new Error('Pengaturan platform belum tersedia.');
  const client=await sessionClient();

  if(operation==='clear'){
   const {error}=await client.rpc('set_platform_poster',{
    p_action:'poster_clear',p_path:null,p_url:null,p_title:'',p_message:''
   });
   if(error)throw new Error(error.message);
   if(current.poster_path)await admin.storage.from('platform-posters').remove([String(current.poster_path)]);
   revalidatePath('/kontrol-aplikasi');revalidatePath('/dashboard');
   return success('Poster dinonaktifkan dan dihapus dari tampilan aplikasi.');
  }

  const title=z.string().max(180).parse(read(form,'title'));
  const message=z.string().max(1000).parse(read(form,'message'));
  const rawFile=form.get('poster');
  const file=rawFile instanceof File&&rawFile.size>0?rawFile:null;
  let posterPath=String(current.poster_path||'');
  let posterUrl=String(current.poster_url||'');
  let uploadedPath:string|null=null;

  if(file){
   if(file.size>4*1024*1024)throw new Error('Ukuran poster maksimal 4 MB.');
   const allowed:Record<string,string>={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
   const ext=allowed[file.type];
   if(!ext)throw new Error('Format poster harus JPG, PNG, atau WebP.');
   uploadedPath=`poster/${Date.now()}-${crypto.randomUUID()}.${ext}`;
   const bytes=await file.arrayBuffer();
   const {error:uploadError}=await admin.storage.from('platform-posters').upload(uploadedPath,bytes,{
    contentType:file.type,cacheControl:'3600',upsert:false
   });
   if(uploadError)throw new Error(`Upload poster gagal: ${uploadError.message}`);
   posterPath=uploadedPath;
   posterUrl=admin.storage.from('platform-posters').getPublicUrl(uploadedPath).data.publicUrl;
  }

  if(!posterPath||!posterUrl){
   throw new Error('Pilih gambar poster terlebih dahulu.');
  }

  const {error}=await client.rpc('set_platform_poster',{
   p_action:'poster_update',p_path:posterPath,p_url:posterUrl,p_title:title,p_message:message
  });
  if(error){
   if(uploadedPath)await admin.storage.from('platform-posters').remove([uploadedPath]);
   throw new Error(error.message);
  }

  if(uploadedPath&&current.poster_path&&current.poster_path!==uploadedPath){
   await admin.storage.from('platform-posters').remove([String(current.poster_path)]);
  }
  revalidatePath('/kontrol-aplikasi');revalidatePath('/dashboard');
  return success(file?'Poster baru berhasil dipublikasikan.':'Informasi poster berhasil diperbarui.');
 }catch(error){
  if(error instanceof z.ZodError)return {ok:false,message:error.issues[0]?.message||'Data poster tidak valid.'};
  return fail(error);
 }
}

const featureScopeSchema=z.object({
 featureKey:z.string().regex(/^[a-z][a-z0-9_]{1,60}$/),
 scopeType:z.enum(['global','tenant','role','tenant_role']),
 tenantId:z.string().uuid().nullable().optional(),
 role:z.enum(['developer','leader','admin','teacher','student']).nullable().optional(),
});

export async function setPlatformFeatureFlagAction(input:{
 featureKey:string;scopeType:'global'|'tenant'|'role'|'tenant_role';
 tenantId?:string|null;role?:'developer'|'leader'|'admin'|'teacher'|'student'|null;enabled:boolean;
}):Promise<ActionResult>{
 await requireDeveloper();
 try{
  const parsed=featureScopeSchema.extend({enabled:z.boolean()}).parse(input);
  if((parsed.scopeType==='tenant'||parsed.scopeType==='tenant_role')&&!parsed.tenantId)
   throw new Error('Pilih instansi terlebih dahulu.');
  if((parsed.scopeType==='role'||parsed.scopeType==='tenant_role')&&!parsed.role)
   throw new Error('Pilih role terlebih dahulu.');
  const db=await sessionClient();
  const {error}=await db.rpc('set_platform_feature_flag',{
   p_feature_key:parsed.featureKey,p_scope_type:parsed.scopeType,
   p_tenant_id:parsed.tenantId||null,p_role:parsed.role||null,p_enabled:parsed.enabled,
  });
  if(error)throw new Error(error.message);
  revalidatePath('/kontrol-aplikasi');
  return success(parsed.enabled?'Fitur diaktifkan untuk scope yang dipilih.':'Fitur dinonaktifkan untuk scope yang dipilih.');
 }catch(error){return fail(error);}
}

export async function clearPlatformFeatureFlagAction(input:{
 featureKey:string;scopeType:'global'|'tenant'|'role'|'tenant_role';
 tenantId?:string|null;role?:'developer'|'leader'|'admin'|'teacher'|'student'|null;
}):Promise<ActionResult>{
 await requireDeveloper();
 try{
  const parsed=featureScopeSchema.parse(input);
  if((parsed.scopeType==='tenant'||parsed.scopeType==='tenant_role')&&!parsed.tenantId)
   throw new Error('Pilih instansi terlebih dahulu.');
  if((parsed.scopeType==='role'||parsed.scopeType==='tenant_role')&&!parsed.role)
   throw new Error('Pilih role terlebih dahulu.');
  const db=await sessionClient();
  const {error}=await db.rpc('clear_platform_feature_flag',{
   p_feature_key:parsed.featureKey,p_scope_type:parsed.scopeType,
   p_tenant_id:parsed.tenantId||null,p_role:parsed.role||null,
  });
  if(error)throw new Error(error.message);
  revalidatePath('/kontrol-aplikasi');
  return success('Override dihapus. Fitur kembali mengikuti pengaturan level di atasnya.');
 }catch(error){return fail(error);}
}

export async function saveRuntimePolicyAction(_:ActionResult,form:FormData):Promise<ActionResult>{
 await requireDeveloper();
 try{
  const parsed=z.object({
   readOnly:z.boolean(),minimum:z.string().regex(/^[0-9]+(\.[0-9]+){0,3}$/),
   latest:z.string().regex(/^[0-9]+(\.[0-9]+){0,3}$/),forceUpdate:z.boolean(),
   message:z.string().min(1).max(500),updateUrl:z.string().max(1000),
  }).parse({
   readOnly:read(form,'read_only')==='true',minimum:read(form,'minimum_app_version'),
   latest:read(form,'latest_app_version'),forceUpdate:read(form,'force_update')==='true',
   message:read(form,'update_message'),updateUrl:read(form,'update_url').trim(),
  });
  if(parsed.updateUrl){
   let url:URL;
   try{url=new URL(parsed.updateUrl);}catch{throw new Error('Link aplikasi versi terbaru tidak valid.');}
   if(!['http:','https:'].includes(url.protocol))throw new Error('Link aplikasi harus menggunakan http atau https.');
  }
  if(parsed.forceUpdate&&!parsed.updateUrl)throw new Error('Link aplikasi versi terbaru wajib diisi saat pembaruan diwajibkan.');

  const admin=adminClient();
  const {data:current}=await admin.from('platform_settings').select('latest_app_version,force_update').eq('id',true).maybeSingle();
  const db=await sessionClient();
  const {error}=await db.rpc('set_platform_runtime_policy',{
   p_read_only:parsed.readOnly,p_minimum_app_version:parsed.minimum,
   p_latest_app_version:parsed.latest,p_force_update:parsed.forceUpdate,
   p_update_message:parsed.message,p_update_url:parsed.updateUrl,
  });
  if(error)throw new Error(error.message);
  revalidatePath('/kontrol-aplikasi');revalidatePath('/dashboard');

  const versionChanged=current?.latest_app_version!==parsed.latest;
  const forceChanged=current?.force_update!==parsed.forceUpdate;
  const updateNotice=versionChanged||forceChanged||parsed.forceUpdate;
  const pushWarning=await sendPushEvent({type:'platform',platform:{
   title:updateNotice?(parsed.forceUpdate?'Pembaruan aplikasi wajib':`Versi ${parsed.latest} tersedia`):parsed.readOnly?'Mode hanya-baca aktif':'Kebijakan aplikasi diperbarui',
   body:updateNotice?parsed.message:parsed.readOnly?'Aplikasi sementara hanya dapat digunakan untuk melihat data.':'Pengaturan akses aplikasi telah diperbarui oleh pengelola platform.',
   route:'/notifications',category:updateNotice?'app_update':'system',dedupe_key:`runtime-policy:${parsed.minimum}:${parsed.latest}:${parsed.forceUpdate}:${parsed.readOnly}:${crypto.randomUUID()}`
  }});
  return success(withPushStatus('Kebijakan runtime aplikasi berhasil disimpan.',pushWarning));
 }catch(error){return fail(error);}
}
