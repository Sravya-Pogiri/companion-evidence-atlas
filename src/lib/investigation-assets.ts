import conflictingReport from '@/assets/investigations/conflicting-report.pdf.asset.json';
import conflictingVideo from '@/assets/investigations/conflicting-bodycam.mp4.asset.json';
import matchingReport from '@/assets/investigations/matching-report.pdf.asset.json';
import matchingVideo from '@/assets/investigations/matching-bodycam.mp4.asset.json';
import incompleteReport from '@/assets/investigations/incomplete-report.pdf.asset.json';
import incompleteVideo from '@/assets/investigations/incomplete-bodycam.mp4.asset.json';
import freshVideo from '@/assets/investigations/fresh-bodycam.mp4.asset.json';
import freshTruncatedVideo from '@/assets/investigations/fresh-truncated-bodycam.mp4.asset.json';
export const investigationAssets={conflicting:{report:conflictingReport.url,video:conflictingVideo.url,start:0},matching:{report:matchingReport.url,video:matchingVideo.url,start:0},incomplete:{report:incompleteReport.url,video:incompleteVideo.url,start:10},fresh:{report:conflictingReport.url,video:freshVideo.url,start:0},'fresh-truncated':{report:conflictingReport.url,video:freshTruncatedVideo.url,start:0}};
