import 'server-only';
import {sessionClient} from './supabase';

export type PushEvent =
 | {type:'entity'|'spp_invoice'|'spp_payment'|'subscription';record_id:string}
 | {type:'platform';platform:{title:string;body:string;route?:string;category?:string;dedupe_key?:string;tenant_id?:string|null;role?:'developer'|'leader'|'admin'|'teacher'|'student'|null}};

/** Push bersifat best-effort: operasi utama tetap sukses walaupun FCM sedang bermasalah. */
export async function sendPushEvent(event:PushEvent):Promise<string|null>{
 try{
  const db=await sessionClient();
  const {data,error}=await db.functions.invoke('push-notification',{body:event});
  if(error)return error.message||'Edge Function push-notification gagal.';
  if(!data||data.ok!==true)return typeof data?.error==='string'?data.error:'Push notification belum dapat dikirim.';
  const failed=Number(data.failed||0),sent=Number(data.sent||0),skipped=Number(data.skipped||0);
  if(failed>0)return `Sebagian push gagal dikirim (${failed} perangkat).`;
  if(sent===0&&skipped===0&&Number(data.notifications||0)>0)return 'Belum ada perangkat aktif yang terdaftar untuk target notifikasi.';
  return null;
 }catch(error){return error instanceof Error?error.message:'Push notification belum dapat dikirim.';}
}

export function withPushStatus(message:string,warning:string|null){
 return warning?`${message} Data tersimpan, tetapi push notification belum terkirim: ${warning}`:`${message} Push notification dikirim.`;
}
