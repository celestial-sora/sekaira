import {cookies} from 'next/headers';
import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {z} from 'zod';
import {db,id,transaction} from './db';
export const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
export const guestAllowed=()=>process.env.NODE_ENV!=='production'&&process.env.ALLOW_GUEST!=='false';
export const applicationUrl=()=>process.env.APP_URL?.replace(/\/$/,'')||(process.env.NODE_ENV==='production'?null:'http://localhost:3000');
export const googleReady=()=>!!(process.env.GOOGLE_CLIENT_ID&&process.env.GOOGLE_CLIENT_SECRET&&applicationUrl());
export const oauthStateSchema=z.object({state:z.string().min(32).max(128),verifier:z.string().min(43).max(128)}).strict();
export const googleProfileSchema=z.object({sub:z.string().min(1).max(255),name:z.string().max(200).optional(),picture:z.string().url().max(2000).optional(),email_verified:z.literal(true)}).passthrough();
export function parseOAuthState(raw:string){try{return oauthStateSchema.parse(JSON.parse(raw));}catch{return null;}}
export function matchesOAuthState(received:string|null,expected:string){if(!received)return false;const a=Buffer.from(received),b=Buffer.from(expected);return a.length===b.length&&timingSafeEqual(a,b);}
const secureCookies=()=>process.env.NODE_ENV==='production'||process.env.APP_URL?.startsWith('https://')===true;
export async function currentUser(){const token=(await cookies()).get('sora_session')?.value;if(!token)return null;const r=(await db().prepare('SELECT u.id,u.email,u.name,u.picture,u.guest,u.admin,u.age_range,u.age_verified FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>?').get(hash(token),Date.now()));if(!r)return null;const age_range:r["age_range"] extends never?never:"general"|"mature"=r.age_range==='mature'?'mature':'general';return {id:r.id as string,email:(r.email as string|null)||null,name:r.name as string,picture:(r.picture as string|null)||null,guest:!!r.guest,admin:!!r.admin,age_range,age_verified:r.age_verified === undefined ? true : !!r.age_verified};}
export const isAdmin=(user:{admin?:boolean;email?:string|null}|null)=>{if(user?.admin)return true;const configured=process.env.ADMIN_EMAILS?.split(',').map(v=>v.trim().toLowerCase()).filter(Boolean)??[];return Boolean(user?.email&&configured.includes(user.email.toLowerCase()));};
export async function session(userId:string,previousToken?:string){const token=randomBytes(32).toString('base64url');await transaction(async()=>{await db().prepare('DELETE FROM sessions WHERE expires_at<?').run(Date.now());if(previousToken)await db().prepare('DELETE FROM sessions WHERE token_hash=?').run(hash(previousToken));await db().prepare('INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,?)').run(hash(token),userId,Date.now()+30*86400000);});(await cookies()).set('sora_session',token,{httpOnly:true,secure:secureCookies(),sameSite:'lax',path:'/',maxAge:30*86400});}
export async function guest(){const existing=await currentUser();if(existing)return existing;if(!guestAllowed())throw new Error('Sign in with Google to continue.');const user={id:id(),name:'Traveler',picture:null,guest:true};(await db().prepare('INSERT INTO users (id,google_sub,name,picture,guest,age_range,age_verified) VALUES (?,?,?,?,?,?,?)').run(user.id,null,user.name,null,1,'general',0));await session(user.id);return user;}
