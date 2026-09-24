import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {currentUser} from '@/lib/auth';
import {ensureDatabase} from '@/lib/db';
import {acceptFriend,FriendError,removeFriend} from '@/lib/friends';

export const runtime='nodejs';
export const dynamic='force-dynamic';
type Context={params:Promise<{id:string}>};
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
function originAllowed(req:NextRequest){const origin=req.headers.get('origin');return !origin||new Set([req.nextUrl.origin,process.env.APP_URL].filter(Boolean)).has(origin);}

export async function PATCH(req:NextRequest,ctx:Context){
 try{
  await ensureDatabase();if(!originAllowed(req))return json({error:'Request origin not allowed.'},403);
  const user=await currentUser();if(!user)return json({error:'Sign in is required.'},401);
  z.object({action:z.literal('accept')}).strict().parse(await req.json());
  await acceptFriend(user.id,(await ctx.params).id);return json({ok:true});
 }catch(error){
  if(error instanceof FriendError)return json({error:error.message},error.status);
  if(error instanceof z.ZodError)return json({error:'Invalid action.'},400);
  console.error('friend accept failed',error);return json({error:'Unable to accept friend request.'},500);
 }
}

export async function DELETE(req:NextRequest,ctx:Context){
 try{
  await ensureDatabase();if(!originAllowed(req))return json({error:'Request origin not allowed.'},403);
  const user=await currentUser();if(!user)return json({error:'Sign in is required.'},401);
  await removeFriend(user.id,(await ctx.params).id);return json({ok:true});
 }catch(error){
  if(error instanceof FriendError)return json({error:error.message},error.status);
  console.error('friend remove failed',error);return json({error:'Unable to remove friend.'},500);
 }
}
