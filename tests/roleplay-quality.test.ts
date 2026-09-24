import test from 'node:test';
import assert from 'node:assert/strict';
import {characterBehaviorDirective,collectUserStyleSamples,hasUnexpectedRepetition,labelDialogueHistory,NATURAL_SPEECH_RULES} from '../src/lib/roleplay-quality';
import type {Character,Message} from '../src/lib/types';

const character=(id:string,name:string,overrides:Partial<Character>={})=>({id,name,owner_id:null,description:'',created_at:'',avatar:'0',personality:'',backstory:'',speaking_style:'',likes:'',dislikes:'',relationship_behavior:'',greeting:'',example_dialogue:'',lore:'',world_id:null,scenario_id:null,faction:'',tags:[],...overrides}) satisfies Character;
const message=(role:Message['role'],content:string,character_id:string|null=null)=>({id:`${role}-${content}`,conversation_id:'conversation',role,character_id,content,emotion:'idle',created_at:''}) satisfies Message;

test('history labels every role so characters cannot confuse speakers',()=>{
 const result=labelDialogueHistory([
  message('user','Hello'),message('director','Rain begins.'),message('assistant','Come inside.','mira'),message('assistant','Unknown voice.','missing'),
 ],[character('mira','Mira')]);
 assert.deepEqual(result.map(item=>item.speaker),['User','Narrator','Mira','Unknown character']);
});

test('style sampling uses user turns only and keeps the latest message',()=>{
 const history=labelDialogueHistory([
  message('user','หวัดดี'),message('assistant','Hello.','mira'),message('director','Rain begins.'),message('user','เออจริงดิ'),
 ],[character('mira','Mira')]);
 assert.deepEqual(collectUserStyleSamples(history,'โห แบบนี้เลยเหรอ'),['หวัดดี','เออจริงดิ','โห แบบนี้เลยเหรอ']);
});

test('regional dialect is explicitly character-scoped rather than copied from the user',()=>{
 assert.match(NATURAL_SPEECH_RULES,/Regional or local dialect is character-owned, not user-owned/i);
 assert.match(NATURAL_SPEECH_RULES,/user's dialect by itself is never permission/i);
});

test('behavior compiler makes intense archetypes observable without forcing violence',()=>{
 const yandere=character('y','Yui',{tags:['Yandere'],personality:'Intensely attached and jealous.',relationship_behavior:'Protective and possessive.'});
 const directive=characterBehaviorDirective(yandere);
 assert.match(directive,/Preserve the profile intensity/i);
 assert.match(directive,/attachment, exclusivity, jealousy/i);
 assert.match(directive,/Do not default to violence/i);
});

test('behavior compiler distinguishes common archetypes',()=>{
 assert.match(characterBehaviorDirective(character('t','T',{tags:['Tsundere']})),/defensiveness, pride, embarrassment/i);
 assert.match(characterBehaviorDirective(character('k','K',{tags:['Kuudere']})),/affect restrained/i);
 assert.match(characterBehaviorDirective(character('d','D',{tags:['Dandere']})),/social hesitation/i);
});

test('repetition guard rejects repeated paragraphs and near-duplicate prior replies',()=>{
 assert.equal(hasUnexpectedRepetition('The lanterns sway above us as the rain begins.\n\nThe lanterns sway above us as the rain begins.',[]),true);
 assert.equal(hasUnexpectedRepetition('The lanterns sway above us as the rain begins, and Mira quietly offers you her umbrella.',['The lanterns sway above us as the rain begins, while Mira quietly offers you her umbrella.']),true);
});

test('repetition guard allows a genuinely new continuation',()=>{
 assert.equal(hasUnexpectedRepetition('Mira folds the map and points toward a narrow bridge hidden behind the market stalls.',['The lanterns sway above us as the rain begins, while Mira quietly offers you her umbrella.']),false);
});
