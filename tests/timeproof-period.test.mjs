import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { execFileSync } from 'node:child_process';
const source = fs.readFileSync('src/lib/timeproof-period.ts', 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
for (const tz of ['UTC', 'America/New_York', 'Asia/Manila']) {
  test(`weekly and biweekly dates survive timezone and DST boundaries in ${tz}`, () => {
    const script = `const exports={}; ${code}; const assert=require('node:assert/strict');
      for(const [day,weekly,biweekly] of [['2026-10-18','2026-10-12','2026-10-05'],['2026-10-19','2026-10-19','2026-10-19'],['2026-11-02','2026-11-02','2026-11-02'],['2026-09-28','2026-09-28','2026-09-21']]) {
        const d=new Date(day+'T00:00:00'); assert.equal(dateKey(d),day); assert.equal(dateKey(periodStart(d,7)),weekly); assert.equal(dateKey(periodStart(d,14)),biweekly);
        const start=periodStart(d,14), dates=[];for(let i=0;i<14;i++){const x=new Date(start);x.setDate(x.getDate()+i); dates.push(dateKey(x));}assert.equal(new Set(dates).size,14);
      }`;
    execFileSync(process.execPath, ['-e', script], { env: { ...process.env, TZ: tz } });
  });
}
test('old portal sessions cannot auto-create punches for Karl or another VA', async () => {
  const source = fs.readFileSync('src/lib/actions.ts', 'utf8');
  const ast = ts.createSourceFile('actions.ts', source, ts.ScriptTarget.Latest, true);
  const action = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'autoFillScheduleTimeproof');
  const code = ts.transpileModule(action.getText(ast), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const mod = { exports: {} }; new Function('exports', code)(mod.exports);
  for (const id of ['500101','500102','']) assert.deepEqual(await mod.exports.autoFillScheduleTimeproof(id), { filled:false,count:0 });
});
