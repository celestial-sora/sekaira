import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const detail=fs.readFileSync('src/components/experiences.tsx','utf8');
const css=fs.readFileSync('src/app/globals.css','utf8');

test('scenario detail exposes dedicated main and aside wrappers',()=>{
 assert.match(detail,/className="world-detail-main"/);
 assert.match(detail,/className="world-detail-aside"/);
});

test('scenario detail sidebar does not stretch beyond its content',()=>{
 assert.match(css,/\.world-detail-layout\{[^}]*align-items:start/);
 assert.match(css,/\.world-detail-aside\{[^}]*align-self:start[^}]*position:static/);
 assert.match(css,/\.world-detail-aside>\.panel\{[^}]*height:auto[^}]*min-height:0/);
});

test('tablet moves sidebar cards below content in two columns',()=>{
 assert.match(css,/@media\(max-width:1180px\)\{[\s\S]*\.world-detail-layout\{grid-template-columns:1fr/);
 assert.match(css,/@media\(max-width:1180px\)\{[\s\S]*\.world-detail-aside\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});
