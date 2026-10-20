import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { PDFDocument } from 'pdf-lib';
const runtimeRequire=createRequire(import.meta.url),cache=new Map();
const token='12345678-1234-4123-8123-123456789abc';
const invoice={id:1,clientId:4,invoiceNumber:'MD-006',billCoverage:'August 2026',amount:'$300.00',invoiceDueDate:'August 31, 2026',status:'Pending',invoiceLink:'',invoiceLayout:'itemized',billToName:'Michael Danis',billToCompany:'Golden Age Assistance',paymentLink:'https://wise.com/pay/me/karlf283',lineItems:[{title:'Monthly GHL Support',description:'Strategy and account assistance',amount:'300.00'}]};
let simulateFailure=false;
function load(filename){
 const full=path.resolve(filename);if(cache.has(full))return cache.get(full).exports;
 const mod={exports:{}};cache.set(full,mod);
 const code=ts.transpileModule(fs.readFileSync(full,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;
 const require=id=>id==='@/lib/client-invoice-email-link'?{emailedClientInvoice:async value=>{if(simulateFailure)throw Error('Private provider detail');return value===token?invoice:null;}}
   :id.startsWith('@/lib/')?load('src/lib/'+id.slice(6)+'.ts'):id.startsWith('./')?load(path.resolve(path.dirname(full),id+'.ts')):runtimeRequire(id);
 new Function('require','module','exports',code)(require,mod,mod.exports);return mod.exports;
}
const {GET}=load('src/app/api/client-invoices/view/[token]/route.ts');
test('an emailed invoice link serves an inline PDF with its payment link and no portal sign-in',async()=>{
 const request=new Request('https://portal.example/api/client-invoices/view/'+token);assert.equal(request.headers.get('cookie'),null);
 const response=await GET(request,{params:Promise.resolve({token})});
 assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'application/pdf');assert.equal(response.headers.get('content-disposition'),'inline; filename="MD-006.pdf"');
 for(const [key,value] of [['cache-control','private, no-store'],['referrer-policy','no-referrer'],['x-content-type-options','nosniff'],['x-robots-tag','noindex, nofollow, noarchive']])assert.equal(response.headers.get(key),value);
 const bytes=Buffer.from(await response.arrayBuffer());assert.equal(bytes.subarray(0,4).toString(),'%PDF');
 const pdf=await PDFDocument.load(bytes);assert.equal(pdf.getTitle(),'Invoice MD-006');assert.ok(pdf.getPages()[0].node.Annots().size()>0,'The payment URL is clickable');
});
test('unknown invoice links return a generic non-cacheable 404',async()=>{
 const response=await GET(new Request('https://portal.example/'),{params:Promise.resolve({token:'not-a-token'})});
 assert.equal(response.status,404);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.ok(!(await response.text()).includes('Michael'));
});
test('PDF failures never expose invoice data or internal error details',async()=>{
 simulateFailure=true;
 try{const response=await GET(new Request('https://portal.example/'),{params:Promise.resolve({token})});assert.equal(response.status,500);assert.ok(!(await response.text()).includes('Private provider detail'));}
 finally{simulateFailure=false;}
});
