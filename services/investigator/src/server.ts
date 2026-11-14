import express from 'express';
import { timingSafeEqual } from 'node:crypto';
import { investigate } from './investigate.ts';
import { safeError } from './gateway-safety.ts';
const app=express();app.use(express.json({limit:'16kb'}));
app.get('/health',(_req,res)=>res.status(process.env['LOVABLE_API_KEY']&&process.env['INVESTIGATOR_TOKEN']?200:503).json({status:process.env['LOVABLE_API_KEY']&&process.env['INVESTIGATOR_TOKEN']?'ready':'setup_required',sdk:'deepagents',model:'openai/gpt-6-astra'}));
app.post('/investigate',async(req,res)=>{
 const token=process.env['INVESTIGATOR_TOKEN'];const supplied=req.headers.authorization?.replace(/^Bearer /,'');
 if(!token||!supplied||Buffer.byteLength(token)!==Buffer.byteLength(supplied)||!timingSafeEqual(Buffer.from(token),Buffer.from(supplied))){res.status(401).json({error:'Investigator service authorization failed'});return;}
 res.setHeader('Content-Type','application/x-ndjson');res.setHeader('Cache-Control','no-store');res.flushHeaders();
 const controller=new AbortController();res.on('close',()=>{if(!res.writableEnded)controller.abort();});
 try{const result=await investigate(req.body.caseId,check=>res.write(JSON.stringify({type:'check',check})+'\n'),controller.signal);res.end(JSON.stringify({type:'result',result})+'\n');}catch(e){console.error('Investigation failed',e);res.end(JSON.stringify({type:'error',...safeError(e)})+'\n');}
});
app.listen(Number(process.env['PORT']??8787),'0.0.0.0',()=>console.log('CaseLens investigator listening'));
