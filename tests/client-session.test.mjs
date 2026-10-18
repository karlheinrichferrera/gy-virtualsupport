import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import ts from 'typescript';
const runtimeRequire=createRequire(import.meta.url);
function harness(){
  const sessions=new Map(),jar=new Map(),writes=[],profiles=new Set([1,2]);let fail=false;
  const sql=async(strings,...values)=>{
    if(fail)throw new Error('Database unavailable');
    const query=strings.join('?');
    if(query.includes('SELECT c.id,c.email,c.display_name')){
      const session=sessions.get(values[0]);return {rows:session&&session.expires>Date.now()&&profiles.has(session.id)?[{id:session.id,email:`client${session.id}@example.invalid`,display_name:`Client ${session.id}` }]:[]};
    }
    if(query.includes('INSERT INTO client_sessions'))sessions.set(values[0],{id:values[1],expires:Date.parse(values[2])});
    if(query.includes('DELETE FROM client_sessions WHERE token_hash'))sessions.delete(values[0]);
    if(query.includes('DELETE FROM client_sessions WHERE client_id'))for(const [token,session]of sessions)if(session.id===values[0])sessions.delete(token);
    if(query.includes('DELETE FROM client_sessions WHERE expires_at'))for(const [token,session]of sessions)if(session.expires<=Date.now())sessions.delete(token);
    return {rows:[]};
  };
  const cookies={get:name=>jar.has(name)?{value:jar.get(name)}:undefined,set:(name,value,options)=>{writes.push({name,value,options});if(options.maxAge===0)jar.delete(name);else jar.set(name,value);}};
  const testModule={exports:{}},code=ts.transpileModule(fs.readFileSync('src/lib/client-session.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  const require=id=>id==='@vercel/postgres'?{sql}:id==='next/headers'?{cookies:async()=>cookies}:id==='./client-session-schema'?{ensureClientSessionSchema:async()=>{}}:runtimeRequire(id);
  new Function('require','module','exports','process',code)(require,testModule,testModule.exports,{env:{NODE_ENV:'production'}});
  return {...testModule.exports,sessions,jar,writes,profiles,fail:()=>{fail=true;}};
}
test('client approvals require an opaque, server-verified session rather than a supplied email',async()=>{
  const app=harness();assert.equal(await app.getClientSession(),null);
  await assert.rejects(app.requireClientSession(),/sign in again/);
  app.jar.set('gy_client_session','client1@example.invalid');assert.equal(await app.getClientSession(),null);
  await app.createClientSession(1);const cookie=app.writes.at(-1);
  assert.equal(cookie.name,'gy_client_session');assert.match(cookie.value,/^[a-f0-9]{64}$/);
  assert.equal(cookie.options.httpOnly,true);assert.equal(cookie.options.secure,true);assert.equal(cookie.options.sameSite,'lax');
  assert.ok(app.sessions.has(createHash('sha256').update(cookie.value).digest('hex')));assert.ok(!app.sessions.has(cookie.value));
  assert.deepEqual(await app.requireClientSession(),{id:1,email:'client1@example.invalid',displayName:'Client 1'});
  const oldToken=cookie.value;await app.createClientSession(2);
  assert.equal(app.sessions.size,1);assert.equal((await app.requireClientSession()).id,2);
  app.jar.set('gy_client_session',oldToken);assert.equal(await app.getClientSession(),null);
});
test('expired, revoked and deleted client accounts cannot approve; logout fails closed',async()=>{
  const app=harness();await app.createClientSession(1);
  for(const session of app.sessions.values())session.expires=0;assert.equal(await app.getClientSession(),null);
  await app.createClientSession(1);await app.invalidateClientSessions(1);assert.equal(await app.getClientSession(),null);
  await app.createClientSession(1);app.profiles.delete(1);assert.equal(await app.getClientSession(),null);
  await app.clearClientSession();assert.equal(app.jar.size,0);assert.equal(app.sessions.size,0);
  await app.createClientSession(2);app.fail();await assert.rejects(app.getClientSession(),/Database unavailable/);
  await assert.rejects(app.clearClientSession(),/Database unavailable/);assert.equal(app.jar.size,0);
});
