import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { investigationSchema,scenarioIds } from './investigation-types';
export const investigateFinding=createServerFn({method:'POST'})
 .inputValidator(input=>z.object({caseId:z.enum(scenarioIds)}).parse(input))
 .handler(async({data})=>{
  const url=process.env['INVESTIGATOR_URL'];const token=process.env['INVESTIGATOR_TOKEN'];
  if(!url||!token)return {ok:false as const,error:'Setup required: configure INVESTIGATOR_URL and INVESTIGATOR_TOKEN for the deployed Deep Agents service.',retryable:true,checks:[]};
  try{
   // Public access is intentional: only the three immutable synthetic cases are accepted; no user evidence is sent.
   const target=new URL('/investigate',url);if(target.protocol!=='https:'&&target.hostname!=='localhost'&&target.hostname!=='127.0.0.1')throw new Error('Investigator must use HTTPS');
   const response=await fetch(target,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(data)});
   if(!response.ok)return {ok:false as const,error:`Investigator service returned ${response.status}. Check deployment and service credentials.`,retryable:response.status>=500||response.status===429,checks:[]};
   if(!response.body)throw new Error('Investigator returned no evidence stream');
   const reader=response.body.getReader();const decoder=new TextDecoder();let buffer='';const checks=[];let result:unknown;
   while(true){const {done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});let newline;while((newline=buffer.indexOf('\n'))>=0){const event=JSON.parse(buffer.slice(0,newline));buffer=buffer.slice(newline+1);if(event.type==='check')checks.push(event.check);if(event.type==='error')return {ok:false as const,error:String(event.message),retryable:event.retryable===true,checks};if(event.type==='result')result=event.result;}}
   const parsed=investigationSchema.parse(result);if(parsed.caseId!==data.caseId)throw new Error('Investigator returned a different case');const references=new Set(parsed.checks.filter(c=>c.status==='completed').flatMap(c=>c.references).map(c=>JSON.stringify(c)));if(parsed.citations.some(c=>!references.has(JSON.stringify(c))))throw new Error('Citation validation failed');return {ok:true as const,result:parsed};
  }catch(e){return {ok:false as const,error:e instanceof Error?e.message:'Investigator unavailable',retryable:true,checks:[]};}
 });
