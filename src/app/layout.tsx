import type {Metadata} from 'next';
import Script from 'next/script';
import './globals.css';
import './conversation-cards.css';
import './ui-refresh.css';
export const metadata:Metadata={title:'Oonchai — Your story begins here',description:'Meet a character. Create a scenario. Become anyone. An original AI roleplay platform.',icons:{icon:'/oonchai-icon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en" suppressHydrationWarning><body><Script id="theme-init" strategy="beforeInteractive">{`try{document.documentElement.dataset.theme=localStorage.getItem('oonchai-theme')==='dark'?'dark':'light'}catch{}`}</Script>{children}</body></html>;}
