import test from 'node:test';
import assert from 'node:assert/strict';
import {singleFlight} from '../src/lib/single-flight';

test('shares a pending bootstrap request but reloads after navigation',async()=>{
 let calls=0;
 let finishFirst:(value:string)=>void=()=>{};
 const first=new Promise<string>(resolve=>{finishFirst=resolve;});
 const load=singleFlight(()=>{
  calls++;
  return calls===1?first:Promise.resolve('character now saved');
 });
 const a=load(),b=load();
 assert.equal(a,b);
 assert.equal(calls,1);
 finishFirst('before character creation');
 assert.equal(await a,'before character creation');
 assert.equal(await load(),'character now saved');
 assert.equal(calls,2);
});

test('a failed bootstrap can be retried on the next mount',async()=>{
 let calls=0;
 const load=singleFlight(()=>++calls===1?Promise.reject(new Error('temporary outage')):Promise.resolve('recovered'));
 await assert.rejects(load(),/temporary outage/);
 assert.equal(await load(),'recovered');
 assert.equal(calls,2);
});
