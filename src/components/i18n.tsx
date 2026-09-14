'use client';

import {createContext,useContext,type ReactNode} from 'react';

export type Language='en'|'th';
const LanguageContext=createContext<Language>('en');

export function LanguageProvider({language,children}:{language:Language;children:ReactNode}){return <LanguageContext.Provider value={language}>{children}</LanguageContext.Provider>;}
export function useLanguage(){const language=useContext(LanguageContext);return {language,text:(english:string,thai:string)=>language==='th'?thai:english};}
