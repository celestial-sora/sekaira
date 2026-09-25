import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('scenario artwork is rendered in catalog cards and detail hero',()=>{
 const shared=fs.readFileSync('src/components/shared.tsx','utf8');
 const detail=fs.readFileSync('src/components/experiences.tsx','utf8');
 assert.match(shared,/w\.cover_image && <img className="world-card-image"/);
 assert.match(shared,/has-image/);
 assert.match(detail,/world\.cover_image && <img className="world-detail-image"/);
});

test('continue story uses the active scenario artwork when available',()=>{
 const app=fs.readFileSync('src/components/app.tsx','utf8');
 assert.match(app,/const continueWorld = continuation\?\.world_id/);
 assert.match(app,/className="continue-art-image"/);
});

test('uploaded scenario artwork keeps source color and crops safely across layouts',()=>{
 const css=fs.readFileSync('src/app/globals.css','utf8');
 for(const cls of ['world-card-image','world-detail-image','continue-art-image']){
  assert.match(css,new RegExp('\\.'+cls+'\\{[^}]*object-fit:cover'));
 }
 assert.match(css,/world-card-image[^}]*filter:none/);
 assert.match(css,/world-detail-image[^}]*mix-blend-mode:normal/);
 assert.match(css,/continue-art\.has-image\{background:none;background-blend-mode:normal\}/);
});
