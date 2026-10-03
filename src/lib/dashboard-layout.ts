export const widgetCatalog = [
  {id:'instansi', label:'Total instansi', size:'quarter'},
  {id:'pengguna', label:'Total pengguna', size:'quarter'},
  {id:'akademik', label:'Aktivitas akademik', size:'quarter'},
  {id:'pendapatan', label:'Pendapatan bulanan', size:'quarter'},
  {id:'tren', label:'Tren langganan', size:'wide'},
  {id:'kesehatan', label:'Kesehatan instansi', size:'half'},
  {id:'transaksi', label:'Transaksi terbaru', size:'half'},
  {id:'perhatian', label:'Butuh perhatian', size:'half'},
  {id:'pintasan', label:'Tindakan cepat', size:'half'},
  {id:'sistem', label:'Status sistem', size:'wide'}
] as const;
export type WidgetId = typeof widgetCatalog[number]['id'];
export type WidgetSize = 'quarter'|'half'|'wide';
export type DashboardPreference = {id:WidgetId; visible:boolean};
export const defaultLayout: DashboardPreference[] = widgetCatalog.map(x=>({id:x.id,visible:true}));
export const validWidgetIds = new Set<string>(widgetCatalog.map(x=>x.id));
export function normalizeLayout(input:unknown): DashboardPreference[] {
  if(!Array.isArray(input))return defaultLayout;
  const used=new Set<string>();const result:DashboardPreference[]=[];
  for(const item of input){
    if(!item||typeof item!=='object')continue;
    const row=item as Record<string,unknown>;
    if(typeof row.id!=='string'||!validWidgetIds.has(row.id)||used.has(row.id))continue;
    used.add(row.id);
    result.push({id:row.id as WidgetId,visible:row.visible!==false});
  }
  for(const item of defaultLayout){if(!used.has(item.id))result.push(item);}
  if(result.every(x=>!x.visible))result[0].visible=true;
  return result;
}
