import test from 'node:test';
import assert from 'node:assert/strict';
import {compileCharacterContext,parseConversationState,recentMessages,summaryWork} from '../src/lib/roleplay-context';
import {applyRelationshipEvents,moodFromEmotion} from '../src/lib/relationship-state';
import {extractedSchema} from '../src/lib/validation';
import type {Character,Message,Relationship} from '../src/lib/types';

const message=(index:number):Message=>({
 id:`m-${index}`,conversation_id:'c',role:index%2===0?'user':'assistant',character_id:index%2===0?null:'char',content:`message ${index}`,emotion:'idle',created_at:new Date(index*1000).toISOString(),
});

const character:Character={
 id:'char',owner_id:'owner',name:'Mira',description:'',created_at:'',avatar:'0',personality:'Warm',backstory:'',speaking_style:'Casual',likes:'',dislikes:'',relationship_behavior:'Protective',greeting:'',example_dialogue:'',lore:'',world_id:null,scenario_id:null,faction:'',tags:['Original'],avatar_id:null,
};

test('rolling summary batches old turns without dropping unsummarized context',()=>{
 const seventeen=Array.from({length:17},(_,index)=>message(index));
 const waiting=summaryWork(seventeen,{});
 assert.equal(waiting.messages.length,0);
 assert.equal(recentMessages(seventeen,{}).length,17);

 const eighteen=Array.from({length:18},(_,index)=>message(index));
 const ready=summaryWork(eighteen,{});
 assert.equal(ready.messages.length,6);
 assert.equal(ready.summarizedThrough,6);
 const state={summary_message_count:ready.summarizedThrough,dialogue_summary:'older continuity'};
 assert.equal(recentMessages(eighteen,state).length,12);
});

test('conversation state parser survives malformed legacy state',()=>{
 assert.deepEqual(parseConversationState('not-json'),{});
 assert.deepEqual(parseConversationState('[]'),{});
 assert.equal(parseConversationState('{"summary":"scene"}').summary,'scene');
});

test('relationship events map to bounded deterministic score changes',()=>{
 const next=applyRelationshipEvents(
  {affinity:99,trust:0,familiarity:0,mood:'idle',note:''},
  [
   {character_id:'char',dimension:'affinity',direction:'gain',intensity:'large',reason:'Shared a vulnerable moment'},
   {character_id:'char',dimension:'trust',direction:'gain',intensity:'medium',reason:'Kept a promise'},
   {character_id:'char',dimension:'familiarity',direction:'loss',intensity:'large',reason:'Continuity reset'},
  ],
 );
 assert.equal(next.affinity,100);
 assert.equal(next.trust,2);
 assert.equal(next.familiarity,0);
 assert.equal(next.note,'Continuity reset');
 assert.equal(moodFromEmotion('happy'),'happy');
 assert.equal(moodFromEmotion('talking'),'idle');
});

test('post-turn extraction carries semantic relationship events instead of numeric deltas',()=>{
 const parsed=extractedSchema.parse({
  memories:[],
  relationship_events:[{character_id:'char',dimension:'trust',direction:'gain',intensity:'small',reason:'User kept a promise'}],
 });
 assert.equal(parsed.relationship_events[0].dimension,'trust');
 assert.equal(parsed.relationship_events[0].intensity,'small');
});

test('context compiler keeps persona, memory, relationship, summary and recent dialogue in separate layers',()=>{
 const relationship:Relationship={character_id:'char',affinity:8,trust:5,familiarity:3,mood:'shy',note:'Shared secret'};
 const context=compileCharacterContext({
  character,persona:null,world:null,location:'Room',scene:null,
  state:{dialogue_summary:'They agreed to meet again.'},memories:[],relationship,
  recent:[{role:'user',speaker:'User',content:'hey',character_id:null}],styleReference:['hey'],otherReplies:[],userMessage:'you came',
 });
 assert.equal(context.character_profile.name,'Mira');
 assert.equal(context.relationship_state?.trust,5);
 assert.equal(context.conversation_summary,'They agreed to meet again.');
 assert.equal(context.recent_dialogue[0].content,'hey');
 assert.deepEqual(context.style_reference.user_samples,['hey']);
});
