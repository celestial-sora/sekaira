import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync('src/components/app.tsx','utf8');
const css=fs.readFileSync('src/components/navigation.module.css','utf8');

test('account is a navbar dropdown instead of a navigation link',()=>{
 assert.match(app,/panel === "account"/);
 assert.match(app,/aria-controls="navigation-account"/);
 assert.match(app,/id="navigation-account"/);
 assert.doesNotMatch(app,/<Link\s+href="\/account"\s+className=\{navStyles\.account\}/);
});

test('language and theme controls stay outside the hamburger panel',()=>{
 assert.match(app,/className=\{navStyles\.quick\}[\s\S]*onClick=\{onLanguage\}/);
 assert.match(app,/className=\{navStyles\.quick\}[\s\S]*onClick=\{onTheme\}/);
 const moreStart=app.indexOf('id="navigation-more"');
 const accountStart=app.indexOf('id="navigation-account"');
 const moreBlock=app.slice(moreStart,accountStart);
 assert.doesNotMatch(moreBlock,/onLanguage|onTheme/);
 assert.match(css,/\.quick\{/);
});

test('account dropdown keeps identity, friends, and sign out actions close at hand',()=>{
 assert.match(app,/className=\{navStyles\.accountIdentity\}/);
 assert.match(app,/<FriendsPanel user=\{user\}/);
 assert.match(app,/auth\/logout/);
});
