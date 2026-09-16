import {db} from './database';
import type {Relationship} from './types';
import {normalizeRelationship,type StructuredRelationship} from './relationship-state';

let schemaReady:Promise<void>|undefined;

export async function ensureRelationshipStateSchema(){
 schemaReady??=(async()=>{
  for(const statement of [
   'ALTER TABLE relationships ADD COLUMN affinity INTEGER NOT NULL DEFAULT 0',
   'ALTER TABLE relationships ADD COLUMN familiarity INTEGER NOT NULL DEFAULT 0',
   "ALTER TABLE relationships ADD COLUMN mood TEXT NOT NULL DEFAULT 'idle'",
  ]){
   try{await db().prepare(statement).run();}catch(error){
    const message=error instanceof Error?error.message:String(error);
    if(!/duplicate column|already exists/i.test(message))throw error;
   }
  }
 })().catch(error=>{schemaReady=undefined;throw error;});
 return schemaReady;
}

function relationshipFromRow(row:Record<string,unknown>):Relationship{
 const normalized=normalizeRelationship({
  affinity:Number(row.affinity)||0,
  trust:Number(row.trust)||0,
  familiarity:Number(row.familiarity)||0,
  mood:typeof row.mood==='string'?row.mood:'idle',
  note:typeof row.note==='string'?row.note:'',
 });
 return {character_id:String(row.character_id),...normalized};
}

export async function getRelationshipState(ownerId:string,relationshipScope:string,characterId:string):Promise<Relationship|null>{
 await ensureRelationshipStateSchema();
 const row=await db().prepare('SELECT character_id,affinity,trust,familiarity,mood,note FROM relationships WHERE owner_id=? AND scope=? AND character_id=?').get(ownerId,relationshipScope,characterId);
 return row?relationshipFromRow(row):null;
}

export async function listRelationshipStates(ownerId:string,relationshipScope:string):Promise<Relationship[]>{
 await ensureRelationshipStateSchema();
 const rows=await db().prepare('SELECT character_id,affinity,trust,familiarity,mood,note FROM relationships WHERE owner_id=? AND scope=?').all(ownerId,relationshipScope);
 return rows.map(relationshipFromRow);
}

export async function saveRelationshipState(ownerId:string,relationshipScope:string,characterId:string,value:StructuredRelationship){
 await ensureRelationshipStateSchema();
 const state=normalizeRelationship(value);
 await db().prepare('INSERT INTO relationships (owner_id,scope,character_id,affinity,trust,familiarity,mood,note) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(owner_id,scope,character_id) DO UPDATE SET affinity=excluded.affinity,trust=excluded.trust,familiarity=excluded.familiarity,mood=excluded.mood,note=excluded.note').run(ownerId,relationshipScope,characterId,state.affinity,state.trust,state.familiarity,state.mood,state.note);
}
