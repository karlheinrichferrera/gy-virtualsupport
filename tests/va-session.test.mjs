import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import ts from 'typescript';
const runtimeRequire=createRequire(import.meta.url);
function harness(){
  const sessions=new Map(),jar=new Map(),writes=[],profiles=new Set(['va-1','va-2']);let admin=null,fail=false;
  const sql=async(strings,...values)=>{
    if(fail)throw new Error('Database unavailable');
    const query=strings.join('?');
    if(query.includes('SELECT s.va_id')){
      const session=sessions.get(values[0]);return {rows:session&&session.expires>Date.now()&&profiles.has(session.id)?[{va_id:session.id}]:[]};
    }
    if(query.includes('INSERT INTO va_sessions'))sessions.set(values[0],{id:values[1],expires:Date.parse(values[2])});
    if(query.includes('DELETE FROM va_sessions WHERE token_hash'))sessions.delete(values[0]);
    if(query.includes('DELETE FROM va_sessions WHERE va_id'))for(const [token,session]of sessions)if(session.id===values[0])sessions.delete(token);
    if(query.includes('DELETE FROM va_sessions WHERE expires_at'))for(const [token,session]of sessions)if(session.expires<=Date.now())sessions.delete(token);
    return {rows:[]};
  };
  const cookies={get:name=>jar.has(name)?{value:jar.get(name)}:undefined,set:(name,value,options)=>{writes.push({name,value,options});if(options.maxAge===0)jar.delete(name);else jar.set(name,value);}};
  const testModule={exports:{}},code=ts.transpileModule(fs.readFileSync('src/lib/va-session.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  const require=id=>id==='@vercel/postgres'?{sql}:id==='next/headers'?{cookies:async()=>cookies}:id==='./va-session-schema'?{ensureVASessionSchema:async()=>{}}:id==='./admin-session'?{getAdminSession:async()=>admin}:runtimeRequire(id);
  new Function('require','module','exports','process',code)(require,testModule,testModule.exports,{env:{NODE_ENV:'production'}});
  return {...testModule.exports,sessions,jar,writes,profiles,setAdmin:value=>{admin=value;},fail:()=>{fail=true;}};
}
test('VA sessions use opaque HttpOnly cookies and store hashes, with owner-scoped access',async()=>{
  const app=harness();assert.equal(await app.getVASession(),null);
  await app.createVASession('va-1');const cookie=app.writes.at(-1);
  assert.equal(cookie.name,'gy_va_session');assert.match(cookie.value,/^[a-f0-9]{64}$/);
  assert.equal(cookie.options.httpOnly,true);assert.equal(cookie.options.secure,true);assert.equal(cookie.options.sameSite,'lax');
  assert.ok(app.sessions.has(createHash('sha256').update(cookie.value).digest('hex')));assert.ok(!app.sessions.has(cookie.value));
  assert.deepEqual(await app.getVASession(),{id:'va-1'});assert.equal(await app.requireVAOrAdmin('va-1'),null);
  await assert.rejects(app.requireVAOrAdmin('va-2'),/sign in again/);
  app.setAdmin({id:1,username:'admin'});assert.deepEqual(await app.requireVAOrAdmin('va-2'),{id:1,username:'admin'});
});
test('expired, revoked, malformed and account-deletion sessions cannot authorize',async()=>{
  const app=harness();app.jar.set('gy_va_session','invalid');assert.equal(await app.getVASession(),null);
  await app.createVASession('va-1');for(const session of app.sessions.values())session.expires=0;assert.equal(await app.getVASession(),null);
  await app.createVASession('va-1');await app.invalidateVASessions('va-1');assert.equal(await app.getVASession(),null);
  await app.createVASession('va-1');app.profiles.delete('va-1');assert.equal(await app.getVASession(),null);
});
test('logout expires the cookie, revokes storage, and fails closed on database errors',async()=>{
  const app=harness();await app.createVASession('va-1');await app.clearVASession();assert.equal(app.jar.size,0);assert.equal(app.sessions.size,0);
  await app.createVASession('va-1');app.fail();await assert.rejects(app.getVASession(),/Database unavailable/);
  await assert.rejects(app.clearVASession(),/Database unavailable/);assert.equal(app.jar.size,0);
});
