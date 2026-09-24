import test from 'node:test';
import assert from 'node:assert/strict';
import {rmSync} from 'node:fs';
import {db} from '../src/lib/database';
import {messages,startConversation} from '../src/lib/db';
import {runTurn} from '../src/lib/engine';
import type {Character} from '../src/lib/types';

const path=`/tmp/sekaira-language-turn-${process.pid}.sqlite`;
process.env.DATABASE_PATH=path;
delete process.env.DATABASE_URL;
process.env.GROQ_API_KEY='test-key';

const character:Character={id:'thai-speaker',owner_id:'owner',name:'Maomao',description:'',created_at:new Date().toISOString(),avatar:'0',personality:'Reserved',backstory:'',speaking_style:'',likes:'',dislikes:'',relationship_behavior:'',greeting:'สวัสดี',example_dialogue:'',lore:'',world_id:null,scenario_id:null,faction:'',tags:[]};
const input={world_id:null,persona_id:null,scenario_id:null,character_ids:[character.id]};
const response=(value:unknown)=>Response.json({choices:[{message:{content:JSON.stringify(value)}}]});

test('wrong-language draft is regenerated before a Thai turn is saved',async()=>{
 await db().prepare('INSERT INTO users (id,name,guest) VALUES (?,?,0)').run('owner','Owner');
 await db().prepare('INSERT INTO characters (id,owner_id,data) VALUES (?,?,?)').run(character.id,'owner',JSON.stringify(character));
 const conversation=await startConversation('owner',input);
 const originalFetch=globalThis.fetch;
 let attempts=0;
 globalThis.fetch=async(_url,init)=>{
  const system=(JSON.parse(String(init?.body)).messages[0].content as string);
  if(system.includes('Extract durable memory'))return response({memories:[],relationship_events:[]});
  attempts++;
  return response({dialogue:system.includes('previous draft used the wrong language')?'ไปหาสมุนไพรกันเถอะ':'我们去找药材吧',emotion:'idle'});
 };
 try{
  await runTurn(conversation,[character],null,null,'เราไปหาสมุนไพรกันไหม');
  assert.equal(attempts,2);
  const history=await messages(conversation.id);
  assert.equal(history.at(-1)?.content,'ไปหาสมุนไพรกันเถอะ');
  assert.equal(history.some(item=>item.content.includes('药材')),false);
 }finally{globalThis.fetch=originalFetch;}
});

test('a second wrong-language draft fails without saving the user turn',async()=>{
 const conversation=await startConversation('owner',input);
 const originalFetch=globalThis.fetch;
 globalThis.fetch=async()=>response({dialogue:'我们去找药材吧',emotion:'idle'});
 try{
  await assert.rejects(runTurn(conversation,[character],null,null,'เราไปหาสมุนไพรกันไหม'),/wrong language/i);
  assert.equal((await messages(conversation.id)).length,1);
 }finally{globalThis.fetch=originalFetch;}
});

test.after(()=>{try{rmSync(path);}catch{}});
