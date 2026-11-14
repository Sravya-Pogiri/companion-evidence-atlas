import {missing} from './case-data';
// Rosales v. Terrell. Section ids are internal; labels carry the case.
export type NotebookSection='summary'|'patel'|'chen'|'requests'|'leads';
export type NotebookQuestion={id:string;section:'patel'|'chen';text:string;citations:string[];expected:string;state:'draft'|'kept'|'cut'};
export const notebookSections:{id:NotebookSection;label:string;detail:string}[]=[{id:'summary',label:'Case summary',detail:'2 issues for review'},{id:'patel',label:'Cross-exam: Officer Terrell',detail:'4 questions'},{id:'chen',label:'Cross-exam: the 100-foot question',detail:'3 questions'},{id:'requests',label:'Evidence requests',detail:'2 requests'},{id:'leads',label:'Investigative leads',detail:'2 leads'}];
export const notebookQuestions:NotebookQuestion[]=[
{id:'p1',section:'patel',text:'Officer Terrell, the reason you gave for the stop was failure to signal, correct?',citations:['1'],expected:'Yes',state:'draft'},
{id:'p2',section:'patel',text:'Your bodycam shows the Mustang approaching the intersection, correct?',citations:['2'],expected:'Yes',state:'draft'},
{id:'p3',section:'patel',text:'When the Mustang comes into view on that footage, its left signal is already on, correct?',citations:['2','4'],expected:'Yes, if the footage is accepted',state:'draft'},
{id:'p4',section:'patel',text:'The car then turns left in the direction it was signaling, correct?',citations:['2','3'],expected:'Yes',state:'draft'},
{id:'c1',section:'chen',text:'You did not see the moment the signal was switched on, correct?',citations:['4'],expected:'Confirm against footage',state:'draft'},
{id:'c2',section:'chen',text:'Nothing in your recording shows where the car was when the signal came on, correct?',citations:['2','4'],expected:'Yes',state:'draft'},
{id:'c3',section:'chen',text:'So you cannot say from the footage whether the signal ran for less than 100 feet, correct?',citations:['4'],expected:'Yes',state:'draft'}];
export const notebookRequests=missing.map((m,i)=>({...m,citation:['4','2'][i]??'1'}));
export const notebookLeads=[{title:'Find the start of the signal',text:'Look for any other recording of the approach that shows when the left signal came on and how far from the turn.',citations:['2','3','4']},{title:'Compare both camera angles',text:'Review the bodycam and dashcam side by side from about 0:45 and pin the exact second of the turn in each.',citations:['2','3']}];
