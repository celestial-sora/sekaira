import test from 'node:test';
import assert from 'node:assert/strict';
import {postgresSQL} from '../src/lib/database';

test('PostgreSQL relationship trust clamp uses unambiguous bigint bounds',()=>{
 const sql="INSERT INTO relationships (owner_id,scope,character_id,trust,note) VALUES (?,?,?,?,?) ON CONFLICT(owner_id,scope,character_id) DO UPDATE SET trust=MAX(-100,MIN(100,relationships.trust+excluded.trust)),note=CASE WHEN excluded.note='' THEN relationships.note ELSE excluded.note END";
 const converted=postgresSQL(sql);
 assert.match(converted,/GREATEST\(\(-100\)::bigint,LEAST\(\(100\)::bigint,relationships\.trust\+excluded\.trust\)\)/);
 assert.match(converted,/INSERT INTO sekaira\.relationships/);
 assert.doesNotMatch(converted,/MAX\(-100,MIN\(100/);
});
