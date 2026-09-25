import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const detail=fs.readFileSync('src/components/experiences.tsx','utf8');
const css=fs.readFileSync('src/app/globals.css','utf8');

test('scenario detail hero separates copy from owner controls',()=>{
 assert.match(detail,/className="world-hero-copy"/);
 assert.match(detail,/className="world-hero-ownerbar"/);
 assert.match(detail,/className="world-hero-actions"/);
 assert.match(detail,/className="world-hero-status"/);
});

test('scenario detail hero has explicit tablet spacing and responsive title sizing',()=>{
 assert.match(css,/\.world-hero-copy\{[^}]*width:min\(780px,72%\)/);
 assert.match(css,/world-hero-copy h1\{[^}]*font-size:clamp\(38px,4\.3vw,64px\)/);
 assert.match(css,/@media\(max-width:1100px\)\{[\s\S]*\.world-hero-ownerbar\{align-items:flex-start;flex-direction:column\}/);
});

test('mobile owner actions stack instead of colliding with status text',()=>{
 assert.match(css,/@media\(max-width:520px\)\{[\s\S]*\.world-hero-actions\{display:grid;grid-template-columns:1fr\}/);
});
