import {BookOpen,LockKeyhole,ShieldCheck} from 'lucide-react';
import {LoginForm} from '@/components/forms';
import {sessionClient} from '@/lib/supabase';
import {redirect} from 'next/navigation';
export const dynamic='force-dynamic';
export default async function Login(){
 if(process.env.NEXT_PUBLIC_SUPABASE_URL&&process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY){
  const db=await sessionClient();const {data:{user}}=await db.auth.getUser();
  if(user){const {data:p}=await db.from('profiles').select('role,active,tenant_id').eq('id',user.id).maybeSingle();if(p?.role==='developer'&&p.active&&p.tenant_id===null)redirect('/dashboard');}
 }
 return <main className="login-shell"><div className="login-hero"><div className="hero-noise"/><div className="hero-top"><div className="brand-mark"><BookOpen size={23}/></div><b>EDULINK <span>PLATFORM</span></b></div><div className="hero-copy"><span className="hero-kicker">PLATFORM ADMINISTRATION</span><h1>Satu panel.<br/>Kendali penuh<br/><em>atas platform.</em></h1><p>Pantau seluruh instansi, akun pengelola, aktivitas akademik, dan transaksi dari satu tempat.</p><div className="hero-line"><ShieldCheck size={19}/> Akses eksklusif Owner / Developer</div></div><div className="hero-footer">OWNER CONSOLE <span>•</span> POWERED BY SUPABASE</div></div><section className="login-content"><div className="login-inner"><div className="login-mobile-brand"><BookOpen/> Edulink Console</div><div className="login-small-icon"><LockKeyhole size={25}/></div><p className="eyebrow">SELAMAT DATANG KEMBALI</p><h2>Masuk ke panel</h2><p className="muted">Gunakan akun developer yang sudah terdaftar di aplikasi Flutter.</p><LoginForm/><div className="login-note"><ShieldCheck size={17}/><span>Perubahan melalui panel mengikuti hak akses dan validasi database.</span></div><p className="copyright">© {new Date().getFullYear()} Edulink Owner Console</p></div></section></main>;
}
