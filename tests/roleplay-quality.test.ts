import test from 'node:test';
import assert from 'node:assert/strict';
import {hasUnexpectedRepetition,labelDialogueHistory} from '../src/lib/roleplay-quality';
import type {Character,Message} from '../src/lib/types';

const character=(id:string,name:string)=>({id,name,owner_id:null,description:'',created_at:'',avatar:'0',personality:'',backstory:'',speaking_style:'',likes:'',dislikes:'',relationship_behavior:'',greeting:'',example_dialogue:'',lore:'',world_id:null,scenario_id:null,faction:'',tags:[],avatar_id:null}) satisfies Character;
const message=(role:Message['role'],content:string,character_id:string|null=null)=>({id:`${role}-${content}`,conversation_id:'conversation',role,character_id,content,emotion:'idle',created_at:''}) satisfies Message;

test('history labels every role so characters cannot confuse speakers',()=>{
 const result=labelDialogueHistory([
  message('user','Hello'),message('director','Rain begins.'),message('assistant','Come inside.','mira'),message('assistant','Unknown voice.','missing'),
 ],[character('mira','Mira')]);
 assert.deepEqual(result.map(item=>item.speaker),['User','Narrator','Mira','Unknown character']);
});

test('repetition guard rejects repeated paragraphs and near-duplicate prior replies',()=>{
 assert.equal(hasUnexpectedRepetition('The lanterns sway above us as the rain begins.\n\nThe lanterns sway above us as the rain begins.',[]),true);
 assert.equal(hasUnexpectedRepetition('The lanterns sway above us as the rain begins, and Mira quietly offers you her umbrella.',['The lanterns sway above us as the rain begins, while Mira quietly offers you her umbrella.']),true);
});

test('repetition guard allows a genuinely new continuation',()=>{
 assert.equal(hasUnexpectedRepetition('Mira folds the map and points toward a narrow bridge hidden behind the market stalls.',['The lanterns sway above us as the rain begins, while Mira quietly offers you her umbrella.']),false);
});
