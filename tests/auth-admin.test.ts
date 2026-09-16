import test from 'node:test';
import assert from 'node:assert/strict';
import {isAdmin} from '../src/lib/auth';

test('production admin access fails closed without ADMIN_EMAILS',()=>{
 const previousNodeEnv=process.env.NODE_ENV;
 const previousAdminEmails=process.env.ADMIN_EMAILS;
 try{
  process.env.NODE_ENV='production';
  delete process.env.ADMIN_EMAILS;
  assert.equal(isAdmin({admin:true,email:'admin@example.test'}),false);
  process.env.ADMIN_EMAILS='admin@example.test';
  assert.equal(isAdmin({admin:false,email:'admin@example.test'}),true);
  assert.equal(isAdmin({admin:true,email:'other@example.test'}),false);
 }finally{
  if(previousNodeEnv===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previousNodeEnv;
  if(previousAdminEmails===undefined)delete process.env.ADMIN_EMAILS;else process.env.ADMIN_EMAILS=previousAdminEmails;
 }
});

test('development may use an explicit persisted admin flag',()=>{
 const previousNodeEnv=process.env.NODE_ENV;
 const previousAdminEmails=process.env.ADMIN_EMAILS;
 try{
  process.env.NODE_ENV='development';
  delete process.env.ADMIN_EMAILS;
  assert.equal(isAdmin({admin:true,email:null}),true);
  assert.equal(isAdmin({admin:false,email:null}),false);
 }finally{
  if(previousNodeEnv===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previousNodeEnv;
  if(previousAdminEmails===undefined)delete process.env.ADMIN_EMAILS;else process.env.ADMIN_EMAILS=previousAdminEmails;
 }
});
