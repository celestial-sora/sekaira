import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync('src/app/api/characters/route.ts','utf8');

test('character create route validates ownership and persists transactionally',()=>{
 assert.match(source,/characterCreationSchema\.parse/);
 assert.match(source,/Choose a world you own/);
 assert.match(source,/transaction\(async\(\)=>createCharacter\(owner,input,friend_ids\)\)/);
 assert.match(source,/return json\(character,201\)/);
});
