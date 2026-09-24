import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {currentUser} from '@/lib/auth';
import {ensureDatabase} from '@/lib/db';
import {characterSharing,InvalidCharacterShare,setCharacterVisibility} from '@/lib/community';

export const runtime='nodejs';
export const dynamic='force-dynamic';
type Context={params:Promise<{id:string}>};
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
const inputSchema=z.object({visibility:z.enum(['private','public','friends','selected']),friend_ids:z.array(z.string().min(1).max(100)).max(100).default([])}).strict();

export async function GET(_req:NextRequest,ctx:Context){
 try{await ensureDatabase();const user=await currentUser();if(!user)return json({error:'Sign in is required.'},401);const state=await characterSharing(user.id,(await ctx.params).id);return state?json(state):json({error:'Character not found.'},404);}
 catch(error){console.error('character sharing read failed',error);return json({error:'Unable to load sharing settings.'},500);}
}

export async function PUT(req:NextRequest,ctx:Context){
 try{
  await ensureDatabase();const origin=req.headers.get('origin');if(origin&&!new Set([req.nextUrl.origin,process.env.APP_URL].filter(Boolean)).has(origin))return json({error:'Request origin not allowed.'},403);
  const user=await currentUser();if(!user)return json({error:'Sign in is required.'},401);
  const input=inputSchema.parse(await req.json());
  const id=(await ctx.params).id;
  const changed=await setCharacterVisibility(id,user.id,input.visibility,input.friend_ids);
  if(!changed)return json({error:'Character not found.'},404);
  return json((await characterSharing(user.id,id))!);
 }catch(error){
  if(error instanceof InvalidCharacterShare)return json({error:error.message},400);
  if(error instanceof z.ZodError)return json({error:'Invalid sharing settings.'},400);
  console.error('character sharing update failed',error);return json({error:'Unable to save sharing settings.'},500);
 }
}
