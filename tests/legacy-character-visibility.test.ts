import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,rmSync} from 'node:fs';

test('a saved Everyone setting in legacy character JSON becomes visible to another account',async()=>{
  const path=`/tmp/sekaira-visibility-${process.pid}.sqlite`;
  const fixture=new DatabaseSync(path);
  try{
    fixture.exec(readFileSync('src/lib/schema.sql','utf8'));
    fixture.prepare('INSERT INTO users (id,name) VALUES (?,?)').run('sora','sora');
    fixture.prepare('INSERT INTO users (id,name) VALUES (?,?)').run('mizuduck','Mizuduck');
    fixture.prepare('INSERT INTO characters (id,owner_id,data) VALUES (?,?,?)').run('maomao','sora',JSON.stringify({id:'maomao',owner_id:'sora',name:'maomao',avatar:'0',tags:[],visibility:'public',published:true}));
  }finally{fixture.close();}
  process.env.DATABASE_PATH=path;
  delete process.env.DATABASE_URL;
  try{
    const {listCommunity}=await import('../src/lib/community');
    const {db}=await import('../src/lib/database');
    const visible=await listCommunity('characters','mizuduck');
    assert.ok(visible.some(item=>item.id==='maomao'));
    const stored=await db().prepare('SELECT visibility,published FROM characters WHERE id=?').get('maomao');
    assert.equal(stored?.visibility,'public');
    assert.equal(stored?.published,1);
  }finally{rmSync(path,{force:true});}
});
