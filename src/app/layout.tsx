import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'EDULINK PRO · Owner Console',description:'Panel pengelolaan platform dan instansi pendidikan'};
export default function RootLayout({children}:{children:React.ReactNode}){
 return <html lang="id"><body>{children}</body></html>;
}
