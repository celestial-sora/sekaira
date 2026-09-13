import {cookies} from 'next/headers';
import {createHash,randomBytes} from 'node:crypto';
import {db,id} from './db';
export const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
export const guestAllowed=()=>process.env.NODE_ENV!=='production'&&process.env.ALLOW_GUEST!=='false';
export const googleReady=()=>!!(process.env.GOOGLE_CLIENT_ID&&process.env.GOOGLE_CLIENT_SECRET);
export async function currentUser(){const token=(await cookies()).get('sora_session')?.value;if(!token)return null;const r=(await db().prepare('SELECT u.id,u.name,u.guest FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>?').get(hash(token),Date.now()));return r?{id:r.id as string,name:r.name as string,guest:!!r.guest}:null;}
export async function session(userId:string){const token=randomBytes(32).toString('base64url');(await db().prepare('DELETE FROM sessions WHERE expires_at<?').run(Date.now()));(await db().prepare('INSERT INTO sessions VALUES (?,?,?)').run(hash(token),userId,Date.now()+30*86400000));(await cookies()).set('sora_session',token,{httpOnly:true,secure:process.env.APP_URL?.startsWith('https://')||false,sameSite:'lax',path:'/',maxAge:30*86400});}
export async function guest(){const existing=await currentUser();if(existing)return existing;if(!guestAllowed())throw new Error('Sign in with Google to continue.');const user={id:id(),name:'Traveler',guest:true};(await db().prepare('INSERT INTO users VALUES (?,?,?,?)').run(user.id,null,user.name,1));await session(user.id);return user;}
