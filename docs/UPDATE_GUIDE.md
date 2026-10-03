# Upgrade langsung dari EDULINK Owner Console V2 ke V3

Dokumen ini untuk pengguna yang sudah menjalankan website V2 di Vercel/lokal. **Jangan membuat proyek Supabase baru atau mengimpor ulang dump lama.**

1. Backup kode V2, konfigurasi lingkungan lokal/Vercel, database Supabase, dan folder `lib/` Flutter. Buat staging untuk mengetes penghapusan, role, pembayaran, dan maintenance.
2. Migrasi `sql/001_platform_controls.sql` **hanya jika belum pernah** dipasang di V2. Pada database yang sama, jalankan `sql/002_owner_management.sql` di SQL Editor. File `docs/verify-v3.sql` adalah inspeksi metadata baca-saja, bukan tes JWT end-user.
3. Bila menggunakan **ZIP patch**, ekstrak di **root proyek Next.js V2**, izinkan menimpa berkas yang sama, dan pertahankan `.env.local`, integrasi custom, serta kredensial di hosting. Bila menggunakan **ZIP lengkap**, gunakan sebagai versi upgrade repository web yang sama (copy/merge, bukan mengganti Flutter).
4. Jalankan `npm install`, `npm run typecheck`, `npm run build`, `npm run verify`, lalu `npm run dev`.
5. Login sebagai Developer yang ada di `auth.users` dan `public.profiles`, lalu uji filter lintas instansi dan semua CRUD menggunakan data **staging**. Verifikasi admin/guru/siswa tetap hanya bisa melihat instansinya.
6. Periksa data yang masih punya relasi: penghapusan akun, kelas, dan tagihan harus ditolak saat ada riwayat. Gunakan fitur Nonaktif/Arsip untuk mempertahankan transaksi.
7. Jika membutuhkan kontrol **buka/tutup aplikasi mobile**, pastikan Flutter V2 sudah menerima platform-gate patch dan sudah dibangun ulang. Website saja tidak bisa memblokir perangkat yang memakai build lama/offline.
8. Setelah lulus tes end-to-end, deploy **website yang sama** kembali ke Vercel, dengan `SUPABASE_SERVICE_ROLE_KEY` hanya di server.

Fitur yang belum didukung dengan aman: mengganti email akun Auth lama, menghapus transaksi gateway/bukti keuangan, menciptakan pembayaran langganan lunas tanpa webhook, dan push notification massal. Tidak ada fitur-fitur ini yang secara keliru diwakili sebagai CRUD aktif.
