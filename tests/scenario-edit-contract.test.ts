import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {worldUpdateSchema} from '../src/lib/validation';

test('scenario update accepts editable canon fields without resetting unspecified values',()=>{
 const update=worldUpdateSchema.parse({name:'Classroom Year One',world_state:'The entrance ceremony has just ended.'});
 assert.deepEqual(update,{name:'Classroom Year One',world_state:'The entrance ceremony has just ended.'});
});

test('scenario settings route and owner PATCH stay wired into the app',()=>{
 const app=fs.readFileSync('src/components/app.tsx','utf8');
 const detail=fs.readFileSync('src/components/experiences.tsx','utf8');
 const route=fs.readFileSync('src/app/api/[...path]/route.ts','utf8');
 assert.match(app,/segments\[2\] === "settings"/);
 assert.match(detail,/Edit scenario/);
 assert.match(route,/path\.length === 2 && method === "PATCH"/);
 assert.match(route,/worldUpdateSchema\.parse/);
});
