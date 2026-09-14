import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {db,createCharacter,createPersona,createWorld,startConversation,conversation,DatabaseContextError} from '../src/lib/db';
import {parseOAuthState,matchesOAuthState,googleProfileSchema} from '../src/lib/auth';

const testDirectory=mkdtempSync(join(tmpdir(),'oonchai-backend-'));
process.env.DATABASE_PATH=join(testDirectory,'test.sqlite');
delete process.env.DATABASE_URL;

const characterInput=(name:string,world_id:string|null=null)=>({
  name,description:'Test character',avatar:'0',personality:'Kind',backstory:'',speaking_style:'Natural',likes:'',dislikes:'',relationship_behavior:'',greeting:'Hello',example_dialogue:'',lore:'',world_id,scenario_id:null,faction:'',tags:['Original'],avatar_id:null,
});
const worldInput=(name:string)=>({name,description:'Test world',lore:'',rules:'',locations:'Start',factions:'',power_system:'',timeline:'',world_state:'',genre:'Original' as const,cover:'sky' as const});
const personaInput=(name:string,world_id:string)=>({name,description:'Test persona',world_id,species:'Human',role:'Traveler',rank:'',faction:'',abilities:'',appearance:'',backstory:'',personality:'',public_facts:'',secret_facts:''});

test('closed beta backend flows',async t=>{
  await db().prepare('INSERT INTO users VALUES (?,?,?,?)').run('owner-a',null,'Owner A',0);
  await db().prepare('INSERT INTO users VALUES (?,?,?,?)').run('owner-b',null,'Owner B',0);

  await t.test('starts a standalone character conversation without world, persona, or scenario',async()=>{
    const character=await createCharacter('owner-a',characterInput('Standalone'));
    const created=await startConversation('owner-a',{world_id:null,persona_id:null,scenario_id:null,character_ids:[character.id]});
    assert.equal(created.world_id,null);
    assert.equal(created.persona_id,null);
    assert.deepEqual(created.character_ids,[character.id]);
    assert.equal(created.name,'Standalone');
  });

  await t.test('rejects missing and inaccessible characters without persisting a partial conversation',async()=>{
    const other=await createCharacter('owner-b',characterInput('Private'));
    const before=(await db().prepare('SELECT id FROM conversations WHERE owner_id=?').all('owner-a')).length;
    await assert.rejects(
      startConversation('owner-a',{world_id:null,persona_id:null,scenario_id:null,character_ids:[other.id]}),
      (error:unknown)=>error instanceof DatabaseContextError&&error.status===404,
    );
    const after=(await db().prepare('SELECT id FROM conversations WHERE owner_id=?').all('owner-a')).length;
    assert.equal(after,before);
  });

  await t.test('requires a persona belonging to the selected world',async()=>{
    const worldA=await createWorld('owner-a',worldInput('World A'));
    const worldB=await createWorld('owner-a',worldInput('World B'));
    const character=await createCharacter('owner-a',characterInput('World Character',worldB.id));
    const wrongPersona=await createPersona('owner-a',personaInput('Wrong Persona',worldA.id));
    await assert.rejects(
      startConversation('owner-a',{world_id:worldB.id,persona_id:wrongPersona.id,scenario_id:null,character_ids:[character.id]}),
      (error:unknown)=>error instanceof DatabaseContextError&&/persona belonging/.test(error.message),
    );
    const persona=await createPersona('owner-a',personaInput('Matching Persona',worldB.id));
    const created=await startConversation('owner-a',{world_id:worldB.id,persona_id:persona.id,scenario_id:null,character_ids:[character.id]});
    assert.equal(created.world_id,worldB.id);
    assert.equal(created.persona_id,persona.id);
    assert.ok(await conversation(created.id,'owner-a'));
  });

  await t.test('rejects malformed OAuth state and unverified Google profiles',()=>{
    assert.equal(parseOAuthState('{"state":true}'),null);
    const state='s'.repeat(43),verifier='v'.repeat(64);
    assert.deepEqual(parseOAuthState(JSON.stringify({state,verifier})),{state,verifier});
    assert.equal(matchesOAuthState(state,state),true);
    assert.equal(matchesOAuthState(`${state}x`,state),false);
    assert.equal(googleProfileSchema.safeParse({sub:'google-user',email_verified:false}).success,false);
    assert.equal(googleProfileSchema.safeParse({sub:'google-user',email_verified:true}).success,true);
  });
});

test.after(()=>rmSync(testDirectory,{recursive:true,force:true}));
