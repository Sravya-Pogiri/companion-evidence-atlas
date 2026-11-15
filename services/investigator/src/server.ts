import express from 'express';
import { timingSafeEqual } from 'node:crypto';
import { investigate } from './investigate.ts';
import { claimRequest, investigateClaim } from './claim.ts';
import { safeError } from './gateway-safety.ts';
import { modelConfig } from './provider.ts';
const app=express();app.use(express.json({limit:'16kb'}));
app.get('/health',(_req,res)=>{const cfg=modelConfig();const ready=!!cfg&&!!process.env['INVESTIGATOR_TOKEN'];res.status(ready?200:503).json({status:ready?'ready':'setup_required',sdk:'deepagents',provider:cfg?.provider??null,model:cfg?.model??null});});
app.post('/investigate',async(req,res)=>{
 const token=process.env['INVESTIGATOR_TOKEN'];const supplied=req.headers.authorization?.replace(/^Bearer /,'');
 if(!token||!supplied||Buffer.byteLength(token)!==Buffer.byteLength(supplied)||!timingSafeEqual(Buffer.from(token),Buffer.from(supplied))){res.status(401).json({error:'Investigator service authorization failed'});return;}
 res.setHeader('Content-Type','application/x-ndjson');res.setHeader('Cache-Control','no-store');res.flushHeaders();
 const controller=new AbortController();res.on('close',()=>{if(!res.writableEnded)controller.abort();});
 try{const result=await investigate(req.body.caseId,check=>res.write(JSON.stringify({type:'check',check})+'\n'),controller.signal);res.end(JSON.stringify({type:'result',result})+'\n');}catch(e){console.error('Investigation failed',e);res.end(JSON.stringify({type:'error',...safeError(e)})+'\n');}
});
// Test this claim: a Deep Agents investigation of a user's claim against a Lexora case.
// NDJSON stream: {type:"activity",event} lines as the agents work, then {type:"result",result}
// or {type:"error",message}.
app.post('/investigate-claim',async(req,res)=>{
 const token=process.env['INVESTIGATOR_TOKEN'];const supplied=req.headers.authorization?.replace(/^Bearer /,'');
 if(!token||!supplied||Buffer.byteLength(token)!==Buffer.byteLength(supplied)||!timingSafeEqual(Buffer.from(token),Buffer.from(supplied))){res.status(401).json({error:'Investigator service authorization failed'});return;}
 const parsed=claimRequest.safeParse(req.body);
 if(!parsed.success){res.status(400).json({error:parsed.error.issues.map(i=>i.message).join('; ')});return;}
 res.setHeader('Content-Type','application/x-ndjson');res.setHeader('Cache-Control','no-store');res.flushHeaders();
 const controller=new AbortController();res.on('close',()=>{if(!res.writableEnded)controller.abort();});
 try{const result=await investigateClaim(parsed.data,event=>res.write(JSON.stringify({type:'activity',event})+'\n'),controller.signal);res.end(JSON.stringify({type:'result',result})+'\n');}
 catch(e){console.error('Claim investigation failed',e);res.end(JSON.stringify({type:'error',message:e instanceof Error&&!/api[_-]?key/i.test(e.message)?e.message:safeError(e).message})+'\n');}
});
app.listen(Number(process.env['PORT']??8787),'0.0.0.0',()=>console.log('Lexora investigator listening'));
