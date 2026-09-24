import test from 'node:test';
import assert from 'node:assert/strict';
import {researchForGeneration,researchPlanSchema,tavilySearch} from '../src/lib/web-research';

test('research plan is bounded to a small number of focused queries',()=>{
 const plan=researchPlanSchema.parse({required:true,focus:'Frieren canon personality and speech',queries:['Frieren official character profile','Frieren personality canon']});
 assert.equal(plan.required,true);
 assert.equal(plan.queries.length,2);
 assert.equal(researchPlanSchema.safeParse({...plan,queries:['a','b','c','d']}).success,false);
});

test('Tavily search keeps the API key in the authorization header and normalizes results',async()=>{
 const previousFetch=globalThis.fetch;
 let seenUrl='',seenAuth='',seenBody='';
 globalThis.fetch=async(input,init)=>{
  seenUrl=String(input);
  seenAuth=new Headers(init?.headers).get('Authorization')??'';
  seenBody=String(init?.body??'');
  return new Response(JSON.stringify({results:[{title:'Official profile',url:'https://example.com/profile',content:'Verified character details',score:0.91}]}),{status:200});
 };
 try{
  const results=await tavilySearch('Frieren canon profile','secret-test-key');
  assert.equal(seenUrl,'https://api.tavily.com/search');
  assert.equal(seenAuth,'Bearer secret-test-key');
  assert.equal(seenBody.includes('secret-test-key'),false);
  assert.deepEqual(results,[{title:'Official profile',url:'https://example.com/profile',content:'Verified character details',score:0.91}]);
 }finally{globalThis.fetch=previousFetch;}
});

test('Tavily search is disabled cleanly when no API key is configured',async()=>{
 assert.deepEqual(await tavilySearch('anything',''),[]);
});

test('explicit named reference searches the requested character and work directly',async()=>{
 const previousKey=process.env.TAVILY_API_KEY,previousFetch=globalThis.fetch;
 process.env.TAVILY_API_KEY='test-key';
 const queries:string[]=[];
 globalThis.fetch=async(input,init)=>{
  assert.equal(String(input),'https://api.tavily.com/search');
  queries.push(JSON.parse(String(init?.body)).query);
  return new Response(JSON.stringify({results:[{title:'Profile',url:'https://example.com/maomao',content:'Reference details'}]}),{status:200});
 };
 try{
  const result=await researchForGeneration('character','อยากให้สร้าง Maomao | The Apothecary Diaries',{name:'Maomao',work:'The Apothecary Diaries'});
  assert.equal(queries.length,1);
  assert.match(queries[0],/Maomao The Apothecary Diaries/);
  assert.equal(result?.sources.length,1);
 }finally{
  globalThis.fetch=previousFetch;
  if(previousKey===undefined)delete process.env.TAVILY_API_KEY;else process.env.TAVILY_API_KEY=previousKey;
 }
});
