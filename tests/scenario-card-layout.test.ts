import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const shared=fs.readFileSync('src/components/shared.tsx','utf8');
const css=fs.readFileSync('src/app/globals.css','utf8');

test('scenario cards use shared badges and body wrappers',()=>{
 assert.match(shared,/className="world-card-badges"/);
 assert.match(shared,/className="world-card-body"/);
 assert.match(shared,/className="world-card-description"/);
});

test('scenario cards balance image and fallback layouts',()=>{
 assert.match(css,/\.world-card,\.world-card\.has-image\{[^}]*aspect-ratio:16\/10/);
 assert.match(css,/\.world-card:not\(\.has-image\)>\.world-card-body/);
 assert.match(css,/\.world-card-description\{[^}]*-webkit-line-clamp:4/);
});

test('tablet scenario cards collapse to one column',()=>{
 assert.match(css,/@media\(max-width:1100px\)\{[\s\S]*\.world-grid\{grid-template-columns:1fr\}/);
});
