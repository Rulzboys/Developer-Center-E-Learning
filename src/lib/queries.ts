import 'server-only';
import {adminClient} from './supabase';
import type {Tenant} from './types';
/** Paging prevents Supabase's default 1,000-row cap from corrupting counters. */
export async function allTenants():Promise<Tenant[]>{
 const db=adminClient();const rows:Tenant[]=[];
 for(let offset=0;offset<20000;offset+=500){
  const {data,error}=await db.from('tenants').select('*').order('id').range(offset,offset+499);
  if(error)throw new Error(error.message);
  rows.push(...(data as Tenant[]));if((data?.length||0)<500)return rows;
 }
 throw new Error('Instansi lebih dari 20.000: perhitungan perlu query agregasi tersendiri.');
}
export async function tableCount(table:'profiles'|'learning_entities'|'subscription_orders'|'spp_invoices'|'spp_payments',filter?:{column:string,value:string}){
 const db=adminClient();let q=db.from(table).select('*',{head:true,count:'exact'});
 if(filter)q=q.eq(filter.column,filter.value);
 const {count,error}=await q;if(error)throw new Error(error.message);return count||0;
}
export async function tenantNames(){const all=await allTenants();return all.map(({id,name})=>({id,name})).sort((a,b)=>a.name.localeCompare(b.name,'id'));}
export async function tenantIndex(){return Object.fromEntries((await allTenants()).map(t=>[t.id,t]));}
