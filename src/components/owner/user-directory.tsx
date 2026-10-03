import Link from "next/link";
import { Download } from "lucide-react";
import {
  Empty,
  FilterBar,
  PageHead,
  Pager,
  Pill,
  TenantSelect,
} from "@/components/ui";
import { UserEditor, UserDelete } from "@/components/owner/user-editor";
import { roleLabels, usersPage } from "@/lib/owner/users-repository";
import type { Role } from "@/lib/types";
export default async function UserDirectory({
  searchParams,
  forcedRole,
}: {
  searchParams: Promise<{
    role?: string;
    tenant?: string;
    q?: string;
    page?: string;
  }>;
  forcedRole?: string;
}) {
  const data = await usersPage(await searchParams, forcedRole);
  const title = data.role
    ? `Manajemen ${roleLabels[data.role as Role]}`
    : "Direktori semua akun";
  const names = Object.fromEntries(data.tenants.map((t) => [t.id, t.name]));
  const base = forcedRole ? "/pengguna/" + forcedRole : "/akun";
  return (
    <>
      <PageHead
        overline="PENGGUNA / PUSAT"
        title={title}
        description="Kelola akun Authentication, profil, role dan akses dari berbagai instansi. Perubahan memiliki audit di Supabase."
        actions={
          <UserEditor
            defaultRole={(data.role || "student") as Role}
            tenants={data.tenants}
            options={data.options}
            defaultTenant={data.tenant}
          />
        }
      />
      <div className="export-bar">
        <Link
          className="button secondary small"
          href={
            "/api/export/akun?" +
            new URLSearchParams({
              ...(data.tenant ? { tenant: data.tenant } : {}),
              ...(data.role ? { role: data.role } : {}),
              ...(data.q ? { q: data.q } : {}),
            }).toString()
          }
        >
          <Download size={16} /> Ekspor CSV
        </Link>
      </div>
      <section className="surface">
        <div className="surface-heading">
          <div>
            <h2>Daftar pengguna</h2>
            <p>
              Data langsung dari public.profiles. Identitas login berasal dari
              Supabase Auth.
            </p>
          </div>
          <span className="surface-count">
            {data.count.toLocaleString("id-ID")} akun
          </span>
        </div>
        <div className="surface-pad">
          <FilterBar
            action={base}
            query={data.q}
            placeholder="Cari nama atau email"
          >
            <TenantSelect value={data.tenant} tenants={data.tenants} />
            {!forcedRole && (
              <select name="role" aria-label="Role" defaultValue={data.role}>
                <option value="">Semua role</option>
                {Object.entries(roleLabels).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            )}
          </FilterBar>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>PENGGUNA</th>
                <th>ROLE</th>
                <th>INSTANSI</th>
                <th>STATUS</th>
                <th className="right">TINDAKAN</th>
              </tr>
            </thead>
            <tbody>
              {data.records.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="table-primary">
                      <span className="avatar table-avatar">
                        {p.name.slice(0, 1).toUpperCase()}
                      </span>
                      <div>
                        <b>{p.name}</b>
                        <span className="subline">{p.email}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="simple-tag">{roleLabels[p.role]}</span>
                  </td>
                  <td className="cell-muted">
                    {p.tenant_id
                      ? names[p.tenant_id] || "Instansi tidak tersedia"
                      : "Platform"}
                  </td>
                  <td>
                    <Pill
                      text={p.active ? "Aktif" : "Nonaktif"}
                      tone={p.active ? "success" : "danger"}
                    />
                  </td>
                  <td>
                    <div className="table-actions">
                      <UserEditor
                        user={p}
                        tenants={data.tenants}
                        options={data.options}
                      />
                      <UserDelete user={p} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.records.length && (
            <Empty text="Tidak ada pengguna sesuai filter." />
          )}
        </div>
        <Pager
          base={base}
          page={data.page}
          count={data.count}
          filters={{
            q: data.q,
            tenant: data.tenant,
            ...(!forcedRole ? { role: data.role } : {}),
          }}
        />
      </section>
    </>
  );
}
