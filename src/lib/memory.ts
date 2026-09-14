import type {Conversation,Memory} from './types';

export type MemoryVisibility='private'|'character'|'world';

/**
 * Visibility is represented without trusting model-authored labels:
 * - private: no character id is present in known_by
 * - character: scoped to one standalone character
 * - world: scoped to one world/persona timeline and explicit witnesses
 *
 * System continuity lives in Conversation.state and is never returned as a
 * character memory. `known_by` always contains character ids, never user ids.
 */
export function memoryVisibility(memory:Memory):MemoryVisibility{
 if(memory.known_by.length===0)return 'private';
 return memory.world_id?'world':'character';
}

export function canCharacterRecall(memory:Memory,conversation:Conversation,characterId:string):boolean{
 if(memory.owner_id!==conversation.owner_id||!memory.known_by.includes(characterId))return false;
 if(conversation.world_id){
  return memoryVisibility(memory)==='world'&&memory.world_id===conversation.world_id&&memory.persona_id===conversation.persona_id;
 }
 return memoryVisibility(memory)==='character'&&!memory.world_id&&memory.character_id===characterId;
}

export function memoryRecipients(characterIds:Iterable<string>):string[]{
 return [...new Set(characterIds)].filter(Boolean);
}

export type MemoryRanker=(memory:Memory,terms:Set<string>,at:number)=>number;

export const keywordMemoryRanker:MemoryRanker=(memory,terms,at)=>{
 const created=Date.parse(memory.created_at);
 const age=Number.isFinite(created)?Math.max(0,at-created):0;
 const recency=Math.exp(-age/86400000/30)*.15;
 const keyword=[...terms].filter(term=>memory.content.toLowerCase().includes(term)).length/Math.max(terms.size,1)*.4;
 return memory.importance*.35+memory.confidence*.1+recency+keyword;
};

export function retrieveCharacterMemories(all:Memory[],conversation:Conversation,characterId:string,query:string,ranker:MemoryRanker=keywordMemoryRanker,at=Date.now()):Memory[]{
 const terms=new Set(query.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(value=>value.length>2));
 return all
  .filter(memory=>canCharacterRecall(memory,conversation,characterId))
  .map(memory=>({memory,score:ranker(memory,terms,at)}))
  .sort((a,b)=>b.score-a.score)
  .slice(0,10)
  .map(value=>value.memory);
}
