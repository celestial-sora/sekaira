import test from 'node:test';
import assert from 'node:assert/strict';
import {scenarioGenerationRequestSchema,scenarioGenerationSchema,scenarioIntentSchema} from '../src/lib/validation';

const intent={
 core_premise:'A rain-soaked cyberpunk Bangkok where memory markets and spirit houses coexist.',
 must_keep:['Bangkok-inspired city','Memory markets','Citywide blackout opening'],
 genre:'Sci-fi',setting:'Near-future Bangkok',tone:'Noir but intimate',conflict:'Districts compete for stolen memories',power_or_technology:'Neural interfaces interact with local spirits',important_locations:['Old city memory bazaar'],factions:['Municipal memory bureau'],rules:['Memories can be copied but every copy degrades'],timeline:'Near future',starting_state:'A citywide blackout has just begun',mysteries_or_hooks:['Who caused the blackout?'],boundaries:[],
};
const generated={name:'Blackout Memory City',description:'A rain-soaked near-future metropolis where spirits, neural tech, and memory trafficking collide.',lore:'The city grew around old shrines while neural infrastructure spread beneath every district.',rules:'Memories can be copied, but every transfer loses detail. Spirits cannot be digitized.',locations:'Old City Memory Bazaar\nFlooded Skytrain Terminal',factions:'Municipal Memory Bureau\nShrine Keepers\nNight Couriers',power_system:'Neural interfaces manipulate stored memory while shrine rites affect non-digital spirits; both have hard limits.',timeline:'Near future, first night of the blackout',world_state:'Power has failed across the city and rival groups are moving before emergency systems recover.',genre:'Sci-fi' as const,cover:'city' as const};

test('scenario generation request trims and bounds the idea',()=>{
 assert.deepEqual(scenarioGenerationRequestSchema.parse({prompt:'   Build a haunted floating city above a permanent storm   '}),{prompt:'Build a haunted floating city above a permanent storm'});
 assert.equal(scenarioGenerationRequestSchema.safeParse({prompt:'too short'}).success,false);
 assert.equal(scenarioGenerationRequestSchema.safeParse({prompt:'x'.repeat(2401)}).success,false);
});

test('scenario intent preserves structured must-have worldbuilding constraints',()=>{
 assert.deepEqual(scenarioIntentSchema.parse(intent),intent);
 assert.equal(scenarioIntentSchema.safeParse({...intent,core_premise:''}).success,false);
 assert.equal(scenarioIntentSchema.safeParse({...intent,must_keep:Array(15).fill('detail')}).success,false);
});

test('generated scenario contract is directly saveable by world schema fields',()=>{
 assert.deepEqual(scenarioGenerationSchema.parse(generated),generated);
 assert.equal(scenarioGenerationSchema.safeParse({...generated,name:''}).success,false);
 assert.equal(scenarioGenerationSchema.safeParse({...generated,genre:'Cyberpunk'}).success,false);
 assert.equal(scenarioGenerationSchema.safeParse({...generated,cover:'rain'}).success,false);
});
