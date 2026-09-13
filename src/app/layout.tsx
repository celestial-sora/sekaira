import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'Sekaira — Your story begins here',description:'Meet a character. Create a world. Become anyone. An original AI roleplay platform.',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
