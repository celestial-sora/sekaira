import {NextRequest,NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {randomBytes,createHash} from 'node:crypto';
import {z} from 'zod';
import {db,id,now,ensureDatabase,list,get,createCharacter,createWorld,createPersona,worldCharacters,conversations,conversation,startConversation,messages,memories,scope,transaction} from '@/lib/db';
import {currentUser,guest,guestAllowed,googleReady,session,hash} from '@/lib/auth';
import {characterSchema,worldSchema,personaSchema,conversationSchema,turnSchema} from '@/lib/validation';
import {runTurn,AppError} from '@/lib/engine';
import type {Character,World,Persona,Conversation} from '@/lib/types';
export const runtime='nodejs';
export const dynamic='force-dynamic';
type Context={params:Promise<{path:string[]}>};
function fail(message:string,status=400):never{throw new AppError(message,status);}
function json(data:unknown,status=200){return NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});}
async function body(req:NextRequest){if(Number(req.headers.get('content-length')||0)>3_000_000)fail('The upload is too large.',413);const raw=await req.text();if(raw.length>3_000_000)fail('The upload is too large.',413);try{return JSON.parse(raw);}catch{fail('Invalid JSON request.');}}
async function chatData(c:Conversation,owner:string){return {conversation:c,messages:(await messages(c.id)),memories:(await memories(owner)).filter(m=>c.world_id?m.world_id===c.world_id&&m.persona_id===c.persona_id:!m.world_id&&m.character_id===c.character_ids[0]),relationships:(await db().prepare('SELECT character_id,trust,note FROM relationships WHERE owner_id=? AND scope=?').all(owner,scope(c))),characters:c.character_ids.map(async cid=>(await get<Character>('characters',cid,owner))),world:c.world_id?(await get<World>('worlds',c.world_id,owner)):null,persona:c.persona_id?(await get<Persona>('personas',c.persona_id,owner)):null};}
async function handle(req:NextRequest,ctx:Context){
 await ensureDatabase();
 const path=(await ctx.params).path,method=req.method;
 if(method!=='GET'){const origin=req.headers.get('origin');const expected=new Set([req.nextUrl.origin,process.env.APP_URL].filter(Boolean));if(origin&&!expected.has(origin))fail('Request origin not allowed.',403);}
 const user=await currentUser();
 if(path[0]==='bootstrap'&&method==='GET')return json({user,characters:(await list<Character>('characters',user?.id||null)),worlds:(await list<World>('worlds',user?.id||null)),personas:user?(await list<Persona>('personas',user.id)):[],conversations:user?(await conversations(user.id)):[],groqReady:!!process.env.GROQ_API_KEY,googleReady:googleReady(),guestAllowed:guestAllowed(),model:process.env.GROQ_MODEL||'llama-3.3-70b-versatile'});
 if(path[0]==='auth'){
  if(path[1]==='guest'&&method==='POST')return json(await guest());
  if(path[1]==='logout'&&method==='POST'){const c=await cookies(),token=c.get('sora_session')?.value;if(token)(await db().prepare('DELETE FROM sessions WHERE token_hash=?').run(hash(token)));c.delete('sora_session');return json({ok:true});}
  if(path[1]==='google'&&method==='GET'){
   if(!googleReady())return NextResponse.redirect(new URL('/settings?auth=not-configured',req.url));
   const state=randomBytes(32).toString('base64url'),verifier=randomBytes(48).toString('base64url');const c=await cookies();
   c.set('sora_oauth',JSON.stringify({state,verifier}),{httpOnly:true,secure:process.env.APP_URL?.startsWith('https://')||false,sameSite:'lax',path:'/api/auth',maxAge:600});
   const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');url.search=new URLSearchParams({client_id:process.env.GOOGLE_CLIENT_ID!,redirect_uri:`${process.env.APP_URL||'http://localhost:3000'}/api/auth/callback`,response_type:'code',scope:'openid profile email',state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'}).toString();return NextResponse.redirect(url);
  }
  if(path[1]==='callback'&&method==='GET'){
   const c=await cookies(),raw=c.get('sora_oauth')?.value;c.delete('sora_oauth');if(!raw)fail('Sign-in expired. Please try again.',401);const saved=JSON.parse(raw);if(req.nextUrl.searchParams.get('state')!==saved.state)fail('Sign-in state did not match. Please try again.',401);
   const code=req.nextUrl.searchParams.get('code');if(!code)return NextResponse.redirect(new URL('/settings?auth=cancelled',req.url));
   const token=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code,client_id:process.env.GOOGLE_CLIENT_ID!,client_secret:process.env.GOOGLE_CLIENT_SECRET!,redirect_uri:`${process.env.APP_URL||'http://localhost:3000'}/api/auth/callback`,grant_type:'authorization_code',code_verifier:saved.verifier}),signal:AbortSignal.timeout(20000)});if(!token.ok)fail('Google sign-in failed. Please try again.',401);
   const {access_token}=await token.json();const info=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:`Bearer ${access_token}`},signal:AbortSignal.timeout(20000)});if(!info.ok)fail('Unable to read Google profile.',401);const profile=await info.json();if(!profile.sub||!profile.email_verified)fail('A verified Google account is required.',401);
   const existing=(await db().prepare('SELECT id FROM users WHERE google_sub=?').get(profile.sub));let uid=existing?.id as string|undefined;
   if(!uid){uid=user?.guest?user.id:id();if(user?.guest)(await db().prepare('UPDATE users SET google_sub=?,name=?,guest=0 WHERE id=?').run(profile.sub,profile.name||'Traveler',uid));else (await db().prepare('INSERT INTO users VALUES (?,?,?,0)').run(uid,profile.sub,profile.name||'Traveler'));}
   await session(uid);return NextResponse.redirect(new URL('/',process.env.APP_URL||req.url));
  }
 }
 if(method==='GET'&&path[0]==='worlds'&&path[1]){const world=(await get<World>('worlds',path[1],user?.id||null));if(!world)fail('World not found.',404);return json({world,characters:(await worldCharacters(world.id,user?.id||null))});}
 if(!user)fail('Please sign in to save your story.',401);
 const owner=user.id;
 if(path[0]==='characters'&&method==='POST'&&path.length===1){const input=characterSchema.parse(await body(req));if(input.world_id){const world=(await get<World>('worlds',input.world_id,owner));if(!world||world.owner_id!==owner)fail('Choose a world you own.',403);}if(input.scenario_id){const s=(await db().prepare('SELECT id FROM scenarios WHERE id=? AND owner_id=? AND world_id IS ?').get(input.scenario_id,owner,input.world_id));if(!s)fail('Scenario not found in this context.',404);}if(input.avatar_id&&!(await db().prepare('SELECT id FROM avatars WHERE id=? AND owner_id=?').get(input.avatar_id,owner)))fail('Avatar not found.',404);return json((await transaction(async ()=>(await createCharacter(owner,input)))),201);}
 if(path[0]==='worlds'&&method==='POST'){
  if(path.length===1)return json((await createWorld(owner,worldSchema.parse(await body(req)))),201);
  const world=(await get<World>('worlds',path[1],owner));if(!world||world.owner_id!==owner)fail('Only the owner can change this world.',403);
  if(path[2]==='characters'){const {character_id}=z.object({character_id:z.string()}).parse(await body(req));if(!(await get<Character>('characters',character_id,owner)))fail('Character not found.',404);(await db().prepare('INSERT OR IGNORE INTO world_characters VALUES (?,?)').run(world.id,character_id));return json({ok:true});}
 }
 if(path[0]==='personas'&&method==='POST'){const input=personaSchema.parse(await body(req));if(input.world_id&&!(await get<World>('worlds',input.world_id,owner)))fail('World not found.',404);return json((await createPersona(owner,input)),201);}
 if(path[0]==='conversations'){
  if(method==='POST'&&path.length===1){const input=conversationSchema.parse(await body(req));const chars=input.character_ids.map(async cid=>(await get<Character>('characters',cid,owner)));if(chars.some(c=>!c))fail('Character not found.',404);
   if(input.world_id){if(!(await get<World>('worlds',input.world_id,owner)))fail('World not found.',404);const p=(await get<Persona>('personas',input.persona_id!,owner));if(!p||p.world_id!==input.world_id)fail('Choose a persona belonging to this world.');const available=new Set((await worldCharacters(input.world_id,owner)).map(c=>c.id));if(input.character_ids.some(cid=>!available.has(cid)))fail('Add your selected characters to this world first.');}
   if(input.scenario_id&&!(await db().prepare('SELECT id FROM scenarios WHERE id=? AND world_id IS ? AND (owner_id IS NULL OR owner_id=?)').get(input.scenario_id,input.world_id,owner)))fail('Scenario not found.',404);
   return json((await startConversation(owner,input)),201);
  }
  const conv=(await conversation(path[1],owner));if(!conv)fail('Conversation not found.',404);
  if(method==='GET')return json(chatData(conv,owner));
  if(method==='POST'&&path[2]==='messages'){const input=turnSchema.parse(await body(req));if(input.character_ids?.some(cid=>!conv.character_ids.includes(cid)))fail('That character is not in this scene.');const chars=conv.character_ids.map(async cid=>(await get<Character>('characters',cid,owner))!);await runTurn(conv,chars,conv.world_id?(await get<World>('worlds',conv.world_id,owner)):null,conv.persona_id?(await get<Persona>('personas',conv.persona_id,owner)):null,input.content,input.character_ids);return json(chatData((await conversation(conv.id,owner))!,owner));}
  if(method==='POST'&&path[2]==='memories'){const input=z.object({content:z.string().trim().min(1).max(1000),private:z.boolean().default(true)}).parse(await body(req));(await db().prepare('INSERT INTO memories VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(id(),owner,conv.id,conv.world_id,conv.persona_id,conv.world_id?null:conv.character_ids[0],'fact',input.content,1,1,JSON.stringify(input.private?[owner]:conv.character_ids),now()));return json(chatData(conv,owner));}
  if(method==='DELETE'&&path.length===2){(await db().prepare('DELETE FROM conversations WHERE id=? AND owner_id=?').run(conv.id,owner));return json({ok:true});}
 }
 if(path[0]==='avatars'&&method==='POST'){const input=z.object({asset_url:z.string().url().max(2000).refine(s=>s.startsWith('https://')&&/\.vrm(?:\?|$)/i.test(s),'Use an HTTPS URL to a .vrm file. Allow cross-origin access on its host.'),type:z.literal('vrm')}).parse(await body(req));const aid=id();(await db().prepare('INSERT INTO avatars VALUES (?,?,?,?)').run(aid,owner,input.type,input.asset_url));return json({id:aid},201);}
 if(path[0]==='avatars'&&method==='GET'){const a=(await db().prepare('SELECT * FROM avatars WHERE id=? AND owner_id=?').get(path[1],owner));if(!a)fail('Avatar not found.',404);return json(a);}
 fail('Not found.',404);
}
async function route(req:NextRequest,ctx:Context){try{return await handle(req,ctx);}catch(e){if(e instanceof z.ZodError)return json({error:e.issues.map(i=>i.message).join(' ')},400);if(e instanceof AppError)return json({error:e.message},e.status);console.error('Request failed:',e instanceof Error?e.message:'Unknown error');return json({error:'Something went wrong. Please try again.'},500);}}
export const GET=route;export const POST=route;export const DELETE=route;
