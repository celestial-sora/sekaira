import type {Character,Memory,Message,Persona,Relationship,World} from './types';
import type {LabeledDialogue} from './roleplay-quality';

export const RECENT_MESSAGE_LIMIT=12;
export const SUMMARY_BATCH_SIZE=6;

export type ConversationState={
 summary?:string;
 dialogue_summary?:string;
 summary_message_count?:number;
 events?:Array<{content:string;at:string}>;
 [key:string]:unknown;
};

export function parseConversationState(raw:string):ConversationState{
 try{
  const value=JSON.parse(raw);
  return value&&typeof value==='object'&&!Array.isArray(value)?value as ConversationState:{};
 }catch{return {};}
}

function summarizedCount(messages:Message[],state:ConversationState){
 const previous=Number.isInteger(state.summary_message_count)?Number(state.summary_message_count):0;
 return Math.max(0,Math.min(previous,messages.length));
}

export function summaryWork(messages:Message[],state:ConversationState,windowSize=RECENT_MESSAGE_LIMIT,batchSize=SUMMARY_BATCH_SIZE){
 const target=Math.max(0,messages.length-Math.max(1,windowSize));
 const start=Math.min(summarizedCount(messages,state),target);
 if(target-start<Math.max(1,batchSize))return {messages:[] as Message[],summarizedThrough:start};
 return {messages:messages.slice(start,target),summarizedThrough:target};
}

export function recentMessages(messages:Message[],state:ConversationState,windowSize=RECENT_MESSAGE_LIMIT){
 const target=Math.max(0,messages.length-Math.max(1,windowSize));
 const start=Math.min(summarizedCount(messages,state),target);
 return messages.slice(start);
}

type ContextArgs={
 character:Character;
 persona:Persona|null;
 world:World|null;
 location:string;
 scene:string|null;
 state:ConversationState;
 memories:Memory[];
 relationship:Relationship|null;
 recent:LabeledDialogue[];
 styleReference:string[];
 otherReplies:Array<{speaker:string;dialogue:string}>;
 userMessage:string;
};

export function compileCharacterContext(args:ContextArgs){
 const {character:c,persona,world,location,scene,state,memories,relationship,recent,styleReference,otherReplies,userMessage}=args;
 return {
  character_profile:{
   name:c.name,description:c.description,personality:c.personality,backstory:c.backstory,
   speaking_style:c.speaking_style,likes:c.likes,dislikes:c.dislikes,
   relationship_behavior:c.relationship_behavior,example_dialogue:c.example_dialogue,lore:c.lore,tags:c.tags,
  },
  public_persona:persona?{
   name:persona.name,species:persona.species,role:persona.role,rank:persona.rank,faction:persona.faction,
   abilities:persona.abilities,appearance:persona.appearance,public_facts:persona.public_facts,
  }:null,
  world_context:world?{
   name:world.name,description:world.description,rules:world.rules,locations:world.locations,
   factions:world.factions,power_system:world.power_system,timeline:world.timeline,
   location,observable_scene:scene,public_state_summary:state.summary||'',recent_public_events:(state.events||[]).slice(-10),
  }:null,
  relationship_state:relationship?{
   affinity:relationship.affinity,trust:relationship.trust,familiarity:relationship.familiarity,
   mood:relationship.mood,note:relationship.note,
  }:null,
  memory_recall:memories.map(memory=>({type:memory.type,content:memory.content,importance:memory.importance,confidence:memory.confidence})),
  conversation_summary:state.dialogue_summary||'',
  recent_dialogue:recent,
  style_reference:{user_samples:styleReference,character_speaking_style:c.speaking_style},
  other_replies:otherReplies,
  user_message:userMessage,
 };
}
