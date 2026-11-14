import type { CaseSummary } from '@/lib/case-data';
export function daysUntil(date:string,today=new Date()){return Math.round((Date.parse(date)-Date.UTC(today.getUTCFullYear(),today.getUTCMonth(),today.getUTCDate()))/86400000);}
export function priority(c:Pick<CaseSummary,'nextCourtDate'|'filingDeadline'|'outstandingRequests'|'unverifiedFindings'|'openTasks'>,today=new Date()){
 const court=daysUntil(c.nextCourtDate,today),deadline=daysUntil(c.filingDeadline,today);
 const breakdown={court:court<=3?40:court<=7?25:court<=14?10:0,deadline:deadline<=3?30:deadline<=7?15:0,requests:Math.min(20,c.outstandingRequests*5),findings:Math.min(15,c.unverifiedFindings*5),tasks:Math.min(10,c.openTasks*2)};
 const raw=Object.values(breakdown).reduce((a,b)=>a+b,0),score=Math.min(100,raw);
 return {score,raw,breakdown,level:score>=70?'Urgent':score>=40?'This week':'On track',tone:score>=70?'urgent':score>=40?'week':'track'};
}
export function relativeDay(n:number){return n<0?`${Math.abs(n)} days overdue`:n===0?'today':n===1?'tomorrow':`in ${n} days`;}
export function shortDate(date:string){return new Date(date).toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'});}
