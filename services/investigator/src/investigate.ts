import { createDeepAgent } from 'deepagents';
import { ChatOpenAI } from '@langchain/openai';
import { tool } from '@langchain/core/tools';
import { createMiddleware } from 'langchain';
import { z } from 'zod';
import { PDFParse } from 'pdf-parse';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { createResponsesCall } from './responses.ts';
import { createLovableAiGatewayRunIdFetch } from './run-id.ts';
import { checkGatewayPause, safeGatewayFetch, safeError } from './gateway-safety.ts';
import { modelConfig } from './provider.ts';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
const exec = promisify(execFile);
export const caseIds = ['conflicting','matching','incomplete'] as const;
const reference = z.object({sourceId:z.enum(['report','video','transcript','dispatch']),page:z.number().nullable(),start:z.number().nullable(),end:z.number().nullable(),rowId:z.string().nullable()}).strict();
export const resultSchema = z.object({outcome:z.enum(['Possible discrepancy','Records agree on this claim','Insufficient evidence']),explanation:z.string(),gaps:z.array(z.string()),citations:z.array(reference)}).strict();
export type Check = {tool:string;status:'completed'|'failed';result:string;references:z.infer<typeof reference>[]};
const root = resolve(import.meta.dirname,'../fixtures');
export async function investigate(caseId:string,emit:(check:Check)=>void = ()=>{},signal?:AbortSignal) {
 if(!caseIds.includes(caseId as typeof caseIds[number]))throw new Error('Unknown synthetic case');
 const cfg=modelConfig(); if(!cfg)throw new Error('Setup error: set GEMINI_API_KEY (or LOVABLE_API_KEY) in the investigator service.'); const key=cfg.apiKey;
 await checkGatewayPause();
 const dir=resolve(root,caseId);const manifest=JSON.parse(await readFile(resolve(dir,'manifest.json'),'utf8'));
 const checks:Check[]=[];const gateway=createLovableAiGatewayRunIdFetch();
 const model=cfg.provider==='gemini'
  ? new ChatOpenAI({model:cfg.model,apiKey:key,maxRetries:0,configuration:{baseURL:cfg.baseURL,fetch:safeGatewayFetch(fetch)}})
  : new ChatOpenAI({model:'openai/gpt-6-astra',apiKey:key,useResponsesApi:true,streaming:true,zdrEnabled:true,reasoning:{effort:'low',summary:'auto'},include:['reasoning.encrypted_content'],maxRetries:0,configuration:{baseURL:'https://ai.gateway.lovable.dev/v1',defaultHeaders:{'Lovable-API-Key':key,'X-Lovable-AIG-SDK':'langchain'},fetch:safeGatewayFetch(gateway.fetch)}});
 const ref=(sourceId:'report'|'video'|'transcript'|'dispatch',values:Partial<z.infer<typeof reference>>={})=>({sourceId,page:null,start:null,end:null,rowId:null,...values});
 const completed=async(name:string,operation:()=>Promise<{result:unknown;references:z.infer<typeof reference>[]}>)=>{try{const output=await operation();const check:Check={tool:name,status:'completed',result:typeof output.result==='string'?output.result:JSON.stringify(output.result),references:output.references};checks.push(check);emit(check);return output;}catch(e){const check:Check={tool:name,status:'failed',result:safeError(e).message,references:[]};checks.push(check);emit(check);throw e;}};
 const tools=[
 tool(async({page})=>completed('Read report page '+page,async()=>{const parser=new PDFParse({data:await readFile(resolve(dir,'report.pdf'))});try{const text=await parser.getText({partial:[page]});if(!text.text.trim())throw new Error('Report page unavailable');return {result:text.text,references:[ref('report',{page})]};}finally{await parser.destroy();}}),{name:'read_report_claim',description:'Read the original synthetic PDF page. The sequence claim is on page 3.',schema:z.object({page:z.number().int().min(1).max(3)}).strict()}),
 tool(async({query,before})=>completed('Searched earlier transcript',async()=>{const segments=JSON.parse(await readFile(resolve(dir,'transcript.json'),'utf8'));const found=segments.filter((s:{start:number;text:string})=>s.start<before&&s.text.toLowerCase().includes(query.toLowerCase()));return {result:{query,before,segments:found,coverage:manifest.coverage},references:found.map((s:{start:number;end:number})=>ref('transcript',{start:s.start,end:s.end}))};}),{name:'search_transcript',description:'Search actual timestamped transcript segments, including earlier requests. Use query trunk to locate all candidate requests. A later request alone cannot exclude an earlier request.',schema:z.object({query:z.string(),before:z.number()}).strict()}),
 tool(async({start,end})=>completed('Checked recording coverage',async()=>({result:{requested:{start,end},available:manifest.coverage,covered:start>=manifest.coverage.start&&end<=manifest.coverage.end},references:[ref('video',{start:manifest.coverage.start,end:manifest.coverage.end})]})),{name:'check_recording_coverage',description:'Check manifest coverage before inspecting a required interval. Missing lead-up must yield insufficient evidence.',schema:z.object({start:z.number(),end:z.number()}).strict()}),
 tool(async({start,end})=>completed(start<10?'Checked video lead-up':'Checked video window',async()=>{
  if(start<manifest.coverage.start||end>manifest.coverage.end||end<=start)throw new Error('Requested video interval is not available');
  const frames=[];for(const time of [start,(start+end)/2,Math.max(start,end-.2)]){const {stdout}=await exec('ffmpeg',['-loglevel','error','-ss',String(time-manifest.coverage.start),'-i',resolve(dir,'bodycam.mp4'),'-frames:v','1','-f','image2pipe','-vcodec','mjpeg','-'],{encoding:'buffer',maxBuffer:5*1024*1024});frames.push({time,image:stdout});}
  const visionPrompt=`Inspect only these sampled frames from the ORIGINAL synthetic clip at absolute seconds ${frames.map(f=>f.time).join(', ')}. Describe whether the rear trunk lid is closed or open in each frame. Do not infer speech, requests, consent, or unseen events. Concise factual observations only.`;
  if(cfg.provider==='gemini'){const gem=createOpenAI({baseURL:cfg.baseURL,apiKey:key,fetch:safeGatewayFetch(fetch)});const {text}=await generateText({model:gem.chat(cfg.model),maxRetries:0,...(signal?{abortSignal:signal}:{}),messages:[{role:'user',content:[{type:'text',text:visionPrompt},...frames.map(f=>({type:'image' as const,image:f.image}))]}]});if(!text.trim())throw new Error('Vision model returned no observation');return {result:{window:{start,end},sampledAt:frames.map(f=>f.time),observation:text},references:[ref('video',{start,end})]};}
  const req=new Request('http://internal/vision',{...(signal?{signal}:{}),headers:gateway.getRunId()?{'X-Lovable-AIG-Run-ID':gateway.getRunId() as string}:{}});
  const {result}=createResponsesCall(req,{baseURL:'https://ai.gateway.lovable.dev/v1',apiKey:key,model:'openai/gpt-6-astra'},[{role:'user',content:[{type:'text',text:`Inspect only these sampled frames from the ORIGINAL synthetic clip at absolute seconds ${frames.map(f=>f.time).join(', ')}. Describe whether the rear trunk lid is closed or open in each frame. Do not infer speech, requests, consent, or unseen events. Concise factual observations only.`},...frames.map(f=>({type:'image' as const,image:f.image}))]}]);
  const observed=await result.text;if(!observed.trim())throw new Error('Vision model returned no observation');return {result:{window:{start,end},sampledAt:frames.map(f=>f.time),observation:observed},references:[ref('video',{start,end})]};
 }),{name:'inspect_video_window',description:'Sample frames from original synthetic bodycam clip and call vision. If opening precedes a spoken request, inspect the earlier lead-up before concluding. No audio inference from frames.',schema:z.object({start:z.number(),end:z.number()}).strict()}),
  tool(async({rowId})=>completed('Checked dispatch entry',async()=>{const rows=JSON.parse(await readFile(resolve(dir,'dispatch.json'),'utf8'));const row=rows.find((r:{id:string})=>r.id===rowId);if(!row)throw new Error('Dispatch entry not found');return {result:row,references:[ref('dispatch',{rowId})]};}),{name:'lookup_dispatch',description:'Read original dispatch row CAD-001 for the synchronized time anchor.',schema:z.object({rowId:z.string()}).strict()}),
 // Read-only TwelveLabs footage search. Gated on service secrets; searches only the
 // indexed video authorized for this case (TWELVELABS_VIDEO_ID_<CASE>).
 tool(async({query})=>completed('Searched footage',async()=>{
  const tlKey=process.env['TWELVELABS_API_KEY'];const indexId=process.env['TWELVELABS_INDEX_ID'];const videoId=process.env[`TWELVELABS_VIDEO_ID_${caseId.toUpperCase()}`];
  if(!tlKey||!indexId||!videoId)throw new Error('Footage search is not configured for this case (TWELVELABS_API_KEY, TWELVELABS_INDEX_ID, TWELVELABS_VIDEO_ID_<CASE>).');
  const form=new FormData();form.set('index_id',indexId);form.set('query_text',query);form.append('search_options','visual');form.set('filter',JSON.stringify({id:[videoId]}));
  const response=await fetch('https://api.twelvelabs.io/v1.3/search',{method:'POST',headers:{'x-api-key':tlKey},body:form});
  if(!response.ok)throw new Error(`TwelveLabs search failed (${response.status})`);
  const body=await response.json() as {data?:{start?:number;end?:number;score?:number;video_id?:string}[]};
  const matches=(body.data??[]).filter(m=>m.video_id===videoId).map(m=>({start:Number(m.start??0)+manifest.coverage.start,end:Number(m.end??0)+manifest.coverage.start,score:m.score??null}));
  return {result:{query,matches,note:'Candidate matches only; no hits leaves the question unresolved.'},references:matches.map(m=>ref('video',{start:m.start,end:m.end}))};
 }),{name:'search_footage',description:'Read-only semantic search of the authorized indexed clip via TwelveLabs. Use to request a closer look at a described moment. Returns candidate windows; no hits leaves the question unresolved.',schema:z.object({query:z.string().min(2).max(200)}).strict()})
 ];
 const allowed=new Set(tools.map(t=>t.name));
 const scoped=createMiddleware({name:'case_scoped_read_only',beforeModel:state=>({messages:state.messages}),wrapToolCall:async(request,handler)=>{if(!allowed.has(request.toolCall.name)&&!request.toolCall.name.startsWith('extract'))throw new Error('Tool not permitted: '+request.toolCall.name);return handler(request);}});
 // Actual Deep Agents instantiation. No filesystem, shell, browsing, or case mutation tools are permitted.
 const agent=createDeepAgent({model,tools,middleware:[scoped],permissions:[{operations:['read','write'],paths:['/**'],mode:'deny'}],responseFormat:resultSchema,systemPrompt:`Investigate a sequence claim using only the case-scoped tools. Read report page 3; check coverage for 0..26; search transcript for every trunk request before 26; inspect original video windows and look up CAD-001. Choose follow-up windows based on returned evidence. If trunk opening precedes a later request, check the lead-up 0..10 and earlier transcript before concluding. If clip begins already open or lead-up is missing, outcome MUST be Insufficient evidence. A later request never proves there was no earlier request. If an earlier request matches report, explain that ambiguity and return Records agree on this claim for that checked sequence. Return Possible discrepancy only with full lead-up checked and no earlier matching request. All output citations MUST exactly match completed tool references, null fields included. No invented facts, references, or claims about guilt. Concise plain English.`});
 let final:any;for await(const update of await agent.stream({messages:[{role:'user',content:'Investigate whether the report claim that a spoken trunk request preceded opening is supported by this case. Return a structured result after checking the evidence.'}]},{streamMode:'values',recursionLimit:50,...(signal?{signal}:{})})){final=update;}
 const result=resultSchema.parse(final?.structuredResponse);
 validateResult(result,checks,manifest.coverage);
 const output={caseId,runId:gateway.getRunId()??null,...result,checks};
 const runs=resolve(import.meta.dirname,'../runs');await mkdir(runs,{recursive:true});await writeFile(resolve(runs,`${caseId}-${Date.now()}.json`),JSON.stringify(output,null,2));return output;
}
export function validateResult(result:z.infer<typeof resultSchema>,checks:Check[],coverage:{start:number;end:number}) {
 const refs=new Set(checks.filter(c=>c.status==='completed').flatMap(c=>c.references).map(r=>JSON.stringify(r)));
 if(!result.citations.length||result.citations.some(r=>!refs.has(JSON.stringify(r))))throw new Error('Agent reference validation failed: citation was not returned by a completed tool.');
 if(checks.some(c=>c.status==='failed'))throw new Error('A required evidence check failed; retry the investigation.');
 if(coverage.start>0&&result.outcome!=='Insufficient evidence')throw new Error('Safety validation failed: missing lead-up cannot establish a discrepancy or agreement.');
 if(result.outcome==='Possible discrepancy'&&!checks.some(c=>c.tool==='Checked video lead-up'))throw new Error('Safety validation failed: lead-up was not inspected.');
}
