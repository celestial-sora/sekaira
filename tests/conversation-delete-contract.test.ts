import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync('src/app/api/conversations/[id]/route.ts','utf8');

test('deleting one conversation does not erase relationship state shared by character/world scope',()=>{
 assert.doesNotMatch(source,/DELETE FROM relationships/i);
 assert.match(source,/DELETE FROM memories WHERE conversation_id=\?/i);
 assert.match(source,/DELETE FROM messages WHERE conversation_id=\?/i);
 assert.match(source,/DELETE FROM conversations WHERE id=\? AND owner_id=\?/i);
});
