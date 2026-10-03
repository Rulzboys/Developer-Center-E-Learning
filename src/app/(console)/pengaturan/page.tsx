import {
  Database,
  KeyRound,
  Server,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { PageHead, Surface, Pill } from "@/components/ui";
import { ProfileForm, PasswordForm } from "@/components/forms";
import { requireDeveloper } from "@/lib/supabase";
export default async function Settings() {
  const { profile } = await requireDeveloper();
  return (
    <>
      <PageHead
        overline="PLATFORM SETTINGS"
        title="Pengaturan"
        description="Kelola identitas Developer, keamanan akun, dan konfigurasi sambungan database."
      />
      <div className="dashboard-columns settings-columns">
        <Surface
          title="Profil developer"
          subtitle="Informasi akun platform Anda."
        >
          <div className="profile-banner">
            <span className="avatar profile-avatar">
              {profile.name.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <b>{profile.name}</b>
              <span>{profile.email}</span>
            </div>
            <Pill text="Developer" tone="info" />
          </div>
          <ProfileForm profile={profile} />
        </Surface>
        <Surface
          title="Keamanan akun"
          subtitle="Ubah kata sandi untuk akses website dan aplikasi."
        >
          <div className="security-banner">
            <span>
              <KeyRound size={22} />
            </span>
            <div>
              <b>Satu identitas Supabase Auth</b>
              <p>
                Perubahan password ini juga berlaku untuk akun yang sama pada
                aplikasi Flutter.
              </p>
            </div>
          </div>
          <PasswordForm />
        </Surface>
      </div>
      <section className="surface">
        <div className="surface-heading">
          <div>
            <h2>Status integrasi</h2>
            <p>Website berjalan tanpa database tambahan.</p>
          </div>
          <Pill text="Shared database" tone="success" />
        </div>
        <div className="integration-grid">
          <div>
            <span className="integration-icon">
              <Database />
            </span>
            <b>Supabase PostgreSQL</b>
            <small>Terhubung dengan database aplikasi Flutter</small>
          </div>
          <div>
            <span className="integration-icon">
              <ShieldCheck />
            </span>
            <b>Supabase Auth</b>
            <small>Akun Developer aktif diverifikasi pada server</small>
          </div>
          <div>
            <span className="integration-icon">
              <Server />
            </span>
            <b>Next.js Server</b>
            <small>Service role hanya tersedia di server Vercel</small>
          </div>
        </div>
      </section>
    </>
  );
}
