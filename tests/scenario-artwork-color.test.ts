import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css=fs.readFileSync('src/app/globals.css','utf8');

test('hero and fallback artwork are no longer color-washed by blend layers',()=>{
 assert.doesNotMatch(css,/background-blend-mode:soft-light/);
 assert.doesNotMatch(css,/\.hero\{[^}]*background:linear-gradient[^}]*aetheria\.png/);
 assert.match(css,/\.hero\{[^}]*background:url\('\/art\/aetheria\.png'\) center\/cover no-repeat/);
});

test('custom scenario images have no full-card or full-hero tint overlay',()=>{
 assert.match(css,/\.world-card\.has-image:before\{display:none;background:none\}/);
 assert.match(css,/\.world-detail-hero\.has-image:before\{display:none;background:none\}/);
 assert.match(css,/\.world-card-image\{[^}]*filter:none[^}]*mix-blend-mode:normal/);
 assert.match(css,/\.world-detail-image\{[^}]*filter:none[^}]*mix-blend-mode:normal/);
});

test('readability treatment is localized to copy instead of recoloring artwork',()=>{
 assert.match(css,/\.hero-copy\{[^}]*background:rgba\(255,255,255,.72\)/);
 assert.match(css,/\.world-card\.has-image>div\{[^}]*background:rgba\(12,10,16,.54\)/);
 assert.match(css,/world-detail-hero\.has-image :is\(\.eyebrow,h1,p,\.tags,\.inline-actions>\.muted\)\{text-shadow/);
});
