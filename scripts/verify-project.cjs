/* Basic offline verification. Full npm build still required after dependency install. */
const fs=require('node:fs'),path=require('node:path');
let ts;
try{ts=require('typescript')}catch{try{ts=require(path.join(require('node:child_process').execSync('npm root -g',{encoding:'utf8'}).trim(),'typescript'))}catch{console.error('TypeScript belum tersedia. Jalankan npm install.');process.exit(2)}}
const root=path.resolve(__dirname,'..'),src=path.join(root,'src');
const files=[];
function walk(folder){for(const f of fs.readdirSync(folder)){const p=path.join(folder,f);if(fs.statSync(p).isDirectory())walk(p);else if(/\.tsx?$/.test(f))files.push(p)}}walk(src);
const errors=[];
for(const file of files){
 const source=fs.readFileSync(file,'utf8');
 const syntax=ts.transpileModule(source,{fileName:file,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.Preserve,target:ts.ScriptTarget.ES2020}});
 (syntax.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).forEach(d=>errors.push(`${path.relative(root,file)}: ${ts.flattenDiagnosticMessageText(d.messageText,' ')}`));
 const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,file.endsWith('x')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 for(const stmt of ast.statements){
  if(!ts.isImportDeclaration(stmt)||!stmt.moduleSpecifier||!ts.isStringLiteral(stmt.moduleSpecifier))continue;
  let imp=stmt.moduleSpecifier.text,p;
  if(imp.startsWith('@/'))p=path.join(src,imp.slice(2));
  else if(imp.startsWith('.'))p=path.resolve(path.dirname(file),imp);
  else continue;
  if(![p,p+'.ts',p+'.tsx',path.join(p,'index.ts'),path.join(p,'index.tsx')].some(v=>fs.existsSync(v)))errors.push(`${path.relative(root,file)}: missing local module ${imp}`);
 }
}
const requiredPages=['dashboard','instansi','akun','akademik','spp','langganan','pengaturan','laporan','kontrol-aplikasi'];
for(const name of requiredPages){const p=path.join(src,'app','(console)',name,'page.tsx');if(!fs.existsSync(p))errors.push('Missing route: '+name);}
for(const page of requiredPages){const file=path.join(src,'app','(console)',page,'page.tsx');if(!fs.readFileSync(file,'utf8').includes('requireDeveloper()') && !(page==='akun' && fs.readFileSync(file,'utf8').includes('UserDirectory') && fs.readFileSync(path.join(src,'lib/owner/users-repository.ts'),'utf8').includes('await requireDeveloper()')))errors.push('Missing Developer guard on: '+page);}
const exportSource=fs.readFileSync(path.join(src,'app/api/export/[resource]/route.ts'),'utf8');
if(!exportSource.includes('await requireDeveloper()'))errors.push('CSV export missing Developer guard.');
const sqlArg=process.argv.find(a=>a.startsWith('--schema='));
if(sqlArg){
 const s=fs.readFileSync(sqlArg.slice('--schema='.length),'utf8');
 for(const tbl of ['profiles','tenants','learning_entities','spp_invoices','spp_payments','spp_audit','spp_qris_settings','spp_gateway_settings','subscription_settings','subscription_orders']){
  if(!s.includes('CREATE TABLE public.'+tbl+' ('))errors.push('Required Supabase table missing: '+tbl);
 }
 for(const name of ['apply_managed_profile','save_tenant','subscription_action','update_self']){
  if(!s.includes('CREATE FUNCTION public.'+name+'('))errors.push('Required Supabase RPC missing: '+name);
 }
 const tenant=s.match(/CREATE TABLE public\.tenants \(([\s\S]*?)\n\);/);
 if(!tenant||!tenant[1].includes('subscription_until'))errors.push('subscription_until not found in tenants table.');
}
if(errors.length){errors.forEach(e=>console.error('FAIL',e));process.exit(1)}
console.log(`PASS: ${files.length} TypeScript source files parsed; all local imports resolve; ${requiredPages.length} routes and export protected.`);
if(sqlArg)console.log('PASS: Attached SQL has the required tables, columns and RPC functions.');
const migration=fs.readFileSync(path.join(root,'sql/001_platform_controls.sql'),'utf8');
for(const fragment of ['CREATE TABLE IF NOT EXISTS public.platform_settings','CREATE TABLE IF NOT EXISTS public.platform_audit','CREATE TABLE IF NOT EXISTS public.owner_dashboard_layouts','public.mobile_runtime_status()','public.set_platform_controls(','CREATE OR REPLACE FUNCTION public.tenant_active(']){
 if(!migration.includes(fragment))errors.push('V2 migration missing: '+fragment);
}
if(!fs.existsSync(path.join(root,'src/components/dashboard-builder.tsx')))errors.push('Missing configurable dashboard component.');
if(errors.length){errors.forEach(e=>console.error('FAIL',e));process.exit(1)}
console.log('PASS: V2 control migration, dashboard builder, reports and controls present.');
const ownerSql=fs.readFileSync(path.join(root,'sql/002_owner_management.sql'),'utf8');
for(const fragment of ['public.is_platform_developer()','public.owner_profile_action(','public.owner_entity_action(','public.owner_invoice_action(','public.owner_qris_action(','public.owner_payment_reconcile(','public.owner_delete_tenant(','public.owner_save_tenant(','public.owner_price_action(','CREATE POLICY owner_profiles_read','CREATE POLICY owner_learning_read','CREATE TABLE IF NOT EXISTS public.owner_audit'])if(!ownerSql.includes(fragment))errors.push('V3 owner migration missing: '+fragment);
const newRoutes=['pengguna/[role]','akademik/[kind]','perkembangan','tahun-akademik','qris','spp/tagihan','riwayat'];
for(const route of newRoutes){const f=path.join(src,'app','(console)',route,'page.tsx');if(!fs.existsSync(f))errors.push('V3 missing route: '+route)}
if(errors.length){errors.forEach(e=>console.error('FAIL',e));process.exit(1)}
console.log('PASS: V3 developer-only RPCs, multi-institution read policies, audit and '+newRoutes.length+' new routes present.');
console.log('NOTE: This is an offline structure/syntax check, not a Next.js compilation or live Supabase integration test.');
