import {Pool,types,type PoolClient} from 'pg';
import {AsyncLocalStorage} from 'node:async_hooks';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
types.setTypeParser(20,v=>Number(v));
type Row=Record<string,unknown>;
type Value=string|number|null;
const connection=new AsyncLocalStorage<PoolClient>();
let pool:Pool|undefined,local:DatabaseSync|undefined;
function connectionString(){
 const configured=process.env.DATABASE_URL?.trim();
 if(configured&&/^postgres(?:ql)?:\/\//i.test(configured))return configured;
 const {POSTGRES_HOST:host,POSTGRES_USER:user,POSTGRES_PASSWORD:password,POSTGRES_DATABASE:database}=process.env;
 if(host&&user&&password&&database){
  const projectRef=process.env.SUPABASE_PROJECT_REF?.trim();
  const isSupabase=host.endsWith('.supabase.co')&&Boolean(projectRef);
  const poolerHost=isSupabase?'aws-0-ap-northeast-1.pooler.supabase.com':host;
  const poolerUser=isSupabase&&!user.includes('.')?`${user}.${projectRef}`:user;
  return `postgresql://${encodeURIComponent(poolerUser)}:${encodeURIComponent(password)}@${poolerHost}:5432/${database}`;
 }
 return configured||'';
}
export function hasPostgres(){return /^postgres(?:ql)?:\/\//i.test(connectionString());}
function postgres(){return pool??=new Pool({connectionString:connectionString(),max:3,idleTimeoutMillis:20000,connectionTimeoutMillis:15000,ssl:{rejectUnauthorized:false}});}
function sqlite(){if(!local){const path=process.env.DATABASE_PATH||'./data/sekaira.sqlite';if(path!==':memory:')mkdirSync(dirname(path),{recursive:true});local=new DatabaseSync(path);local.exec(readFileSync('src/lib/schema.sql','utf8'));}return local;}
// Keep the same parameterized repository queries for PostgreSQL and local SQLite.
export function postgresSQL(sql:string){
 let out=sql.replace(/\bIS \?/g,'IS NOT DISTINCT FROM ?').replace(/MAX\(-100,MIN\(100,(?:relationships\.)?trust\+excluded\.trust\)\)/,'GREATEST((-100)::bigint,LEAST((100)::bigint,relationships.trust+excluded.trust))');
 if(out.startsWith('INSERT OR IGNORE'))out=out.replace('INSERT OR IGNORE','INSERT')+' ON CONFLICT DO NOTHING';
 const tables=['users','sessions','worlds','scenarios','avatars','characters','world_characters','personas','conversations','scenes','scene_characters','messages','memories','relationships','turn_locks'];
 out=out.replace(/\b(FROM|JOIN|INTO|UPDATE)\s+(\w+)/g,(m,op,table)=>tables.includes(table)?`${op} sekaira.${table}`:m);
 let quote=false,index=0,result='';for(let i=0;i<out.length;i++){const c=out[i];if(c==="'"){if(quote&&out[i+1]==="'"){result+="''";i++;continue;}quote=!quote;}result+=c==='?'&&!quote?`$${++index}`:c;}return result;
}
async function query(sql:string,args:Value[]){if(hasPostgres()){const result=await (connection.getStore()||postgres()).query(postgresSQL(sql),args);return {rows:result.rows as Row[],changes:result.rowCount||0};}if(process.env.VERCEL)throw new Error('A PostgreSQL connection is not configured on Vercel.');const stmt=sqlite().prepare(sql);if(/^\s*(SELECT|WITH)/i.test(sql))return {rows:stmt.all(...args) as Row[],changes:0};const result=stmt.run(...args);return {rows:[] as Row[],changes:Number(result.changes)};}
const adapter={prepare(sql:string){return {async all(...args:Value[]){return (await query(sql,args)).rows;},async get(...args:Value[]){return (await query(sql,args)).rows[0];},async run(...args:Value[]){return {changes:(await query(sql,args)).changes};}}}};
export const db=()=>adapter;
export async function transaction<T>(fn:()=>Promise<T>):Promise<T>{if(hasPostgres()){if(connection.getStore())return fn();const client=await postgres().connect();try{await client.query('BEGIN');const value=await connection.run(client,fn);await client.query('COMMIT');return value;}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}}const d=sqlite();d.exec('BEGIN IMMEDIATE');try{const value=await fn();d.exec('COMMIT');return value;}catch(e){d.exec('ROLLBACK');throw e;}}
