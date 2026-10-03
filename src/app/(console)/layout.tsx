import {requireDeveloper} from '@/lib/supabase';
import {Sidebar,ConsoleHeader} from '@/components/navigation';
export const dynamic='force-dynamic';
export default async function ConsoleLayout({children}:{children:React.ReactNode}){
 const {profile}=await requireDeveloper();
 return <div className="app-shell"><Sidebar profile={profile}/><div className="app-main"><ConsoleHeader profile={profile}/><main className="content-wrap">{children}</main></div></div>;
}
