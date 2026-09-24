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
function postgresSSL(){
 if(process.env.DATABASE_SSL_MODE?.trim().toLowerCase()==='disable'){
  if(process.env.NODE_ENV==='production')throw new Error('DATABASE_SSL_MODE=disable is not allowed in production.');
  return false as const;
 }
 return {rejectUnauthorized:false};
}
function postgres(){return pool??=new Pool({connectionString:connectionString(),max:1,idleTimeoutMillis:10000,connectionTimeoutMillis:10000,allowExitOnIdle:true,ssl:postgresSSL()});}
function sqlite(){if(!local){const path=process.env.DATABASE_PATH||'./data/sekaira.sqlite';if(path!==':memory:')mkdirSync(dirname(path),{recursive:true});local=new DatabaseSync(path);local.exec(readFileSync('src/lib/schema.sql','utf8'));try{local.exec('ALTER TABLE characters DROP COLUMN avatar_id');}catch(error){if(!String(error).includes('no such column'))throw error;}local.exec('DROP TABLE IF EXISTS avatars');try{local.exec("ALTER TABLE characters ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN ('private','public','friends','selected'))");}catch(error){if(!String(error).includes('duplicate column name'))throw error;}local.exec("UPDATE characters SET visibility='public' WHERE published=1 AND visibility='private'");local.exec("UPDATE characters SET visibility=json_extract(data,'$.visibility'),published=CASE WHEN json_extract(data,'$.visibility')='public' THEN 1 ELSE published END WHERE visibility='private' AND json_extract(data,'$.visibility') IN ('public','friends','selected')");local.exec('CREATE INDEX IF NOT EXISTS character_visibility ON characters(visibility,owner_id)');}return local;}
// Keep repository queries portable: translate SQLite-specific syntax to PostgreSQL
// without introducing bind placeholders. Captured expressions are SQL, not query arguments.
export function postgresSQL(sql:string){
 let out=sql
  .replace(/\bIS \?/g,'IS NOT DISTINCT FROM ?')
  .replace(/\bORDER BY rowid\b/g,'ORDER BY created_at')
  .replace(/json_extract\(([^,]+),\s*'\$\.published'\)\s*=\s*1/g,(_match,expr)=>`COALESCE(((${String(expr).trim()})::jsonb ->> 'published')::boolean, false) = true`)
  .replace(/MAX\(-100,MIN\(100,(?:relationships\.)?trust\+excluded\.trust\)\)/,'GREATEST((-100)::bigint,LEAST((100)::bigint,relationships.trust+excluded.trust))');
 if(out.startsWith('INSERT OR IGNORE'))out=out.replace('INSERT OR IGNORE','INSERT')+' ON CONFLICT DO NOTHING';
 const tables=['users','sessions','worlds','scenarios','characters','friendships','character_shares','world_characters','personas','conversations','scenes','scene_characters','messages','memories','relationships','turn_locks'];
 out=out.replace(/\b(FROM|JOIN|INTO|UPDATE|TABLE)\s+(\w+)/g,(m,op,table)=>tables.includes(table)?`${op} sekaira.${table}`:m);
 let quote=false,index=0,result='';for(let i=0;i<out.length;i++){const c=out[i];if(c==="'"){if(quote&&out[i+1]==="'"){result+="''";i++;continue;}quote=!quote;}result+=c==='?'&&!quote?`$${++index}`:c;}return result;
}
async function query(sql:string,args:Value[]){if(hasPostgres()){const result=await (connection.getStore()||postgres()).query(postgresSQL(sql),args);return {rows:result.rows as Row[],changes:result.rowCount||0};}if(process.env.VERCEL)throw new Error('A PostgreSQL connection is not configured on Vercel.');const stmt=sqlite().prepare(sql);if(/^\s*(SELECT|WITH)/i.test(sql))return {rows:stmt.all(...args) as Row[],changes:0};const result=stmt.run(...args);return {rows:[] as Row[],changes:Number(result.changes)};}
const adapter={prepare(sql:string){return {async all(...args:Value[]){return (await query(sql,args)).rows;},async get(...args:Value[]){return (await query(sql,args)).rows[0];},async run(...args:Value[]){return {changes:(await query(sql,args)).changes};}}}};
export const db=()=>adapter;
export async function transaction<T>(fn:()=>Promise<T>):Promise<T>{if(hasPostgres()){if(connection.getStore())return fn();const client=await postgres().connect();try{await client.query('BEGIN');const value=await connection.run(client,fn);await client.query('COMMIT');return value;}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}}const d=sqlite();d.exec('BEGIN IMMEDIATE');try{const value=await fn();d.exec('COMMIT');return value;}catch(e){d.exec('ROLLBACK');throw e;}}
