import test from 'node:test';
import assert from 'node:assert/strict';
import {canCharacterRecall,memoryBelongsToConversationScope,memoryRecipients,retrieveCharacterMemories} from '../src/lib/memory';
import type {Conversation,Memory} from '../src/lib/types';

const baseConversation=(overrides:Partial<Conversation>={}):Conversation=>({
  id:'conversation-1',owner_id:'owner-1',world_id:'world-1',persona_id:'persona-1',scenario_id:null,
  character_ids:['char-present','char-absent'],name:'World chat',state:'{"summary":"public"}',location:'Square',created_at:'2026-01-01',updated_at:'2026-01-01',...overrides,
});
const memory=(overrides:Partial<Memory>={}):Memory=>({
  id:'memory-1',owner_id:'owner-1',conversation_id:'conversation-1',world_id:'world-1',persona_id:'persona-1',character_id:null,
  type:'event',content:'The bell rang at noon.',importance:.9,confidence:.9,known_by:['char-present'],created_at:'2026-01-01',...overrides,
});

test('memory boundaries only allow active witnesses to recall a world memory',()=>{
  const conversation=baseConversation();
  assert.equal(canCharacterRecall(memory(),conversation,'char-present'),true);
  assert.equal(canCharacterRecall(memory(),conversation,'char-absent'),false);
  assert.equal(canCharacterRecall(memory(),conversation,'other-world-character'),false);
  assert.equal(canCharacterRecall(memory({persona_id:'other-persona'}),conversation,'char-present'),false);
});

test('private memories and cross-owner memories never enter character retrieval',()=>{
  const conversation=baseConversation({world_id:null,persona_id:null,character_ids:['char-present']});
  const privateMemory=memory({world_id:null,persona_id:null,character_id:'char-present',known_by:[],content:'Private note'});
  const publicMemory=memory({world_id:null,persona_id:null,character_id:'char-present',known_by:['char-present'],content:'Shared note'});
  const otherOwner=memory({owner_id:'owner-2',world_id:null,persona_id:null,character_id:'char-present',known_by:['char-present'],content:'Other owner note'});
  assert.equal(canCharacterRecall(privateMemory,conversation,'char-present'),false);
  assert.deepEqual(retrieveCharacterMemories([privateMemory,publicMemory,otherOwner],conversation,'char-present','shared').map(item=>item.content),['Shared note']);
});

test('memory management follows character scope instead of source conversation id',()=>{
  const conversation=baseConversation({id:'conversation-new',world_id:null,persona_id:null,character_ids:['char-present']});
  const earlierMemory=memory({conversation_id:'conversation-old',world_id:null,persona_id:null,character_id:'char-present',known_by:[]});
  assert.equal(memoryBelongsToConversationScope(earlierMemory,conversation),true);
  assert.equal(memoryBelongsToConversationScope({...earlierMemory,character_id:'other-character'},conversation),false);
});

test('memory management keeps world persona timelines isolated',()=>{
  const conversation=baseConversation({id:'conversation-new'});
  assert.equal(memoryBelongsToConversationScope(memory({conversation_id:'conversation-old'}),conversation),true);
  assert.equal(memoryBelongsToConversationScope(memory({persona_id:'persona-2'}),conversation),false);
  assert.equal(memoryBelongsToConversationScope(memory({world_id:'world-2'}),conversation),false);
});

test('memory recipients are unique and exclude empty ids',()=>{
  assert.deepEqual(memoryRecipients(['char-a','','char-a','char-b']),['char-a','char-b']);
});
