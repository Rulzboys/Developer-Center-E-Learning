import Link from 'next/link';
import {notFound} from 'next/navigation';
import {ArrowLeft,BookOpen,Building2,CreditCard,GraduationCap,Users} from 'lucide-react';
import {PageHead,Pill,Stat,Surface} from '@/components/ui';
import {TenantEditButton,TenantStatusButton} from '@/components/forms';
import {adminClient,requireDeveloper,validateUUID} from '@/lib/supabase';
import {accessStatus,date,integer,rupiah} from '@/lib/format';
import type {Tenant} from '@/lib/types';
export default async function TenantDetail({params}:{params:Promise<{id:string}>}){
 await requireDeveloper();const {id}=await params;if(!validateUUID(id))notFound();
 const db=adminClient();
 const [tenantResult,users,academic,invoices,payments,qris,gateway]=await Promise.all([
  db.from('tenants').select('*').eq('id',id).maybeSingle(),
  db.from('profiles').select('*',{head:true,count:'exact'}).eq('tenant_id',id),
  db.from('learning_entities').select('*',{head:true,count:'exact'}).eq('tenant_id',id),
  db.from('spp_invoices').select('amount',{count:'exact'}).eq('tenant_id',id).limit(1),
  db.from('spp_payments').select('amount',{count:'exact'}).eq('tenant_id',id).limit(1),
  db.from('spp_qris_settings').select('enabled,nominal_enabled,merchant_name,updated_at').eq('tenant_id',id).maybeSingle(),
  db.from('spp_gateway_settings').select('enabled,external_store_id,updated_at').eq('tenant_id',id).maybeSingle()
 ]);
 if(tenantResult.error)throw new Error(tenantResult.error.message);if(!tenantResult.data)notFound();
 for(const check of [users,academic,invoices,payments,qris,gateway])if(check.error)throw new Error(check.error.message);
 const tenant=tenantResult.data as Tenant;const status=accessStatus(tenant);
 return <><Link href="/instansi" className="back-link"><ArrowLeft size={17}/> Semua instansi</Link><PageHead overline={'INSTANSI / '+tenant.code} title={tenant.name} description={`${tenant.plan} · ${tenant.academic_year} / ${tenant.semester}`} actions={<div className="page-action-group"><TenantEditButton tenant={tenant}/><TenantStatusButton tenant={tenant}/></div>}/><div className="tenant-heading-summary"><span className="tenant-detail-icon"><Building2 size={28}/></span><div><p>STATUS AKSES</p><Pill text={status.text} tone={status.tone}/></div><div><p>BATAS MASA AKTIF</p><b>{date(tenant.expires_at)}</b></div><div><p>SUBSCRIPTION UNTIL</p><b>{date(tenant.subscription_until)}</b></div></div><div className="stat-grid three"><Stat label="Akun instansi" value={integer(users.count||0)} detail="Seluruh peran" icon={<Users size={19}/>}/><Stat label="Aktivitas akademik" value={integer(academic.count||0)} detail="Kelas hingga presensi" icon={<GraduationCap size={19}/>}/><Stat label="Transaksi pembayaran" value={integer(payments.count||0)} detail={`${integer(invoices.count||0)} tagihan SPP`} icon={<CreditCard size={19}/>}/></div><div className="dashboard-columns"><Surface title="Profil instansi"><dl className="detail-list"><div><dt>Kode</dt><dd>{tenant.code}</dd></div><div><dt>Paket</dt><dd>{tenant.plan}</dd></div><div><dt>Alamat</dt><dd>{tenant.address||'—'}</dd></div><div><dt>Kontak</dt><dd>{tenant.contact||'—'}</dd></div><div><dt>Target hafalan</dt><dd>{tenant.target_count} bagian</dd></div><div><dt>Tahun akademik</dt><dd>{tenant.academic_year} ({tenant.semester})</dd></div></dl></Surface><Surface title="Konfigurasi pembayaran" subtitle="Konfigurasi dapat dikelola Developer dari Pengaturan QRIS."><dl className="detail-list"><div><dt>QRIS manual</dt><dd><Pill text={qris.data?.enabled?'Aktif':'Tidak aktif'} tone={qris.data?.enabled?'success':'neutral'}/></dd></div><div><dt>Merchant</dt><dd>{qris.data?.merchant_name||'—'}</dd></div><div><dt>QRIS nominal</dt><dd>{qris.data?.nominal_enabled?'Didukung':'Tidak aktif'}</dd></div><div><dt>Payment gateway</dt><dd><Pill text={gateway.data?.enabled?'Aktif':'Tidak aktif'} tone={gateway.data?.enabled?'success':'neutral'}/></dd></div><div><dt>External store ID</dt><dd>{gateway.data?.external_store_id?'Terdaftar':'Belum terdaftar'}</dd></div></dl></Surface></div><div className="info-box"><BookOpen size={19}/><div><b>Penting: dua tanggal langganan</b><p>Fungsi pembayaran otomatis pada SQL saat ini memperpanjang <code>subscription_until</code>, sedangkan pemeriksaan akses akun menggunakan <code>expires_at</code>. Jika tanggal berbeda, periksa alur sinkronisasi sebelum mengandalkan aktivasi otomatis.</p></div></div><div className="quick-detail-links"><Link href={'/akun?tenant='+tenant.id}><Users size={18}/> Pengguna instansi →</Link><Link href={'/akademik?tenant='+tenant.id}><GraduationCap size={18}/> Aktivitas akademik →</Link><Link href={'/qris?tenant='+tenant.id}><CreditCard size={18}/> Pengaturan QRIS →</Link><Link href={'/spp?tenant='+tenant.id}><CreditCard size={18}/> Pembayaran SPP →</Link><Link href={'/langganan?tenant='+tenant.id}><BookOpen size={18}/> Langganan →</Link></div></>;
}
