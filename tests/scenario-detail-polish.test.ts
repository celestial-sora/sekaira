import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const detail=fs.readFileSync('src/components/experiences.tsx','utf8');
const css=fs.readFileSync('src/app/globals.css','utf8');

test('scenario setup panel and start footer have dedicated layout hooks',()=>{
 assert.match(detail,/className="glass panel world-setup-panel"/);
 assert.match(detail,/className="form-footer world-start-footer"/);
});

test('scenario lore accordions use readable spacing and line length',()=>{
 assert.match(css,/\.lore-panel \.advanced\{[^}]*border-radius:18px/);
 assert.match(css,/\.lore-panel \.advanced p\{[^}]*max-width:78ch[^}]*line-height:1\.78/);
});

test('tablet and mobile setup actions stack cleanly',()=>{
 assert.match(css,/@media\(max-width:900px\)\{[\s\S]*\.world-start-footer\{align-items:stretch;flex-direction:column\}/);
 assert.match(css,/@media\(max-width:600px\)\{[\s\S]*\.world-setup-panel,\.lore-panel\{padding:18px\}/);
});
