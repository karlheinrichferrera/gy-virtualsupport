import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { neon } from '@neondatabase/serverless';

test('Client ID is optional admin-managed metadata and never a login credential', {skip:!process.env.POSTGRES_URL}, async()=>{
 const connection=neon(process.env.POSTGRES_URL,{fullResults:true});
 const schema=`client_reference_test_${Date.now()}`;
 const query=async(text,values=[])=> (await connection.transaction([connection("SELECT set_config('search_path',$1,true)",[schema]),connection(text,values)]))[1];
 const sql=(strings,...values)=>query(strings.reduce((text,part,i)=>text+(i?`$${i}`:'')+part,''),values);
 const source=fs.readFileSync('src/lib/actions.ts','utf8'),ast=ts.createSourceFile('actions.ts',source,ts.ScriptTarget.Latest,true);
 const names=['clientReference','rowToClientAccount','authenticateClient','addClientAccount','updateClientAccount','updateClientAccountByEmail'];
 const code=ts.transpileModule(ast.statements.filter(node=>ts.isFunctionDeclaration(node)&&names.includes(node.name?.text)).map(node=>node.getText(ast)).join('\n'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 const migration=fs.readFileSync('src/lib/db.ts','utf8').split('\n').find(line=>line.includes('ADD COLUMN IF NOT EXISTS client_code'));
 const migrate=new Function('sql',`return async()=>{${migration}}`)(sql);
 let admin=true,sessionId=null;
 const mod={exports:{}};
 new Function('exports','sql','ensureTablesOnce','requireAdminSession','createClientSession','estDateLong',code)(mod.exports,sql,migrate,async()=>{if(!admin)throw new Error('Admin sign-in required');},async id=>{sessionId=id;},()=> 'Test date');
 const actions=mod.exports;
 await connection(`CREATE SCHEMA ${schema}`);
 try {
  await query(`CREATE TABLE client_accounts(id SERIAL PRIMARY KEY,email TEXT UNIQUE,password TEXT,display_name TEXT,company_name TEXT DEFAULT '',address TEXT DEFAULT '',phone TEXT DEFAULT '',timesheet_url TEXT DEFAULT '',timesheet_view_url TEXT DEFAULT '',created_at TEXT DEFAULT '')`);
  await sql`INSERT INTO client_accounts(email,password,display_name) VALUES ('existing@example.invalid','test-secret','Existing client')`;
  await migrate();await migrate();
  assert.equal((await actions.authenticateClient('existing@example.invalid','test-secret')).clientCode,'');
  assert.deepEqual(await actions.addClientAccount('new@example.invalid','new-secret','New client','','','','  CL-1001  '),{success:true});
  const created=await actions.authenticateClient('new@example.invalid','new-secret');
  assert.equal(created.clientCode,'CL-1001');assert.equal(created.email,'new@example.invalid');assert.ok(!('password' in created));
  assert.equal(sessionId,created.id);
  assert.equal(await actions.authenticateClient('CL-1001','new-secret'),null);
  await actions.updateClientAccount(created.id,{clientCode:'CL-1002'});
  await actions.updateClientAccount(created.id,{companyName:'Updated company'});
  await actions.updateClientAccountByEmail('new@example.invalid',{displayName:'Updated name',clientCode:'FORGED'});
  let result=await actions.authenticateClient('new@example.invalid','new-secret');
  assert.equal(result.clientCode,'CL-1002');assert.equal(result.id,created.id);assert.equal(result.companyName,'Updated company');
  await assert.rejects(actions.updateClientAccount(created.id,{clientCode:'x'.repeat(65)}),/64 characters/);
  admin=false;await assert.rejects(actions.updateClientAccount(created.id,{clientCode:'FORGED'}),/Admin sign-in/);
  await assert.rejects(actions.addClientAccount('forged@example.invalid','test','Forged','','','','FORGED'),/Admin sign-in/);
  admin=true;await actions.updateClientAccount(created.id,{clientCode:''});
  result=await actions.authenticateClient('new@example.invalid','new-secret');assert.equal(result.clientCode,'');
 } finally {await connection(`DROP SCHEMA ${schema} CASCADE`);}
});
