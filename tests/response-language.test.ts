import test from 'node:test';
import assert from 'node:assert/strict';
import {hasUnexpectedLanguage,responseLanguage,responseLanguageRule} from '../src/lib/response-language';

test('Thai user messages select Thai even when character data or earlier reply was Chinese',()=>{
 assert.equal(responseLanguage('เอาละ งั้นเราไปหา สมุนไพรกันเลยไหม',['你好','สวัสดี']), 'Thai');
 assert.equal(responseLanguage('ok',['สวัสดี','ไปกันเถอะ']), 'Thai');
 assert.match(responseLanguageRule('Thai'),/natural Thai/);
 assert.equal(hasUnexpectedLanguage('ถ้าอยากไปหา药材 ฉันจะไปด้วย','Thai'),true);
 assert.equal(hasUnexpectedLanguage('ไปหาสมุนไพรกันเถอะ Maomao','Thai'),false);
});

test('a Chinese user message may receive Chinese while English does not drift into it',()=>{
 assert.equal(responseLanguage('我们去找药材吧',['hello']), 'Chinese');
 assert.equal(hasUnexpectedLanguage('我们走吧','Chinese'),false);
 assert.equal(responseLanguage('Let us go gather herbs.',['สวัสดี']), 'English');
 assert.equal(hasUnexpectedLanguage('我们走吧','English'),true);
});
