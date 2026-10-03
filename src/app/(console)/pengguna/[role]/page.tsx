import {notFound} from 'next/navigation';
import UserDirectory from '@/components/owner/user-directory';
export default async function UserRole({params,searchParams}:{params:Promise<{role:string}>;searchParams:Promise<{tenant?:string;q?:string;page?:string}>}){
 const {role}=await params;if(!['developer','leader','admin','teacher','student'].includes(role))notFound();
 return <UserDirectory searchParams={searchParams} forcedRole={role}/>;
}
