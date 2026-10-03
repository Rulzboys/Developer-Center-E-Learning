import {PageHead,Empty,Pager,FilterBar,TenantSelect,Pill} from '@/components/ui';
import {InvoiceEditor,InvoiceDelete,InvoiceArchive} from '@/components/owner/finance-editor';
import {adminClient,requireDeveloper,validateUUID,safeSearch} from '@/lib/supabase';
import {allTenants} from '@/lib/queries';
import {academicOptions} from '@/lib/owner/academic-repository';
import {rupiah,date} from '@/lib/format';
import type {Invoice} from '@/lib/types';
export default async function Invoices({searchParams}:{searchParams:Promise<{tenant?:string;q?:string;page?:string}>}){
 await requireDeveloper();const sp=await searchParams;const tenant=validateUUID(sp.tenant||'')?sp.tenant||'':'';const q=safeSearch(sp.q);const page=Math.max(1,Math.min(10000,Number(sp.page)||1));
 let query=adminClient().from('spp_invoices').select('id,tenant_id,student_id,title,period,amount,due_date,allow_partial,archived,created_at',{count:'exact'}).order('created_at',{ascending:false}).range((page-1)*20,page*20-1);
 if(tenant)query=query.eq('tenant_id',tenant);if(q)query=query.or(`title.ilike.%${q}%,period.ilike.%${q}%`);
 const [{data,count,error},tenants,options]=await Promise.all([query,allTenants(),academicOptions(tenant)]);if(error)throw new Error(error.message);
 const names=Object.fromEntries(tenants.map(t=>[t.id,t.name]));const students=Object.fromEntries(options.students.map(s=>[s.id,s.name]));
 return <><PageHead overline="KEUANGAN / TAGIHAN" title="Manajemen Tagihan SPP" description="Buat, ubah, arsipkan, atau hapus tagihan per instansi. Tagihan yang mempunyai pembayaran dilindungi." actions={<InvoiceEditor tenants={tenants} options={options} defaultTenant={tenant}/>}/>
 <section className="surface"><div className="surface-heading"><div><h2>Daftar tagihan</h2><p>Nominal dan status dari database Supabase.</p></div><span className="surface-count">{count||0} tagihan</span></div><div className="surface-pad"><FilterBar action="/spp/tagihan" query={q} placeholder="Cari tagihan / periode"><TenantSelect value={tenant} tenants={tenants}/></FilterBar></div><div className="table-scroll"><table className="data-table"><thead><tr><th>TAGIHAN</th><th>SISWA / INSTANSI</th><th>NOMINAL</th><th>JATUH TEMPO</th><th>STATUS</th><th className="right">TINDAKAN</th></tr></thead><tbody>{((data||[]) as Invoice[]).map(i=><tr key={i.id}><td><b>{i.title}</b><span className="subline">{i.period}</span></td><td>{students[i.student_id]||i.student_id.slice(0,8)}<span className="subline">{names[i.tenant_id]||'—'}</span></td><td>{rupiah(i.amount)}</td><td className="cell-muted">{date(i.due_date)}</td><td><Pill text={i.archived?'Arsip':'Aktif'} tone={i.archived?'neutral':'success'}/></td><td><div className="table-actions"><InvoiceEditor invoice={i} tenants={tenants} options={options}/><InvoiceArchive invoice={i}/><InvoiceDelete invoice={i}/></div></td></tr>)}</tbody></table>{!data?.length&&<Empty text="Tidak ada tagihan sesuai filter."/>}</div><Pager base="/spp/tagihan" page={page} count={count||0} filters={{tenant,q}}/></section></>;
}
