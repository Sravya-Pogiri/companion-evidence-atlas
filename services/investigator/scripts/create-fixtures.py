from pathlib import Path
from PIL import Image, ImageDraw
from reportlab.pdfgen import canvas
import json,subprocess
root=Path(__file__).resolve().parents[1]/'fixtures';root.mkdir(exist_ok=True)
for case,opening,requests,start in [('conflicting',8,[18],0),('matching',12,[6,18],0),('incomplete',8,[18],10)]:
 d=root/case;d.mkdir(exist_ok=True)
 c=canvas.Canvas(str(d/'report.pdf'))
 for page in range(1,4):
  c.setFont('Helvetica-Bold',16);c.drawString(50,790,'SYNTHETIC TRAINING EVIDENCE - INCIDENT REPORT')
  c.setFont('Helvetica',12);c.drawString(50,755,f'Case: {case} | Page {page}')
  if page==3:
   for i,line in enumerate(['Officer Patel narrative:', 'I asked Morgan to open the trunk before the trunk was opened.', 'The request was made during the initial vehicle check.', 'Recording time anchored to dispatch entry CAD-001.']):c.drawString(50,700-i*30,line)
  else:c.drawString(50,700,'Administrative cover sheet. No sequence claim on this page.')
  c.showPage()
 c.save()
 segments=[{'start':start,'end':start+2,'text':'Officer approaches vehicle.' if start==0 else 'Recording resumes. Trunk is already open.'}]
 segments += [{'start':t,'end':t+2,'text':'Please open the trunk.' if t==6 else 'Can you open the trunk, please?'} for t in requests if t>=start]
 segments += [{'start':opening,'end':opening+2,'text':'[Trunk opening visible; no speech.]'}] if opening>=start else []
 json.dump(sorted(segments,key=lambda s:s['start']),open(d/'transcript.json','w'),indent=2)
 json.dump([{'id':'CAD-001','time':'2026-11-02T20:40:00Z','text':'Unit Patel begins vehicle check; body camera synchronized.'}],open(d/'dispatch.json','w'),indent=2)
 frames=d/'frames';frames.mkdir(exist_ok=True)
 for sec in range(start,26):
  im=Image.new('RGB',(960,540),(35,38,39));draw=ImageDraw.Draw(im)
  draw.rectangle((0,300,960,540),fill=(56,56,57));draw.line((20,470,930,410),fill=(155,155,140),width=3)
  draw.rectangle((285,235,680,420),fill=(100,109,117));draw.rectangle((330,180,630,290),fill=(100,109,117));draw.rectangle((370,195,610,260),fill=(36,45,50))
  draw.ellipse((320,390,385,455),fill=(10,10,10));draw.ellipse((580,390,645,455),fill=(10,10,10))
  if sec>=opening:draw.polygon([(635,295),(675,155),(710,165),(680,335)],fill=(150,159,166));draw.rectangle((620,290,680,355),fill=(12,12,12))
  else:draw.rectangle((620,290,685,330),fill=(100,109,117))
  draw.ellipse((160,150,205,195),fill=(140,140,135));draw.rectangle((155,195,210,340),fill=(42,53,66));draw.line((160,330,155,440),fill=(20,25,28),width=17);draw.line((200,330,205,440),fill=(20,25,28),width=17)
  draw.text((20,20),f'SYNTHETIC BWC-01 | ABSOLUTE +{sec:02d}s | 2026-11-02 20:40:{sec:02d}',fill=(245,245,245),font_size=22)
  im.save(frames/f'{sec-start:03d}.png')
 subprocess.run(['ffmpeg','-y','-loglevel','error','-framerate','1','-i',str(frames/'%03d.png'),'-c:v','libx264','-pix_fmt','yuv420p','-r','24',str(d/'bodycam.mp4')],check=True)
 json.dump({'caseId':case,'coverage':{'start':start,'end':26},'sources':{'report':'report.pdf','video':'bodycam.mp4','transcript':'transcript.json','dispatch':'dispatch.json'}},open(d/'manifest.json','w'),indent=2)
 print('Generated',case)
