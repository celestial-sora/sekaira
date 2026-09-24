"use client";

import {useEffect,useState} from 'react';
import Link from 'next/link';
import type {Bootstrap,Character,CharacterVisibility} from '@/lib/types';
import {api,ErrorNote} from './shared';
import {acceptedFriends,type FriendEntry} from './friends-panel';
import {useLanguage} from './i18n';

type Sharing={visibility:CharacterVisibility;friend_ids:string[]};

export function CharacterSharing({character,onUpdate}:{character:Character;onUpdate?:()=>Promise<Bootstrap>}){
 const {text}=useLanguage();
 const [visibility,setVisibility]=useState<CharacterVisibility>(character.visibility||(character.published?'public':'private'));
 const [selected,setSelected]=useState<string[]>([]);
 const [friends,setFriends]=useState<FriendEntry[]>([]);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 useEffect(()=>{let active=true;Promise.all([api<Sharing>(`characters/${character.id}/visibility`),api<{friends:FriendEntry[]}>('friends')]).then(([sharing,result])=>{if(!active)return;setVisibility(sharing.visibility);setSelected(sharing.friend_ids);setFriends(acceptedFriends(result.friends));}).catch(error=>{if(active)setError((error as Error).message);});return()=>{active=false;};},[character.id]);
 async function save(){setBusy(true);setError('');setNotice('');try{const result=await api<Sharing>(`characters/${character.id}/visibility`,'PUT',{visibility,friend_ids:visibility==='selected'?selected:[]});setVisibility(result.visibility);setSelected(result.friend_ids);await onUpdate?.();setNotice(text('Sharing settings saved.','บันทึกการแชร์แล้ว'));}catch(error){setError((error as Error).message);}finally{setBusy(false);}}
 return <section className="character-sharing"><h2>{text('Who can use this character?','ใครใช้ตัวละครนี้ได้บ้าง?')}</h2><p className="muted">{text('Your choice controls who can find, open, and start a chat with this character.','ตัวเลือกนี้กำหนดว่าใครค้นหา เปิดดู และเริ่มแชตกับตัวละครนี้ได้')}</p><label className="field"><span>{text('Visibility','การมองเห็น')}</span><select value={visibility} onChange={event=>{setVisibility(event.target.value as CharacterVisibility);setNotice('');}}><option value="private">{text('Only me','เฉพาะฉัน')}</option><option value="public">{text('Everyone','ทุกคน')}</option><option value="friends">{text('All friends','เพื่อนทั้งหมด')}</option><option value="selected">{text('Selected friends','เพื่อนที่เลือก')}</option></select></label>{visibility==='selected'&&<div className="share-friends">{friends.length?friends.map(friend=><label key={friend.id}><input type="checkbox" checked={selected.includes(friend.id)} onChange={event=>setSelected(current=>event.target.checked?[...current,friend.id]:current.filter(id=>id!==friend.id))}/><span>{friend.name}{friend.email?` · ${friend.email}`:''}</span></label>):<p className="muted">{text('Add and accept a friend first in your account.','เพิ่มและรับเพื่อนในหน้าบัญชีก่อน')} <Link href="/account">{text('Manage friends','จัดการเพื่อน')}</Link></p>}</div>}<ErrorNote message={error}/>{notice&&<p className="notice" role="status">{notice}</p>}<button className="button primary" type="button" disabled={busy||(visibility==='selected'&&!selected.length)} onClick={()=>void save()}>{busy?text('Saving…','กำลังบันทึก…'):text('Save sharing','บันทึกการแชร์')}</button></section>;
}
