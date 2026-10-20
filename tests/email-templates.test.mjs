import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';
const runtimeRequire = createRequire(import.meta.url), cache = new Map();
function load(name) {
  const filename = path.resolve('src/lib',name+'.ts');
  if(cache.has(filename))return cache.get(filename).exports;
  const testModule={exports:{}};cache.set(filename,testModule);
  const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  new Function('require','module','exports',code)(id=>id.startsWith('./')?load(id.slice(2)):runtimeRequire(id),testModule,testModule.exports);
  return testModule.exports;
}
const templates=load('email-templates'), addresses=load('email-addresses');
const origin='https://portal.example';
const invoice={kind:'invoice',invoiceNumber:'INV-42',billCoverage:'October 1–15, 2026',amount:'$1,000.00',dueDate:'October 25, 2026',invoiceLink:'https://paypal.example/pay/42',clientEmail:'client@example.invalid',clientName:'Devin Rubin',defaultPassword:true,includesPayPalFees:true};
test('invoice email matches the requested subject, billing summary, payment link, access instructions, and signature',()=>{
  const result=templates.invoiceEmail(invoice,origin);
  assert.ok(result.body.startsWith('Hi Devin,\n\nWe hope'));
  assert.ok(result.html.includes('<p>Hi Devin,</p>'));
  assert.equal(result.subject,'INVOICE - October 1–15, 2026 : GY Virtual Support Team');
  for(const value of ['INV-42','October 1–15, 2026','$1,000.00','inclusive of PayPal transaction fees','October 25, 2026','https://paypal.example/pay/42','https://portal.example/client/dashboard','client@example.invalid','gyclient2026','Questions or Billing Concerns?','hello.graveyardcrewph@outlook.com'])assert.ok(result.body.includes(value),value);
  assert.ok(result.html.includes('<strong>Invoice Number:</strong>'));
  assert.ok(result.html.includes('View &amp; Pay Your Invoice'));
});
test('invoice greetings use the first name, escape HTML and handle legacy records without a name',()=>{
  const result=templates.invoiceEmail({...invoice,clientName:'  Daisy\t Martinez  '},origin);
  assert.ok(result.body.startsWith('Hi Daisy,'));assert.ok(!result.html.includes('Hi Daisy Martinez'));
  assert.ok(templates.invoiceEmail({...invoice,clientName:'<Devin> Rubin'},origin).html.includes('Hi &lt;Devin&gt;,'));
  assert.ok(templates.invoiceEmail({...invoice,clientName:undefined},origin).body.startsWith('Hi there,'));
});
test('changed passwords are never copied into emails and an absent invoice link opens portal invoices',()=>{
  const result=templates.invoiceEmail({...invoice,defaultPassword:false,invoiceLink:'javascript:alert(1)'},origin);
  assert.ok(!result.body.includes('gyclient2026'));
  assert.ok(result.body.includes('Use your current portal password'));
  assert.ok(result.html.includes('href="https://portal.example/client/dashboard/invoices"'));
});
test('notification emails omit missing/external redirects, preserve valid portal links, and place greeting images below the signature',()=>{
  const data={kind:'notification',title:'Birthday',message:'Have a wonderful day!',audience:'va',redirectTo:''};
  const absent=templates.notificationEmail(data,origin,'cid:notification-image');
  assert.ok(!absent.body.includes('Open your portal'));
  assert.ok(!absent.html.includes('/dashboard'));
  assert.ok(absent.html.indexOf('<img')>absent.html.indexOf('Best regards,'));
  for(const redirectTo of ['https://evil.example','//evil.example','/client/dashboard','/dashboard/../admin'])assert.ok(!templates.notificationEmail({...data,redirectTo},origin).body.includes('Open your portal'));
  assert.ok(templates.notificationEmail({...data,redirectTo:'/dashboard/requests'},origin).body.includes('https://portal.example/dashboard/requests'));
});
test('email HTML escapes user content while preserving readable text and line breaks',()=>{
  const result=templates.notificationEmail({kind:'notification',title:'<Birthday>',message:'<script>alert("x")</script>\nSecond line',audience:'client',redirectTo:''},origin);
  assert.ok(!result.html.includes('<script>'));assert.ok(result.html.includes('&lt;script&gt;'));assert.ok(result.html.includes('<br>Second line'));
  assert.ok(templates.manualEmail('<b>Message</b>').html.includes('&lt;b&gt;Message&lt;/b&gt;'));
});
test('recipient parsing deduplicates across To/CC/BCC without exposing BCC to CC',()=>{
  assert.deepEqual(addresses.emailRecipients([' CLIENT@EXAMPLE.INVALID '],['client@example.invalid','staff@example.invalid'],['staff@example.invalid','private@example.invalid']),{to:['client@example.invalid'],cc:['staff@example.invalid'],bcc:['private@example.invalid']});
  assert.deepEqual(addresses.parseEmailAddresses('a@example.invalid; b@example.invalid\nc@example.invalid'),['a@example.invalid','b@example.invalid','c@example.invalid']);
  assert.throws(()=>addresses.emailRecipients(['client@example.invalid'],['bad-address']));
  assert.throws(()=>addresses.emailRecipients(['client@example.invalid'],Array.from({length:20},(_,i)=>`${i}@example.invalid`)));
});

test('all other invoice emails, including future accounts without a fee flag, omit PayPal fee wording',()=>{
  for(const includesPayPalFees of [false,undefined]){
    const result=templates.invoiceEmail({...invoice,clientName:'Michael Danis',clientEmail:'michael@example.invalid',invoiceLink:'https://wise.com/pay/me/example',includesPayPalFees},origin);
    assert.ok(result.body.startsWith('Hi Michael,'));assert.ok(result.body.includes('Total Amount Due: $1,000.00\nPayment Due Date:'));
    assert.doesNotMatch(result.body,/paypal|transaction fees/i);assert.doesNotMatch(result.html,/paypal|transaction fees/i);
    assert.ok(result.html.includes('<strong>Total Amount Due:</strong>'));assert.ok(result.html.includes('$1,000.00'));
  }
});

test('non-Devin View & Pay buttons use the invoice PDF and Devin keeps the original link',()=>{
  const pdf=origin+'/api/client-invoices/view/12345678-1234-4123-8123-123456789abc';
  const other=templates.invoiceEmail({...invoice,clientName:'Michael Danis',includesPayPalFees:false,invoicePdfUrl:pdf},origin);
  assert.ok(other.body.includes('View & Pay Your Invoice: '+pdf));assert.ok(other.html.includes('href="'+pdf+'"'));assert.ok(!other.html.includes(invoice.invoiceLink));
  const devin=templates.invoiceEmail({...invoice,invoicePdfUrl:pdf},origin);
  assert.ok(devin.body.includes('View & Pay Your Invoice: '+invoice.invoiceLink));assert.ok(!devin.html.includes(pdf));
  for(const invoicePdfUrl of ['https://other.example/api/client-invoices/view/12345678-1234-4123-8123-123456789abc',origin+'/admin/dashboard',pdf+'?redirect=outside']){
    const email=templates.invoiceEmail({...invoice,includesPayPalFees:false,invoicePdfUrl},origin);assert.ok(!email.body.includes('View & Pay Your Invoice: '+invoicePdfUrl));
  }
});
