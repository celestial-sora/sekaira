"use client";

import {useEffect,useState,type FormEvent} from 'react';
import Link from 'next/link';
import {ArrowLeft,Save} from 'lucide-react';
import type {Bootstrap,Character,CharacterVisibility} from '@/lib/types';
import {api,ErrorNote,Portrait} from './shared';
import {acceptedFriends,type FriendEntry} from './friends-panel';
import {useLanguage} from './i18n';

type Sharing={visibility:CharacterVisibility;friend_ids:string[]};
const editableKeys=['name','description','personality','backstory','speaking_style','relationship_behavior','roleplay_guidance','likes','dislikes','greeting','example_dialogue','lore','faction'] as const;
type EditableKey=typeof editableKeys[number];
type Draft=Record<EditableKey,string>;

function fromCharacter(character:Character):Draft{
 return Object.fromEntries(editableKeys.map(key=>[key,character[key]??''])) as Draft;
}

export function CharacterSettings({character,refresh}:{character:Character;refresh:()=>Promise<Bootstrap>}){
 const {text}=useLanguage();
 const [draft,setDraft]=useState<Draft>(()=>fromCharacter(character));
 const [tags,setTags]=useState(character.tags.join(', '));
 const [visibility,setVisibility]=useState<CharacterVisibility>(character.visibility??(character.published?'public':'private'));
 const [selected,setSelected]=useState<string[]>([]);
 const [friends,setFriends]=useState<FriendEntry[]>([]);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 useEffect(()=>{
  setDraft(fromCharacter(character));setTags(character.tags.join(', '));setVisibility(character.visibility??(character.published?'public':'private'));
  let active=true;
  Promise.all([api<Sharing>(`characters/${character.id}/visibility`),api<{friends:FriendEntry[]}>('friends')]).then(([sharing,result])=>{
   if(!active)return;
   setVisibility(sharing.visibility);setSelected(sharing.friend_ids);setFriends(acceptedFriends(result.friends));
  }).catch(cause=>{if(active)setError((cause as Error).message);});
  return()=>{active=false;};
 },[character.id]);
 const setField=(key:EditableKey,value:string)=>setDraft(current=>({...current,[key]:value}));
 const field=(key:EditableKey,en:string,th:string,area=true,hint?:string)=><label className="field" key={key}><span>{text(en,th)}</span>{area?<textarea name={key} rows={key==='roleplay_guidance'?4:3} maxLength={key==='roleplay_guidance'?2000:6000} value={draft[key]} onChange={event=>setField(key,event.target.value)}/>:<input name={key} maxLength={key==='name'?100:6000} value={draft[key]} onChange={event=>setField(key,event.target.value)}/ >}{hint&&<small>{hint}</small>}</label>;
 async function save(event:FormEvent){
  event.preventDefault();setError('');setNotice('');
  const parsedTags=[...new Set(tags.split(',').map(tag=>tag.trim()).filter(Boolean))];
  if(parsedTags.length>8||parsedTags.some(tag=>tag.length>30)){setError(text('Use up to 8 tags, each under 30 characters.','ใช้ได้สูงสุด 8 แท็ก แต่ละแท็กไม่เกิน 30 ตัวอักษร'));return;}
  if(!draft.name.trim()){setError(text('Enter a character name.','กรุณาใส่ชื่อตัวละคร'));return;}
  if(visibility==='selected'&&!selected.length){setError(text('Choose at least one friend.','เลือกเพื่อนอย่างน้อยหนึ่งคน'));return;}
  setBusy(true);
  try{
   await api<Character>(`characters/${character.id}`,'PATCH',{...draft,tags:parsedTags,visibility,friend_ids:visibility==='selected'?selected:[]});
   await refresh();
   setNotice(text('Character settings saved. New chat replies will use the updated personality and roleplay guidance.','บันทึกแล้ว คำตอบแชตครั้งต่อไปจะใช้บุคลิกและแนวทางโรลเพลย์ใหม่'));
  }catch(cause){setError((cause as Error).message);}finally{setBusy(false);}
 }
 return <div className="character-settings-page">
  <Link className="back-link" href={`/characters/${character.id}`}><ArrowLeft size={16}/>{text('Back to character','กลับไปหน้าตัวละคร')}</Link>
  <div className="settings-heading"><Portrait avatar={character.avatar} name={character.name}/><div><span className="eyebrow">{text('CHARACTER SETTINGS','ตั้งค่าตัวละคร')}</span><h1>{character.name}</h1><p className="muted">{text('Changes to personality and roleplay style apply to future replies, including existing chats.','การแก้บุคลิกและแนวทางโรลเพลย์จะใช้กับคำตอบครั้งต่อไป รวมถึงแชตเดิม')}</p></div></div>
  <form onSubmit={save} className="character-settings-form">
   <section className="glass panel settings-section"><h2>{text('Who can use this character?','ใครใช้ตัวละครนี้ได้บ้าง?')}</h2><p className="muted">{text('Choose who can find, open, and chat with this character.','เลือกคนที่ค้นหา เปิดดู และแชตกับตัวละครนี้ได้')}</p><label className="field"><span>{text('Visibility','การมองเห็น')}</span><select value={visibility} onChange={event=>setVisibility(event.target.value as CharacterVisibility)}><option value="private">{text('Only me','เฉพาะฉัน')}</option><option value="public">{text('Everyone','ทุกคน')}</option><option value="friends">{text('All friends','เพื่อนทั้งหมด')}</option><option value="selected">{text('Selected friends','เพื่อนที่เลือก')}</option></select></label>{visibility==='selected'&&<div className="share-friends">{friends.length?friends.map(friend=><label key={friend.id}><input type="checkbox" checked={selected.includes(friend.id)} onChange={event=>setSelected(current=>event.target.checked?[...current,friend.id]:current.filter(id=>id!==friend.id))}/><span>{friend.name}{friend.email?` · ${friend.email}`:''}</span></label>):<p className="muted">{text('Add a friend in your account first.','เพิ่มเพื่อนในหน้าบัญชีก่อน')} <Link href="/account">{text('Manage friends','จัดการเพื่อน')}</Link></p>}</div>}</section>
   <section className="glass panel settings-section"><h2>{text('Identity and personality','ตัวตนและบุคลิก')}</h2><div className="settings-fields">{field('name','Name','ชื่อ',false)}{field('description','Short description','คำอธิบายสั้น')}{field('personality','Personality','บุคลิก')}{field('backstory','Backstory','ภูมิหลัง')}{field('likes','Likes','สิ่งที่ชอบ')}{field('dislikes','Dislikes','สิ่งที่ไม่ชอบ')}{field('faction','Faction or affiliation','ฝ่ายหรือกลุ่ม')}{field('lore','Character lore','ข้อมูลตัวละคร')}</div><label className="field"><span>{text('Tags (comma separated)','แท็ก (คั่นด้วยจุลภาค)')}</span><input value={tags} onChange={event=>setTags(event.target.value)} maxLength={260}/><small>{text('Up to 8 tags.','สูงสุด 8 แท็ก')}</small></label></section>
   <section className="glass panel settings-section"><h2>{text('Roleplay voice and flow','เสียงและจังหวะโรลเพลย์')}</h2><p className="muted">{text('Describe how this character reacts, speaks, and keeps a scene moving.','บอกว่าตัวละครตอบสนอง พูด และพาฉากดำเนินต่ออย่างไร')}</p><div className="settings-fields">{field('speaking_style','Speaking style','สไตล์การพูด')}{field('relationship_behavior','Relationship behavior','พฤติกรรมในความสัมพันธ์')}{field('roleplay_guidance','Roleplay guidance','แนวทางโรลเพลย์',true,text('Example: Keep replies conversational, notice small gestures, and take initiative only when it fits the scene.','เช่น ตอบแบบเป็นบทสนทนา สังเกตท่าทางเล็ก ๆ และเริ่มบทสนทนาเองเมื่อเข้ากับฉาก'))}{field('greeting','Opening greeting','คำทักทายแรก')}{field('example_dialogue','Example dialogue','ตัวอย่างบทสนทนา')}</div></section>
   <div className="settings-save"><ErrorNote message={error}/>{notice&&<p className="notice" role="status">{notice}</p>}<button className="button primary" type="submit" disabled={busy}><Save size={17}/>{busy?text('Saving…','กำลังบันทึก…'):text('Save character settings','บันทึกการตั้งค่าตัวละคร')}</button></div>
  </form>
 </div>;
}
