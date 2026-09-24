import test from 'node:test';
import assert from 'node:assert/strict';
import {rmSync} from 'node:fs';
import {db} from '../src/lib/database';
import {get,startConversation} from '../src/lib/db';
import {characterArtwork,getVisibleAvatar,listCommunity,setCharacterVisibility,validateShareRecipients} from '../src/lib/community';
import {acceptFriend,listFriends,removeFriend,requestFriend} from '../src/lib/friends';
import type {Character} from '../src/lib/types';

const path=`/tmp/sekaira-friends-${process.pid}.sqlite`;
process.env.DATABASE_PATH=path;
delete process.env.DATABASE_URL;

const character={id:'shared-character',owner_id:'owner',name:'Shared character',description:'',personality:'',greeting:'hello',world_id:null,scenario_id:null,avatar_id:'avatar-shared',avatar:'0',tags:[],published:false,visibility:'private',created_at:new Date().toISOString()};
const conversationInput={world_id:null,persona_id:null,scenario_id:null,character_ids:[character.id]};

async function visibleTo(userId:string){
 return (await listCommunity<Character>('characters',userId)).some(item=>item.id===character.id);
}

test('friend approval and character sharing control detail, listing, avatar, and chat access',async()=>{
 for(const [id,email] of [['owner','owner@example.test'],['friend','friend@example.test'],['stranger','stranger@example.test']])
  await db().prepare('INSERT INTO users (id,name,email,guest) VALUES (?,?,?,0)').run(id,id,email);
 await db().prepare('INSERT INTO avatars (id,owner_id,type,asset_url) VALUES (?,?,?,?)').run('avatar-shared','owner','vrm','https://example.test/shared.vrm');
 await db().prepare('INSERT INTO characters (id,owner_id,avatar_id,visibility,data) VALUES (?,?,?,?,?)').run(character.id,'owner','avatar-shared','private',JSON.stringify(character));

 assert.ok(await get<Character>('characters',character.id,'owner'));
 assert.equal(await visibleTo('friend'),false);
 assert.equal(await get<Character>('characters',character.id,'friend'),null);
 await assert.rejects(startConversation('friend',conversationInput));

 await requestFriend('owner','friend@example.test');
 assert.equal((await listFriends('friend'))[0].direction,'incoming');
 await assert.rejects(acceptFriend('owner','friend'));
 await setCharacterVisibility(character.id,'owner','friends',[]);
 assert.equal(await visibleTo('friend'),false);
 await acceptFriend('friend','owner');
 assert.equal(await visibleTo('friend'),true);
 assert.equal(await visibleTo('stranger'),false);
 assert.ok(await get<Character>('characters',character.id,'friend'));
 assert.ok(await getVisibleAvatar('avatar-shared','friend'));
 assert.ok(await startConversation('friend',conversationInput));
 await assert.rejects(startConversation('stranger',conversationInput));

 await setCharacterVisibility(character.id,'owner','selected',['friend']);
 assert.equal(await visibleTo('friend'),true);
 await assert.rejects(validateShareRecipients('owner','selected',['stranger']));
 await removeFriend('owner','friend');
 assert.equal(await visibleTo('friend'),false);
 assert.equal(await get<Character>('characters',character.id,'friend'),null);
 assert.equal(await getVisibleAvatar('avatar-shared','friend'),null);
 await assert.rejects(startConversation('friend',conversationInput));
 const shares=await db().prepare('SELECT user_id FROM character_shares WHERE character_id=?').all(character.id);
 assert.equal(shares.length,0);

 await setCharacterVisibility(character.id,'owner','public',[]);
 assert.equal(await visibleTo('stranger'),true);
 assert.ok(await startConversation('stranger',conversationInput));
 const image=Buffer.from('image for access test');
 const stored={...character,avatar:`data:image/png;base64,${image.toString('base64')}`,visibility:'public',published:true};
 await db().prepare('UPDATE characters SET data=? WHERE id=?').run(JSON.stringify(stored),character.id);
 const listed=(await listCommunity<Character>('characters','stranger')).find(item=>item.id===character.id);
 assert.equal(listed?.avatar,`/api/characters/${character.id}/art`);
 assert.deepEqual(Buffer.from((await characterArtwork(character.id,'stranger'))!.bytes),image);
 await setCharacterVisibility(character.id,'owner','private',[]);
 assert.equal(await visibleTo('stranger'),false);
 assert.equal(await characterArtwork(character.id,'stranger'),null);
 assert.ok(await characterArtwork(character.id,'owner'));
 assert.ok(await get<Character>('characters',character.id,'owner'));
});

test.after(()=>{try{rmSync(path);}catch{}});
