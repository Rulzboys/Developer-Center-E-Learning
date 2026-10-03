# Edulink Owner Console

Website **khusus role `developer`** untuk memantau dan mengelola platform dari database **Supabase yang sama** dengan aplikasi Flutter `lib.zip` yang menjadi dasar project. Dibuat memakai **Next.js App Router + React 19 + TypeScript**, dengan server Next.js yang sesuai untuk hosting Vercel.

> **Penting:** website ini memang sengaja tidak menciptakan database alternatif, tidak mengimpor SQL dump ke proyek yang sudah hidup, dan tidak mengubah RLS atau fungsi pembayaran mobile. SQL yang dikirim dipakai untuk menyesuaikan integrasi, jenis kolom, enum, dan RPC.

## Fitur

| Menu | Fungsionalitas | Jenis akses |
|---|---|---|
| Dashboard | Instansi aktif/ditangguhkan/kedaluwarsa, jumlah pengguna, catatan akademik, total transaksi langganan lunas bulan berjalan (WIB), dan transaksi terbaru | Lihat |
| Instansi | Tambah, ubah, aktifkan/tangguhkan; paket Dasar/Sekolah/Pesantren; tanggal masa aktif, kontak, tahun akademik, semester, target hafalan; halaman detail | Kelola |
| Pengguna | Direktori semua peran; filter instansi, role, nama/email | Lihat |
| Akun Admin/Pimpinan | Buat akun Supabase Auth & profil, edit nama/telepon/status (tidak mengubah email, role, tenant) | Kelola, sesuai RPC |
| Akademik | Ringkasan dan daftar lintas instansi untuk 9 jenis entitas (kelas, mata pelajaran, pengumuman, materi, jadwal, tugas, jawaban, hafalan, presensi) | Lihat |
| SPP | Daftar dan filter transaksi, status QRIS/DANA, tagihan terbaru, event `spp_audit` | Lihat |
| Langganan | Atur harga bulanan/tahunan melalui RPC `subscription_action`; transaksi seluruh instansi, status gateway, metadata webhook terbaru | Harga: kelola. Transaksi: lihat |
| Pengaturan | Profil developer, ganti kata sandi | Kelola |
| CSV | Ekspor instansi, pengguna, ringkasan akademik, SPP, dan langganan, dengan validasi role di server; batas 20.000 baris per ekspor | Lihat/unduh |

Semua halaman utama berbahasa Indonesia dengan sidebar responsif dan pencarian/filter yang tersambung ke database. Tidak tersedia mode data dummy yang bisa tertukar dengan data produksi.

## Persyaratan

- Node.js **20.9+** (disarankan Node.js 22).
- Akses ke proyek **Supabase yang digunakan aplikasi Flutter**.
- Setidaknya satu pengguna pada Supabase Auth yang sudah mempunyai baris `public.profiles` dengan `role = 'developer'`, `tenant_id IS NULL`, dan `active = true`.
- Akses aman untuk mengatur environment variables Vercel.

### 1. Konfigurasi lokal

```bash
cp .env.example .env.local
```

Isi `.env.local`:

```ini
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<SUPABASE_PUBLISHABLE_OR_ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<SERVER_ONLY_SECRET_KEY>
```

Gunakan URL dan anon/publishable key proyek yang **sama** seperti Flutter (`lib/core/config/app_config.dart`). Ambil secret/service-role key hanya dari pengaturan API Supabase yang sah. **Jangan pernah membagikan secret key di chat, memasukkannya ke Git, atau menambahkan prefiks `NEXT_PUBLIC_`.**

Website menggunakan `SUPABASE_SERVICE_ROLE_KEY` **hanya di server** untuk melakukan pengawasan lintas instansi dan membuat akun lewat Auth Admin API. Setiap permintaan halaman, perubahan, dan ekspor yang memakai akses server tersebut melakukan validasi Supabase `auth.getUser()` dan profil developer aktif terlebih dahulu. Cookie autentikasi dibuat HttpOnly; tidak ada Supabase service key di kode browser.

### 2. Instalasi dan menjalankan

```bash
npm install
npm run dev
```

Buka `http://localhost:3000/login`, lalu masuk dengan akun developer yang sudah ada di proyek Supabase tersebut.

Untuk pemeriksaan sebelum deploy:

```bash
npm run typecheck
npm run build
npm run verify
```

`npm run verify` menjalankan tes struktur, sintaks TypeScript, ketersediaan route, dan pemeriksaan guard Developer. Secara opsional, jika file backup SQL tersedia lokal, jalankan:

```bash
node scripts/verify-project.cjs --schema=/lokasi/supabase_backup.sql
```

> Tidak perlu menjalankan `supabase_backup.sql` lagi jika proyek Supabase yang sama **sudah berjalan**. Dump mencakup schema `auth`, `storage`, `realtime`, dan struktur Supabase internal lain; jangan mengimpor ulang ke database aktif.

### 3. Deploy ke Vercel

1. Buat repository privat, masukkan folder project ini tanpa `.env.local`.
2. Di Vercel, **Add New Project** → impor repository → framework `Next.js` (terdeteksi otomatis).
3. Tambahkan ketiga Environment Variables dengan nama **persis** seperti `.env.example`, untuk lingkungan Production dan Preview yang sesuai. Sebaiknya **gunakan Supabase staging terpisah untuk Preview** agar pengujian tidak mengubah produksi.
4. Deploy. Framework preset menjalankan `next build` dari script `npm run build`.
5. Buka `/login`. Uji dengan akun developer; uji juga akun admin biasa untuk memastikan akses ditolak.
6. Verifikasi bahwa daftar instansi sesuai aplikasi Flutter, tindakan ubah/tangguhkan instansi muncul di mobile, serta pengubahan harga terbaca di aplikasi.

Jangan mengunggah file backup SQL atau database dump ke repository hosting. Berkas ini sengaja tidak dimasukkan dalam ZIP website.

## Alur pengelolaan akun

Website **tidak** membuat role Developer baru dari UI. Role tersebut harus sudah dikonfigurasi secara aman pada Supabase Auth dan `public.profiles` oleh pemilik platform.

Ketika developer membuat **Admin** atau **Pimpinan**:

1. Server memverifikasi pengguna login dan role developer aktif.
2. Supabase Auth Admin API membuat akun email/password awal yang Anda tentukan. Password minimal 12 karakter dan tidak pernah dicatat di log aplikasi.
3. Session developer memanggil RPC database **yang sudah tersedia**: `apply_managed_profile(p_actor_id, p_profile)`. Fungsi tersebut memanggil aturan `authorize_user_management` dari SQL.
4. Jika penyimpanan profil gagal, server berusaha menghapus pengguna Auth yang baru dibuat agar tidak tertinggal akun setengah jadi. Akun lama tidak bisa diganti email, role, atau instansinya melalui UI.

Developer harus memverifikasi alamat email penerima dan membagikan password awal lewat kanal aman. Anda dapat mengarahkan pengelola untuk segera mengganti password. Proses reset-email massal, penghapusan permanen akun, dan pembuatan developer tambahan **tidak** diaktifkan di panel ini.

## Batasan yang mengikuti SQL saat ini

**Khusus pengawasan:** fungsi `save_learning_entity` secara eksplisit menolak role developer; pengelolaan akademik tetap dilakukan pengelola instansi. `spp_action`, `spp_approve_payment`, dan pengaturan gateway QRIS juga ditujukan ke admin/pimpinan instansi atau peran terkait. Website memberikan pengawasan lintas instansi lewat akses read-only server yang melewati RLS *hanya setelah pemeriksaan Developer*, tetapi tidak membuat jalur tulis tersembunyi untuk mengganti nilai, status bayar, bukti, kelas, atau riwayat siswa.

**Potensi perbedaan masa aktif:** fungsi `subscription_settle` saat pembayaran `paid` menambah `public.tenants.subscription_until`, tetapi fungsi `tenant_active()` yang digunakan untuk akses mobile hanya memeriksa `status='active'` dan `expires_at > now()`. Kedua tanggal tampil di halaman detail instansi. **Jangan menganggap pembayaran otomatis telah memperpanjang akses** sebelum alur sinkronisasi keduanya diaudit dan diperbaiki secara terencana pada proyek Supabase. Editor instansi dalam website dapat memperbaiki `expires_at` secara manual sesuai hak Developer.

**Audit:** tampilan Audit SPP memakai tabel `public.spp_audit` yang tersedia. Database SQL yang diberikan belum menyertakan tabel audit tersendiri untuk setiap perubahan konfigurasi oleh Developer; fitur audit mutasi Owner yang terpisah memerlukan migrasi SQL terencana. Jangan menganggap log SPP mencatat semua perubahan Owner.

**Skala:** metrik dan ekspor memakai paginasi untuk mengatasi batas default Supabase 1.000 baris; penghitungan nilai pendapatan langsung dari maksimal 20.000 order lunas pada bulan berjalan. Jika volume lebih besar, buat RPC agregasi teruji pada SQL produksi, bukan memperluas pembacaan transaksi tanpa batas.

**Integrasi belum live-tested:** project dibuat dari kode Flutter dan SQL yang kamu unggah, tanpa kredensial Supabase atau endpoint yang bisa dihubungi dari lingkungan pembuatannya. Struktur dan sintaks diverifikasi offline. Jalankan `npm install`, `npm run typecheck`, dan `npm run build`, kemudian uji alur pada **Supabase staging** sebelum mengarahkannya ke database produksi.

## Struktur project

```text
src/
  app/
    (console)/
      dashboard/            # metrik dan ringkasan
      instansi/             # daftar dan detail instansi
      akun/                 # direktori seluruh akun + CRUD admin/pimpinan
      akademik/             # pengawasan 9 jenis data akademik
      spp/                  # pengawasan transaksi dan audit SPP
      langganan/            # harga paket + order
      pengaturan/           # profil developer dan password
      layout.tsx            # guard semua halaman console
    api/export/[resource]/ # CSV terproteksi
    login/                 # autentikasi Supabase
    actions.ts             # Server Actions terproteksi
  components/
    navigation.tsx         # sidebar + navigasi mobile
    forms.tsx              # dialog, form React 19
    ui.tsx                 # kartu, tabel, filter, paginasi
  lib/
    supabase.ts            # client session + server service, guard developer
    queries.ts             # query agregasi/paginasi
    types.ts              # kontrak berdasarkan tabel SQL
    format.ts             # format IDR dan tanggal WIB
  middleware.ts            # refresh cookie aman
scripts/
  verify-project.cjs       # validasi offline
```

Rincian keterkaitan tabel/fungsi dengan Flutter: lihat [`docs/PETA-FLUTTER-SQL.md`](docs/PETA-FLUTTER-SQL.md).
