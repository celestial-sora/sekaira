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

test('PostgreSQL visibility queries use boolean published predicates',()=>{
 const listSql="SELECT characters.data, characters.published FROM characters WHERE characters.owner_id IS NULL OR characters.owner_id = ? OR characters.published ORDER BY characters.id DESC";
 const convertedList=postgresSQL(listSql);
 assert.match(convertedList,/FROM sekaira\.characters/);
 assert.match(convertedList,/OR characters\.published/);
 assert.doesNotMatch(convertedList,/published = 1/);
 assert.doesNotMatch(convertedList,/json_extract/);
 assert.match(convertedList,/characters\.owner_id = \$1/);

 const detailSql="SELECT data, published FROM characters WHERE id = ? AND (owner_id IS NULL OR owner_id = ? OR published)";
 const convertedDetail=postgresSQL(detailSql);
 assert.match(convertedDetail,/FROM sekaira\.characters/);
 assert.match(convertedDetail,/OR published/);
 assert.doesNotMatch(convertedDetail,/published = 1/);
 assert.doesNotMatch(convertedDetail,/json_extract/);
 assert.match(convertedDetail,/id = \$1/);
 assert.match(convertedDetail,/owner_id = \$2/);
});

test('PostgreSQL message ordering does not use SQLite rowid',()=>{
 const sql="SELECT * FROM messages WHERE conversation_id=? ORDER BY rowid";
 const converted=postgresSQL(sql);
 assert.match(converted,/FROM sekaira\.messages/);
 assert.match(converted,/ORDER BY created_at/);
 assert.doesNotMatch(converted,/rowid/);
 assert.match(converted,/conversation_id=\$1/);
});
