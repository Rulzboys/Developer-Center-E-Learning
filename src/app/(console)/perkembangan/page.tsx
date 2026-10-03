import Link from "next/link";
import {
  PageHead,
  FilterBar,
  Pager,
  Empty,
  TenantSelect,
} from "@/components/ui";
import {
  adminClient,
  requireDeveloper,
  safeSearch,
  validateUUID,
} from "@/lib/supabase";
import { allTenants } from "@/lib/queries";
import { academicOptions } from "@/lib/owner/academic-repository";
type Row = {
  id: string;
  tenant_id: string;
  name: string;
  class_id: string | null;
};
type EntityRow = { kind: string; data: Record<string, unknown> };
export default async function Progress({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string; q?: string; page?: string }>;
}) {
  await requireDeveloper();
  const sp = await searchParams;
  const tenant = validateUUID(sp.tenant || "") ? sp.tenant || "" : "";
  const q = safeSearch(sp.q);
  const page = Math.max(1, Math.min(10000, Number(sp.page) || 1));
  const db = adminClient();
  let query = db
    .from("profiles")
    .select("id,name,tenant_id,class_id", { count: "exact" })
    .eq("role", "student")
    .order("name")
    .range((page - 1) * 15, page * 15 - 1);
  if (tenant) query = query.eq("tenant_id", tenant);
  if (q) query = query.ilike("name", "%" + q + "%");
  const [result, tenants, opts] = await Promise.all([
    query,
    allTenants(),
    academicOptions(tenant),
  ]);
  if (result.error) throw new Error(result.error.message);
  const students = (result.data || []) as Row[];
  let progress: EntityRow[] = [];
  if (students.length) {
    const ids = students.map((s) => s.id);
    let r = db
      .from("learning_entities")
      .select("kind,data")
      .in("kind", ["memorization", "attendance", "submission"])
      .in("data->>studentId", ids)
      .limit(5000);
    if (tenant) r = r.eq("tenant_id", tenant);
    const response = await r;
    if (response.error) throw new Error(response.error.message);
    progress = (response.data || []) as EntityRow[];
  }
  const summary = (id: string) => {
    const mine = progress.filter((e) => e.data.studentId === id);
    const mem = mine.filter((e) => e.kind === "memorization");
    const attendance = mine.filter((e) => e.kind === "attendance");
    const graded = mine.filter(
      (e) => e.kind === "submission" && typeof e.data.score === "number",
    );
    const avg = graded.length
      ? Math.round(
          graded.reduce((a, e) => a + Number(e.data.score), 0) / graded.length,
        )
      : null;
    return {
      mem: mem.length,
      completed: mem.filter((e) => e.data.status === "completed").length,
      present: attendance.filter((e) => e.data.status === "Hadir").length,
      attendance: attendance.length,
      grade: avg,
    };
  };
  const names = Object.fromEntries(tenants.map((t) => [t.id, t.name])),
    classes = Object.fromEntries(
      opts.classes.map((c) => [c.id, String(c.data.name || "Kelas")]),
    );
  return (
    <>
      <PageHead
        overline="AKADEMIK / ANALITIK"
        title="Perkembangan Siswa"
        description="Ringkasan berdasarkan catatan hafalan, absensi, dan nilai tugas di Supabase. Tidak menggunakan data contoh."
      />
      <section className="surface">
        <div className="surface-heading">
          <div>
            <h2>Ringkasan per siswa</h2>
            <p>
              Penghitungan berasal dari data aktual, bukan prediksi prestasi.
            </p>
          </div>
          <span className="surface-count">{result.count || 0} siswa</span>
        </div>
        <div className="surface-pad">
          <FilterBar
            action="/perkembangan"
            query={q}
            placeholder="Cari nama siswa"
          >
            <TenantSelect value={tenant} tenants={tenants} />
          </FilterBar>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>SISWA</th>
                <th>INSTANSI / KELAS</th>
                <th>HAFALAN</th>
                <th>KEHADIRAN TERCATAT</th>
                <th>RATA-RATA TUGAS</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => {
                const m = summary(s.id);
                return (
                  <tr key={s.id}>
                    <td>
                      <b>{s.name}</b>
                    </td>
                    <td className="cell-muted">
                      {names[s.tenant_id] || "—"}
                      <span className="subline">
                        {s.class_id
                          ? classes[s.class_id] || "Kelas"
                          : "Tanpa kelas"}
                      </span>
                    </td>
                    <td>
                      {m.completed}/{m.mem} selesai
                    </td>
                    <td>
                      {m.present}/{m.attendance} hadir
                    </td>
                    <td>
                      {m.grade === null ? "Belum ada nilai" : m.grade + "/100"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!students.length && <Empty text="Belum ada siswa sesuai filter." />}
        </div>
        <Pager
          base="/perkembangan"
          page={page}
          count={result.count || 0}
          pageSize={15}
          filters={{ tenant, q }}
        />
      </section>
    </>
  );
}
