import test from 'node:test';
import assert from 'node:assert/strict';
import {rmSync} from 'node:fs';
import {db} from '../src/lib/database';
import {memories,retrieveMemory,runTurn} from '../src/lib/engine';
import {startConversation} from '../src/lib/db';
import type {Character,Persona,World} from '../src/lib/types';

const path=`/tmp/sekaira-memory-rejected-${process.pid}.sqlite`;
process.env.DATABASE_PATH=path;
delete process.env.DATABASE_URL;
process.env.GROQ_API_KEY='test-key';

const world:World={id:'school-world',owner_id:'owner',name:'School',description:'',created_at:new Date().toISOString(),lore:'',rules:'The exam date has not been announced.',locations:'Classroom',factions:'',power_system:'',timeline:'First week',world_state:'Students are waiting for the schedule.',genre:'School',cover:'city'};
const persona:Persona={id:'new-student',owner_id:'owner',name:'New Student',description:'',created_at:new Date().toISOString(),world_id:world.id,species:'Human',role:'Student',rank:'Year 1',faction:'',abilities:'',appearance:'',backstory:'',personality:'',public_facts:'New arrival',secret_facts:''};
const character:Character={id:'classmate',owner_id:'owner',name:'Classmate',description:'',created_at:new Date().toISOString(),avatar:'0',personality:'Reserved',backstory:'',speaking_style:'',likes:'',dislikes:'',relationship_behavior:'',greeting:'Welcome.',example_dialogue:'',lore:'',world_id:world.id,scenario_id:null,faction:'',tags:[]};
const input={world_id:world.id,persona_id:persona.id,scenario_id:null,character_ids:[character.id]};
const response=(value:unknown)=>Response.json({choices:[{message:{content:JSON.stringify(value)}}]});

test('a rejected grounded reply never becomes cross-room memory',async()=>{
 await db().prepare('INSERT INTO users (id,name,guest) VALUES (?,?,0)').run('owner','Owner');
 await db().prepare('INSERT INTO worlds (id,owner_id,data) VALUES (?,?,?)').run(world.id,'owner',JSON.stringify(world));
 await db().prepare('INSERT INTO personas (id,owner_id,world_id,data) VALUES (?,?,?,?)').run(persona.id,'owner',world.id,JSON.stringify(persona));
 await db().prepare('INSERT INTO characters (id,owner_id,world_id,data) VALUES (?,?,?,?)').run(character.id,'owner',world.id,JSON.stringify(character));
 await db().prepare('INSERT INTO world_characters (world_id,character_id) VALUES (?,?)').run(world.id,character.id);
 const conversation=await startConversation('owner',input);
 const originalFetch=globalThis.fetch;
 let reviews=0;
 globalThis.fetch=async(_url,init)=>{
  const payload=JSON.parse(String(init?.body));
  const system=payload.messages[0].content as string;
  if(system.includes('strict factual continuity checker')){
   reviews++;
   return response(reviews===1
    ?{consistent:false,corrected_dialogue:'I do not know the exam date yet.'}
    :{consistent:true,corrected_dialogue:''});
  }
  if(system.includes('Extract durable memory'))return response({
   memories:[{content:'The exam is on Friday.',type:'fact',importance:.95,confidence:.95}],
   relationship_events:[],
  });
  return response({dialogue:'The exam is on Friday.',emotion:'idle'});
 };
 try{
  await runTurn(conversation,[character],world,persona,'When is the exam?',[character.id]);
  assert.equal((await memories('owner')).some(memory=>memory.content==='The exam is on Friday.'),false);
  const next=await startConversation('owner',input);
  const recalled=retrieveMemory(await memories('owner'),next,character.id,'exam Friday');
  assert.equal(recalled.some(memory=>memory.content.includes('Friday')),false);
 }finally{globalThis.fetch=originalFetch;}
});

test.after(()=>{try{rmSync(path);}catch{}});
