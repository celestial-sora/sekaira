import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {worldSchema,worldUpdateSchema} from '../src/lib/validation';

const tinyPng='data:image/png;base64,iVBORw0KGgo=';

test('scenario creation and editing accept removable custom artwork',()=>{
 const created=worldSchema.parse({name:'Artwork world',cover_image:tinyPng});
 assert.equal(created.cover_image,tinyPng);
 const changed=worldUpdateSchema.parse({cover_image:tinyPng});
 assert.deepEqual(changed,{cover_image:tinyPng});
 const removed=worldUpdateSchema.parse({cover_image:null});
 assert.deepEqual(removed,{cover_image:null});
});

test('scenario artwork rejects unsupported image payloads',()=>{
 assert.throws(()=>worldSchema.parse({name:'Bad art',cover_image:'data:image/gif;base64,AAAA'}));
});

test('scenario editor exposes upload change remove controls and keeps AI generation from replacing artwork',()=>{
 const source=fs.readFileSync('src/components/scenario-form.tsx','utf8');
 assert.match(source,/Scenario artwork/);
 assert.match(source,/accept="image\/png,image\/jpeg,image\/webp"/);
 assert.match(source,/Change image/);
 assert.match(source,/Remove image/);
 assert.match(source,/Omit<ScenarioDraft,'cover_image'>/);
});
