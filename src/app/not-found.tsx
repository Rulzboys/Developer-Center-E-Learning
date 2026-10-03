import Link from 'next/link';
export default function NotFound(){return <div className="center-page"><div className="login-card"><div className="brand-icon">404</div><h1>Halaman tidak ditemukan</h1><p>Alamat yang Anda buka tidak tersedia.</p><Link href="/dashboard" className="button primary">Kembali ke dashboard</Link></div></div>}
