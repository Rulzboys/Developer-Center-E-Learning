# EDULINK Developer Panel — Professional Redesign V3

Upgrade **di atas proyek web Next.js 15 / React 19 / TypeScript yang sudah berjalan**. Tidak mengganti autentikasi, database, GoRouter, Riverpod, atau fitur role Flutter. Sumber model: `lib.zip` aplikasi Flutter dan `supabase_backup.sql` yang diberikan; migrasi V2 tetap dipakai untuk mobile maintenance.

> **PENTING:** Pengelolaan pusat yang baru membutuhkan migrasi SQL `002_owner_management.sql`. Jalankan di Supabase **staging** dan lakukan uji end-to-end sebelum produksi. Paket ini telah melalui pemeriksaan sintaks/struktur offline tetapi BELUM diuji dengan kredensial database pengguna, build Next.js lengkap, atau kompilasi Flutter.

## 1. Perubahan desain

- Tema SaaS pendidikan **biru, putih, abu-abu muda** dengan kartu, tabel, label, dan form yang lebih tenang; ilustrasi/gradien futuristik dikurangi.
- Sidebar tetap di desktop; mobile memakai drawer. Kelompok kategori dapat dilipat, pencarian menu `Ctrl / ⌘ + K` dipertahankan, scrolling tetap berfungsi dengan scrollbar disembunyikan.
- Tata letak dashboard **10 widget** dari V2 tetap dapat dipindahkan, disembunyikan, dan disimpan per akun Developer lewat `owner_dashboard_layouts`.
- Semua halaman baru memakai `PageHead`, tabel, filter instansi, pencarian dan pagination server-side. Tindakan tulis memakai modal dengan validasi dan konfirmasi untuk penghapusan.

## 2. Menu yang tersedia

| Menu | Route | Kemampuan |
|---|---|---|
| Dashboard | `/dashboard` | Widget yang bisa disusun dan statistik lintas instansi |
| Manajemen Instansi | `/instansi` | Tambah, edit, suspend/aktifkan, hapus **jika kosong** |
| Tahun Akademik & Semester | `/tahun-akademik` | Edit `academic_year`/`semester` milik masing-masing instansi lewat form instansi |
| Semua Akun | `/akun` | Cari/filter semua akun termasuk Developer |
| Manajemen Pimpinan / Admin / Guru / Siswa | `/pengguna/{leader,admin,teacher,student}` | Buat akun Supabase Auth dan profil, ubah role dan data, status, hapus bila tak mempunyai relasi |
| Kelas / Mata Pelajaran / Jadwal / Materi / Tugas / Pengumpulan / Absensi / Hafalan / Pengumuman | `/akademik/[kind]` | Form CRUD dengan validasi relasi dan audit |
| Perkembangan Siswa | `/perkembangan` | Agregasi per siswa dari hafalan, absensi, dan penilaian tugas |
| Pemantauan semua akademik | `/akademik` | Indeks kegiatan dan ekspor, dipertahankan dari V2 |
| SPP & Pembayaran | `/spp` | Monitor semua pembayaran, review khusus laporan QRIS manual |
| Manajemen Tagihan | `/spp/tagihan` | CRUD invoice tanpa pembayaran terkait; arsip/aktifkan kembali termasuk yang telah memiliki transaksi |
| Pengaturan QRIS | `/qris` | Konfigurasi QRIS dan DANA gateway per instansi |
| Langganan & Harga | `/langganan` | Ubah harga paket dan monitor transaksi gateway |
| Pengaturan Sistem | `/kontrol-aplikasi` | Maintenance global, jadwal, audit kontrol platform (V2) |
| Audit Developer | `/riwayat` | Catatan perubahan V3 lintas instansi |
| Profil Developer | `/pengaturan` | Identitas dan keamanan akun (V2) |
| Laporan | `/laporan` | Laporan, filter dan ekspor (V2) |

Tidak ada tabel, menu, atau model universitas/jurusan/program studi/mata kuliah.

## 3. Instalasi — jika saat ini sudah memakai Owner Console V2

1. **Backup** project Next.js saat ini, `lib/` Flutter dan database Supabase. Siapkan proyek Supabase staging; jangan lakukan uji tombol maintenance di database produksi.
2. **Jangan impor ulang** `supabase_backup.sql`; itu hanya referensi struktur database. Jika `001_platform_controls.sql` **belum pernah** diterapkan, jalankan terlebih dahulu. Jika fitur V2 sudah berfungsi, jangan jalankan ulang migrasi 001.
3. Jalankan SQL **`sql/002_owner_management.sql`** menggunakan Supabase SQL Editor pada database yang sama. Migrasi ini membuat `owner_audit`, fungsi `is_platform_developer`, kebijakan RLS baca lintas instansi khusus Developer, dan RPC tulis terverifikasi untuk profil, pembelajaran, tagihan, QRIS/gateway, review QRIS manual, instansi, serta harga.
4. Ganti **hanya kode website** dengan folder V3 atau pindahkan perubahan V3 ke repository lama. **Pertahankan `.env.local` milikmu**; file ini tidak disertakan. Jangan menyalin kredensial Supabase ke sisi client.
5. Instal dan validasi:

```bash
npm install
npm run typecheck
npm run build
npm run verify
npm run dev
```

6. Login dengan akun Supabase Auth yang juga terdapat di `public.profiles`, `role='developer'`, `active=true`, `tenant_id IS NULL`. Uji create/edit/delete pada instansi dan akun staging, filter lintas instansi, kemudian jadwalkan deployment Vercel.
7. Untuk aplikasi mobile, **jangan ganti `lib/`**. Jika kamu telah menggunakan Flutter platform-gate patch dari V2, tetap gunakan; jika belum, integrasikan dan uji patch tersebut secara terpisah sebelum mengandalkan sakelar global.

`.env.local` (isi menggunakan project yang sama dengan Flutter):

```ini
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=SUPABASE_PUBLISHABLE_OR_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=SERVER_ONLY_SECRET
```

**Kunci service role harus rahasia:** hanya digunakan di server Next.js/Vercel setelah verifikasi `requireDeveloper()`. Jangan menaruhnya di `NEXT_PUBLIC_*`, aplikasi Flutter, source control, atau formulir web. Supabase RPC V3 tetap memverifikasi `auth.uid()` dan profil Developer di database, bukan mempercayai role dari browser.

## 4. Batasan dan pengamanan sengaja

- **Penghapusan yang masih punya relasi ditolak**. Akun dengan riwayat pendidikan atau transaksi sebaiknya dinonaktifkan. Penghapusan akun yang memenuhi syarat dilakukan melalui RPC + Supabase Auth Admin. Bila langkah Auth Admin gagal setelah RPC berhasil, baca pesan error dan selesaikan akun Auth yang tertinggal secara manual. Jangan menggunakan cascade pada catatan keuangan/belajar.
- **Perubahan email akun yang sudah ada** belum ditawarkan karena membutuhkan proses verifikasi dan sinkronisasi Supabase Auth/profil. Membuat akun baru, memperbarui nama/nomor/role/instansi/kelas/status, dan hapus aman telah disediakan.
- **SPP:** tagihan tanpa pembayaran dapat diubah/dihapus. Yang sudah memiliki pembayaran tetap dapat diarsipkan/diaktifkan kembali tetapi isi tagihan tidak bisa diedit atau dihapus. Reviewer Developer hanya dapat mengubah transaksi **QRIS manual berstatus `reported`** menjadi `matched` atau `disputed` dengan catatan; `matched` mewajibkan bukti pembayaran di Storage, referensi mutasi bank, audit, dan pemeriksaan sisa tagihan. Tidak disediakan CRUD bebas atas transaksi DANA/QRIS yang sudah diproses gateway.
- **Langganan:** harga dapat diubah; order dan status `paid` tetap berasal dari webhook/proses gateway resmi. Dashboard bukan alat untuk membuat transaksi sukses fiktif, refund tanpa provider, atau menghapus bukti keuangan.
- **QRIS:** payload harus valid sebagai QRIS statis menurut `spp_qris_static` yang sudah ada; gateway membutuhkan External Store ID. API secret disimpan melalui Supabase Functions secrets, bukan panel ini.
- **Pengumuman:** fitur database `announcement` dapat dikelola penuh. Ini bukan sistem push notification massal; notifikasi push membutuhkan infrastruktur pengiriman dan persetujuan perangkat yang belum ada di backup.
- **Perkembangan:** laporan berdasarkan data aktual. Agregasi saat ini membaca maksimum 5.000 catatan terkait siswa di halaman berjalan dan 1.500 opsi relasi per permintaan; untuk penggunaan sangat besar, ganti dengan RPC agregasi + autocomplete server dengan pagination.
- **Tahun akademik:** kolom instansi `academic_year` dan `semester` adalah sumber kebenaran yang sudah ada. Tidak membuat tabel periode baru yang berpotensi tidak sinkron dengan Flutter.
- **Maintenance:** tetap memakai `001_platform_controls.sql` dan patch Flutter V2. Versi Flutter yang belum diperbarui, proses offline, dan API yang tidak membaca `tenant_active()` tidak dijamin langsung terblokir. Akses login Supabase Auth sendiri tetap tersedia.
- **Tanggal langganan:** SQL backup membedakan `tenants.subscription_until` (diperpanjang oleh pembayaran) dan `tenants.expires_at` (dicek oleh `tenant_active`). Upgrade ini tidak menyamakan keduanya secara diam-diam. Tinjau aturan bisnisnya sebelum menjanjikan aktivasi otomatis dari langganan.

## 5. Koneksi ke struktur Flutter + SQL

- Flutter model `AppUser` dipetakan ke `public.profiles`. Semua role developer/leader/admin/teacher/student memakai tabel yang **sama**, termasuk kolom `tenant_id`, `class_id`, `active`.
- `Entity` Flutter adalah `learning_entities` dengan kolom `kind` dan JSON `data`. Nama kunci `classId`, `subjectId`, `teacherId`, `studentId`, `dueAt`, `startVerse`, `endVerse`, dsb. dipertahankan.
- QRIS / SPP memakai tabel `spp_qris_settings`, `spp_gateway_settings`, `spp_invoices`, `spp_payments`, dan `spp_audit` asli. Langganan memakai `subscription_settings` dan `subscription_orders` asli.
- Pengguna non-developer tetap menggunakan kebijakan RLS dan RPC lama. Developer mendapat SELECT lintas instansi melalui RLS OR **hanya saat `is_platform_developer()` benar**. Mutasi baru melewati RPC SECURITY DEFINER yang melakukan pemeriksaan role, validasi relasi dan audit. Operasi Auth Admin membutuhkan server-only Supabase service role.

## 6. Checklist staging

- [ ] Akun Developer lama bisa login dan tetap satu `auth.users` / `public.profiles` ID
- [ ] Akun admin/guru/siswa lama tetap mendapat pembatasan sesuai instansi
- [ ] Buat/edit pengguna setiap role dan cek langsung di Flutter setelah reload
- [ ] Ubah role, pindah instansi untuk akun tanpa relasi, nonaktifkan akun; pastikan riwayat mencegah penghapusan yang berbahaya
- [ ] Buat kelas setelah membuat guru, kemudian mata pelajaran, jadwal, tugas, materi, absensi, hafalan, pengumuman; verifikasi kunci JSON terbaca Flutter
- [ ] Uji RLS Developer SELECT lintas instansi dan penolakan akses user biasa ke `owner_*` RPC
- [ ] Uji CRUD tagihan tanpa pembayaran, arsip, review QRIS manual dengan bukti mutasi dan periksa `owner_audit`
- [ ] Uji QRIS/gateway dengan payload staging yang sah sebelum mengaktifkan pembayaran live
- [ ] Uji widget dashboard, responsif desktop/mobile, keyboard, tabel/pagination/filter dan scrolling tanpa scrollbar
- [ ] Uji sakelar maintenance dengan build Flutter yang sudah dipatch — jangan menguji di produksi

## 7. Verifikasi kode yang tersedia

`node scripts/verify-project.cjs --schema=/path/supabase_backup.sql` memeriksa sintaks TS/TSX, keberadaan route dan module lokal, guard dasar, struktur tabel dan keberadaan fragmen migrasi. Itu **bukan pengujian tipe lengkap, build Next.js, tes migrasi PostgreSQL, uji RLS runtime, atau tes Flutter**.

Setelah instalasi npm dan menggunakan Supabase staging, jalankan build lengkap dan jalankan checklist manual di atas. Deploy ke Vercel setelah seluruh tes lulus.
