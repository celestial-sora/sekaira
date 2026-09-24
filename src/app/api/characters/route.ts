import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {currentUser} from '@/lib/auth';
import {createCharacter,db,ensureDatabase,get,transaction} from '@/lib/db';
import type {World} from '@/lib/types';
import {characterCreationSchema} from '@/lib/validation';
import {InvalidCharacterShare} from '@/lib/community';

export const runtime='nodejs';
export const dynamic='force-dynamic';

const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
function originAllowed(req:NextRequest){const origin=req.headers.get('origin');const expected=new Set([req.nextUrl.origin,process.env.APP_URL].filter(Boolean));return !origin||expected.has(origin);}

export async function POST(req:NextRequest){
 try{
  await ensureDatabase();
  if(!originAllowed(req))return json({error:'Request origin not allowed.'},403);
  const user=await currentUser();
  if(!user)return json({error:'Please sign in to save your story.'},401);
  if(Number(req.headers.get('content-length')||0)>3_000_000)return json({error:'The upload is too large.'},413);
  const raw=await req.text();if(raw.length>3_000_000)return json({error:'The upload is too large.'},413);
  let parsed:unknown;try{parsed=JSON.parse(raw);}catch{return json({error:'Invalid JSON request.'},400);}
  const {friend_ids,...input}=characterCreationSchema.parse(parsed),owner=user.id;
  if(input.world_id){const world=await get<World>('worlds',input.world_id,owner);if(!world||world.owner_id!==owner)return json({error:'Choose a world you own.'},403);}
  if(input.scenario_id){const scenario=await db().prepare('SELECT id FROM scenarios WHERE id=? AND owner_id=? AND world_id IS ?').get(input.scenario_id,owner,input.world_id);if(!scenario)return json({error:'Scenario not found in this context.'},404);}
  if(input.avatar_id&&!(await db().prepare('SELECT id FROM avatars WHERE id=? AND owner_id=?').get(input.avatar_id,owner)))return json({error:'Avatar not found.'},404);
  const character=await transaction(async()=>createCharacter(owner,input,friend_ids));
  return json(character,201);
 }catch(error){
  if(error instanceof z.ZodError)return json({error:error.issues.map(issue=>issue.message).join(' ')},400);
  if(error instanceof InvalidCharacterShare)return json({error:error.message},400);
  console.error('character create failed',error);
  return json({error:'Unable to save this character right now.'},500);
 }
}
