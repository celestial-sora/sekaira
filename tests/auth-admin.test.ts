import test from 'node:test';
import assert from 'node:assert/strict';
import {isAdmin} from '../src/lib/auth';

const env=process.env as Record<string,string|undefined>;

function restore(name:string,value:string|undefined){
 if(value===undefined)delete env[name];else env[name]=value;
}

test('production admin access fails closed without ADMIN_EMAILS',()=>{
 const previousNodeEnv=env.NODE_ENV;
 const previousAdminEmails=env.ADMIN_EMAILS;
 try{
  env.NODE_ENV='production';
  delete env.ADMIN_EMAILS;
  assert.equal(isAdmin({admin:true,email:'admin@example.test'}),false);
  env.ADMIN_EMAILS='admin@example.test';
  assert.equal(isAdmin({admin:false,email:'admin@example.test'}),true);
  assert.equal(isAdmin({admin:true,email:'other@example.test'}),false);
 }finally{
  restore('NODE_ENV',previousNodeEnv);
  restore('ADMIN_EMAILS',previousAdminEmails);
 }
});

test('development may use an explicit persisted admin flag',()=>{
 const previousNodeEnv=env.NODE_ENV;
 const previousAdminEmails=env.ADMIN_EMAILS;
 try{
  env.NODE_ENV='development';
  delete env.ADMIN_EMAILS;
  assert.equal(isAdmin({admin:true,email:null}),true);
  assert.equal(isAdmin({admin:false,email:null}),false);
 }finally{
  restore('NODE_ENV',previousNodeEnv);
  restore('ADMIN_EMAILS',previousAdminEmails);
 }
});
