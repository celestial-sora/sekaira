"use client";

import {useState,type ChangeEvent,type FormEvent} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {ArrowLeft,ArrowRight,Globe2,Sparkles} from 'lucide-react';
import type {Bootstrap,World} from '@/lib/types';
import {api,ErrorNote,PageTitle} from './shared';
import {useLanguage} from './i18n';

type Refresh=()=>Promise<Bootstrap>;
type ScenarioDraft={name:string;description:string;lore:string;rules:string;locations:string;factions:string;power_system:string;timeline:string;world_state:string;genre:World['genre'];cover:World['cover']};
const emptyDraft:ScenarioDraft={name:'',description:'',lore:'',rules:'',locations:'',factions:'',power_system:'',timeline:'',world_state:'',genre:'Original',cover:'sky'};

function Field({name,label,value,onChange,placeholder='',area=false,required=false}:{name:keyof ScenarioDraft;label:string;value:string;onChange:(value:string)=>void;placeholder?:string;area?:boolean;required?:boolean}){
 const common={name,value,placeholder,required,onChange:(event:ChangeEvent<HTMLInputElement|HTMLTextAreaElement>)=>onChange(event.target.value),maxLength:6000};
 return <label className={`field ${area?'wide':''}`}><span>{label}{required&&<b> *</b>}</span>{area?<textarea {...common} rows={3}/>:<input {...common} maxLength={name==='name'?100:6000}/>}</label>;
}

export function ScenarioForm({refresh}:{refresh:Refresh}){
 const router=useRouter();const {text}=useLanguage();
 const [draft,setDraft]=useState<ScenarioDraft>(emptyDraft),[idea,setIdea]=useState(''),[generating,setGenerating]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const update=<K extends keyof ScenarioDraft>(key:K,value:ScenarioDraft[K])=>setDraft(current=>({...current,[key]:value}));
 const genres:Array<[World['genre'],string]>=[['Original','ต้นฉบับ'],['Fantasy','แฟนตาซี'],['Isekai','ต่างโลก'],['School','โรงเรียน'],['Romance','โรแมนติก'],['Mystery','ลึกลับ'],['Historical','ประวัติศาสตร์'],['Action','แอ็กชัน'],['Sci-fi','ไซไฟ']];
 async function generate(){if(!idea.trim()||generating)return;setGenerating(true);setError('');try{setDraft(await api<ScenarioDraft>('worlds/generate','POST',{prompt:idea}));}catch(error){setError((error as Error).message);}finally{setGenerating(false);}}
 async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);setError('');try{const world=await api<World>('worlds','POST',draft);await refresh();router.push(`/worlds/${world.id}`);}catch(error){setError((error as Error).message);setBusy(false);}}
 return <>
  <Link href="/create" className="back-link"><ArrowLeft size={16}/>{text('Back to Create','กลับไปหน้าสร้าง')}</Link>
  <PageTitle eyebrow={text('A SCENARIO OF YOUR OWN','ซีนาริโอในแบบของคุณ')} title={text('Create Scenario','สร้างซีนาริโอ')} description={text('Describe the world you want. AI can shape a complete editable draft, or you can build it manually.','บอกโลกหรือซีนาริโอที่ต้องการ ให้ AI ช่วยสร้างร่างที่แก้ไขต่อได้ หรือจะเขียนเองทั้งหมดก็ได้')}/>
  <form onSubmit={submit} className="form-layout">
   <div className="form-main glass">
    <section className="ai-character-builder">
     <span className="eyebrow">{text('AI SCENARIO STUDIO','สตูดิโอสร้างซีนาริโอด้วย AI')}</span>
     <div className="ai-builder-heading"><div><h2>{text('What kind of world do you want to enter?','คุณอยากเข้าไปอยู่ในโลกแบบไหน?')}</h2><p>{text('Describe the premise, mood, lore, rules, conflict, locations, factions, or anything that must stay exactly as you imagined it.','บอกพล็อต บรรยากาศ lore กฎ ความขัดแย้ง สถานที่ ฝ่ายต่าง ๆ หรือรายละเอียดที่ต้องคงไว้ตามที่คุณคิด')}</p></div><Sparkles size={25}/></div>
     <label className="field"><span>{text('Scenario idea','ไอเดียซีนาริโอ')}</span><textarea value={idea} onChange={event=>setIdea(event.target.value)} maxLength={2400} rows={4} placeholder={text('A rain-soaked cyberpunk Bangkok where old spirit houses coexist with illegal neural magic, rival districts fight over memory markets, and the story begins during a citywide blackout…','กรุงเทพไซเบอร์พังก์กลางสายฝนที่ศาลพระภูมิอยู่ร่วมกับเวทประสาทผิดกฎหมาย เขตต่าง ๆ แย่งชิงตลาดความทรงจำ และเรื่องเริ่มขึ้นในคืนไฟดับทั้งเมือง…')}/></label>
     <button className="button ai-generate" type="button" disabled={generating||!idea.trim()} onClick={generate}><Sparkles size={16}/>{generating?text('Building your scenario…','กำลังสร้างซีนาริโอ…'):text('Generate with AI','สร้างด้วย AI')}</button>
    </section>
    <div className="form-section-heading"><Globe2/><div><h2>{text('The scenario at a glance','ภาพรวมของซีนาริโอ')}</h2><p>{text('Everything AI creates stays editable before you save.','ทุกอย่างที่ AI สร้างยังแก้ไขได้ก่อนบันทึก')}</p></div></div>
    <div className="form-grid">
     <Field name="name" label={text('Scenario name','ชื่อซีนาริโอ')} required value={draft.name} onChange={value=>update('name',value)} placeholder={text('A name for your scenario','ตั้งชื่อให้ซีนาริโอของคุณ')}/>
     <label className="field"><span>{text('Genre','แนวเรื่อง')}</span><select name="genre" value={draft.genre} onChange={event=>update('genre',event.target.value as World['genre'])}>{genres.map(([value,thai])=><option key={value} value={value}>{text(value,thai)}</option>)}</select></label>
     <Field name="description" label={text('Description','คำอธิบาย')} area value={draft.description} onChange={value=>update('description',value)} placeholder={text('What kind of scenario is waiting on the other side?','อีกฟากหนึ่งมีซีนาริโอแบบใดรออยู่?')}/>
     <Field name="lore" label={text('Lore','ตำนานและภูมิหลัง')} area value={draft.lore} onChange={value=>update('lore',value)} placeholder={text('Its history, legends, secrets, and mysteries…','ประวัติศาสตร์ ตำนาน ความลับ และปริศนา…')}/>
     <Field name="rules" label={text('Rules','กฎ')} area value={draft.rules} onChange={value=>update('rules',value)} placeholder={text('What is possible here? What has limits?','ที่นี่มีอะไรเป็นไปได้ และอะไรมีข้อจำกัด?')}/>
     <Field name="locations" label={text('Locations','สถานที่')} area value={draft.locations} onChange={value=>update('locations',value)} placeholder={text('Important places the story can move through','สถานที่สำคัญที่เรื่องราวสามารถเดินทางไปถึง')}/>
     <Field name="factions" label={text('Factions','ฝ่ายต่าง ๆ')} area value={draft.factions} onChange={value=>update('factions',value)} placeholder={text('Groups, institutions, rivals, alliances','กลุ่ม องค์กร คู่แข่ง และพันธมิตร')}/>
     <Field name="power_system" label={text('Power system','ระบบพลัง')} area value={draft.power_system} onChange={value=>update('power_system',value)} placeholder={text('Magic, technology, influence — and their costs or limits','เวทมนตร์ เทคโนโลยี อิทธิพล รวมถึงต้นทุนหรือข้อจำกัด')}/>
     <Field name="timeline" label={text('Timeline','ช่วงเวลา')} value={draft.timeline} onChange={value=>update('timeline',value)} placeholder={text('When does the story begin?','เรื่องราวเริ่มต้นขึ้นเมื่อไร?')}/>
     <label className="field"><span>{text('Atmosphere','บรรยากาศ')}</span><select name="cover" value={draft.cover} onChange={event=>update('cover',event.target.value as World['cover'])}><option value="sky">{text('Sky & clouds','ท้องฟ้าและหมู่เมฆ')}</option><option value="forest">{text('Enchanted forest','ป่าต้องมนตร์')}</option><option value="night">{text('Moonlit mystery','ปริศนาใต้แสงจันทร์')}</option><option value="city">{text('City of dreams','นครแห่งความฝัน')}</option><option value="sunset">{text('Golden hour','ยามแสงทอง')}</option></select></label>
     <Field name="world_state" label={text('Initial scenario state','สถานะเริ่มต้นของซีนาริโอ')} area value={draft.world_state} onChange={value=>update('world_state',value)} placeholder={text('What is happening right now when the user enters?','ตอนผู้ใช้เข้ามา กำลังเกิดอะไรขึ้นในโลกนี้?')}/>
    </div>
    <ErrorNote message={error}/>
    <div className="form-footer"><span>{text('Private to your account','เป็นส่วนตัวสำหรับบัญชีของคุณ')}</span><button className="button primary" disabled={busy||!draft.name.trim()}>{busy?text('Creating…','กำลังสร้าง…'):text('Create Scenario','สร้างซีนาริโอ')}<ArrowRight size={17}/></button></div>
   </div>
   <aside className="form-preview glass"><div className={`world-preview-art world-${draft.cover}`}/><span className="eyebrow">{text('YOUR SCENARIO','ซีนาริโอของคุณ')}</span><h2>{draft.name||text('A world waiting to exist','โลกที่กำลังรอให้ถือกำเนิด')}</h2><span className="pill">{draft.genre}</span><p>{draft.description||text('Use AI to draft the setting, then tune every detail before saving.','ใช้ AI ร่างโลก แล้วปรับทุกจุดได้ก่อนบันทึก')}</p><div className="preview-note"><Sparkles size={20}/><p>{text('AI creates the foundation; you keep final control over canon, rules, and starting state.','AI ช่วยวางรากฐาน แต่คุณเป็นคนตัดสิน canon กฎ และสถานะเริ่มต้นสุดท้าย')}</p></div></aside>
  </form>
 </>;
}
