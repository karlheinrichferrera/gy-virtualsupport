import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { neon } from '@neondatabase/serverless';
const runtimeRequire=createRequire(import.meta.url);

test('VA workflow notices and client invoice publication are atomic and recipient scoped', {skip:!process.env.POSTGRES_URL}, async t=>{
  const connection=neon(process.env.POSTGRES_URL,{fullResults:true});
  const schema=`workflow_test_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
  const query=async(text,values=[])=>{
    const results=await connection.transaction([connection("SELECT set_config('search_path',$1,true)",[schema]),connection(text,values)]);
    return results[1];
  };
  const sql=(strings,...values)=>query(strings.reduce((text,part,i)=>text+(i?`$${i}`:'')+part,''),values);
  sql.query=query;
  const identity={id:1,username:'test-admin',displayName:'Test Admin'};
  let admin=identity,va='va-1',client=null,wakes=0;
  const sessions=[];
  const cache=new Map();
  function load(name){
    const filename=path.resolve('src/lib',name+'.ts');if(cache.has(filename))return cache.get(filename).exports;
    const testModule={exports:{}};cache.set(filename,testModule);
    const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
    const require=id=>id==='@vercel/postgres'?{sql}:id==='./admin-session'?{
      getAdminSession:async()=>admin,requireAdminSession:async()=>{if(!admin)throw new Error('Admin sign-in required');return admin;},
    }:id==='./client-session'?{
      getClientSession:async()=>client,requireClientSession:async()=>{if(!client)throw new Error('Client sign-in required');return client;},
      createClientSession:async id=>{client={id,email:`client-${id}@example.invalid`,displayName:'Client'};},clearClientSession:async()=>{client=null;},invalidateClientSessions:async()=>{client=null;},
    }:id==='./va-session'?{
      requireVAOrAdmin:async id=>{if(admin)return admin;if(va!==id)throw new Error('VA sign-in required');return null;},
      createVASession:async id=>sessions.push(id),getVASession:async()=>va?{id:va}:null,
    }:id==='./outlook'?{getOutlookConnection:async()=>({connected:true,senderEmail:'hello.graveyardcrewph@outlook.com'}),sendOutlookMessage:async()=>{throw new Error('Real sending is disabled in tests');},OutlookSendError:class extends Error{}}:id==='./email-service'?{approveVAEmail:async()=>{}}:id==='./email-dispatch'?{wakeEmailDelivery:()=>{wakes++;}}:
      id==='./db'?{ensureTables:async()=>{}}:id.startsWith('./')?load(id.slice(2)):runtimeRequire(id);
    new Function('require','module','exports',code)(require,testModule,testModule.exports);return testModule.exports;
  }
  await connection(`CREATE SCHEMA ${schema}`);
  try{
    await sql`CREATE TABLE va_profiles(id TEXT PRIMARY KEY,email TEXT,password TEXT DEFAULT 'test-password',first_name TEXT DEFAULT 'Test',last_name TEXT DEFAULT 'VA')`;
    await sql`CREATE TABLE client_accounts(id INTEGER PRIMARY KEY,email TEXT,password TEXT DEFAULT 'gyclient2026',display_name TEXT DEFAULT 'Client',company_name TEXT DEFAULT '',address TEXT DEFAULT '',phone TEXT DEFAULT '',timesheet_url TEXT DEFAULT '',timesheet_view_url TEXT DEFAULT '',created_at TEXT DEFAULT '')`;
    await sql`CREATE TABLE notifications(id SERIAL PRIMARY KEY,va_id TEXT NOT NULL DEFAULT '',title TEXT NOT NULL,message TEXT NOT NULL DEFAULT '',type TEXT DEFAULT 'general',is_read BOOLEAN DEFAULT false,created_at TEXT DEFAULT '',created_by TEXT DEFAULT '')`;
    await sql`CREATE TABLE notification_reads(notification_id INTEGER REFERENCES notifications(id) ON DELETE CASCADE,va_id TEXT NOT NULL)`;
    await sql`CREATE TABLE leave_requests(request_id TEXT PRIMARY KEY,va_id TEXT REFERENCES va_profiles(id),type TEXT,date_submitted TEXT,date_from TEXT,date_to TEXT,reason TEXT,status TEXT,remarks TEXT)`;
    await sql`CREATE TABLE salary_adjustments(id SERIAL PRIMARY KEY,va_id TEXT REFERENCES va_profiles(id),effectivity_date TEXT,type TEXT,hourly_rate TEXT,sales_commission TEXT,referral_bonus TEXT,notes TEXT)`;
    await sql`CREATE TABLE timeproof_entries(id SERIAL PRIMARY KEY,va_id TEXT REFERENCES va_profiles(id),client_id INTEGER,punch_date TEXT,time_in TEXT,time_out TEXT,notes TEXT,created_at TEXT,entry_type TEXT,status TEXT,submission_key UUID UNIQUE)`;
    await sql`CREATE TABLE client_invoices(id SERIAL PRIMARY KEY,client_id INTEGER,invoice_number TEXT,bill_coverage TEXT,amount TEXT,invoice_due_date TEXT,status TEXT,invoice_link TEXT)`;
    await sql`CREATE TABLE invoices(id SERIAL PRIMARY KEY,va_id TEXT REFERENCES va_profiles(id),client_id INTEGER,invoice_number TEXT,date_covered TEXT,amount TEXT,transaction_fee TEXT,amount_disbursed TEXT,invoice_copy TEXT,status TEXT,submission_key UUID UNIQUE)`;
    await sql`INSERT INTO va_profiles(id,email) VALUES ('va-1','one@example.invalid'),('va-2','two@example.invalid')`;
    await sql`INSERT INTO client_accounts(id,email) VALUES (1,'client-one@example.invalid'),(2,'client-two@example.invalid'),(3,'devin@goldenyearsdesign.com')`;
    await sql`CREATE TABLE va_client_assignments(va_id TEXT REFERENCES va_profiles(id),client_id INTEGER REFERENCES client_accounts(id),PRIMARY KEY(va_id,client_id))`;
    await sql`INSERT INTO va_client_assignments VALUES ('va-1',1),('va-2',2)`;
    await load('request-approval-schema').ensureRequestApprovalSchema();
    await load('notification-schema').ensureNotificationSchema();
    await load('email-schema').ensureEmailSchema();
    await sql`CREATE TABLE outlook_connection(singleton BOOLEAN PRIMARY KEY DEFAULT true,connection_id UUID NOT NULL,encrypted_tokens TEXT)`;
    await sql`INSERT INTO outlook_connection VALUES(true,${randomUUID()}::uuid,'test-placeholder')`;
    const actions=load('actions'),notices=async()=> (await sql`SELECT * FROM notifications ORDER BY id`).rows;
    const request={id:'LR-1',type:'Leave',dateSubmitted:'October 18, 2026',dateFrom:'2026-10-20',dateTo:'2026-10-21',reason:'Test leave',status:'Pending',remarks:''};
    const reset=async()=>{await sql`TRUNCATE notifications,leave_requests,salary_adjustments,timeproof_entries,client_invoices,invoices,email_jobs RESTART IDENTITY CASCADE`;admin=identity;va='va-1';client=null;wakes=0;await sql`DELETE FROM va_client_assignments`;await sql`INSERT INTO va_client_assignments VALUES ('va-1',1),('va-2',2)`;};

    await t.test('additional recipients are optional per invoice, normalized, admin-only and limited to ten',async()=>{
      await reset();
      const invoice={clientId:3,invoiceNumber:'RECIPIENTS',billCoverage:'October 1–15',amount:'$100',invoiceDueDate:'2026-10-25',status:'Draft',invoiceLink:''};
      const ten=Array.from({length:10},(_,i)=>`Staff${i}@Example.invalid`);
      await actions.addClientInvoice({...invoice,additionalRecipients:ten.join(';\n')});
      await actions.addClientInvoice({...invoice,invoiceNumber:'SAME-CLIENT-NO-CC'});
      let all=await actions.getClientInvoices();const id=all.find(row=>row.invoiceNumber==='RECIPIENTS').id;
      assert.equal(all.find(row=>row.id===id).additionalRecipients,ten.map(email=>email.toLowerCase()).join(', '));
      assert.equal(all.find(row=>row.invoiceNumber==='SAME-CLIENT-NO-CC').additionalRecipients,'');
      assert.ok(!Object.hasOwn(await actions.getClientAccountByEmail('devin@goldenyearsdesign.com'),'invoiceCc'));
      await assert.rejects(actions.addClientInvoice({...invoice,additionalRecipients:[...ten,'extra@example.invalid'].join(',')}),/up to 10/);
      await assert.rejects(actions.addClientInvoice({...invoice,additionalRecipients:'invalid-address'}),/valid email/);
      await assert.rejects(actions.updateClientInvoice(id,{...invoice,additionalRecipients:[...ten,'extra@example.invalid'].join(',')}),/up to 10/);
      await actions.updateClientInvoice(id,{...invoice,additionalRecipients:' NEW@Example.invalid, new@example.invalid '});
      await load('email-schema').ensureEmailSchema();await load('email-schema').ensureEmailSchema();
      all=await actions.getClientInvoices();assert.equal(all.find(row=>row.id===id).additionalRecipients,'new@example.invalid');
      await actions.updateClientInvoice(id,invoice);assert.equal((await actions.getClientInvoices()).find(row=>row.id===id).additionalRecipients,'new@example.invalid');
      await actions.updateClientInvoice(id,{...invoice,clientId:2});assert.equal((await actions.getClientInvoices()).find(row=>row.id===id).additionalRecipients,'');
      admin=null;await assert.rejects(actions.addClientInvoice(invoice),/sign-in/);await assert.rejects(actions.updateClientInvoice(id,invoice),/sign-in/);await assert.rejects(actions.getClientInvoices(),/sign-in/);admin=identity;
    });
    await t.test('invoice list shows the actual queue status and failure reason without inventing delivery confirmation',async()=>{
      await reset();const statuses=['queued','sending','accepted','failed','uncertain','skipped','cancelled'];
      const invoice={clientId:1,invoiceNumber:'NO-MAIL',billCoverage:'October',amount:'$100',invoiceDueDate:'2026-10-25',status:'Pending',invoiceLink:''};
      await actions.addClientInvoice(invoice);
      for(const status of statuses){
        await actions.addClientInvoice({...invoice,invoiceNumber:status});
        const row=(await sql`SELECT id FROM client_invoices WHERE invoice_number=${status}`).rows[0];
        await sql`INSERT INTO email_jobs(idempotency_key,connection_id,to_emails,subject,body,source,source_id,status,last_error)
          VALUES (${'invoice:'+row.id},${randomUUID()}::uuid,'["client-one@example.invalid"]'::jsonb,'Invoice','Body','invoice',${row.id},${status},${status==='failed'?'Outlook rejected the message.':null})`;
      }
      const all=await actions.getClientInvoices();assert.equal(all.find(row=>row.invoiceNumber==='NO-MAIL').emailStatus,null);
      for(const status of statuses)assert.equal(all.find(row=>row.invoiceNumber===status).emailStatus,status);
      assert.equal(all.find(row=>row.invoiceNumber==='failed').emailError,'Outlook rejected the message.');
      const invoiceId=all.find(row=>row.invoiceNumber==='accepted').id;
      await sql`INSERT INTO email_jobs(idempotency_key,connection_id,to_emails,subject,body,source,source_id,status,is_resend)
        VALUES ('invoice-resend:test',${randomUUID()}::uuid,'["client-one@example.invalid"]'::jsonb,'Resent invoice','Body','invoice',${invoiceId},'queued',true)`;
      const updated=await actions.getClientInvoices();assert.equal(updated.length,all.length);
      assert.equal(updated.find(row=>row.id===invoiceId).emailStatus,'queued');
      await sql`UPDATE email_jobs SET status='accepted' WHERE idempotency_key='invoice-resend:test'`;
      await sql`UPDATE email_jobs SET status='queued' WHERE idempotency_key=${'invoice:'+invoiceId}`;
      assert.equal((await actions.getClientInvoices()).find(row=>row.id===invoiceId).emailStatus,'queued','An active retry remains visible even when a newer history entry was accepted');
    });
    await t.test('leave and shift receipts are private and retried submissions do not duplicate them',async()=>{
      await reset();admin=null;
      await Promise.all([actions.addRequest('va-1',request),actions.addRequest('va-1',request)]);
      await actions.addRequest('va-1',{...request,id:'LR-2',type:'Shift Adjustment'});
      assert.deepEqual((await notices()).filter(n=>n.audience==='va').map(n=>n.title).sort(),['Leave request received','Shift Adjustment request received']);
      assert.ok((await notices()).filter(n=>n.audience==='va').every(n=>n.va_id==='va-1'&&n.redirect_to==='/dashboard/requests'));
      assert.equal((await notices()).filter(n=>n.audience==='client'&&n.client_id===1).length,2);
      await assert.rejects(actions.addRequest('va-2',{...request,id:'LR-other'}),/sign-in/);
      await assert.rejects(actions.addRequest('va-1',{...request,reason:'Changed payload'}),/already in use/);
      assert.equal((await notices()).length,4);
    });
    await t.test('client and admin approvals are distinct and concurrent/repeated full approvals create one notice',async()=>{
      await reset();await actions.addRequest('va-1',request);admin=null;
      await assert.rejects(actions.updateRequestStatus(request.id,'Approved'),/sign-in/);
      assert.equal((await sql`SELECT status FROM leave_requests`).rows[0].status,'Pending');
      admin=identity;
      await Promise.all(Array.from({length:3},()=>actions.updateRequestStatus(request.id,'Approved','Enjoy your leave.')));
      assert.equal((await sql`SELECT status FROM leave_requests WHERE request_id=${request.id}`).rows[0].status,'Pending');
      assert.equal((await notices()).filter(n=>n.title==='Leave request approved').length,0);
      client={id:1,email:'client-one@example.invalid'};
      await Promise.all(Array.from({length:3},()=>actions.reviewClientRequest(request.id,'Approved')));
      const approval=(await notices()).filter(n=>n.title==='Leave request approved');
      assert.equal(approval.length,1);assert.ok(approval[0].message.includes('Enjoy your leave.'));
      await actions.addRequest('va-1',{...request,id:'SHIFT',type:'Shift Adjustment'});
      await actions.reviewClientRequest('SHIFT','Approved');
      assert.equal((await sql`SELECT status FROM leave_requests WHERE request_id='SHIFT'`).rows[0].status,'Pending');
      await actions.updateRequestStatus('SHIFT','Approved');
      assert.equal((await notices()).filter(n=>n.title==='Shift Adjustment request approved').length,1);
      admin=null;await assert.rejects(actions.updateRequestDetails('LR-1',{reason:'Changed after approval'}),/Only pending/);admin=identity;
    });
    await t.test('notification failure rolls back both a request submission and an approval',async()=>{
      await reset();await actions.addRequest('va-1',request);
      client={id:1,email:'client-one@example.invalid'};await actions.reviewClientRequest(request.id,'Approved');
      await sql`CREATE FUNCTION reject_notices() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'test notice failure'; END; $$ LANGUAGE plpgsql`;
      await sql`CREATE TRIGGER reject_notices BEFORE INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION reject_notices()`;
      try{
        await assert.rejects(actions.addRequest('va-1',{...request,id:'FAIL'}),/test notice failure/);
        assert.equal((await sql`SELECT * FROM leave_requests WHERE request_id='FAIL'`).rows.length,0);
        await assert.rejects(actions.addTimeproofEntry({vaId:'va-1',clientId:1,punchDate:'2026-10-18',timeIn:'15:00',timeOut:'17:00',notes:'Test',createdAt:'Today',entryType:'overtime',status:'pending',submissionKey:randomUUID()}),/test notice failure/);
        assert.equal((await sql`SELECT id FROM timeproof_entries`).rows.length,0);
        await assert.rejects(actions.updateRequestStatus(request.id,'Approved'),/test notice failure/);
        assert.equal((await sql`SELECT status FROM leave_requests WHERE request_id='LR-1'`).rows[0].status,'Pending');
      }finally{await sql`DROP TRIGGER reject_notices ON notifications`;}
    });
    await t.test('overtime receipts are idempotent and approvals notify once; rejection still works',async()=>{
      await reset();admin=null;
      const entry={vaId:'va-1',clientId:1,punchDate:'2026-10-18',timeIn:'15:10',timeOut:'17:10',notes:'Test overtime',createdAt:'Today',entryType:'overtime',status:'pending',submissionKey:randomUUID()};
      await Promise.all([actions.addTimeproofEntry(entry),actions.addTimeproofEntry(entry)]);
      assert.equal((await notices()).filter(n=>n.audience==='va').length,1);assert.equal((await notices()).find(n=>n.audience==='va').title,'Overtime request received');
      assert.equal((await notices()).filter(n=>n.audience==='client'&&n.client_id===1).length,1);
      const id=Number((await sql`SELECT id FROM timeproof_entries`).rows[0].id);
      await assert.rejects(actions.updateTimeproofEntryStatus(id,'approved'),/sign-in/);
      await assert.rejects(actions.addTimeproofEntry({...entry,submissionKey:randomUUID(),status:'approved'}),/submitted for approval/);
      admin=identity;await Promise.all([actions.updateTimeproofEntryStatus(id,'approved'),actions.updateTimeproofEntryStatus(id,'approved')]);
      assert.equal((await sql`SELECT status FROM timeproof_entries WHERE id=${id}`).rows[0].status,'pending');
      assert.equal((await notices()).filter(n=>n.title==='Overtime request approved').length,0);
      client={id:1,email:'client-one@example.invalid'};await Promise.all([actions.reviewClientOvertime(id,'Approved'),actions.reviewClientOvertime(id,'Approved')]);
      assert.equal((await notices()).filter(n=>n.title==='Overtime request approved').length,1);
      assert.ok((await notices()).some(n=>n.message.includes('15:00 to 17:00')));
      await actions.updateTimeproofEntryStatus(id,'rejected');
      assert.equal((await sql`SELECT status FROM timeproof_entries WHERE id=${id}`).rows[0].status,'rejected');
    });
    await t.test('clients can only review the selected client requests and cannot forge the admin decision',async()=>{
      await reset();await actions.addRequest('va-1',request);admin=null;va=null;
      await assert.rejects(actions.getClientRequests(),/sign-in/);
      await assert.rejects(actions.getClientNotifications('client-one@example.invalid'),/sign-in/);
      await assert.rejects(actions.reviewClientRequest(request.id,'Approved'),/sign-in/);
      client={id:2,email:'client-two@example.invalid'};
      assert.equal((await actions.getClientRequests()).length,0);
      await assert.rejects(actions.reviewClientRequest(request.id,'Approved'),/permission/);
      await assert.rejects(actions.updateClientRequestRemarks(request.id,'Wrong client'),/denied/);
      await assert.rejects(actions.updateRequestStatus(request.id,'Approved'),/sign-in/);
      await sql`INSERT INTO va_client_assignments VALUES ('va-1',2)`;
      assert.equal((await actions.getClientRequests()).length,0,'Assignment alone does not grant another selected client approval');
      await assert.rejects(actions.reviewClientRequest(request.id,'Approved'),/permission/);
      client={id:1,email:'client-one@example.invalid'};
      await assert.rejects(actions.getClientNotifications('client-two@example.invalid'),/does not match/);
      await assert.rejects(actions.markAllClientNotificationsRead('client-two@example.invalid'),/does not match/);
      assert.equal((await actions.getClientNotifications('client-one@example.invalid')).length,1);
      assert.equal((await actions.getClientRequests()).length,1);
      await actions.reviewClientRequest(request.id,'Approved','Client approved');
      let row=(await sql`SELECT * FROM leave_requests WHERE request_id=${request.id}`).rows[0];
      assert.equal(row.admin_approval,'Pending');assert.equal(row.client_approval,'Approved');assert.equal(row.status,'Pending');
      await assert.rejects(actions.getAllRequestsFlat(),/sign-in/);
      admin=identity;await actions.updateRequestStatus(request.id,'Denied','Admin denied');
      row=(await sql`SELECT * FROM leave_requests WHERE request_id=${request.id}`).rows[0];
      assert.equal(row.client_approval,'Approved');assert.equal(row.status,'Denied');
      assert.equal((await notices()).filter(n=>n.title==='Leave request approved').length,0);
      await actions.updateRequestStatus(request.id,'Pending');await actions.reviewClientRequest(request.id,'Pending');
      await Promise.all([actions.updateRequestStatus(request.id,'Approved'),actions.reviewClientRequest(request.id,'Approved')]);
      row=(await sql`SELECT * FROM leave_requests WHERE request_id=${request.id}`).rows[0];
      assert.equal(row.status,'Approved');assert.equal(row.client_approval,'Approved');assert.equal(row.admin_approval,'Approved');
      assert.equal((await notices()).filter(n=>n.title==='Leave request approved').length,1);
    });
    await t.test('multi-client selection is explicit and material edits invalidate both approvals',async()=>{
      await reset();await sql`INSERT INTO va_client_assignments VALUES ('va-1',2)`;
      await assert.rejects(actions.addRequest('va-1',request),/Select an assigned client/);
      await assert.rejects(actions.addRequest('va-1',{...request,clientId:3}),/Select an assigned client/);
      await actions.addRequest('va-1',{...request,clientId:2});
      client={id:2,email:'client-two@example.invalid'};await actions.reviewClientRequest(request.id,'Approved');
      admin=null;await assert.rejects(actions.updateRequestDetails(request.id,{reason:'Change approved content'}),/Only pending/);
      admin=identity;await actions.updateRequestStatus(request.id,'Approved');
      await actions.updateRequestDetails(request.id,{reason:'Revised request',clientId:1});
      const row=(await sql`SELECT * FROM leave_requests WHERE request_id=${request.id}`).rows[0];
      assert.equal(row.status,'Pending');assert.equal(row.client_approval,'Pending');assert.equal(row.admin_approval,'Pending');assert.equal(row.client_id,1);
      await assert.rejects(actions.reviewClientRequest(request.id,'Approved'),/permission/);
      client={id:1,email:'client-one@example.invalid'};await sql`DELETE FROM va_client_assignments WHERE va_id='va-1' AND client_id=1`;
      assert.equal((await actions.getClientRequests()).length,0);
      await assert.rejects(actions.reviewClientRequest(request.id,'Approved'),/permission/);
    });
    await t.test('overtime approvals enforce client ownership, reject either denial, and count hours only after both approve',async()=>{
      await reset();const entry={vaId:'va-1',clientId:1,punchDate:'2026-10-18',timeIn:'15:00',timeOut:'17:00',notes:'OT',createdAt:'Today',entryType:'overtime',status:'pending',submissionKey:randomUUID()};
      await actions.addTimeproofEntry(entry);const id=Number((await sql`SELECT id FROM timeproof_entries`).rows[0].id);
      client={id:2,email:'client-two@example.invalid'};assert.equal((await actions.getClientOvertimeRequests()).length,0);
      await assert.rejects(actions.reviewClientOvertime(id,'Approved'),/permission/);
      client={id:1,email:'client-one@example.invalid'};assert.equal((await actions.getClientOvertimeRequests()).length,1);
      await actions.reviewClientOvertime(id,'Denied');await actions.updateTimeproofEntryStatus(id,'approved');
      assert.equal((await sql`SELECT status FROM timeproof_entries WHERE id=${id}`).rows[0].status,'rejected');
      await actions.reviewClientOvertime(id,'Pending');
      assert.equal((await sql`SELECT status FROM timeproof_entries WHERE id=${id}`).rows[0].status,'pending');
      admin=null;await assert.rejects(actions.updateTimeproofEntry(id,{notes:'Change after one approval'}),/Reviewed overtime/);admin=identity;
      await actions.reviewClientOvertime(id,'Approved');
      assert.equal((await sql`SELECT status FROM timeproof_entries WHERE id=${id}`).rows[0].status,'approved');
      await actions.updateTimeproofEntry(id,{notes:'Revised overtime'});
      const row=(await sql`SELECT * FROM timeproof_entries WHERE id=${id}`).rows[0];
      assert.equal(row.status,'pending');assert.equal(row.admin_approval,'Pending');assert.equal(row.client_approval,'Pending');
      await actions.addTimeproofEntry({...entry,status:'approved',submissionKey:randomUUID()});
      const created=(await sql`SELECT * FROM timeproof_entries ORDER BY id DESC LIMIT 1`).rows[0];
      assert.equal(created.status,'pending');assert.equal(created.admin_approval,'Approved');assert.equal(created.client_approval,'Pending');
    });
    await t.test('all three request types privately notify only the selected client and queue one email each',async()=>{
      await reset();await sql`INSERT INTO va_client_assignments VALUES ('va-1',2)`;
      const service=load('email-service');await service.setEmailAutomation(false,true);
      await actions.addRequest('va-1',{...request,clientId:2});
      await actions.addRequest('va-1',{...request,id:'SHIFT-NOTICE',type:'Shift Adjustment',clientId:2});
      const entry={vaId:'va-1',clientId:2,punchDate:'2026-10-18',timeIn:'15:00',timeOut:'17:00',notes:'OT',createdAt:'Today',entryType:'overtime',status:'pending',submissionKey:randomUUID()};
      await Promise.all([actions.addTimeproofEntry(entry),actions.addTimeproofEntry(entry)]);
      const inbox=await load('notifications').recipientNotifications('client','2');
      assert.equal(inbox.length,3);assert.ok(inbox.every(n=>n.clientId===2&&n.redirectTo.startsWith('/client/dashboard/requests')));
      assert.deepEqual(inbox.map(n=>n.title).sort(),['Leave request awaiting your approval','Overtime request awaiting your approval','Shift Adjustment request awaiting your approval']);
      assert.equal((await load('notifications').recipientNotifications('client','1')).length,0);
      await service.queueAutomaticEmails();await service.queueAutomaticEmails();
      const mail=(await sql`SELECT j.* FROM email_jobs j JOIN notifications n ON j.source='notification' AND j.source_id=n.id WHERE n.audience='client'`).rows;
      assert.equal(mail.length,3);assert.ok(mail.every(j=>j.status==='queued'&&JSON.stringify(j.to_emails)==='["client-two@example.invalid"]'));
      assert.ok(mail.every(j=>j.template_data.redirectTo.startsWith('/client/dashboard/requests')&&j.template_data.audience==='client'));
      client={id:2,email:'client-two@example.invalid'};await actions.reviewClientRequest(request.id,'Approved');
      await actions.updateRequestStatus(request.id,'Approved');
      await actions.updateRequestDetails(request.id,{reason:request.reason,clientId:2});
      assert.equal((await sql`SELECT status FROM leave_requests WHERE request_id=${request.id}`).rows[0].status,'Approved','Saving unchanged details must preserve both approvals');
      await actions.updateRequestDetails(request.id,{reason:'Changed period context',clientId:1});
      assert.equal((await load('notifications').recipientNotifications('client','1')).length,1,'The new selected client is notified after a material edit');
      assert.equal((await sql`SELECT status FROM leave_requests WHERE request_id=${request.id}`).rows[0].status,'Pending');
    });
    await t.test('Devin request emails go only to Zanyette and Karl while other client and invoice routing stays intact',async()=>{
      await reset();await sql`INSERT INTO va_client_assignments VALUES ('va-1',3)`;
      await load('email-schema').ensureEmailSchema();
      const service=load('email-service');await service.setEmailAutomation(true,true);
      await Promise.all([actions.addRequest('va-1',{...request,id:'DEVIN-LEAVE',clientId:3}),actions.addRequest('va-1',{...request,id:'DEVIN-LEAVE',clientId:3})]);
      await actions.addRequest('va-1',{...request,id:'DEVIN-SHIFT',type:'Shift Adjustment',clientId:3});
      const entry={vaId:'va-1',clientId:3,punchDate:'2026-10-18',timeIn:'15:00',timeOut:'17:00',notes:'Client review',createdAt:'Today',entryType:'overtime',status:'pending',submissionKey:randomUUID()};
      await Promise.all([actions.addTimeproofEntry(entry),actions.addTimeproofEntry(entry)]);
      const inbox=await load('notifications').recipientNotifications('client','3');assert.equal(inbox.length,3,'Portal notifications remain attached to the selected client account');
      await service.queueAutomaticEmails();await service.queueAutomaticEmails();
      const jobs=async()=> (await sql`SELECT j.* FROM email_jobs j JOIN notifications n ON j.source='notification' AND j.source_id=n.id WHERE n.audience='client' AND n.type='request' AND n.client_id=3 ORDER BY j.id`).rows;
      const mail=await jobs();assert.equal(mail.length,6);
      const addresses=['karl@goldenyearsdesign.com','zanyette@goldenyearsdesign.com'];
      for(const notification of inbox){
        const copies=mail.filter(j=>j.source_id===notification.id);
        assert.deepEqual(copies.flatMap(j=>j.to_emails).sort(),addresses);
        assert.ok(copies.every(j=>j.to_emails.length===1&&j.cc_emails.length===0&&j.bcc_emails.length===0));
      }
      assert.ok(mail.every(j=>!j.to_emails.includes('devin@goldenyearsdesign.com')));
      await actions.updateRequestDetails('DEVIN-LEAVE',{reason:'Updated client request',clientId:3});
      await actions.addRequest('va-1',{...request,id:'OTHER-CLIENT',clientId:1});
      await sql`INSERT INTO notifications(audience,client_id,title,message,type,published_at) VALUES ('client',3,'General client notice','Normal notification','admin',NOW())`;
      await actions.addClientInvoice({clientId:3,invoiceNumber:'DEVIN-INVOICE',billCoverage:'October',amount:'$100',invoiceDueDate:'2026-10-25',status:'Pending',invoiceLink:''});
      await service.queueAutomaticEmails();await service.queueAutomaticEmails();
      assert.equal((await jobs()).length,8,'An edited request also routes one copy to each delegate');
      const other=(await sql`SELECT j.to_emails FROM email_jobs j JOIN notifications n ON j.source='notification' AND j.source_id=n.id WHERE n.audience='client' AND n.client_id=1 AND n.type='request'`).rows;
      assert.deepEqual(other.map(j=>j.to_emails),[['client-one@example.invalid']]);
      const general=(await sql`SELECT j.to_emails FROM email_jobs j JOIN notifications n ON j.source='notification' AND j.source_id=n.id WHERE n.title='General client notice'`).rows;
      assert.deepEqual(general.map(j=>j.to_emails),[['devin@goldenyearsdesign.com']]);
      const invoices=(await sql`SELECT to_emails FROM email_jobs WHERE source='invoice'`).rows;
      assert.deepEqual(invoices.map(j=>j.to_emails),[['devin@goldenyearsdesign.com']]);
    });
    await t.test('approval migration preserves completed history, upgrades pending rows and is repeatable',async()=>{
      await reset();await sql`INSERT INTO leave_requests(request_id,va_id,type,status,remarks) VALUES ('OLD-DONE','va-1','Leave','Approved','Prior approval'),('OLD-PENDING','va-1','Leave','Pending','')`;
      await load('request-approval-schema').ensureRequestApprovalSchema();await load('request-approval-schema').ensureRequestApprovalSchema();
      const rows=(await sql`SELECT * FROM leave_requests ORDER BY request_id`).rows;
      assert.equal(rows[0].status,'Approved');assert.equal(rows[0].requires_dual_approval,false);assert.equal(rows[0].admin_approval,'Approved');
      assert.equal(rows[1].requires_dual_approval,true);assert.equal(rows[1].client_id,1);
      client={id:1,email:'client-one@example.invalid'};await actions.reviewClientRequest('OLD-PENDING','Approved');
      await load('request-approval-schema').ensureRequestApprovalSchema();
      assert.equal((await sql`SELECT client_approval FROM leave_requests WHERE request_id='OLD-PENDING'`).rows[0].client_approval,'Approved');
    });
    await t.test('new salary adjustments require an admin and notify only the affected VA',async()=>{
      await reset();const adjustment={effectivityDate:'October 20, 2026',type:'INCREASE',hourlyRate:'$8.00',salesCommission:'5%',referralBonus:'$50',notes:'Performance review'};
      admin=null;await assert.rejects(actions.addAdjustment('va-1',adjustment),/sign-in/);
      admin=identity;await actions.addAdjustment('va-1',adjustment);
      const rows=await notices();assert.equal(rows.length,1);assert.equal(rows[0].title,'New salary adjustment');assert.equal(rows[0].va_id,'va-1');
      assert.ok(rows[0].message.includes('$8.00'));assert.equal(rows[0].redirect_to,'/dashboard/adjustments');
      assert.equal((await load('notifications').recipientNotifications('va','va-2')).length,0);
    });
    await t.test('draft invoices remain private until published, and publication pushes are not duplicated',async()=>{
      await reset();const invoice={clientId:1,invoiceNumber:'CI-1',billCoverage:'October 1–15',amount:'$100',invoiceDueDate:'2026-10-25',status:'Draft',invoiceLink:''};
      await actions.addClientInvoice(invoice);assert.equal((await notices()).length,0);
      assert.equal((await actions.getClientInvoicesByEmail('client-one@example.invalid')).length,0);
      const id=Number((await sql`SELECT id FROM client_invoices`).rows[0].id);
      await Promise.all([actions.updateClientInvoice(id,{...invoice,status:'Pending'}),actions.updateClientInvoice(id,{...invoice,status:'Pending'})]);
      const rows=await notices();assert.equal(rows.length,1);assert.equal(rows[0].audience,'client');assert.equal(rows[0].client_id,1);assert.equal(rows[0].type,'invoice');
      await actions.addClientInvoice({...invoice,clientId:2,invoiceNumber:'OTHER',status:'Pending'});
      await actions.addClientInvoice({...invoice,invoiceNumber:'ANOTHER-DRAFT',status:' Draft '});
      assert.deepEqual((await actions.getClientInvoicesByEmail('client-one@example.invalid')).map(i=>i.invoiceNumber),['CI-1']);
      assert.equal((await actions.getClientInvoicesByEmail('client-two@example.invalid')).length,1);
      await actions.updateClientInvoice(id,{...invoice,status:'Draft'});await actions.updateClientInvoice(id,{...invoice,status:'Pending'});
      assert.equal((await notices()).filter(n=>n.client_id===1).length,1);
    });
    const invoice={invoiceNumber:'VA-1001',clientId:1,dateCovered:'October 1–15, 2026',amount:'$100.00',transactionFee:'$1.00',amountDisbursed:'$99.00',invoiceCopy:'',status:'Pending'};
    await t.test('VA invoice acknowledgements are private, atomic and idempotent on submission retries',async()=>{
      await reset();admin=null;const key=randomUUID();
      await Promise.all([actions.addInvoice('va-1',invoice,key),actions.addInvoice('va-1',invoice,key)]);
      assert.equal((await sql`SELECT * FROM invoices`).rows.length,1);
      const rows=await notices();assert.equal(rows.length,1);assert.equal(rows[0].title,'VA Invoice - Acknowledgement');
      assert.equal(rows[0].va_id,'va-1');assert.equal(rows[0].audience,'va');assert.equal(rows[0].type,'payment');assert.equal(rows[0].redirect_to,'/dashboard/invoices');
      assert.ok(rows[0].message.includes('VA-1001'));assert.ok(rows[0].message.includes('$100.00'));
      await assert.rejects(actions.addInvoice('va-2',invoice,randomUUID()),/sign-in/);
      await assert.rejects(actions.addInvoice('va-1',{...invoice,status:'Paid'},randomUUID()),/Pending or Draft/);
      await assert.rejects(actions.addInvoice('va-1',{...invoice,amount:'$500.00'},key),/already used/);
      await assert.rejects(actions.getInvoicesFor('va-2'),/sign-in/);
      await actions.updateInvoice(invoice.invoiceNumber,{amount:'$101.00'});assert.equal((await notices()).length,1);
      await actions.addInvoice('va-1',{...invoice,invoiceNumber:'VA-DRAFT',status:'Draft'},randomUUID());assert.equal((await notices()).length,1);
    });
    await t.test('both admin payment paths notify the owning VA once despite concurrent and repeated Paid saves',async()=>{
      await reset();admin=null;await actions.addInvoice('va-1',invoice,randomUUID());
      await assert.rejects(actions.updateInvoiceStatus(invoice.invoiceNumber,'Paid'),/sign-in/);
      await assert.rejects(actions.updateInvoice(invoice.invoiceNumber,{status:'Paid'}),/administrator/);
      va='va-2';await assert.rejects(actions.updateInvoice(invoice.invoiceNumber,{amount:'$1.00'}),/sign-in/);
      admin=identity;await Promise.all([actions.updateInvoiceStatus(invoice.invoiceNumber,'Paid'),actions.updateInvoice(invoice.invoiceNumber,{status:'Paid'}),actions.updateInvoiceStatus(invoice.invoiceNumber,'Paid')]);
      await actions.updateInvoice(invoice.invoiceNumber,{amountDisbursed:'$98.00',status:'Paid'});
      const paid=(await notices()).filter(n=>n.title==='VA Invoice - Paid');assert.equal(paid.length,1);assert.equal(paid[0].va_id,'va-1');assert.ok(paid[0].message.includes('$99.00'));
      assert.equal((await load('notifications').recipientNotifications('va','va-2')).length,0);
      admin=null;va='va-1';await assert.rejects(actions.updateInvoice(invoice.invoiceNumber,{amount:'$1.00'}),/Paid invoices/);
      admin=identity;await actions.addInvoice('va-1',{...invoice,invoiceNumber:'VA-EDIT-PATH'},randomUUID());
      await actions.updateInvoice('VA-EDIT-PATH',{status:'Paid',amountDisbursed:'$97.00'});
      assert.ok((await notices()).find(n=>n.title==='VA Invoice - Paid'&&n.message.includes('VA-EDIT-PATH')).message.includes('$97.00'));
    });
    await t.test('failed invoice notices roll back the submission or Paid status rather than silently losing a notice',async()=>{
      await reset();await actions.addInvoice('va-1',invoice,randomUUID());
      await sql`CREATE TRIGGER reject_notices BEFORE INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION reject_notices()`;
      try{
        await assert.rejects(actions.addInvoice('va-1',{...invoice,invoiceNumber:'VA-FAIL'},randomUUID()),/test notice failure/);
        assert.equal((await sql`SELECT * FROM invoices WHERE invoice_number='VA-FAIL'`).rows.length,0);
        await assert.rejects(actions.updateInvoiceStatus(invoice.invoiceNumber,'Paid'),/test notice failure/);
        assert.equal((await sql`SELECT status FROM invoices WHERE invoice_number=${invoice.invoiceNumber}`).rows[0].status,'Pending');
      }finally{await sql`DROP TRIGGER reject_notices ON notifications`;}
    });
    await t.test('profile reads never expose stored passwords and VA authentication is checked on the server',async()=>{
      const profile=await actions.getProfile('va-1');assert.equal(profile.password,'');
      assert.ok((await actions.getProfiles()).every(profile=>profile.password===''));
      assert.equal(await actions.authenticateVA('va-1','wrong-password'),null);
      assert.deepEqual(await actions.authenticateVA('va-1','test-password'),{id:'va-1'});
      assert.deepEqual(sessions,['va-1']);assert.ok(wakes>0);
    });
  }finally{await connection(`DROP SCHEMA ${schema} CASCADE`);}
});
