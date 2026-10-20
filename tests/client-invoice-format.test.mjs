import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import { PDFDocument } from 'pdf-lib';
const runtimeRequire = createRequire(import.meta.url), cache = new Map();
function load(name) {
  if (cache.has(name)) return cache.get(name).exports;
  const mod = { exports: {} }; cache.set(name, mod);
  const code = ts.transpileModule(fs.readFileSync(`src/lib/${name}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  new Function('require','module','exports',code)(id => id.startsWith('./') ? load(id.slice(2)) : runtimeRequire(id), mod, mod.exports);
  return mod.exports;
}
const { invoiceItems, invoiceAmountCents, invoicePaymentLink } = load('client-invoice-format');
const { clientInvoicePdf } = load('client-invoice-pdf');
const item = (amount, title = 'Support', description = '') => ({ title, description, amount });
test('invoice totals use integer cents and ignore any independently supplied total', () => {
  assert.equal(invoiceItems([item('0.10'), item('0.20')]).amount, '$0.30');
  assert.equal(invoiceItems([item('$1,234.50'),item('2.5')]).amount, '$1,237.00');
  assert.equal(invoiceAmountCents('300'),30000);
  for (const value of ['-1','1e3','10.001','1,2','Infinity','NaN','','USD 3','<script>']) assert.throws(() => invoiceAmountCents(value));
  for (const items of [[],Array(51).fill(item('1')),[item('0')],[item('1','')],[item('1','Title','x'.repeat(3001))]]) assert.throws(() => invoiceItems(items));
});
test('payment links allow only HTTPS destinations without embedded credentials', () => {
  assert.equal(invoicePaymentLink(''), '');
  assert.equal(invoicePaymentLink('https://wise.com/pay/me/karlf283'),'https://wise.com/pay/me/karlf283');
  for (const url of ['javascript:alert(1)','http://example.test','https://u:pass@example.test','https://example.test/\nfoo']) assert.throws(() => invoicePaymentLink(url));
});
const example = { id:1,clientId:4,invoiceNumber:'TGC-MD-006',billCoverage:'August 2026',amount:'$300.00',invoiceDueDate:'August 31, 2026',status:'Pending',invoiceLink:'',invoiceLayout:'itemized',
  billToName:'Michael Danis',billToCompany:'Golden Age Assistance',paymentLink:'https://wise.com/pay/me/karlf283',
  lineItems:[item('300','Monthly GHL Support (August 3/3)','GHL Strategy Support and Account Assistance Service\nRate: $300 USD per month\nBilling Period: August 2026')] };
test('downloaded PDF includes selectable invoice content, correct totals and a clickable payment URL', async () => {
  const bytes = await clientInvoicePdf(example), pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(),1);assert.equal(pdf.getTitle(),'Invoice TGC-MD-006');
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gy-invoice-pdf-'));
  try {
    const file=path.join(dir,'invoice.pdf');fs.writeFileSync(file,bytes);
    const text=execFileSync('pdftotext',['-layout',file,'-'],{encoding:'utf8'});
    for (const expected of ['TGC-MD-006','Michael Danis','Golden Age Assistance','Monthly GHL Support','GHL Strategy Support','Rate: $300 USD','Billing Period: August 2026','GRAND TOTAL','$300.00','August 31, 2026','https://wise.com/pay/me/karlf283','karlheinrich.ferrera@gmail.com']) assert.ok(text.includes(expected),expected);
    assert.ok(pdf.getPages()[0].node.Annots()?.size()>0,'The PDF contains a link annotation');
    fs.writeFileSync('/tmp/gy-itemized-invoice-example.pdf',bytes);
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});
test('long invoices paginate without dropping items or Unicode text', async () => {
  const data={...example,invoiceNumber:'LONG-INVOICE',billToName:'André Muñoz – Client',lineItems:Array.from({length:14},(_,i)=>item('10',`Service item ${i+1}`,('Detailed service description and billing coverage.\n').repeat(28)))};
  const bytes=await clientInvoicePdf(data),pdf=await PDFDocument.load(bytes);assert.ok(pdf.getPageCount()>2);
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gy-invoice-long-'));
  try {
    const file=path.join(dir,'long.pdf');fs.writeFileSync(file,bytes);
    const text=execFileSync('pdftotext',['-layout',file,'-'],{encoding:'utf8'});
    assert.ok(text.includes('André Muñoz – Client'));assert.ok(text.includes('$140.00'));
    for(let i=1;i<=14;i++)assert.ok(text.includes(`Service item ${i}`));
    assert.ok(text.includes('Thank you for your business!'));
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});

test('a deliberate resend of a Paid invoice is a receipt instead of a request for another payment', () => {
  const { invoiceEmail }=load('email-templates');
  const email=invoiceEmail({kind:'invoice',invoiceNumber:'PAID-1',billCoverage:'October',amount:'$300',dueDate:'October 25',invoiceLink:'',clientEmail:'client@example.invalid',clientName:'Michael Danis',defaultPassword:false,isPaid:true},'https://portal.example.invalid');
  assert.equal(email.subject,'Client Invoice - Paid');assert.ok(email.body.includes('Hi Michael,'));assert.ok(email.body.includes('has been marked as paid'));
  assert.ok(!email.body.includes('complete your payment'));assert.ok(!email.body.includes('Password:'));
});
test('a Paid invoice PDF shows the payment status and omits payment instructions', async()=>{
  const bytes=await clientInvoicePdf({...example,status:'Paid'}),pdf=await PDFDocument.load(bytes);
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gy-invoice-paid-'));
  try{
    const file=path.join(dir,'paid.pdf');fs.writeFileSync(file,bytes);
    const text=execFileSync('pdftotext',['-layout',file,'-'],{encoding:'utf8'});
    assert.ok(text.includes('Status: Paid'));assert.ok(text.includes('Thank you for your payment.'));assert.ok(!text.includes('To pay your invoice'));assert.ok(!text.includes('https://wise.com'));
    assert.equal(pdf.getPages()[0].node.Annots()?.size()||0,0);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('an older non-itemized invoice can be viewed as a PDF without changing its original amount',async()=>{
 const bytes=await clientInvoicePdf({...example,invoiceLayout:'legacy',lineItems:[],amount:'$300 USD'}),pdf=await PDFDocument.load(bytes);
 assert.equal(pdf.getPageCount(),1);assert.ok(pdf.getPages()[0].node.Annots().size()>0);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gy-legacy-invoice-'));
 try{const file=path.join(dir,'legacy.pdf');fs.writeFileSync(file,bytes);const text=execFileSync('pdftotext',['-layout',file,'-'],{encoding:'utf8'});assert.ok(text.includes('$300 USD'));assert.ok(text.includes('Billed services'));}
 finally{fs.rmSync(dir,{recursive:true,force:true});}
});
