import type {Character,Message} from './types';

export type LabeledDialogue={role:Message['role'];speaker:string;content:string;character_id:string|null};

export function labelDialogueHistory(history:Message[],characters:Character[]):LabeledDialogue[]{
 const names=new Map(characters.map(character=>[character.id,character.name]));
 return history.map(message=>({
  role:message.role,
  speaker:message.role==='user'?'User':message.role==='director'?'Narrator':names.get(message.character_id||'')||'Unknown character',
  content:message.content,
  character_id:message.character_id,
 }));
}

function normalized(value:string){return value.toLocaleLowerCase().replace(/[\p{P}\p{S}\s]+/gu,'');}
function shingles(value:string,size=4){const text=normalized(value),out=new Set<string>();for(let i=0;i<=text.length-size;i++)out.add(text.slice(i,i+size));return out;}
function similarity(a:string,b:string){
 const left=shingles(a),right=shingles(b);if(!left.size||!right.size)return 0;
 let shared=0;for(const item of left)if(right.has(item))shared++;
 return shared/(left.size+right.size-shared);
}

export function hasUnexpectedRepetition(dialogue:string,previousByCharacter:string[]):boolean{
 const compact=normalized(dialogue);if(compact.length<24)return false;
 const segments=dialogue.split(/(?:\n{2,}|(?<=[.!?。！？])\s+)/u).map(normalized).filter(segment=>segment.length>=20);
 if(new Set(segments).size!==segments.length)return true;
 return previousByCharacter.some(previous=>{
  const prior=normalized(previous);if(prior.length<24)return false;
  if(compact===prior)return true;
  return Math.min(compact.length,prior.length)>=60&&similarity(compact,prior)>=.8;
 });
}
