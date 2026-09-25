"use client";

import {useState,type ChangeEvent,type FormEvent} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {ArrowLeft,ArrowRight,Globe2,ImagePlus,Sparkles,Trash2} from 'lucide-react';
import type {Bootstrap,World} from '@/lib/types';
import {api,ErrorNote,PageTitle} from './shared';
import {useLanguage} from './i18n';

type Refresh=()=>Promise<Bootstrap>;
type ScenarioDraft={name:string;description:string;lore:string;rules:string;locations:string;factions:string;power_system:string;timeline:string;world_state:string;genre:World['genre'];cover:World['cover'];cover_image:string|null};
const emptyDraft:ScenarioDraft={name:'',description:'',lore:'',rules:'',locations:'',factions:'',power_system:'',timeline:'',world_state:'',genre:'Original',cover:'sky',cover_image:null};
function fromScenario(scenario:World):ScenarioDraft{return {name:scenario.name,description:scenario.description,lore:scenario.lore,rules:scenario.rules,locations:scenario.locations,factions:scenario.factions,power_system:scenario.power_system,timeline:scenario.timeline,world_state:scenario.world_state,genre:scenario.genre,cover:scenario.cover,cover_image:scenario.cover_image??null};}

function Field({name,label,value,onChange,placeholder='',area=false,required=false}:{name:keyof ScenarioDraft;label:string;value:string;onChange:(value:string)=>void;placeholder?:string;area?:boolean;required?:boolean}){
 const common={name,value,placeholder,required,onChange:(event:ChangeEvent<HTMLInputElement|HTMLTextAreaElement>)=>onChange(event.target.value),maxLength:6000};
 return <label className={`field ${area?'wide':''}`}><span>{label}{required&&<b> *</b>}</span>{area?<textarea {...common} rows={3}/>:<input {...common} maxLength={name==='name'?100:6000}/>}</label>;
}

export function ScenarioForm({refresh,scenario}:{refresh:Refresh;scenario?:World}){
 const router=useRouter();const {text}=useLanguage();const editing=Boolean(scenario);
 const [draft,setDraft]=useState<ScenarioDraft>(()=>scenario?fromScenario(scenario):emptyDraft),[idea,setIdea]=useState(''),[generating,setGenerating]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const update=<K extends keyof ScenarioDraft>(key:K,value:ScenarioDraft[K])=>setDraft(current=>({...current,[key]:value}));
 const genres:Array<[World['genre'],string]>=[['Original','ต้นฉบับ'],['Fantasy','แฟนตาซี'],['Isekai','ต่างโลก'],['School','โรงเรียน'],['Romance','โรแมนติก'],['Mystery','ลึกลับ'],['Historical','ประวัติศาสตร์'],['Action','แอ็กชัน'],['Sci-fi','ไซไฟ']];
 async function generate(){if(!idea.trim()||generating)return;setGenerating(true);setError('');try{const generated=await api<Omit<ScenarioDraft,'cover_image'>>('worlds/generate','POST',{prompt:idea});setDraft(current=>({...current,...generated}));}catch(error){setError((error as Error).message);}finally{setGenerating(false);}}
 function chooseArtwork(event:ChangeEvent<HTMLInputElement>){const file=event.target.files?.[0];event.target.value='';if(!file)return;if(!['image/png','image/jpeg','image/webp'].includes(file.type)){setError(text('Upload a PNG, JPEG or WebP image.','อัปโหลดรูป PNG, JPEG หรือ WebP'));return;}if(file.size>2_000_000){setError(text('Choose an image smaller than 2 MB.','กรุณาเลือกรูปที่มีขนาดไม่เกิน 2 MB'));return;}const reader=new FileReader();reader.onload=()=>{if(typeof reader.result==='string'){update('cover_image',reader.result);setError('');}};reader.onerror=()=>setError(text('Could not read that image.','ไม่สามารถอ่านไฟล์รูปนี้ได้'));reader.readAsDataURL(file);}
 async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);setError('');try{const world=await api<World>(scenario?`worlds/${scenario.id}`:'worlds',scenario?'PATCH':'POST',draft);await refresh();router.push(`/worlds/${world.id}`);}catch(error){setError((error as Error).message);setBusy(false);}}
 return <>
  <Link href={scenario?`/worlds/${scenario.id}`:'/create'} className="back-link"><ArrowLeft size={16}/>{scenario?text('Back to scenario','กลับไปหน้าซีนาริโอ'):text('Back to Create','กลับไปหน้าสร้าง')}</Link>
  <PageTitle eyebrow={text(editing?'EDIT YOUR SCENARIO':'A SCENARIO OF YOUR OWN',editing?'แก้ไขซีนาริโอของคุณ':'ซีนาริโอในแบบของคุณ')} title={text(editing?'Edit Scenario':'Create Scenario',editing?'แก้ไขซีนาริโอ':'สร้างซีนาริโอ')} description={text(editing?'Update canon, rules, locations, and the starting state. Existing chats keep their history while future replies use the saved scenario data.':'Describe the world you want. AI can shape a complete editable draft, or you can build it manually.',editing?'แก้ canon กฎ สถานที่ และสถานะเริ่มต้น แชตเดิมยังเก็บประวัติไว้ ส่วนคำตอบใหม่จะใช้ข้อมูลซีนาริโอที่บันทึก':'บอกโลกหรือซีนาริโอที่ต้องการ ให้ AI ช่วยสร้างร่างที่แก้ไขต่อได้ หรือจะเขียนเองทั้งหมดก็ได้')}/>
  <form onSubmit={submit} className="form-layout">
   <div className="form-main glass">
    <section className="ai-character-builder">
     <span className="eyebrow">{text('AI SCENARIO STUDIO','สตูดิโอสร้างซีนาริโอด้วย AI')}</span>
     <div className="ai-builder-heading"><div><h2>{text('What kind of world do you want to enter?','คุณอยากเข้าไปอยู่ในโลกแบบไหน?')}</h2><p>{text('Describe the premise, mood, lore, rules, conflict, locations, factions, or anything that must stay exactly as you imagined it.','บอกพล็อต บรรยากาศ lore กฎ ความขัดแย้ง สถานที่ ฝ่ายต่าง ๆ หรือรายละเอียดที่ต้องคงไว้ตามที่คุณคิด')}</p></div><Sparkles size={25}/></div>
     <label className="field"><span>{text('Scenario idea','ไอเดียซีนาริโอ')}</span><textarea value={idea} onChange={event=>setIdea(event.target.value)} maxLength={2400} rows={4} placeholder={text('A rain-soaked cyberpunk Bangkok where old spirit houses coexist with illegal neural magic, rival districts fight over memory markets, and the story begins during a citywide blackout…','กรุงเทพไซเบอร์พังก์กลางสายฝนที่ศาลพระภูมิอยู่ร่วมกับเวทประสาทผิดกฎหมาย เขตต่าง ๆ แย่งชิงตลาดความทรงจำ และเรื่องเริ่มขึ้นในคืนไฟดับทั้งเมือง…')}/></label>
     <button className="button ai-generate" type="button" disabled={generating||!idea.trim()} onClick={generate}><Sparkles size={16}/>{generating?text('Building your scenario…','กำลังสร้างซีนาริโอ…'):text('Generate with AI','สร้างด้วย AI')}</button>
    </section>
    <section className="scenario-art-editor">
     <div className="form-section-heading"><ImagePlus/><div><h2>{text('Scenario artwork','รูปซีนาริโอ')}</h2><p>{text('Upload a cover now, or replace it later from this same editor.','อัปโหลดรูปปกตอนนี้ หรือกลับมาเปลี่ยนรูปภายหลังได้จากหน้านี้')}</p></div></div>
     <div className="scenario-art-row">
      <div className="scenario-art-preview" aria-label={text('Scenario artwork preview','ตัวอย่างรูปซีนาริโอ')}>{draft.cover_image?<img src={draft.cover_image} alt=""/>:<div className={`scenario-art-fallback world-${draft.cover}`}><Globe2 size={28}/><span>{text('Using atmosphere fallback','ใช้ภาพพื้นหลังตามบรรยากาศ')}</span></div>}</div>
      <div className="scenario-art-actions"><label className="button"><ImagePlus size={16}/>{draft.cover_image?text('Change image','เปลี่ยนรูป'):text('Upload image','อัปโหลดรูป')}<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={chooseArtwork}/></label>{draft.cover_image&&<button className="button" type="button" onClick={()=>update('cover_image',null)}><Trash2 size={16}/>{text('Remove image','ลบรูป')}</button>}<small>{text('PNG, JPEG or WebP · up to 2 MB','PNG, JPEG หรือ WebP · ไม่เกิน 2 MB')}</small></div>
     </div>
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
    <div className="form-footer"><span>{editing?text('Saved changes affect future scenario turns.','การแก้ไขที่บันทึกจะใช้กับเทิร์นถัดไปของซีนาริโอ'):text('Private to your account','เป็นส่วนตัวสำหรับบัญชีของคุณ')}</span><button className="button primary" disabled={busy||!draft.name.trim()}>{busy?text(editing?'Saving…':'Creating…',editing?'กำลังบันทึก…':'กำลังสร้าง…'):text(editing?'Save Scenario':'Create Scenario',editing?'บันทึกซีนาริโอ':'สร้างซีนาริโอ')}<ArrowRight size={17}/></button></div>
   </div>
   <aside className="form-preview glass"><div className={`world-preview-art world-${draft.cover} ${draft.cover_image?'has-custom-image':''}`}>{draft.cover_image&&<img src={draft.cover_image} alt=""/>}</div><span className="eyebrow">{text('YOUR SCENARIO','ซีนาริโอของคุณ')}</span><h2>{draft.name||text('A world waiting to exist','โลกที่กำลังรอให้ถือกำเนิด')}</h2><span className="pill">{draft.genre}</span><p>{draft.description||text('Use AI to draft the setting, then tune every detail before saving.','ใช้ AI ร่างโลก แล้วปรับทุกจุดได้ก่อนบันทึก')}</p><div className="preview-note"><Sparkles size={20}/><p>{text('AI creates the foundation; you keep final control over canon, rules, and starting state.','AI ช่วยวางรากฐาน แต่คุณเป็นคนตัดสิน canon กฎ และสถานะเริ่มต้นสุดท้าย')}</p></div></aside>
  </form>
 </>;
}
