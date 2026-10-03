import Link from 'next/link';
import type {ReactNode} from 'react';
import {Activity,AlertCircle,ArrowUpRight,BarChart3,BookOpen,Building2,CalendarClock,CheckCircle2,ChevronRight,CircleDollarSign,CreditCard,Download,GraduationCap,LayoutGrid,Power,Settings2,ShieldCheck,Users} from 'lucide-react';
import {PageHead,Pill,Empty} from '@/components/ui';
import {adminClient,readAll,requireDeveloper} from '@/lib/supabase';
import {allTenants,tableCount} from '@/lib/queries';
import {accessStatus,date,datetime,integer,rupiah} from '@/lib/format';
import {defaultLayout,normalizeLayout,widgetCatalog} from '@/lib/dashboard-layout';
import DashboardBuilder from '@/components/dashboard-builder';
import type {SubscriptionOrder} from '@/lib/types';

const shortRupiah=(value:number)=>'Rp'+new Intl.NumberFormat('id-ID',{notation:'compact',compactDisplay:'short',maximumFractionDigits:1}).format(value);
const monthKey=(value:Date|string)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit'}).format(new Date(value));
export default async function Dashboard(){
 const {profile}=await requireDeveloper();
 const db=adminClient(),now=new Date();
 const y=Number(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Jakarta',year:'numeric'}).format(now));
 const m=Number(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Jakarta',month:'numeric'}).format(now));
 const months=Array.from({length:6},(_,i)=>{
   const dt=new Date(Date.UTC(y,m-1-(5-i),1,12));
   return {key:monthKey(dt),label:new Intl.DateTimeFormat('id-ID',{month:'short',timeZone:'Asia/Jakarta'}).format(dt)};
 });
 const cutoff=new Date(Date.UTC(y,m-6,1,0)).toISOString();
 const [tenants,users,students,academic,totalOrders,paidOrders,recentRes,pendingRes,settingsRes,layoutRes]=await Promise.all([
  allTenants(),tableCount('profiles'),tableCount('profiles',{column:'role',value:'student'}),
  tableCount('learning_entities'),tableCount('subscription_orders'),
  readAll<Pick<SubscriptionOrder,'amount'|'id'|'paid_at'|'tenant_id'>>('subscription_orders','id,amount,paid_at,tenant_id',q=>q.eq('status','paid').gte('paid_at',cutoff)),
  db.from('subscription_orders').select('id,tenant_id,plan,amount,status,created_at').order('created_at',{ascending:false}).limit(6),
  db.from('spp_payments').select('*',{count:'exact',head:true}).eq('status','reported'),
  db.from('platform_settings').select('mobile_enabled,maintenance_starts_at,maintenance_ends_at').eq('id',true).maybeSingle(),
  db.from('owner_dashboard_layouts').select('widgets').eq('user_id',profile.id).maybeSingle()
 ]);
 if(recentRes.error||pendingRes.error)throw new Error(recentRes.error?.message||pendingRes.error?.message);
 const counts={active:0,suspended:0,expired:0};
 tenants.forEach(t=>{if(t.status==='suspended')counts.suspended++;else if(accessStatus(t).tone==='success')counts.active++;else counts.expired++;});
 const soon=tenants.filter(t=>t.status==='active'&&new Date(t.expires_at).getTime()>now.getTime()&&new Date(t.expires_at).getTime()<now.getTime()+30*86400000)
    .sort((a,b)=>a.expires_at.localeCompare(b.expires_at));
 const revenue=paidOrders.filter(o=>o.paid_at&&monthKey(o.paid_at)===monthKey(now)).reduce((sum,o)=>sum+o.amount,0);
 const barData=months.map(month=>({label:month.label,key:month.key,value:paidOrders.filter(o=>o.paid_at&&monthKey(o.paid_at)===month.key).reduce((sum,o)=>sum+o.amount,0)}));
 const highest=Math.max(...barData.map(v=>v.value),1);
 const tenantNames=Object.fromEntries(tenants.map(t=>[t.id,t.name]));
 const recent=recentRes.data||[];
 const gateReady=!settingsRes.error&&!!settingsRes.data;
 const scheduled=!!settingsRes.data?.maintenance_starts_at&&new Date(settingsRes.data.maintenance_starts_at)<=now&&(!settingsRes.data.maintenance_ends_at||new Date(settingsRes.data.maintenance_ends_at)>now);
 const accessible=gateReady&&settingsRes.data?.mobile_enabled&&!scheduled;
 const overall=(accessible?'Aplikasi online':gateReady?'Aplikasi maintenance':'Belum dikonfigurasi');
 const kpi=(icon:ReactNode,tint:string,eyebrow:string,value:string,desc:string,href:string)=><Link href={href} className="dash-stat"><span className={'dash-stat-icon '+tint}>{icon}</span><span className="dash-stat-arrow"><ArrowUpRight size={16}/></span><span className="dash-stat-label">{eyebrow}</span><strong>{value}</strong><small>{desc}</small></Link>;
 const widgets=[
  {id:'instansi',title:'Total instansi',size:'quarter',content:kpi(<Building2 size={22}/>, 'tint-blue','Total instansi',integer(tenants.length),`${counts.active} aktif · ${counts.expired+counts.suspended} perlu perhatian`,'/instansi')},
  {id:'pengguna',title:'Total pengguna',size:'quarter',content:kpi(<Users size={22}/>, 'tint-teal','Pengguna terdaftar',integer(users),`${integer(students)} siswa / santri`,'/akun')},
  {id:'akademik',title:'Aktivitas akademik',size:'quarter',content:kpi(<GraduationCap size={22}/>, 'tint-purple','Data akademik',integer(academic),'Kelas, tugas, presensi, hafalan','/akademik')},
  {id:'pendapatan',title:'Pendapatan bulanan',size:'quarter',content:kpi(<CircleDollarSign size={22}/>, 'tint-gold','Langganan lunas · bulan ini',rupiah(revenue),`${integer(totalOrders)} total order sepanjang waktu`,'/langganan')},
  {id:'tren',title:'Tren langganan',size:'wide',content:<div className="dash-panel"><div className="dash-panel-head"><div><span className="dash-overline"><BarChart3 size={16}/> ANALITIK PENDAPATAN</span><h2>Tren langganan</h2><p>Nilai transaksi berstatus lunas · 6 bulan terakhir (WIB)</p></div><Link href="/laporan" className="dash-head-link">Buka laporan <ArrowUpRight size={16}/></Link></div><div className="chart-summary"><div><span>Total dalam periode</span><strong>{rupiah(barData.reduce((n,x)=>n+x.value,0))}</strong></div><span className="chart-badge"><Activity size={14}/> Supabase live data</span></div><div className="revenue-chart" aria-label="Grafik pendapatan enam bulan terakhir">{barData.map(v=><div className="revenue-bar" key={v.key} title={`${v.label}: ${rupiah(v.value)}`}><span>{v.value?shortRupiah(v.value):'Rp0'}</span><div className="revenue-track"><div style={{height:v.value?`${Math.max(7,v.value/highest*100)}%`:'4%'}}/></div><small>{v.label}</small></div>)}</div></div>},
  {id:'kesehatan',title:'Kesehatan instansi',size:'half',content:<div className="dash-panel"><div className="dash-panel-head"><div><span className="dash-overline"><ShieldCheck size={16}/> STATUS ORGANISASI</span><h2>Kondisi instansi</h2><p>Ringkasan akses berdasarkan kontrak setiap instansi.</p></div><Link href="/instansi" className="dash-head-link">Semua <ChevronRight size={16}/></Link></div><div className="health-body"><div className="health-donut" style={{background:`conic-gradient(#1fae93 ${counts.active/Math.max(1,tenants.length)*100}%, #e6eef7 0)`}}><div><b>{counts.active}</b><span>Aktif</span></div></div><div className="health-list">{[{label:'Aktif',n:counts.active,color:'#1fae93'},{label:'Ditangguhkan',n:counts.suspended,color:'#e67676'},{label:'Kedaluwarsa',n:counts.expired,color:'#ecb759'}].map(x=><div key={x.label}><div className="health-line"><span><i style={{background:x.color}}/>{x.label}</span><b>{x.n}</b></div><div className="health-progress"><i style={{background:x.color,width:`${x.n/Math.max(1,tenants.length)*100}%`}}/></div></div>)}</div></div></div>},
  {id:'transaksi',title:'Transaksi terbaru',size:'half',content:<div className="dash-panel"><div className="dash-panel-head"><div><span className="dash-overline"><CreditCard size={16}/> AKTIVITAS TERBARU</span><h2>Langganan terbaru</h2><p>Enam transaksi terbaru dari seluruh instansi.</p></div><Link href="/langganan" className="dash-head-link">Semua <ChevronRight size={16}/></Link></div>{recent.length?<div className="dash-recent">{recent.map(o=><div className="dash-recent-row" key={o.id}><span className="dash-recent-avatar"><Building2 size={18}/></span><div><b>{tenantNames[o.tenant_id]||'Instansi tidak dikenal'}</b><small>{o.plan==='annual'?'Tahunan':'Bulanan'} · {datetime(o.created_at)}</small></div><div className="dash-recent-status"><b>{rupiah(o.amount)}</b><Pill text={o.status==='paid'?'Lunas':o.status==='pending'?'Menunggu':o.status} tone={o.status==='paid'?'success':o.status==='pending'?'warning':'neutral'}/></div></div>)}</div>:<Empty text="Belum ada transaksi langganan."/>}</div>},
  {id:'perhatian',title:'Butuh perhatian',size:'half',content:<div className="dash-panel"><div className="dash-panel-head"><div><span className="dash-overline"><AlertCircle size={16}/> PERLU DITINJAU</span><h2>Pusat perhatian</h2><p>Hal-hal yang membutuhkan tindak lanjut Owner.</p></div><Link href="/laporan" className="dash-head-link">Laporan <ChevronRight size={16}/></Link></div><div className="attention-list"><Link href="/spp?status=reported"><span className="attention-icon orange"><CreditCard size={19}/></span><div><b>{integer(pendingRes.count||0)} bukti SPP menunggu review</b><p>Koordinasikan dengan admin/pimpinan instansi.</p></div><ArrowUpRight size={18}/></Link><Link href="/instansi"><span className="attention-icon pink"><CalendarClock size={19}/></span><div><b>{integer(counts.expired)} instansi kedaluwarsa</b><p>Periksa perpanjangan akses setiap instansi.</p></div><ArrowUpRight size={18}/></Link><Link href="/instansi"><span className="attention-icon blue"><Activity size={19}/></span><div><b>{integer(soon.length)} instansi berakhir dalam 30 hari</b><p>{soon[0]?`Berikutnya: ${soon[0].name} · ${date(soon[0].expires_at)}`:'Tidak ada kontrak segera berakhir.'}</p></div><ArrowUpRight size={18}/></Link></div></div>},
  {id:'pintasan',title:'Tindakan cepat',size:'half',content:<div className="dash-panel"><div className="dash-panel-head"><div><span className="dash-overline"><LayoutGrid size={16}/> AKSES CEPAT</span><h2>Tindakan cepat</h2><p>Pintasan ke pengelolaan platform.</p></div></div><div className="quick-action-grid">{[{href:'/instansi',icon:<Building2 size={20}/>,label:'Instansi',note:'Kontrak & status',color:'blue'},{href:'/akun',icon:<Users size={20}/>,label:'Pengelola',note:'Admin & pimpinan',color:'teal'},{href:'/laporan',icon:<BarChart3 size={20}/>,label:'Laporan',note:'Statistik lintas instansi',color:'purple'},{href:'/kontrol-aplikasi',icon:<Power size={20}/>,label:'Kontrol aplikasi',note:'Maintenance global',color:'gold'},{href:'/api/export/instansi',icon:<Download size={20}/>,label:'Ekspor instansi',note:'Unduh CSV',color:'blue'},{href:'/pengaturan',icon:<Settings2 size={20}/>,label:'Pengaturan',note:'Identitas & keamanan',color:'teal'}].map(x=><Link href={x.href} key={x.href}><span className={'quick-action-icon '+x.color}>{x.icon}</span><b>{x.label}</b><small>{x.note}</small></Link>)}</div></div>},
  {id:'sistem',title:'Status sistem',size:'wide',content:<div className="system-strip"><span className={'system-strip-icon '+(accessible?'good':'alert')}>{accessible?<CheckCircle2 size={23}/>:<AlertCircle size={23}/>}</span><div><span className="dash-overline">PENGAWASAN PLATFORM</span><b>{overall}</b><p>{!gateReady?'Jalankan migrasi SQL v2 agar panel kontrol dan mobile gate tersedia.':accessible?'Sakelar dan jadwal mengizinkan akses. Penegakan tetap membutuhkan pembaruan Flutter.':'Akses aplikasi dipengaruhi maintenance atau sakelar manual. Buka halaman kontrol untuk detail.'}</p></div><Link href="/kontrol-aplikasi" className="button secondary small">Kelola kontrol <ArrowUpRight size={16}/></Link></div>}
 ] as {id:typeof widgetCatalog[number]['id'];title:string;size:'quarter'|'half'|'wide';content:ReactNode}[];
 return <>
  <div className="edu-hero"><div className="edu-hero-copy"><span className="hero-chip"><BookOpen size={15}/> E-Learning Command Center</span><h2>Semua aktivitas pendidikan,<br/>dalam satu kendali.</h2><p>Pantau perkembangan, kelola kontrak, dan jaga layanan berjalan sesuai kebutuhan seluruh instansi.</p><div className="edu-hero-actions"><Link href="/laporan" className="hero-button"><BarChart3 size={17}/> Lihat laporan</Link><Link href="/kontrol-aplikasi" className="hero-outline"><Power size={17}/> Kontrol aplikasi</Link></div></div><div className="hero-illustration" aria-hidden="true"><div className="hero-orbit orbit-one"/><div className="hero-orbit orbit-two"/><div className="hero-center"><GraduationCap size={49}/></div><span className="hero-bubble bubble-one"><BookOpen size={24}/></span><span className="hero-bubble bubble-two"><Users size={24}/></span><span className="hero-bubble bubble-three"><BarChart3 size={24}/></span></div></div>
  <DashboardBuilder widgets={widgets} initial={layoutRes.error?defaultLayout:normalizeLayout(layoutRes.data?.widgets)}/>
 </>;
}
