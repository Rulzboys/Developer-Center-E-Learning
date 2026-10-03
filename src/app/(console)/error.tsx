'use client';
import {useEffect} from 'react';
import {AlertTriangle,RefreshCcw} from 'lucide-react';
export default function ConsoleError({error,reset}:{error:Error&{digest?:string},reset:()=>void}){
 useEffect(()=>{console.error('Terjadi kesalahan pada panel:',error.name,error.digest||'');},[error]);
 return <div className="center-page"><section className="login-card"><span className="brand-icon"><AlertTriangle/></span><h1>Data gagal dimuat</h1><p>Koneksi atau izin akses ke Supabase sedang bermasalah. Periksa konfigurasi environment serta status proyek, lalu coba kembali.</p><button className="button primary" onClick={reset}><RefreshCcw size={17}/> Coba lagi</button></section></div>;
}
