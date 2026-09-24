import {NextResponse} from 'next/server';
import {currentUser} from '@/lib/auth';
import {characterArtwork} from '@/lib/community';

export const runtime='nodejs';
export const dynamic='force-dynamic';

type Context={params:Promise<{id:string}>};
const notFound=()=>new NextResponse(null,{status:404,headers:{'Cache-Control':'no-store'}});

export async function GET(_request:Request,context:Context){
  const {id}=await context.params;
  const viewer=await currentUser();
  const artwork=await characterArtwork(id,viewer?.id??null);
  if(!artwork)return notFound();
  return new NextResponse(new Blob([Uint8Array.from(artwork.bytes)]),{
    headers:{'Content-Type':artwork.type,'Content-Length':String(artwork.bytes.length),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},
  });
}
