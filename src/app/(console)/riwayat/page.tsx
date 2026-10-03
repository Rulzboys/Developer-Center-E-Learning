import {PageHead,Empty,Pager,FilterBar,TenantSelect} from '@/components/ui';
import {adminClient,requireDeveloper,validateUUID,safeSearch} from '@/lib/supabase';
import {allTenants} from '@/lib/queries';
import {datetime} from '@/lib/format';
export default async function Audit({searchParams}:{searchParams:Promise<{tenant?:string;resource?:string;page?:string}>}){
 await requireDeveloper();const sp=await searchParams;const tenant=validateUUID(sp.tenant||'')?sp.tenant||'':'';const resource=safeSearch(sp.resource);const page=Math.max(1,Math.min(10000,Number(sp.page)||1));
 let query=adminClient().from('owner_audit').select('id,actor_id,tenant_id,resource,action,record_id,created_at',{count:'exact'}).order('created_at',{ascending:false}).range((page-1)*20,page*20-1);
 if(tenant)query=query.eq('tenant_id',tenant);if(resource)query=query.eq('resource',resource);
 const [{data,error,count},tenants]=await Promise.all([query,allTenants()]);if(error)throw new Error(error.message);
 const names=Object.fromEntries(tenants.map(t=>[t.id,t.name]));
 return <><PageHead overline="SISTEM / AUDIT" title="Riwayat Aktivitas Developer" description="Pantau perubahan pengguna, data akademik, tagihan, QRIS dan transaksi manual. Riwayat ini dibuat oleh migrasi V3; aktivitas sebelum migrasi tidak muncul di sini."/>
 <section className="surface"><div className="surface-heading"><div><h2>Aktivitas pengelolaan</h2><p>Catatan otomatis untuk tindakan penting Developer.</p></div><span className="surface-count">{count||0} aktivitas</span></div><div className="surface-pad"><FilterBar action="/riwayat" hideSearch><TenantSelect value={tenant} tenants={tenants}/><select name="resource" defaultValue={resource} aria-label="Filter aktivitas"><option value="">Semua kategori</option>{['profiles','tenants','classroom','subject','assignment','attendance','material','memorization','submission','schedule','announcement','spp_invoices','spp_payments','qris','gateway'].map(r=><option key={r} value={r}>{r}</option>)}</select></FilterBar></div>
 <div className="table-scroll"><table className="data-table"><thead><tr><th>WAKTU (WIB)</th><th>AKSI</th><th>KATEGORI</th><th>INSTANSI</th><th>REFERENSI</th></tr></thead><tbody>{(data||[]).map(a=><tr key={a.id}><td>{datetime(a.created_at)}</td><td><span className="simple-tag">{a.action}</span></td><td>{a.resource}</td><td className="cell-muted">{a.tenant_id?names[a.tenant_id]||'Instansi telah dihapus':'Platform'}</td><td className="mono cell-muted">{a.record_id.slice(0,8)}</td></tr>)}</tbody></table>{!data?.length&&<Empty text="Belum ada aktivitas untuk filter ini. Jalankan migrasi V3 terlebih dahulu."/>}</div><Pager base="/riwayat" page={page} count={count||0} filters={{tenant,resource}}/></section></>;
}
