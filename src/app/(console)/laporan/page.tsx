import Link from 'next/link';
import {ArrowUpRight,BarChart3,BookOpen,Building2,CreditCard,Download,GraduationCap,Users} from 'lucide-react';
import {PageHead} from '@/components/ui';
import {adminClient,requireDeveloper,readAll,validateUUID} from '@/lib/supabase';
import {allTenants} from '@/lib/queries';
import {kindLabels,entityKinds,type SubscriptionOrder} from '@/lib/types';
import {accessStatus,integer,rupiah} from '@/lib/format';
export default async function Reports({searchParams}:{searchParams:Promise<{tenant?:string;period?:string}>}){
 await requireDeveloper();
 const sp=await searchParams, tenants=await allTenants();
 const tenant=validateUUID(sp.tenant||'')&&tenants.some(t=>t.id===sp.tenant)?sp.tenant!:'';
 const period=(['month','quarter','year'] as const).includes(sp.period as 'month'|'quarter'|'year')?sp.period||'month':'month';
 const now=new Date();
 const jakarta=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Jakarta',year:'numeric',month:'numeric'}).formatToParts(now);
 const year=Number(jakarta.find(p=>p.type==='year')?.value), month=Number(jakarta.find(p=>p.type==='month')?.value);
 const begin=period==='year'?1:period==='quarter'?Math.floor((month-1)/3)*3+1:month;
 const since=new Date(Date.UTC(year,begin-1,1,-7)).toISOString();
 const db=adminClient();
 const counts=(table:'profiles'|'learning_entities'|'spp_invoices'|'spp_payments', column?:string,value?:string)=>{
  let q=db.from(table).select('*',{count:'exact',head:true});if(tenant)q=q.eq('tenant_id',tenant);if(column&&value)q=q.eq(column,value);return q;
 };
 const [users,students,academic,invoices,reports,matched,plans,paid]=await Promise.all([
  counts('profiles'),counts('profiles','role','student'),counts('learning_entities'),counts('spp_invoices'),
  counts('spp_payments','status','reported'),counts('spp_payments','status','matched'),
  Promise.all(entityKinds.map(kind=>counts('learning_entities','kind',kind))),
  readAll<Pick<SubscriptionOrder,'amount'|'tenant_id'|'plan'|'paid_at'>>('subscription_orders','id,amount,tenant_id,plan,paid_at',q=>tenant?q.eq('tenant_id',tenant).eq('status','paid').gte('paid_at',since):q.eq('status','paid').gte('paid_at',since))
 ]);
 const values=[users,students,academic,invoices,reports,matched,...plans];
 if(values.some(r=>r.error))throw new Error(values.find(r=>r.error)?.error?.message||'Tidak dapat memuat laporan.');
 const revenue=paid.reduce((sum,x)=>sum+x.amount,0);
 const annual=paid.filter(x=>x.plan==='annual');const monthly=paid.filter(x=>x.plan==='monthly');
 const kinds=entityKinds.map((kind,i)=>({kind,label:kindLabels[kind],count:plans[i].count||0})).sort((a,b)=>b.count-a.count);
 const greatest=Math.max(...kinds.map(k=>k.count),1);
 const filteredTenants=tenant?tenants.filter(t=>t.id===tenant):tenants;
 const active=filteredTenants.filter(t=>accessStatus(t).tone==='success').length;
 const expire=filteredTenants.filter(t=>t.status==='active'&&new Date(t.expires_at)>now&&new Date(t.expires_at).getTime()<now.getTime()+30*86400000).length;
 const csv=(resource:string)=>`/api/export/${resource}${tenant?'?tenant='+tenant:''}`;
 const paidCsv='/api/export/langganan?'+new URLSearchParams({status:'paid',paid_since:since,...(tenant?{tenant}:{})}).toString();
 return <><PageHead overline="ANALYTICS / INSIGHT" title="Laporan & analitik" description="Ringkasan operasional platform untuk membantu pemantauan seluruh instansi." actions={<Link href={paidCsv} className="button primary"><Download size={18}/> Ekspor transaksi</Link>}/>
 <form action="/laporan" className="report-filters"><div><label htmlFor="report-tenant">Lingkup instansi</label><select id="report-tenant" name="tenant" defaultValue={tenant}><option value="">Semua instansi</option>{tenants.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></div><div><label htmlFor="report-period">Periode langganan</label><select id="report-period" name="period" defaultValue={period}><option value="month">Bulan ini</option><option value="quarter">Triwulan ini</option><option value="year">Tahun ini</option></select></div><button type="submit" className="button primary">Terapkan filter</button><span className="report-explain">Jumlah akademik dan akun adalah total keseluruhan; pendapatan mengikuti periode.</span></form>
 <div className="report-kpis"><div><span className="report-kpi-icon tint-blue"><Building2 size={22}/></span><small>Instansi aktif</small><strong>{integer(active)}</strong><p>{integer(filteredTenants.length)} instansi dalam lingkup</p></div><div><span className="report-kpi-icon tint-teal"><Users size={22}/></span><small>Total pengguna</small><strong>{integer(users.count||0)}</strong><p>{integer(students.count||0)} siswa / santri</p></div><div><span className="report-kpi-icon tint-purple"><GraduationCap size={22}/></span><small>Data akademik</small><strong>{integer(academic.count||0)}</strong><p>Semua jenis data pembelajaran</p></div><div><span className="report-kpi-icon tint-gold"><CreditCard size={22}/></span><small>Pendapatan langganan</small><strong>{rupiah(revenue)}</strong><p>{integer(paid.length)} transaksi lunas dalam periode</p></div></div>
 <div className="report-cols"><section className="dash-panel"><div className="dash-panel-head"><div><span className="dash-overline"><BookOpen size={16}/> DISTRIBUSI</span><h2>Komposisi data akademik</h2><p>Jumlah per jenis, {tenant?'untuk instansi terpilih':'seluruh instansi'}.</p></div></div><div className="kind-report">{kinds.map(x=><div key={x.kind}><span>{x.label}</span><div><i style={{width:`${x.count/greatest*100}%`}}/></div><b>{integer(x.count)}</b></div>)}</div></section>
 <section className="dash-panel"><div className="dash-panel-head"><div><span className="dash-overline"><BarChart3 size={16}/> KEUANGAN</span><h2>Langganan & SPP</h2><p>Rincian pengawasan, bukan pencatatan laba.</p></div></div><div className="finance-summary"><div><span>Langganan bulanan lunas</span><b>{rupiah(monthly.reduce((a,x)=>a+x.amount,0))}</b><small>{monthly.length} transaksi</small></div><div><span>Langganan tahunan lunas</span><b>{rupiah(annual.reduce((a,x)=>a+x.amount,0))}</b><small>{annual.length} transaksi</small></div><div><span>Tagihan SPP diterbitkan</span><b>{integer(invoices.count||0)}</b><small>Total seluruh periode</small></div><div><span>Pembayaran SPP butuh review</span><b>{integer(reports.count||0)}</b><small>{integer(matched.count||0)} pembayaran sudah cocok</small></div></div></section></div>
 <section className="dash-panel report-action-panel"><div className="dash-panel-head"><div><span className="dash-overline"><Building2 size={16}/> PENGAWASAN</span><h2>Ekspor & tindak lanjut</h2><p>Unduh data terfilter untuk pengolahan lebih lanjut, maksimal 20.000 baris per ekspor.</p></div></div><div className="report-links">{[{id:'akun',label:'Akun pengelola & pengguna'},{id:'akademik',label:'Data akademik'},{id:'spp',label:'Transaksi SPP'},{id:'langganan',label:'Langganan lunas dalam periode'}].map(item=><Link href={item.id==='langganan'?paidCsv:csv(item.id)} key={item.id}><Download size={18}/>{item.label}<ArrowUpRight size={15}/></Link>)}<Link href="/instansi"><Building2 size={18}/>{expire} instansi akan berakhir dalam 30 hari<ArrowUpRight size={15}/></Link></div></section>
 </>;
}
