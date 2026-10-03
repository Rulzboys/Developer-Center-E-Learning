import {kindLabels} from '@/lib/types';
export type Field={key:string;label:string;type?:'text'|'textarea'|'date'|'datetime-local'|'number'|'select'|'relation'|'time';choices?:{value:string;label:string}[];rel?:'teacher'|'student'|'classroom'|'subject'|'assignment';required?:boolean};
const rel=(key:string,label:string,relation:Field['rel'],required=true):Field=>({key,label,rel:relation,type:'relation',required});
const text=(key:string,label:string,required=true):Field=>({key,label,required});
const choices=(key:string,label:string,values:[string,string][],required=true):Field=>({key,label,type:'select',required,choices:values.map(([value,label])=>({value,label}))});
const n=(key:string,label:string):Field=>({key,label,type:'number',required:true});
export const academicFields:Record<string,Field[]>={
 classroom:[text('name','Nama kelas'),rel('teacherId','Guru pembimbing','teacher'),text('academicYear','Tahun ajaran'),n('targetCount','Target hafalan')],
 subject:[text('name','Mata pelajaran'),{key:'description',label:'Deskripsi',type:'textarea'}],
 announcement:[text('title','Judul'),{key:'content',label:'Isi pengumuman',required:true,type:'textarea'},choices('audience','Penerima',[['all','Semua'],['student','Siswa'],['teacher','Guru'],['admin','Admin']]),rel('classId','Khusus kelas (opsional)','classroom',false)],
 material:[text('title','Judul materi'),{key:'content',label:'Isi materi',type:'textarea',required:true},rel('classId','Kelas','classroom'),rel('subjectId','Mata pelajaran','subject')],
 schedule:[text('title','Nama kegiatan'),rel('classId','Kelas','classroom'),rel('subjectId','Mata pelajaran','subject'),choices('weekday','Hari',[['1','Senin'],['2','Selasa'],['3','Rabu'],['4','Kamis'],['5','Jumat'],['6','Sabtu'],['7','Minggu']]),{key:'startTime',label:'Jam mulai',type:'time',required:true},{key:'endTime',label:'Jam selesai',type:'time',required:true},text('room','Ruangan',false)],
 assignment:[text('title','Judul tugas'),{key:'description',label:'Instruksi tugas',type:'textarea',required:true},rel('classId','Kelas','classroom'),rel('subjectId','Mata pelajaran','subject'),{key:'dueAt',label:'Tenggat',type:'datetime-local',required:true}],
 submission:[rel('classId','Kelas','classroom'),rel('studentId','Siswa','student'),rel('assignmentId','Tugas','assignment'),{key:'answer',label:'Jawaban',required:true,type:'textarea'},{key:'score',label:'Nilai (0–100)',type:'number'},text('feedback','Catatan penilaian',false)],
 attendance:[rel('classId','Kelas','classroom'),rel('studentId','Siswa','student'),{key:'date',label:'Tanggal',type:'date',required:true},choices('status','Status',[['Hadir','Hadir'],['Izin','Izin'],['Sakit','Sakit'],['Alpa','Alpa']])],
 memorization:[rel('classId','Kelas','classroom'),rel('studentId','Siswa','student'),text('title','Surah / bagian'),n('startVerse','Ayat mulai'),n('endVerse','Ayat selesai'),choices('status','Status',[['inProgress','Berlangsung'],['review','Perlu review'],['completed','Selesai']]),n('fluency','Kelancaran'),n('tajwid','Tajwid'),n('makhraj','Makhraj'),{key:'notes',label:'Catatan',type:'textarea'}]
};
export const displayTitle=(kind:string,d:Record<string,unknown>)=>String(d.name||d.title||d.date||d.answer||kindLabels[kind]||kind).slice(0,110);
