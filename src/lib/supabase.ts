import 'server-only';
import {createClient, type SupabaseClient} from '@supabase/supabase-js';
import {createServerClient, type CookieOptions} from '@supabase/ssr';
import {cookies} from 'next/headers';
import {cache} from 'react';
import {redirect} from 'next/navigation';
import type {Profile} from './types';

export function publicEnv(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!key)throw new Error('NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY belum diatur.');
 return {url,key};
}
export async function sessionClient(){
 const {url,key}=publicEnv();
 const store=await cookies();
 return createServerClient(url,key,{
  cookies:{
   getAll(){return store.getAll();},
   setAll(items:{name:string;value:string;options:CookieOptions}[]){try{items.forEach(({name,value,options})=>store.set(name,value,{...options,httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production'}));}catch{/* SSR Server Components cannot write cookies; middleware refreshes them. */}}
  }
 });
}
/** NEVER import this into a Client Component or any public API route. */
export function adminClient():SupabaseClient {
 const {url}=publicEnv();
 const secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!secret)throw new Error('SUPABASE_SERVICE_ROLE_KEY belum diatur di server.');
 return createClient(url,secret,{auth:{autoRefreshToken:false,persistSession:false}});
}
export const requireDeveloper=cache(async ():Promise<{userId:string;profile:Profile}>=>{
 const client=await sessionClient();
 const {data:{user},error}=await client.auth.getUser();
 if(error||!user)redirect('/login');
 const {data:profile, error:profileError}=await client.from('profiles').select('*').eq('id',user.id).maybeSingle();
 if(profileError || !profile || profile.role!=='developer' || !profile.active || profile.tenant_id!==null)redirect('/no-access');
 return {userId:user.id,profile:profile as Profile};
});
/** Generic paginated read for exports and accurate dashboard sum; never fetches raw credentials. */
export async function readAll<T>(table:'subscription_orders', columns:string, filters:(q:any)=>any):Promise<T[]>{
 const db=adminClient();const pageSize=500;const rows:T[]=[];
 for(let offset=0;offset<20000;offset+=pageSize){
  const q=filters(db.from(table).select(columns).order('id',{ascending:true}).range(offset,offset+pageSize-1));
  const {data,error}=await q;
  if(error)throw new Error(error.message);
  rows.push(...((data||[]) as T[]));
  if(!data||data.length<pageSize)return rows;
 }
 throw new Error('Terlalu banyak data untuk metrik dashboard (>20.000). Gunakan agregasi SQL sebelum memakai skala besar.');
}
/** PostgREST OR search syntax: remove delimiter/control characters to avoid expression injection. */
export function safeSearch(value?:string){return (value||'').replace(/[^\p{L}\p{N}\s-]/gu,' ').replace(/\s+/g,' ').trim().slice(0,64);}
export function validateUUID(v:string){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);}
