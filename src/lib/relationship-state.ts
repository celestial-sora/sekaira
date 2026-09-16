export type RelationshipMood='idle'|'happy'|'shy'|'angry'|'sad'|'surprised';
export type RelationshipDimension='affinity'|'trust'|'familiarity';
export type RelationshipDirection='gain'|'loss';
export type RelationshipIntensity='small'|'medium'|'large';

export type RelationshipEvent={
 character_id:string;
 dimension:RelationshipDimension;
 direction:RelationshipDirection;
 intensity:RelationshipIntensity;
 reason:string;
};

export type StructuredRelationship={
 affinity:number;
 trust:number;
 familiarity:number;
 mood:RelationshipMood;
 note:string;
};

const STEP:Record<RelationshipIntensity,number>={small:1,medium:2,large:3};
const MOODS=new Set<RelationshipMood>(['idle','happy','shy','angry','sad','surprised']);

function clamp(value:number,min:number,max:number){return Math.max(min,Math.min(max,value));}

export function normalizeRelationship(value:Partial<StructuredRelationship>|null|undefined):StructuredRelationship{
 return {
  affinity:clamp(Number(value?.affinity)||0,-100,100),
  trust:clamp(Number(value?.trust)||0,-100,100),
  familiarity:clamp(Number(value?.familiarity)||0,0,100),
  mood:MOODS.has(value?.mood as RelationshipMood)?value!.mood as RelationshipMood:'idle',
  note:typeof value?.note==='string'?value.note:'',
 };
}

export function applyRelationshipEvents(current:Partial<StructuredRelationship>|null|undefined,events:RelationshipEvent[]):StructuredRelationship{
 const next=normalizeRelationship(current);
 for(const event of events){
  const signed=STEP[event.intensity]*(event.direction==='gain'?1:-1);
  if(event.dimension==='affinity')next.affinity=clamp(next.affinity+signed,-100,100);
  else if(event.dimension==='trust')next.trust=clamp(next.trust+signed,-100,100);
  else next.familiarity=clamp(next.familiarity+signed,0,100);
  if(event.reason.trim())next.note=event.reason.trim();
 }
 return next;
}

export function moodFromEmotion(emotion:string):RelationshipMood{
 if(emotion==='talking')return 'idle';
 return MOODS.has(emotion as RelationshipMood)?emotion as RelationshipMood:'idle';
}
