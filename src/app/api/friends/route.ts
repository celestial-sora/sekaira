import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {currentUser} from '@/lib/auth';
import {ensureDatabase} from '@/lib/db';
import {FriendError,listFriends,requestFriend} from '@/lib/friends';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});

export async function GET(){
 try{await ensureDatabase();const user=await currentUser();if(!user)return json({error:'Sign in is required.'},401);return json({friends:await listFriends(user.id)});}
 catch(error){console.error('friend list failed',error);return json({error:'Unable to load friends.'},500);}
}

export async function POST(req:NextRequest){
 try{
  await ensureDatabase();
  const origin=req.headers.get('origin');if(origin&&!new Set([req.nextUrl.origin,process.env.APP_URL].filter(Boolean)).has(origin))return json({error:'Request origin not allowed.'},403);
  const user=await currentUser();if(!user)return json({error:'Sign in is required.'},401);
  const input=z.object({email:z.email().max(320)}).strict().parse(await req.json());
  await requestFriend(user.id,input.email);
  return json({ok:true},201);
 }catch(error){
  if(error instanceof FriendError)return json({error:error.message},error.status);
  if(error instanceof z.ZodError)return json({error:'Enter a valid email address.'},400);
  console.error('friend request failed',error);return json({error:'Unable to send friend request.'},500);
 }
}
