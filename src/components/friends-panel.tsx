"use client";

import {useCallback,useEffect,useState,type FormEvent} from 'react';
import type {Bootstrap} from '@/lib/types';
import {api,ErrorNote,Portrait} from './shared';
import {useLanguage} from './i18n';

export type FriendEntry={id:string;name:string;picture:string|null;email:string|null;status:'pending'|'accepted';direction:'incoming'|'outgoing'|'accepted'};
export const acceptedFriends=(entries:FriendEntry[])=>entries.filter(entry=>entry.status==='accepted');

export function FriendsPanel({user}:{user:Bootstrap['user']}){
 const {text}=useLanguage();
 const [entries,setEntries]=useState<FriendEntry[]>([]);
 const [email,setEmail]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const load=useCallback(async()=>{const result=await api<{friends:FriendEntry[]}>('friends');setEntries(result.friends);},[]);
 useEffect(()=>{if(user&&!user.guest)void load().catch(error=>setError((error as Error).message));},[user?.id,user?.guest,load]);
 if(!user||user.guest)return <section className="glass panel"><h2>{text('Friends','เพื่อน')}</h2><p className="muted">{text('Sign in with Google to add friends and share characters privately.','เข้าสู่ระบบด้วย Google เพื่อเพิ่มเพื่อนและแชร์ตัวละครแบบส่วนตัว')}</p></section>;
 const incoming=entries.filter(entry=>entry.direction==='incoming');
 const outgoing=entries.filter(entry=>entry.direction==='outgoing');
 const friends=acceptedFriends(entries);
 async function send(event:FormEvent){event.preventDefault();setBusy(true);setError('');setNotice('');try{await api('friends','POST',{email});setEmail('');setNotice(text('Friend request sent.','ส่งคำขอเป็นเพื่อนแล้ว'));await load();}catch(error){setError((error as Error).message);}finally{setBusy(false);}}
 async function act(id:string,action:'accept'|'remove'){setBusy(true);setError('');setNotice('');try{await api(`friends/${id}`,action==='accept'?'PATCH':'DELETE',action==='accept'?{action:'accept'}:undefined);await load();}catch(error){setError((error as Error).message);}finally{setBusy(false);}}
 const row=(entry:FriendEntry)=><div className="friend-row" key={entry.id}><Portrait avatar={entry.picture||'0'} name={entry.name}/><div><strong>{entry.name}</strong><small>{entry.email}</small></div><div className="friend-actions">{entry.direction==='incoming'&&<button className="button primary" disabled={busy} onClick={()=>void act(entry.id,'accept')}>{text('Accept','รับเพื่อน')}</button>}<button className="button" disabled={busy} onClick={()=>void act(entry.id,'remove')}>{entry.direction==='incoming'?text('Decline','ปฏิเสธ'):entry.direction==='outgoing'?text('Cancel','ยกเลิก'):text('Remove','ลบเพื่อน')}</button></div></div>;
 return <section className="glass panel friends-panel"><h2>{text('Friends','เพื่อน')}</h2><p className="muted">{text('Add someone by the email they use for their Oonchai account. They must accept before private sharing works.','เพิ่มเพื่อนด้วยอีเมลที่ใช้ใน Oonchai อีกฝ่ายต้องรับคำขอก่อนจึงจะแชร์แบบส่วนตัวได้')}</p><form className="friend-request" onSubmit={send}><input type="email" required maxLength={320} value={email} onChange={event=>setEmail(event.target.value)} placeholder={text('Friend’s account email','อีเมลบัญชีของเพื่อน')}/><button className="button primary" disabled={busy||!email.trim()}>{text('Add friend','เพิ่มเพื่อน')}</button></form><ErrorNote message={error}/>{notice&&<p className="notice" role="status">{notice}</p>}{incoming.length>0&&<><h3>{text('Requests to you','คำขอที่ส่งถึงคุณ')}</h3><div className="friend-list">{incoming.map(row)}</div></>}{friends.length>0&&<><h3>{text('Your friends','เพื่อนของคุณ')}</h3><div className="friend-list">{friends.map(row)}</div></>}{outgoing.length>0&&<><h3>{text('Waiting for acceptance','รออีกฝ่ายรับคำขอ')}</h3><div className="friend-list">{outgoing.map(row)}</div></>}{entries.length===0&&<p className="muted">{text('No friends yet. Send the first request above.','ยังไม่มีเพื่อน ลองส่งคำขอด้านบน')}</p>}</section>;
}
