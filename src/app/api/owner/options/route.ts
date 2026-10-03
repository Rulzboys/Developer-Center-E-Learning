import {NextRequest,NextResponse} from 'next/server';
import {requireDeveloper,validateUUID} from '@/lib/supabase';
import {academicOptions} from '@/lib/owner/academic-repository';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest){
 await requireDeveloper();const tenant=request.nextUrl.searchParams.get('tenant')||'';
 if(!validateUUID(tenant))return NextResponse.json({error:'Instansi tidak valid'},{status:400,headers:{'Cache-Control':'no-store'}});
 const options=await academicOptions(tenant);
 return NextResponse.json(options,{headers:{'Cache-Control':'private,no-store'}});
}
