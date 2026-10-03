import {NextRequest,NextResponse} from 'next/server';
import {adminClient,requireDeveloper,validateUUID,safeSearch} from '@/lib/supabase';
import {kindLabels} from '@/lib/types';

export const dynamic='force-dynamic';
export const runtime='nodejs';
/** Strict allowlist: never offer arbitrary tables or private payment/webhook payloads. */
const resources={
 instansi:{table:'tenants',columns:'id,name,code,status,plan,expires_at,academic_year,semester,address,contact,target_count,subscription_until',headers:['ID','Nama','Kode','Status','Paket','Aktif hingga','Tahun akademik','Semester','Alamat','Kontak','Target hafalan','Langganan hingga']},
 akun:{table:'profiles',columns:'id,tenant_id,name,email,role,number,phone,active',headers:['ID','Instansi ID','Nama','Email','Role','Nomor','Telepon','Aktif']},
 akademik:{table:'learning_entities',columns:'id,tenant_id,kind,data,created_at',headers:['ID','Instansi ID','Jenis','Ringkasan','Dibuat']},
 spp:{table:'spp_payments',columns:'id,tenant_id,invoice_id,student_id,amount,status,provider,created_at,paid_at',headers:['ID','Instansi ID','Tagihan ID','Siswa ID','Nominal','Status','Provider','Dibuat','Dibayar']},
 langganan:{table:'subscription_orders',columns:'id,tenant_id,buyer_id,plan,amount,status,gateway,gateway_env,created_at,paid_at',headers:['ID','Instansi ID','Pembeli ID','Paket','Nominal','Status','Gateway','Lingkungan','Dibuat','Dibayar']}
} as const;
function cells(resource:keyof typeof resources,row:Record<string,unknown>):unknown[]{
 if(resource==='instansi')return [row.id,row.name,row.code,row.status,row.plan,row.expires_at,row.academic_year,row.semester,row.address,row.contact,row.target_count,row.subscription_until];
 if(resource==='akun')return [row.id,row.tenant_id,row.name,row.email,row.role,row.number,row.phone,row.active];
 if(resource==='akademik'){
  const d=row.data as Record<string,unknown> || {};
  return [row.id,row.tenant_id,kindLabels[String(row.kind)]||row.kind,String(d.name||d.title||d.date||d.unitKey||d.status||'').slice(0,200),row.created_at];
 }
 if(resource==='spp')return [row.id,row.tenant_id,row.invoice_id,row.student_id,row.amount,row.status,row.provider,row.created_at,row.paid_at];
 return [row.id,row.tenant_id,row.buyer_id,row.plan,row.amount,row.status,row.gateway,row.gateway_env,row.created_at,row.paid_at];
}
function escapeCell(val:unknown){
 let s=val==null?'':String(val);
 // Prevent CSV / spreadsheet formula injection for externally provided text fields.
 if(/^[\s\uFEFF]*[=+@\-\t\r]/.test(s)&&typeof val==='string')s="'"+s;
 return '"'+s.replaceAll('"','""').replaceAll(/\r?\n/g,' ')+'"';
}
export async function GET(req:NextRequest,{params}:{params:Promise<{resource:string}>}){
 await requireDeveloper();
 const {resource}=await params;
 if(!(resource in resources))return NextResponse.json({error:'Export tidak tersedia.'},{status:404});
 const type=resource as keyof typeof resources;const spec=resources[type];const db=adminClient();const s=req.nextUrl.searchParams;
 let q=db.from(spec.table).select(spec.columns).order('id',{ascending:true});
 const tenant=s.get('tenant');if(type!=='instansi'&&tenant&&validateUUID(tenant))q=q.eq('tenant_id',tenant);
 const search=safeSearch(s.get('q')||'');
 if(search&&type==='instansi')q=q.or(`name.ilike.%${search}%,code.ilike.%${search}%`);
 if(search&&type==='akun')q=q.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
 if(type==='instansi'&&['active','suspended'].includes(s.get('status')||''))q=q.eq('status',s.get('status')!);
 if(type==='akun'&&['developer','leader','admin','teacher','student'].includes(s.get('role')||''))q=q.eq('role',s.get('role')!);
 if(type==='akademik'&&['classroom','subject','announcement','material','schedule','assignment','submission','memorization','attendance'].includes(s.get('kind')||''))q=q.eq('kind',s.get('kind')!);
 if((type==='spp'||type==='langganan')&&['pending','reported','matched','disputed','paid','failed','expired','cancelled','refunded'].includes(s.get('status')||''))q=q.eq('status',s.get('status')!);
 if(type==='langganan'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(s.get('paid_since')||''))q=q.gte('paid_at',s.get('paid_since')!);
 const rows:Record<string,unknown>[]=[];
 for(let offset=0;offset<=19500;offset+=500){
  const {data,error}=await q.range(offset,offset+499);
  if(error)return NextResponse.json({error:'Export gagal dimuat.'},{status:500});
  rows.push(...((data || []) as unknown as Record<string,unknown>[]));
  if(!data||data.length<500)break;
  if(offset===19500)return NextResponse.json({error:'Data melebihi 20.000 baris. Persempit filter terlebih dahulu.'},{status:413});
 }
 const lines=[spec.headers.map(escapeCell).join(','),...rows.map(r=>cells(type,r).map(escapeCell).join(','))];
 const csv='\uFEFF'+lines.join('\r\n');
 const day=new Date().toISOString().slice(0,10);
 return new NextResponse(csv,{status:200,headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="edulink-${type}-${day}.csv"`,'Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff'}});
}
