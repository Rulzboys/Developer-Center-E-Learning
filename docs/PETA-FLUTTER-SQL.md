# Peta integrasi Flutter → Supabase → Owner Console

Disusun dari `lib.zip` (Flutter) dan `supabase_backup.sql` (dump PostgreSQL) yang diunggah.

| Kode Flutter / fitur | Tabel / RPC SQL terkait | Implementasi Owner Console |
|---|---|---|
| `features/developer/tenants_page.dart`, `saveTenant` | `public.tenants`, `save_tenant(jsonb)`, `tenant_active(uuid)` | `/instansi` CRUD instansi dan status; `/instansi/[id]` detail dan penanda beda tanggal langganan |
| `features/admin/users_page.dart`, `features/auth/login_page.dart`, `manage-user` Edge Function | `auth.users`, `public.profiles`, `apply_managed_profile`, `authorize_user_management` | `/akun`: read seluruh akun, create/edit Admin dan Pimpinan via Auth Admin API + RPC yang sudah ada |
| `features/admin/classes_page.dart`, `features/admin/academic_page.dart` | `learning_entities` kind `classroom`, `subject` | `/akademik` laporan lintas instansi, tanpa bypass penulisan |
| `features/learning/content_page.dart` | `learning_entities` kind `announcement`, `material`, `schedule` | `/akademik` filter jenis dan instansi |
| `features/assignments/assignment_page.dart` | `learning_entities` kind `assignment`, `submission` | `/akademik` ringkasan, tanpa menampilkan jawaban lengkap pada export |
| `features/memorization/memorization_page.dart`, `features/attendance/attendance_page.dart` | `learning_entities` kind `memorization`, `attendance` | `/akademik` laporan aktivitas/riwayat |
| `features/spp/spp_page.dart`, `payment_page.dart`, `qris_settings_page.dart` | `spp_invoices`, `spp_payments`, `spp_audit`, `spp_qris_settings`, `spp_gateway_settings`, RPC `spp_action`, `spp_dana_notify`, dll. | `/spp` tagihan terbaru, transaksi, status gateway dan audit; `/instansi/[id]` ringkasan gateway tanpa membocorkan payload QRIS |
| `features/subscription/subscription_settings_page.dart`, `subscription_page.dart` | `subscription_settings`, `subscription_orders`, `subscription_action`, `subscription_settle` | `/langganan`: harga melalui RPC Developer dan riwayat order read-only |
| `features/profile/profile_page.dart` | `profiles`, `update_self` | `/pengaturan` profil dan password Developer |
| `core/data/supabase_repository.dart` | Supabase Auth + Data + RPC | Session khusus server + service role server-side setelah pemeriksaan Developer |

## Kenapa akses akademik/SPP Owner dibuat read-only?

Struktur role aplikasi adalah `developer`, `leader`, `admin`, `teacher`, `student`. SQL membatasi fungsi penulisan akademik ke anggota instansi; developer **bukan** operator akademik lintas instansi. Pembayaran siswa, rekonsiliasi pengelola, dan notifikasi DANA juga mempunyai urutan validasi tertentu yang tidak aman untuk diganti dengan `UPDATE` service-role langsung. Panel Owner mengawasi seluruh sistem tanpa menciptakan jalan pintas yang dapat merusak catatan pembayaran atau histori belajar.

Untuk membuat editor akademik/rekonsiliasi Owner di masa mendatang, buat *fitur eskalasi administratif* yang disetujui, lengkap dengan RPC tersendiri, validasi tenant, prinsip persetujuan, dan audit log sebelum UI penulisan dibuka. Jangan menjalankan `adminClient().from('spp_payments').update({status:'matched'})` secara langsung.

## Konsekuensi perbedaan `subscription_until` dan `expires_at`

- `subscription_settle` menaikkan `subscription_until` ketika transaksi langganan lunas.
- `tenant_active` hanya membaca `status` dan `expires_at`.
- Keduanya sengaja ditampilkan terpisah untuk mendeteksi perubahan yang belum tersinkron.
- Migrasi korektif harus mempertimbangkan transaksi lama, batas masa aktif dan aturan kontrak sebelum menambah trigger / memperbarui fungsi.
