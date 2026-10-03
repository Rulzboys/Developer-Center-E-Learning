# Checklist uji versi PRO V2 (jalankan di Supabase staging)

## Sebelum mulai

- [ ] Backup database dan aplikasi; pastikan Supabase project sesuai environment website dan Flutter.
- [ ] Jalankan `sql/001_platform_controls.sql` di staging dan pastikan baris `public.platform_settings` dengan `id=true` ada serta `mobile_enabled=true`.
- [ ] Pastikan profil login website di `public.profiles` memiliki `role='developer'`, `active=true`, `tenant_id IS NULL`.
- [ ] Deploy Flutter yang sudah berisi tiga file patch; `APP_MODE=supabase`.

## Website

- [ ] Login Developer sukses; login role siswa/admin instansi ditolak di website.
- [ ] Pencarian topbar (`Ctrl`/`⌘ + K`) menuju halaman sesuai kata kunci.
- [ ] Warna aksen biru/hijau/ungu mengubah elemen antarmuka.
- [ ] Dashboard: tombol `Atur widget` → sembunyikan, urutkan dengan drag, dan dengan tombol naik/turun → Simpan.
- [ ] Logout dan login dengan akun Developer sama: urutan widget tetap tersimpan. Developer lain memiliki preferensi sendiri.
- [ ] Laporan difilter berdasarkan instansi dan periode; nilai transaksi lunas konsisten dengan data Supabase (status `paid`).
- [ ] Ekspor transaksi dari laporan hanya berisi transaksi `paid` setelah awal periode yang dipilih.
- [ ] Alur instansi, pengelola, akademik, SPP, langganan, dan ekspor lama tetap berjalan.

## Kill switch

- [ ] Ketika `mobile_enabled=true` dan tidak ada jadwal berjalan, `SELECT public.mobile_runtime_status();` mengembalikan `enabled=true`.
- [ ] Developer menonaktifkan aplikasi (frasa konfirmasi benar); audit bertambah 1; `mobile_runtime_status` mengembalikan `enabled=false` dan pesan yang diatur.
- [ ] Flutter yang dipatch saat baru dibuka menampilkan maintenance. Jika sudah terbuka, tunggu hingga cek berkala atau kirim ke background dan kembali foreground.
- [ ] Reader biasa tidak dapat membaca data instansi yang dilindungi `tenant_active()` saat maintenance. Jangan menyimpulkan semua endpoint tertutup tanpa pemeriksaan khusus untuk Edge Functions.
- [ ] Developer tetap dapat membuka website, melihat audit, dan mengaktifkan kembali aplikasi.
- [ ] Jadwalkan maintenance masa depan dengan durasi singkat; tepat saat waktu mulai status RPC berubah false dan pada waktu berakhir kembali true tanpa cron (jika manual enabled=true).
- [ ] Batalkan jadwal; pastikan status mengikuti sakelar manual dan audit tercatat.
- [ ] Nonaktifkan internet pada Flutter yang di-patch: verifikasi gagal dan aplikasi menunjukkan layar pemeriksaan gagal, tidak diam-diam melanjutkan.
- [ ] Uji tombol `Coba lagi` setelah internet pulih.

## Rollback darurat

1. Kembalikan sakelar ON dan batalkan jadwal dari `/kontrol-aplikasi`; pastikan RPC `mobile_runtime_status` menampilkan `enabled=true`.
2. Jika website atau RPC pengelola rusak namun Supabase SQL Editor masih tersedia dan perlu memulihkan layanan, jalankan **hanya pada database yang benar**:

```sql
UPDATE public.platform_settings
SET mobile_enabled=true,
    maintenance_starts_at=NULL,
    maintenance_ends_at=NULL,
    updated_at=now();
SELECT public.mobile_runtime_status();
```

Tindakan SQL darurat langsung tidak masuk ke `platform_audit` otomatis; catat alasan dan pelaksananya secara manual. Jangan hapus tabel baru saat aplikasi Flutter yang telah di-patch masih memerlukannya: tanpa RPC, gate gagal tertutup (fail closed).
