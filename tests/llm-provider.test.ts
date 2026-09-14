import test from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {groq} from '../src/lib/engine';
import {groqModelCandidates,llmConfig} from '../src/lib/llm';

test('model candidates keep the configured model and add supported fallbacks once',()=>{
 const previous=process.env.GROQ_MODEL;
 process.env.GROQ_MODEL='retired/model';
 try{assert.deepEqual(groqModelCandidates(llmConfig()),['retired/model','openai/gpt-oss-120b','openai/gpt-oss-20b']);}
 finally{if(previous===undefined)delete process.env.GROQ_MODEL;else process.env.GROQ_MODEL=previous;}
});

test('Groq retries a supported model when the configured model is unavailable',async()=>{
 const previousKey=process.env.GROQ_API_KEY,previousModel=process.env.GROQ_MODEL,previousFetch=globalThis.fetch;
 process.env.GROQ_API_KEY='test-key';process.env.GROQ_MODEL='retired/model';
 const requested:string[]=[];
 globalThis.fetch=async(_input,init)=>{
  const model=JSON.parse(String(init?.body)).model as string;requested.push(model);
  if(model==='retired/model')return new Response(JSON.stringify({error:{message:'model unavailable'}}),{status:404});
  return new Response(JSON.stringify({choices:[{message:{content:'{"ok":true}'}}]}),{status:200});
 };
 try{
  assert.deepEqual(await groq('Return JSON.','test',z.object({ok:z.boolean()})),{ok:true});
  assert.deepEqual(requested,['retired/model','openai/gpt-oss-120b']);
 }finally{
  globalThis.fetch=previousFetch;
  if(previousKey===undefined)delete process.env.GROQ_API_KEY;else process.env.GROQ_API_KEY=previousKey;
  if(previousModel===undefined)delete process.env.GROQ_MODEL;else process.env.GROQ_MODEL=previousModel;
 }
});
