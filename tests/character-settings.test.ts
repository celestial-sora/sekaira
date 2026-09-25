import test from 'node:test';
import assert from 'node:assert/strict';
import {rmSync} from 'node:fs';
import {db} from '../src/lib/database';
import {get} from '../src/lib/db';
import {updateCharacterDetails} from '../src/lib/community';
import {acceptFriend,requestFriend} from '../src/lib/friends';
import {compileCharacterContext,interactionBeat} from '../src/lib/roleplay-context';
import type {Character} from '../src/lib/types';

const path=`/tmp/sekaira-settings-${process.pid}.sqlite`;
process.env.DATABASE_PATH=path;
delete process.env.DATABASE_URL;

const character:Character={id:'editable',owner_id:'owner',name:'Original',description:'',created_at:new Date().toISOString(),avatar:'0',personality:'Quiet',backstory:'',speaking_style:'',likes:'',dislikes:'',relationship_behavior:'',greeting:'Hello',example_dialogue:'',lore:'',world_id:null,scenario_id:null,faction:'',tags:['Original'],visibility:'private'};

test('owner can update character details and visibility after creation while others cannot',async()=>{
 for(const [id,email] of [['owner','owner@example.test'],['friend','friend@example.test'],['stranger','stranger@example.test']])
  await db().prepare('INSERT INTO users (id,name,email,guest) VALUES (?,?,?,0)').run(id,id,email);
 await db().prepare('INSERT INTO characters (id,owner_id,visibility,data) VALUES (?,?,?,?)').run(character.id,'owner','private',JSON.stringify(character));

 assert.equal(await updateCharacterDetails(character.id,'stranger',{personality:'Changed'}),null);
 assert.equal((await get<Character>('characters',character.id,'owner'))?.personality,'Quiet');
 const updated=await updateCharacterDetails(character.id,'owner',{name:'Refined',avatar:'3',personality:'Observant and reserved',speaking_style:'Short, precise replies',roleplay_guidance:'Notice small gestures and answer directly.',tags:['Mystery','Reserved'],visibility:'public'});
 assert.equal(updated?.name,'Refined');
 assert.equal(updated?.published,true);
 assert.equal(updated?.avatar,'3');
 assert.equal((await get<Character>('characters',character.id,'stranger'))?.roleplay_guidance,'Notice small gestures and answer directly.');

 await requestFriend('owner','friend@example.test');
 await acceptFriend('friend','owner');
 await updateCharacterDetails(character.id,'owner',{visibility:'selected',friend_ids:['friend']});
 assert.ok(await get<Character>('characters',character.id,'friend'));
 assert.equal(await get<Character>('characters',character.id,'stranger'),null);
 await updateCharacterDetails(character.id,'owner',{tags:['Mystery']});
 assert.ok(await get<Character>('characters',character.id,'friend'));
 await assert.rejects(updateCharacterDetails(character.id,'owner',{visibility:'selected',friend_ids:['stranger']}));
 assert.ok(await get<Character>('characters',character.id,'friend'));
 assert.equal((await get<Character>('characters',character.id,'owner'))?.personality,'Observant and reserved');
});

test('roleplay context carries current guidance and the immediate conversational beat',async()=>{
 const current=(await get<Character>('characters',character.id,'owner'))!;
 const recent=[
  {role:'assistant' as const,speaker:current.name,content:'Would you like to search the garden?',character_id:current.id},
  {role:'user' as const,speaker:'User',content:'ได้เลย',character_id:null},
 ];
 const context=compileCharacterContext({character:current,persona:null,world:null,location:'garden',scene:null,state:{},memories:[],relationship:null,recent,styleReference:['ได้เลย'],otherReplies:[],userMessage:'ได้เลย'});
 assert.equal(context.character_profile.roleplay_guidance,'Notice small gestures and answer directly.');
 assert.equal(context.turn_cues.beat,'brief_exchange');
 assert.equal(context.turn_cues.previous_character_reply,'Would you like to search the garden?');
 assert.equal(interactionBeat('ไปหาอะไรดีไหม?'),'answer_question');
 assert.equal(interactionBeat('*ยื่นมือให้เธอ*'),'react_to_action');
});

test.after(()=>{try{rmSync(path);}catch{}});
