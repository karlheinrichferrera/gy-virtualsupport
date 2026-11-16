import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {neon} from '@neondatabase/serverless';

test('database blocks retired Karl schedule punches from older deployments but preserves manual punches and other VAs', {skip:!process.env.POSTGRES_URL},async()=>{
 const connection=neon(process.env.POSTGRES_URL,{fullResults:true});const schema=`timeproof_automation_test_${Date.now()}`;
 const sql=async(strings,...values)=>{const text=strings.reduce((text,part,i)=>text+(i?`$${i}`:'')+part,'');return (await connection.transaction([connection("SELECT set_config('search_path',$1,true)",[schema]),connection(text,values)]))[1];};
 const mod={exports:{}};const code=ts.transpileModule(fs.readFileSync('src/lib/timeproof-automation-schema.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 new Function('require','exports',code)(()=>({sql}),mod.exports);
 await connection(`CREATE SCHEMA ${schema}`);
 try{
  await sql`CREATE TABLE timeproof_entries(id SERIAL PRIMARY KEY,va_id TEXT,notes TEXT,time_in TEXT,time_out TEXT)`;
  await mod.exports.ensureTimeproofAutomationSchema();await mod.exports.ensureTimeproofAutomationSchema();
  assert.equal((await sql`INSERT INTO timeproof_entries(va_id,notes,time_in,time_out) VALUES ('500101','Auto-filled from schedule','09:00','17:00') RETURNING id`).rows.length,0);
  assert.equal((await sql`INSERT INTO timeproof_entries(va_id,notes,time_in,time_out) VALUES ('500101','','09:00','') RETURNING id`).rows.length,1);
  await sql`UPDATE timeproof_entries SET time_out='17:00' WHERE va_id='500101'`;
  assert.equal((await sql`SELECT time_out FROM timeproof_entries WHERE va_id='500101'`).rows[0].time_out,'17:00');
  assert.equal((await sql`INSERT INTO timeproof_entries(va_id,notes,time_in,time_out) VALUES ('500102','Auto-filled from schedule','09:00','17:00') RETURNING id`).rows.length,1);
  assert.equal((await sql`SELECT count(*)::int AS count FROM timeproof_entries`).rows[0].count,2);
 }finally{await connection(`DROP SCHEMA ${schema} CASCADE`);}
});
