import Link from "next/link";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import {
  Empty,
  FilterBar,
  PageHead,
  Pager,
  Pill,
  TenantSelect,
} from "@/components/ui";
import {
  AcademicEditor,
  AcademicDelete,
} from "@/components/owner/academic-editor";
import { academicPage } from "@/lib/owner/academic-repository";
import { displayTitle } from "@/lib/owner/academic-config";
import { entityKinds, kindLabels } from "@/lib/types";
import { datetime } from "@/lib/format";
export default async function AcademicKindPage({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string }>;
  searchParams: Promise<{ tenant?: string; q?: string; page?: string }>;
}) {
  const { kind } = await params;
  if (!(entityKinds as readonly string[]).includes(kind)) notFound();
  const data = await academicPage(kind, await searchParams);
  const names = Object.fromEntries(data.tenants.map((t) => [t.id, t.name]));
  return (
    <>
      <PageHead
        overline="AKADEMIK / MANAJEMEN"
        title={kindLabels[kind]}
        description="Kelola data lintas instansi. Filter memastikan kamu selalu mengetahui instansi asal setiap catatan."
        actions={
          <AcademicEditor
            kind={kind}
            tenants={data.tenants}
            options={data.opts}
            defaultTenant={data.tenant}
          />
        }
      />
      <section className="surface">
        <div className="surface-heading">
          <div>
            <h2>Daftar {kindLabels[kind].toLowerCase()}</h2>
            <p>
              Data tersinkron langsung dari Supabase yang sama dengan aplikasi
              Flutter.
            </p>
          </div>
          <span className="surface-count">
            {data.count.toLocaleString("id-ID")} data
          </span>
        </div>
        <div className="surface-pad">
          <FilterBar
            action={"/akademik/" + kind}
            query={data.q}
            placeholder="Cari nama / judul"
          >
            <TenantSelect value={data.tenant} tenants={data.tenants} />
          </FilterBar>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>DATA</th>
                <th>INSTANSI</th>
                <th>DIBUAT</th>
                <th className="right">TINDAKAN</th>
              </tr>
            </thead>
            <tbody>
              {data.records.map((record) => (
                <tr key={record.id}>
                  <td>
                    <b>{displayTitle(kind, record.data)}</b>
                    <span className="subline mono">
                      {record.id.slice(0, 8)}
                    </span>
                  </td>
                  <td className="cell-muted">
                    {names[record.tenant_id] || "Instansi tidak ditemukan"}
                  </td>
                  <td className="cell-muted">{datetime(record.created_at)}</td>
                  <td>
                    <div className="table-actions">
                      <AcademicEditor
                        kind={kind}
                        tenants={data.tenants}
                        options={data.opts}
                        record={record}
                      />
                      <AcademicDelete record={record} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data.records.length && (
            <Empty text="Belum ada catatan sesuai filter." />
          )}
        </div>
        <Pager
          base={"/akademik/" + kind}
          page={data.page}
          count={data.count}
          filters={{ tenant: data.tenant, q: data.q }}
        />
      </section>
    </>
  );
}
