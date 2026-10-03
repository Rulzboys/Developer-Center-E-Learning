import 'server-only';
import {adminClient,requireDeveloper,safeSearch,validateUUID} from '@/lib/supabase';
import type {LearningEntity,Profile,Tenant} from '@/lib/types';
import {allTenants} from '@/lib/queries';
export type Options={teachers:Pick<Profile,'id'|'name'|'tenant_id'|'class_id'>[];students:Pick<Profile,'id'|'name'|'tenant_id'|'class_id'>[];classes:LearningEntity[];subjects:LearningEntity[];assignments:LearningEntity[]};
export async function academicOptions(tenant=''):Promise<Options>{
 await requireDeveloper();const db=adminClient();
 let p=db.from('profiles').select('id,name,tenant_id,class_id,role').in('role',['student','teacher']).order('name').limit(1500);
 let e=db.from('learning_entities').select('id,tenant_id,kind,data,author_id,created_at').in('kind',['classroom','subject','assignment']).order('created_at',{ascending:false}).limit(1500);
 if(tenant){p=p.eq('tenant_id',tenant);e=e.eq('tenant_id',tenant)}
 const [profiles,entities]=await Promise.all([p,e]);if(profiles.error||entities.error)throw new Error(profiles.error?.message||entities.error?.message);
 const rows=(profiles.data||[]) as (Profile[]);const items=(entities.data||[]) as LearningEntity[];
 return {teachers:rows.filter(r=>r.role==='teacher'),students:rows.filter(r=>r.role==='student'),classes:items.filter(e=>e.kind==='classroom'),subjects:items.filter(e=>e.kind==='subject'),assignments:items.filter(e=>e.kind==='assignment')};
}
export async function academicPage(kind:string,search:{tenant?:string;q?:string;page?:string}){
 await requireDeveloper();const db=adminClient(),tenants=await allTenants();
 const tenant=validateUUID(search.tenant||'')?search.tenant||'':'';const q=safeSearch(search.q);const page=Math.max(1,Math.min(50000,Number(search.page)||1));
 let request=db.from('learning_entities').select('id,tenant_id,kind,data,author_id,created_at',{count:'exact'}).eq('kind',kind).order('created_at',{ascending:false}).range((page-1)*20,page*20-1);
 if(tenant)request=request.eq('tenant_id',tenant);
 // JSON content filtering uses a safe server-side ILIKE matching string fields.
 if(q)request=request.or(`data->>name.ilike.%${q}%,data->>title.ilike.%${q}%`);
 const [{data,count,error},opts]=await Promise.all([request,academicOptions(tenant)]);
 if(error)throw new Error(error.message);
 return {records:(data||[]) as LearningEntity[],count:count||0,opts,tenants:tenants as Tenant[],tenant,page,q};
}
