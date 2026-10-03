import 'server-only';
import {allTenants} from '@/lib/queries';
import {adminClient,requireDeveloper,safeSearch,validateUUID} from '@/lib/supabase';
import {academicOptions} from '@/lib/owner/academic-repository';
import type {Profile,Role} from '@/lib/types';
const roles=['developer','leader','admin','teacher','student'];
export const roleLabels:Record<Role,string>={developer:'Developer',leader:'Pimpinan',admin:'Admin',teacher:'Guru',student:'Siswa'};
export async function usersPage(search:{role?:string;tenant?:string;q?:string;page?:string},forcedRole?:string){
 await requireDeveloper();const role=roles.includes(forcedRole||search.role||'')?(forcedRole||search.role||''):'';const tenant=validateUUID(search.tenant||'')?search.tenant||'':'';const q=safeSearch(search.q);
 const page=Math.max(1,Math.min(10000,Number(search.page)||1));let req=adminClient().from('profiles').select('id,tenant_id,name,email,role,class_id,number,phone,active,photo_path',{count:'exact'}).order('name').range((page-1)*20,page*20-1);
 if(role)req=req.eq('role',role);if(tenant)req=req.eq('tenant_id',tenant);if(q)req=req.or(`name.ilike.%${q}%,email.ilike.%${q}%`);
 const [result,tenants,options]=await Promise.all([req,allTenants(),academicOptions(tenant)]);
 if(result.error)throw new Error(result.error.message);
 return {records:(result.data||[]) as Profile[],count:result.count||0,tenants,options,q,tenant,page,role};
}
