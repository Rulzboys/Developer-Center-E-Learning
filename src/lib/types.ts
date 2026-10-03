export type Role = 'developer' | 'leader' | 'admin' | 'teacher' | 'student';
export type Tenant = {
  id: string; name: string; code: string; status: 'active' | 'suspended';
  plan: 'Dasar' | 'Sekolah' | 'Pesantren'; expires_at: string;
  academic_year: string; semester: 'Ganjil' | 'Genap';
  address: string; contact: string; target_count: number; subscription_until: string | null;
};
export type Profile = {
  id: string; tenant_id: string | null; name: string; email: string; role: Role;
  class_id: string | null; number: string; phone: string; active: boolean; photo_path: string;
};
export type SubscriptionOrder = {
  id:string;tenant_id:string;buyer_id:string;plan:'monthly'|'annual';
  amount:number;status:string;gateway:string;gateway_env:string;
  gateway_reference:string|null; created_at:string;paid_at:string|null;expires_at:string;
};
export type LearningEntity = {
  id:string;tenant_id:string;kind:string;data:Record<string,unknown>;
  author_id:string;created_at:string;
};
export type Invoice = {
  id:string;tenant_id:string;student_id:string;title:string;period:string;
  amount:number;due_date:string;allow_partial:boolean;archived:boolean;created_at:string;
};
export type Payment = {
  id:string;tenant_id:string;student_id:string;invoice_id:string;
  amount:number;status:string;provider:string;created_at:string;paid_at:string|null;
  reported_at:string|null;proof_path:string;review_note:string;
};
export type ActionResult = { ok:boolean; message:string };
export const initialAction:ActionResult = {ok:false,message:''};
export const entityKinds = ['classroom','subject','announcement','material','schedule','assignment','submission','memorization','attendance'] as const;
export const kindLabels:Record<string,string> = {
  classroom:'Kelas',subject:'Mata pelajaran',announcement:'Pengumuman',
  material:'Materi',schedule:'Jadwal',assignment:'Tugas',submission:'Pengumpulan',
  memorization:'Hafalan',attendance:'Absensi'
};
