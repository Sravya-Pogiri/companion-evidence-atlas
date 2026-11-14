import {describe,it,expect} from 'vitest';
import {priority} from '../utils/priority';
const now=new Date('2026-11-14T04:01:00Z');
const base={nextCourtDate:'2026-12-20',filingDeadline:'2026-12-20',outstandingRequests:0,unverifiedFindings:0,openTasks:0};
describe('case triage rules',()=>{
 it.each([[3,40],[7,25],[14,10],[15,0]])('court within %i days adds %i',(days,points)=>{expect(priority({...base,nextCourtDate:new Date(now.getTime()+days*86400000).toISOString().slice(0,10)},now).breakdown.court).toBe(points)});
 it.each([[3,30],[7,15],[8,0]])('deadline within %i days adds %i',(days,points)=>{expect(priority({...base,filingDeadline:new Date(now.getTime()+days*86400000).toISOString().slice(0,10)},now).breakdown.deadline).toBe(points)});
 it('requests add five, capped at twenty',()=>{expect(priority({...base,outstandingRequests:2},now).breakdown.requests).toBe(10);expect(priority({...base,outstandingRequests:7},now).breakdown.requests).toBe(20)});
 it('findings add five, capped at fifteen',()=>{expect(priority({...base,unverifiedFindings:2},now).breakdown.findings).toBe(10);expect(priority({...base,unverifiedFindings:5},now).breakdown.findings).toBe(15)});
 it('tasks add two, capped at ten',()=>{expect(priority({...base,openTasks:3},now).breakdown.tasks).toBe(6);expect(priority({...base,openTasks:9},now).breakdown.tasks).toBe(10)});
 it('urgency starts at seventy',()=>{expect(priority({...base,nextCourtDate:'2026-11-17',filingDeadline:'2026-11-17'},now).level).toBe('Urgent')});
 it('sixty-nine is this week',()=>{expect(priority({...base,nextCourtDate:'2026-11-17',filingDeadline:'2026-11-20',outstandingRequests:2,openTasks:2},now).score).toBe(69);expect(priority({...base,nextCourtDate:'2026-11-17',filingDeadline:'2026-11-20',outstandingRequests:2,openTasks:2},now).level).toBe('This week')});
 it('forty starts this week',()=>{expect(priority({...base,nextCourtDate:'2026-11-17'},now).level).toBe('This week')});
 it('thirty-nine is on track',()=>{expect(priority({...base,outstandingRequests:4,unverifiedFindings:3,openTasks:2},now).score).toBe(39);expect(priority({...base,outstandingRequests:4,unverifiedFindings:3,openTasks:2},now).level).toBe('On track')});
});
