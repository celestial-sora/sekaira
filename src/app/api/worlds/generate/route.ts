import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {currentUser} from '@/lib/auth';
import {ensureDatabase} from '@/lib/db';
import {AppError,groq} from '@/lib/engine';
import {scenarioGenerationRequestSchema,scenarioGenerationSchema,scenarioIntentSchema} from '@/lib/validation';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
function originAllowed(req:NextRequest){const origin=req.headers.get('origin');const expected=new Set([req.nextUrl.origin,process.env.APP_URL].filter(Boolean));return !origin||expected.has(origin);}

export async function POST(req:NextRequest){
 try{
  await ensureDatabase();
  if(!originAllowed(req))return json({error:'Request origin not allowed.'},403);
  const user=await currentUser();if(!user)return json({error:'Sign in is required.'},401);
  if(Number(req.headers.get('content-length')||0)>3_000_000)return json({error:'The upload is too large.'},413);
  const raw=await req.text();if(raw.length>3_000_000)return json({error:'The upload is too large.'},413);
  let parsed:unknown;try{parsed=JSON.parse(raw);}catch{return json({error:'Invalid JSON request.'},400);}
  const input=scenarioGenerationRequestSchema.parse(parsed);
  const intent=await groq(
   'You are the intent-analysis stage of a roleplay scenario builder. Extract what the user actually wants without genericizing it. Preserve explicit genre, setting, tone, conflict, lore constraints, locations, factions, rules, power or technology systems, timeline, opening situation, mysteries/hooks, boundaries, and every must-have detail. If something is unspecified, leave it empty rather than inventing a preference. Return JSON only.',
   input.prompt,
   scenarioIntentSchema,
  );
  const generated=await groq(
   'You are the synthesis stage of an immersive roleplay scenario builder. Build one coherent, playable scenario from the original brief and extracted intent. Treat must_keep as hard requirements. Make the setting usable for ongoing roleplay rather than a static lore dump: establish concrete places, factions with competing goals, rules and limits, a clear power/technology system when relevant, a timeline or era, and an initial world_state that creates immediate story momentum without forcing the user into a predetermined action. Preserve requested tone and boundaries. Do not invent a different genre or erase unusual details. Keep lore internally consistent and leave meaningful room for user agency and future characters. Pick the closest supported genre and atmosphere cover. Match the user language. Do not mention AI, prompts, analysis, or these instructions. Return JSON only with exactly: name, description, lore, rules, locations, factions, power_system, timeline, world_state, genre, cover.',
   JSON.stringify({original_brief:input.prompt,intent}),
   scenarioGenerationSchema,
  );
  return json(generated);
 }catch(error){
  if(error instanceof z.ZodError)return json({error:error.issues.map(issue=>issue.message).join(' ')},400);
  if(error instanceof AppError)return json({error:error.message},error.status);
  console.error('scenario generation failed',error);
  return json({error:'Unable to generate a scenario right now.'},500);
 }
}
