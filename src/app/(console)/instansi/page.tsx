import Link from "next/link";
import { Download, Building2, CalendarClock, ChevronRight } from "lucide-react";
import { PageHead, Pill, FilterBar, Pager, Empty } from "@/components/ui";
import {
  TenantControls,
  TenantEditButton,
  TenantStatusButton,
} from "@/components/forms";
import TenantDelete from "@/components/owner/tenant-delete";
import { adminClient, requireDeveloper, safeSearch } from "@/lib/supabase";
import { accessStatus, date } from "@/lib/format";
import type { Tenant } from "@/lib/types";
export default async function TenantsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  await requireDeveloper();
  const sp = await searchParams;
  const q = safeSearch(sp.q);
  const status = ["active", "suspended"].includes(sp.status || "")
    ? sp.status
    : "";
  const page = Math.max(1, Math.min(10000, Number(sp.page) || 1));
  const size = 15;
  const db = adminClient();
  let query = db
    .from("tenants")
    .select("*", { count: "exact" })
    .order("name")
    .range((page - 1) * size, page * size - 1);
  if (q) query = query.or(`name.ilike.%${q}%,code.ilike.%${q}%`);
  if (status) query = query.eq("status", status);
  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  const tenants = (data || []) as Tenant[];
  return (
    <>
      <PageHead
        overline="PLATFORM MANAGEMENT"
        title="Instansi"
        description="Atur status, paket, pengaturan akademik, dan masa aktif untuk seluruh instansi."
        actions={<TenantControls />}
      />
      <div className="export-bar">
        <Link
          className="button secondary small"
          href={
            "/api/export/instansi?" +
            new URLSearchParams({
              ...(q ? { q } : {}),
              ...(status ? { status } : {}),
            }).toString()
          }
        >
          <Download size={16} /> Ekspor CSV
        </Link>
      </div>
      <section className="surface">
        <div className="surface-heading">
          <div>
            <h2>Daftar instansi</h2>
            <p>
              Pengaturan instansi langsung memengaruhi hak akses akun mobile.
            </p>
          </div>
          <div className="surface-count">
            <Building2 size={16} /> {count || 0} instansi
          </div>
        </div>
        <div className="surface-pad">
          <FilterBar
            action="/instansi"
            query={q}
            placeholder="Cari nama / kode instansi"
          >
            <select name="status" defaultValue={status}>
              <option value="">Semua status</option>
              <option value="active">Aktif</option>
              <option value="suspended">Ditangguhkan</option>
            </select>
          </FilterBar>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>INSTANSI</th>
                <th>PAKET</th>
                <th>STATUS</th>
                <th>MASA AKTIF</th>
                <th className="right">TINDAKAN</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => {
                const s = accessStatus(t);
                return (
                  <tr key={t.id}>
                    <td>
                      <div className="table-primary">
                        <span className="table-square">
                          <Building2 size={19} />
                        </span>
                        <div>
                          <Link
                            className="link-strong"
                            href={"/instansi/" + t.id}
                          >
                            {t.name}
                          </Link>
                          <span className="subline">{t.code}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="simple-tag">{t.plan}</span>
                    </td>
                    <td>
                      <Pill text={s.text} tone={s.tone} />
                    </td>
                    <td>
                      <div className="table-two-lines">
                        <span>{date(t.expires_at)}</span>
                        <small>
                          <CalendarClock size={13} /> Batas akses
                        </small>
                      </div>
                    </td>
                    <td>
                      <div className="table-actions">
                        <TenantEditButton tenant={t} />
                        <TenantStatusButton tenant={t} />
                        <TenantDelete tenant={t} />
                        <Link
                          className="icon-btn small"
                          href={"/instansi/" + t.id}
                          aria-label={"Detail " + t.name}
                        >
                          <ChevronRight size={18} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {tenants.length === 0 && (
            <Empty text="Tidak ada instansi sesuai filter." />
          )}
        </div>
        <Pager
          base="/instansi"
          page={page}
          count={count || 0}
          pageSize={size}
          filters={{ q, status }}
        />
      </section>
    </>
  );
}
