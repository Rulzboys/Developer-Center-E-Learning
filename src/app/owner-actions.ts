'use server';
import {revalidatePath} from 'next/cache';
import {z} from 'zod';
import {adminClient,requireDeveloper,sessionClient} from '@/lib/supabase';
import type {ActionResult,Role} from '@/lib/types';
import {entityKinds} from '@/lib/types';
import {academicFields} from '@/lib/owner/academic-config';
import {sendPushEvent,withPushStatus} from '@/lib/push';

const val=(fd:FormData,key:string)=>String(fd.get(key)??'').trim();
const ok=(message:string):ActionResult=>({ok:true,message});
const fail=(error:unknown):ActionResult=>({ok:false,message:error instanceof z.ZodError?(error.issues[0]?.message||'Data tidak valid'):error instanceof Error?error.message:'Operasi tidak berhasil'});
const uuid=z.string().uuid();
const profileSchema=z.object({
 id:z.string().uuid().optional(),name:z.string().trim().min(1).max(160),email:z.string().email().max(254),
 role:z.enum(['developer','leader','admin','teacher','student']),tenant_id:z.string().uuid().nullable(),
 class_id:z.string().uuid().nullable(),phone:z.string().max(40),number:z.string().max(80),active:z.boolean()
}).superRefine((p,ctx)=>{if((p.role==='developer')!==(p.tenant_id===null))ctx.addIssue({code:'custom',message:'Developer tidak boleh terikat instansi dan role lain wajib memilih instansi.'});if(p.role!=='student'&&p.class_id)ctx.addIssue({code:'custom',message:'Hanya siswa boleh memiliki kelas'});});
function refresh(){for(const p of ['/akun','/pengguna','/dashboard','/akademik','/instansi','/perkembangan','/spp','/qris'])revalidatePath(p,'layout');}
export async function saveOwnerProfileAction(_:ActionResult,fd:FormData):Promise<ActionResult>{
 await requireDeveloper();let createdId:string|null=null;
 try{
  const id=val(fd,'id');const p=profileSchema.parse({id:id||undefined,name:val(fd,'name'),email:val(fd,'email').toLowerCase(),role:val(fd,'role'),
   tenant_id:val(fd,'tenant_id')||null,class_id:val(fd,'class_id')||null,number:val(fd,'number'),phone:val(fd,'phone'),active:val(fd,'active')==='true'});
  const db=adminClient();let targetId=id;
  if(!targetId){
   const password=String(fd.get('password')??'');if(password.length<12||password.length>72)throw new Error('Kata sandi awal harus 12–72 karakter.');
   const {data,error}=await db.auth.admin.createUser({email:p.email,password,email_confirm:true});
   if(error||!data.user)throw new Error(error?.message||'Gagal membuat akun Authentication.');
   targetId=data.user.id;createdId=targetId;
  }else{
   const {data:existing,error}=await db.from('profiles').select('id,email').eq('id',targetId).maybeSingle();
   if(error||!existing)throw new Error('Profil pengguna tidak ditemukan.');
   if(existing.email.toLowerCase()!==p.email)throw new Error('Email akun yang sudah dibuat tidak boleh diganti melalui form ini.');
  }
  const session=await sessionClient();
  const {error}=await session.rpc('owner_profile_action',{p_action:'save',p_profile:{...p,id:targetId}});
  if(error)throw new Error(error.message);
  refresh();return ok(id?'Akun dan akses diperbarui.':'Akun Authentication dan profil berhasil dibuat.');
 }catch(error){if(createdId){const rollback=await adminClient().auth.admin.deleteUser(createdId);if(rollback.error)return fail(new Error('Profil gagal dibuat dan rollback Auth gagal. Periksa akun orphan '+createdId+'. '+rollback.error.message));}return fail(error);}
}
export async function deleteOwnerProfileAction(_:ActionResult,fd:FormData):Promise<ActionResult>{
 const {userId}=await requireDeveloper();try{
  const id=uuid.parse(val(fd,'id'));if(id===userId)throw new Error('Tidak boleh menghapus akun sendiri.');
  if(val(fd,'confirmation')!=='HAPUS')throw new Error('Ketik HAPUS untuk konfirmasi.');
  const {error}=await (await sessionClient()).rpc('owner_profile_action',{p_action:'delete',p_profile:{id}});
  if(error)throw new Error(error.message);
  const auth=await adminClient().auth.admin.deleteUser(id);
  if(auth.error)throw new Error('Profil dihapus, tetapi penghapusan Supabase Auth gagal. Hapus user ini secara manual setelah memeriksa FK: '+auth.error.message);
  refresh();return ok('Akun dihapus dari profiles dan Authentication.');
 }catch(error){return fail(error);}
}
export async function saveOwnerEntityAction(_:ActionResult,fd:FormData):Promise<ActionResult>{
 await requireDeveloper();try{
  const id=val(fd,'id')||crypto.randomUUID(),tenant_id=uuid.parse(val(fd,'tenant_id'));const kind=val(fd,'kind');
  if(!(entityKinds as readonly string[]).includes(kind))throw new Error('Jenis akademik tidak didukung.');
  // Read old JSON from the trusted database. Never trust browser-provided original values.
  const current=await adminClient().from('learning_entities').select('id,tenant_id,kind,data').eq('id',id).maybeSingle();
  if(current.error)throw current.error;
  if(current.data&&(current.data.tenant_id!==tenant_id||current.data.kind!==kind))throw new Error('Data tidak sesuai instansi atau jenis aslinya.');
  const data:Record<string,unknown>={...(current.data?.data||{})};
  const allowed=new Set((academicFields[kind]||[]).map(field=>field.key));
  for(const [key,value] of fd.entries()){
   if(!key.startsWith('field_'))continue;
   const field=key.substring(6);if(!allowed.has(field))throw new Error('Field tidak dikenali');
   if(value instanceof File)throw new Error('Lampiran belum didukung melalui form ini.');
   const text=String(value).trim();if(text===''){delete data[field];continue;}
   data[field]=['targetCount','startVerse','endVerse','fluency','tajwid','makhraj','score'].includes(field)?z.coerce.number().int().parse(text):field==='dueAt'?new Date(text+'+07:00').toISOString():text;
  }
  const {error}=await (await sessionClient()).rpc('owner_entity_action',{p_action:'save',p_entity:{id,tenant_id,kind,data}});
  if(error)throw new Error(error.message);refresh();revalidatePath('/akademik/'+kind);
  const pushWarning=['announcement','assignment','submission','memorization'].includes(kind)?await sendPushEvent({type:'entity',record_id:id}):null;
  return ok(withPushStatus('Data '+kind+' berhasil disimpan.',pushWarning));
 }catch(error){return fail(error)}
}
export async function deleteOwnerEntityAction(_:ActionResult,fd:FormData):Promise<ActionResult>{
 await requireDeveloper();try{
  const id=uuid.parse(val(fd,'id'));if(val(fd,'confirmation')!=='HAPUS')throw new Error('Ketik HAPUS untuk menghapus data.');
  const {error}=await (await sessionClient()).rpc('owner_entity_action',{p_action:'delete',p_entity:{id}});
  if(error)throw new Error(error.message);refresh();return ok('Data berhasil dihapus.');
 }catch(error){return fail(error)}
}
const invoiceSchema=z.object({id:z.string().uuid(),tenant_id:z.string().uuid(),student_id:z.string().uuid(),title:z.string().min(1).max(160),period:z.string().min(1).max(60),amount:z.coerce.number().int().min(1).max(1_000_000_000),due_date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),allow_partial:z.boolean(),archived:z.boolean()});
export async function saveOwnerInvoiceAction(_:ActionResult,fd:FormData):Promise<ActionResult>{
 await requireDeveloper();try{
  const invoice=invoiceSchema.parse({id:val(fd,'id')||crypto.randomUUID(),tenant_id:val(fd,'tenant_id'),student_id:val(fd,'student_id'),title:val(fd,'title'),period:val(fd,'period'),amount:val(fd,'amount'),due_date:val(fd,'due_date'),allow_partial:val(fd,'allow_partial')==='true',archived:val(fd,'archived')==='true'});
  const {error}=await (await sessionClient()).rpc('owner_invoice_action',{p_action:'save',p_data:invoice});
  if(error)throw new Error(error.message);revalidatePath('/spp');
  const pushWarning=await sendPushEvent({type:'spp_invoice',record_id:invoice.id});
  return ok(withPushStatus('Tagihan tersimpan.',pushWarning));
 }catch(error){return fail(error)}
}
export async function deleteOwnerInvoiceAction(_:ActionResult,fd:FormData):Promise<ActionResult>{
 await requireDeveloper();try{
  const id=uuid.parse(val(fd,'id'));if(val(fd,'confirmation')!=='HAPUS')throw new Error('Ketik HAPUS.');
  const {error}=await (await sessionClient()).rpc('owner_invoice_action',{p_action:'delete',p_data:{id}});
  if(error)throw new Error(error.message);revalidatePath('/spp');return ok('Tagihan dihapus.');
 }catch(error){return fail(error)}
}
export async function archiveOwnerInvoiceAction(_:ActionResult,fd:FormData):Promise<ActionResult>{
 await requireDeveloper();try{
  const id=uuid.parse(val(fd,'id'));if(val(fd,'confirmation')!=='ARSIP')throw new Error('Ketik ARSIP untuk konfirmasi.');
  const {data,error}=await (await sessionClient()).rpc('owner_invoice_action',{p_action:'archive',p_data:{id}});
  if(error)throw new Error(error.message);revalidatePath('/spp');return ok(data?.archived?'Tagihan diarsipkan.':'Tagihan diaktifkan kembali.');
 }catch(error){return fail(error)}
}
export async function saveOwnerQrisAction(_:ActionResult,fd:FormData):Promise<ActionResult>{
 await requireDeveloper();try{
  const kind=z.enum(['qris','gateway']).parse(val(fd,'kind'));const tenant_id=uuid.parse(val(fd,'tenant_id'));
  const data={tenant_id,enabled:val(fd,'enabled')==='true',contact_phone:val(fd,'contact_phone').slice(0,40),nominal_enabled:val(fd,'nominal_enabled')==='true',payload:val(fd,'payload'),external_store_id:val(fd,'external_store_id')};
  if(kind==='qris'&&val(fd,'consent')!=='yes')throw new Error('Konfirmasi kewenangan merchant sebelum mengubah QRIS.');
  const {error}=await (await sessionClient()).rpc('owner_qris_action',{p_kind:kind,p_data:data});
  if(error)throw new Error(error.message);revalidatePath('/qris');return ok('Pengaturan '+kind.toUpperCase()+' berhasil disimpan.');
 }catch(error){return fail(error)}
}
export async function reviewOwnerPaymentAction(_:ActionResult,fd:FormData):Promise<ActionResult>{
 await requireDeveloper();try{
  const id=uuid.parse(val(fd,'id'));const status=z.enum(['matched','disputed']).parse(val(fd,'status'));
  const note=z.string().trim().min(4).max(500).parse(val(fd,'note'));const bank=val(fd,'bank_reference');
  if(status==='matched'&&!bank)throw new Error('Referensi mutasi bank wajib diisi');
  const {error}=await (await sessionClient()).rpc('owner_payment_reconcile',{p_id:id,p_status:status,p_note:note,p_bank_reference:bank});
  if(error)throw new Error(error.message);revalidatePath('/spp');
  const pushWarning=await sendPushEvent({type:'spp_payment',record_id:id});
  return ok(withPushStatus('Review pembayaran dicatat dalam audit.',pushWarning));
 }catch(error){return fail(error)}
}

export async function deleteOwnerTenantAction(_:ActionResult,fd:FormData):Promise<ActionResult>{
 await requireDeveloper();try{
  const id=uuid.parse(val(fd,'id'));if(val(fd,'confirmation')!=='HAPUS')throw new Error('Ketik HAPUS untuk konfirmasi.');
  const {error}=await (await sessionClient()).rpc('owner_delete_tenant',{p_id:id});
  if(error)throw new Error(error.message);revalidatePath('/instansi');revalidatePath('/dashboard');return ok('Instansi kosong berhasil dihapus.');
 }catch(error){return fail(error)}
}
