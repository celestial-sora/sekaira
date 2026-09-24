"use client";

import {useEffect,useState,type FormEvent} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {ArrowLeft,Save,Trash2} from 'lucide-react';
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
 const router=useRouter();
 const [draft,setDraft]=useState<Draft>(()=>fromCharacter(character));
 const [tags,setTags]=useState(character.tags.join(', '));
 const [visibility,setVisibility]=useState<CharacterVisibility>(character.visibility??(character.published?'public':'private'));
 const [savedVisibility,setSavedVisibility]=useState<CharacterVisibility>(character.visibility??(character.published?'public':'private'));
 const [sharingReady,setSharingReady]=useState(false);
 const [sharingBusy,setSharingBusy]=useState(false);
 const [selected,setSelected]=useState<string[]>([]);
 const [savedSelected,setSavedSelected]=useState<string[]>([]);
 const [friends,setFriends]=useState<FriendEntry[]>([]);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [sharingError,setSharingError]=useState('');
 const [notice,setNotice]=useState('');
 const [confirmDelete,setConfirmDelete]=useState(false);
 const [deleting,setDeleting]=useState(false);
 useEffect(()=>{
  if(window.location.hash==='#delete-character')document.getElementById('delete-character')?.scrollIntoView({block:'start'});
 },[character.id]);
 useEffect(()=>{
  setDraft(fromCharacter(character));setTags(character.tags.join(', '));setSharingReady(false);
  let active=true;
  api<Sharing>(`characters/${character.id}/visibility`).then(sharing=>{
   if(!active)return;
   setVisibility(sharing.visibility);setSavedVisibility(sharing.visibility);setSelected(sharing.friend_ids);setSavedSelected(sharing.friend_ids);setSharingReady(true);
  }).catch(cause=>{if(active){setSharingError((cause as Error).message);setError((cause as Error).message);}});
  api<{friends:FriendEntry[]}>('friends').then(result=>{if(active)setFriends(acceptedFriends(result.friends));}).catch(()=>{if(active)setFriends([]);});
  return()=>{active=false;};
 },[character.id]);
 async function changeVisibility(next:CharacterVisibility){
  setError('');setSharingError('');setNotice('');setVisibility(next);
  if(next==='selected')return;
  if(next===savedVisibility)return;
  setSharingBusy(true);
  try{
   const saved=await api<Sharing>(`characters/${character.id}/visibility`,'PUT',{visibility:next,friend_ids:[]});
   if(saved.visibility!==next)throw new Error(text('The visibility change was not saved. Please try again.','บันทึกการมองเห็นไม่สำเร็จ กรุณาลองอีกครั้ง'));
   setSavedVisibility(saved.visibility);setSelected(saved.friend_ids);setSavedSelected(saved.friend_ids);
   setNotice(text('Visibility saved. Save below if you also changed character details.','บันทึกการมองเห็นแล้ว หากแก้ข้อมูลตัวละครด้วยให้กดบันทึกด้านล่าง'));
   try{await refresh();}catch(cause){setError((cause as Error).message);}
  }catch(cause){setVisibility(savedVisibility);setSharingError((cause as Error).message);setError((cause as Error).message);}finally{setSharingBusy(false);}
 }
 const setField=(key:EditableKey,value:string)=>setDraft(current=>({...current,[key]:value}));
 const field=(key:EditableKey,en:string,th:string,area=true,hint?:string)=><label className="field" key={key}><span>{text(en,th)}</span>{area?<textarea name={key} rows={key==='roleplay_guidance'?4:3} maxLength={key==='roleplay_guidance'?2000:6000} value={draft[key]} onChange={event=>setField(key,event.target.value)}/>:<input name={key} maxLength={key==='name'?100:6000} value={draft[key]} onChange={event=>setField(key,event.target.value)}/ >}{hint&&<small>{hint}</small>}</label>;
 async function save(event:FormEvent){
  event.preventDefault();setError('');setNotice('');
  if(!sharingReady||sharingBusy)return;
  const parsedTags=[...new Set(tags.split(',').map(tag=>tag.trim()).filter(Boolean))];
  if(parsedTags.length>8||parsedTags.some(tag=>tag.length>30)){setError(text('Use up to 8 tags, each under 30 characters.','ใช้ได้สูงสุด 8 แท็ก แต่ละแท็กไม่เกิน 30 ตัวอักษร'));return;}
  if(!draft.name.trim()){setError(text('Enter a character name.','กรุณาใส่ชื่อตัวละคร'));return;}
  if(visibility==='selected'&&!selected.length){setError(text('Choose at least one friend.','เลือกเพื่อนอย่างน้อยหนึ่งคน'));return;}
  setBusy(true);
  try{
   const saved=await api<Character>(`characters/${character.id}`,'PATCH',{...draft,tags:parsedTags,visibility,friend_ids:visibility==='selected'?selected:[]});
   if(saved.visibility!==visibility)throw new Error(text('The visibility change was not saved. Please try again.','บันทึกการมองเห็นไม่สำเร็จ กรุณาลองอีกครั้ง'));
   const latest=await refresh();
   if(latest.characters.find(item=>item.id===character.id)?.visibility!==visibility)throw new Error(text('The saved visibility could not be confirmed. Please reload and try again.','ยังยืนยันการมองเห็นที่บันทึกไม่ได้ กรุณาโหลดหน้าใหม่แล้วลองอีกครั้ง'));
   setSavedVisibility(visibility);setSavedSelected(visibility==='selected'?selected:[]);setSharingError('');
   setNotice(text('Character settings saved. New chat replies will use the updated personality and roleplay guidance.','บันทึกแล้ว คำตอบแชตครั้งต่อไปจะใช้บุคลิกและแนวทางโรลเพลย์ใหม่'));
  }catch(cause){setError((cause as Error).message);}finally{setBusy(false);}
 }
 async function deleteCharacter(){
  if(deleting)return;
  setDeleting(true);setError('');
  try{
   await api(`characters/${character.id}`,'DELETE');
   await refresh().catch(()=>undefined);
   router.replace('/characters');
  }catch(cause){setError((cause as Error).message);setDeleting(false);}
 }
 const selectedChanged=visibility==='selected'&&(visibility!==savedVisibility||[...selected].sort().join('|')!==[...savedSelected].sort().join('|'));
 return <div className="character-settings-page">
  <Link className="back-link" href={`/characters/${character.id}`}><ArrowLeft size={16}/>{text('Back to character','กลับไปหน้าตัวละคร')}</Link>
  <div className="settings-heading"><Portrait avatar={character.avatar} name={character.name}/><div><span className="eyebrow">{text('CHARACTER SETTINGS','ตั้งค่าตัวละคร')}</span><h1>{character.name}</h1><p className="muted">{text('Changes to personality and roleplay style apply to future replies, including existing chats.','การแก้บุคลิกและแนวทางโรลเพลย์จะใช้กับคำตอบครั้งต่อไป รวมถึงแชตเดิม')}</p></div></div>
  <form onSubmit={save} className="character-settings-form">
   <section className="glass panel settings-section"><h2>{text('Who can use this character?','ใครใช้ตัวละครนี้ได้บ้าง?')}</h2><p className="muted">{text('Everyone, Only me, and All friends save as soon as you choose them. Selected friends are saved with the button below.','ตัวเลือกทุกคน เฉพาะฉัน และเพื่อนทั้งหมดจะบันทึกทันที ส่วนเพื่อนที่เลือกให้กดบันทึกด้านล่าง')}</p><label className="field"><span>{text('Visibility','การมองเห็น')}</span><select value={visibility} disabled={!sharingReady||sharingBusy||busy} onChange={event=>void changeVisibility(event.target.value as CharacterVisibility)}><option value="private">{text('Only me','เฉพาะฉัน')}</option><option value="public">{text('Everyone','ทุกคน')}</option><option value="friends">{text('All friends','เพื่อนทั้งหมด')}</option><option value="selected">{text('Selected friends','เพื่อนที่เลือก')}</option></select></label><p className="muted" role="status" aria-live="polite">{!sharingReady?text('Loading sharing settings…','กำลังโหลดการตั้งค่าการแชร์…'):sharingBusy?text('Saving visibility…','กำลังบันทึกการมองเห็น…'):selectedChanged?text('Choose friends, then save below.','เลือกเพื่อนแล้วกดบันทึกด้านล่าง'):visibility==='public'?text('Saved: everyone can find and chat with this character.','บันทึกแล้ว: ทุกคนค้นหาและแชตกับตัวละครนี้ได้'):visibility==='private'?text('Saved: only you can use this character.','บันทึกแล้ว: มีเพียงคุณที่ใช้ตัวละครนี้ได้'):text('Current visibility is saved.','บันทึกการมองเห็นแล้ว')}</p><ErrorNote message={sharingError}/>{visibility==='selected'&&<div className="share-friends">{friends.length?friends.map(friend=><label key={friend.id}><input type="checkbox" checked={selected.includes(friend.id)} onChange={event=>setSelected(current=>event.target.checked?[...current,friend.id]:current.filter(id=>id!==friend.id))}/><span>{friend.name}{friend.email?` · ${friend.email}`:''}</span></label>):<p className="muted">{text('Add a friend in your account first.','เพิ่มเพื่อนในหน้าบัญชีก่อน')} <Link href="/account">{text('Manage friends','จัดการเพื่อน')}</Link></p>}</div>}</section>
   <section className="glass panel settings-section"><h2>{text('Identity and personality','ตัวตนและบุคลิก')}</h2><div className="settings-fields">{field('name','Name','ชื่อ',false)}{field('description','Short description','คำอธิบายสั้น')}{field('personality','Personality','บุคลิก')}{field('backstory','Backstory','ภูมิหลัง')}{field('likes','Likes','สิ่งที่ชอบ')}{field('dislikes','Dislikes','สิ่งที่ไม่ชอบ')}{field('faction','Faction or affiliation','ฝ่ายหรือกลุ่ม')}{field('lore','Character lore','ข้อมูลตัวละคร')}</div><label className="field"><span>{text('Tags (comma separated)','แท็ก (คั่นด้วยจุลภาค)')}</span><input value={tags} onChange={event=>setTags(event.target.value)} maxLength={260}/><small>{text('Up to 8 tags.','สูงสุด 8 แท็ก')}</small></label></section>
   <section className="glass panel settings-section"><h2>{text('Roleplay voice and flow','เสียงและจังหวะโรลเพลย์')}</h2><p className="muted">{text('Describe how this character reacts, speaks, and keeps a scene moving.','บอกว่าตัวละครตอบสนอง พูด และพาฉากดำเนินต่ออย่างไร')}</p><div className="settings-fields">{field('speaking_style','Speaking style','สไตล์การพูด')}{field('relationship_behavior','Relationship behavior','พฤติกรรมในความสัมพันธ์')}{field('roleplay_guidance','Roleplay guidance','แนวทางโรลเพลย์',true,text('Example: Keep replies conversational, notice small gestures, and take initiative only when it fits the scene.','เช่น ตอบแบบเป็นบทสนทนา สังเกตท่าทางเล็ก ๆ และเริ่มบทสนทนาเองเมื่อเข้ากับฉาก'))}{field('greeting','Opening greeting','คำทักทายแรก')}{field('example_dialogue','Example dialogue','ตัวอย่างบทสนทนา')}</div></section>
   <div className="settings-save"><ErrorNote message={error}/>{notice&&<p className="notice" role="status">{notice}</p>}<button className="button primary" type="submit" disabled={busy||sharingBusy||!sharingReady}><Save size={17}/>{busy?text('Saving…','กำลังบันทึก…'):text('Save character settings','บันทึกการตั้งค่าตัวละคร')}</button></div>
  </form>
  <section id="delete-character" className="glass panel settings-section">
   <h2>{text('Delete character','ลบตัวละคร')}</h2>
   <p className="muted">{text('This permanently removes the character. Conversations with no remaining characters become read-only.','การลบจะนำตัวละครออกอย่างถาวร บทสนทนาที่ไม่เหลือตัวละครจะเปิดอ่านได้อย่างเดียว')}</p>
   <button className="button danger" type="button" disabled={busy||sharingBusy||deleting} onClick={()=>setConfirmDelete(true)}><Trash2 size={17}/>{text('Delete character','ลบตัวละคร')}</button>
  </section>
  {confirmDelete&&<div className="modal-backdrop"><section className="modal glass" role="dialog" aria-modal="true" aria-labelledby="delete-character-title">
   <h2 id="delete-character-title">{text(`Delete ${character.name}?`,`ลบ ${character.name} หรือไม่?`)}</h2>
   <p>{text('This cannot be undone. The character will disappear from your collection and shared pages.','การลบย้อนกลับไม่ได้ ตัวละครจะหายจากรายการของคุณและหน้าที่แชร์ไว้')}</p>
   <ErrorNote message={error}/>
   <div className="inline-actions"><button autoFocus className="button" type="button" disabled={deleting} onClick={()=>setConfirmDelete(false)}>{text('Cancel','ยกเลิก')}</button><button className="button danger" type="button" disabled={deleting} onClick={()=>void deleteCharacter()}>{deleting?text('Deleting…','กำลังลบ…'):text('Delete character','ลบตัวละคร')}</button></div>
  </section></div>}
 </div>;
}
