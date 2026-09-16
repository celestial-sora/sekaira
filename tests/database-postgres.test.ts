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

test('PostgreSQL visibility queries translate SQLite published JSON checks',()=>{
 const listSql="SELECT data FROM characters WHERE owner_id IS NULL OR owner_id = ? OR json_extract(characters.data, '$.published') = 1";
 const convertedList=postgresSQL(listSql);
 assert.match(convertedList,/FROM sekaira\.characters/);
 assert.match(convertedList,/COALESCE\(\(characters\.data::jsonb ->> 'published'\)::boolean, false\) = true/);
 assert.doesNotMatch(convertedList,/json_extract/);
 assert.match(convertedList,/owner_id = \$1/);

 const detailSql="SELECT data FROM characters WHERE id = ? AND (owner_id IS NULL OR owner_id = ? OR json_extract(data, '$.published') = 1)";
 const convertedDetail=postgresSQL(detailSql);
 assert.match(convertedDetail,/COALESCE\(\(data::jsonb ->> 'published'\)::boolean, false\) = true/);
 assert.match(convertedDetail,/id = \$1/);
 assert.match(convertedDetail,/owner_id = \$2/);
});
