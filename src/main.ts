import {CPU6502} from './cpu';
import {AppleIIeBus} from './bus';
import {renderGraphics} from './graphics';
const bus=new AppleIIeBus(),cpu=new CPU6502();
cpu.bus=bus;cpu.demoStopOnBrk=true;
const canvas=document.querySelector<HTMLCanvasElement>('#screen')!;
const ctx=canvas.getContext('2d')!;
const status=document.querySelector<HTMLElement>('#status')!;
const keyboard=document.querySelector<HTMLInputElement>('#keyboard')!;
let romMode=false;
let running=false;
let lastError='';
function bootSectorDiagnostic(){
 const disk=bus.disk;
 if(disk.formats[0]!=='DSK'||!disk.images[0])return '';
 // Boot ROM normally loads physical track 0, sector 0 into $0800.
 const expected=disk.images[0].subarray(0,256);
 const actual=bus.ram.subarray(0x800,0x900);
 let differences=0;
 for(let i=0;i<256;i++)if(expected[i]!==actual[i])differences++;
 const changes:string[]=[];
 for(let i=0;i<256;i++)if(expected[i]!==actual[i]&&changes.length<12){
  changes.push('0x'+(0x800+i).toString(16)+':'+expected[i].toString(16)+'>'+actual[i].toString(16));
 }
 const hex=(bytes:Uint8Array)=>Array.from(bytes.subarray(0,16),b=>b.toString(16).padStart(2,'0')).join(' ');
 return ' | T0S0 mismatches '+differences+'/256 | diff '+changes.join(',')+' | image '+hex(expected)+' | RAM0800 '+hex(actual);
}
const bootTrace:number[]=[];
const pcVisits=new Uint32Array(65536);
let instructionCount=0;
let reachedBootSector=false;
let returnedToFirmware=false;
let firmwareReturn='';
function hex16(n:number){return '$'+n.toString(16).padStart(4,'0');}
function stop(){running=false;sectorScanCache='';}
function traceStep(){
 if(!running)sectorScanCache='';
 const before=cpu.pc;
 if(romMode){
  pcVisits[before]++;instructionCount++;
  bootTrace.push(before);
  if(bootTrace.length>20)bootTrace.shift();
  if(before>=0x800&&before<0x900)reachedBootSector=true;
  if(reachedBootSector&&before>=0xc000&&before<0xc600&&!returnedToFirmware){
   returnedToFirmware=true;
   firmwareReturn='from '+hex16(bootTrace.length>1?bootTrace[bootTrace.length-2]:before)+' to '+hex16(before);
  }
 }
 cpu.step();
}
function cpuContext(){
 const pc=cpu.pc;
 const bytes=Array.from({length:12},(_,i)=>bus.read((pc-4+i)&65535).toString(16).padStart(2,'0')).join(' ');
 return ' | PC context '+hex16((pc-4)&65535)+': '+bytes+' | X '+cpu.x+' Y '+cpu.y+' SP '+cpu.sp+' P '+cpu.status+' diskCycles '+bus.disk.readCycles;
}
function diskReadDiagnostic(){
 const d=bus.disk.readStats;
 return ' | Disk reads ready '+d.ready+' wait '+d.waiting+' overwritten '+d.overwritten+' produced '+d.produced;
}
function loaderDiagnostic(){
 const hot:number[]=[];
 for(let a=0x800;a<0xc000;a++)if(pcVisits[a]>0)hot.push(a);
 hot.sort((a,b)=>pcVisits[b]-pcVisits[a]);
 const h=bus.disk.headStats,v=bus.videoWrites;
 return ' | instructions '+instructionCount+
  ' | hot PCs '+hot.slice(0,5).map(a=>hex16(a)+':'+pcVisits[a]).join(',')+
  ' | head moves '+h.transitions+' ['+h.history.join(',')+']'+
  ' | video writes text '+v.text+' hires '+v.hires+' last '+hex16(v.last)+
  ' | display '+(bus.text?'TEXT':'GRAPHICS')+' page '+(bus.page2?2:1)+' hires '+(bus.hires?'YES':'NO');
}
let sectorScanCache='';
function sectorScanDiagnostic(){
 if(running)return ' | later-sector scan: pause to inspect';
 if(sectorScanCache)return sectorScanCache;
 const image=bus.disk.images[0];
 if(bus.disk.formats[0]!=='DSK'||!image)return '';
 // Inspect RAM pages against the first three tracks; skip uniform sectors.
 // This is a similarity check, NOT proof that a sector was successfully decoded.
 const best:{score:number;address:number;track:number;sector:number}[]=[];
 let exact=0;
 for(let sectorIndex=1;sectorIndex<48;sectorIndex++){
  const start=sectorIndex*256;
  let varied=false;
  for(let j=1;j<256;j++)if(image[start+j]!==image[start]){varied=true;break;}
  if(!varied)continue;
  let topScore=0,topAddress=0;
  for(let address=0x900;address<0x8000;address+=256){
   let score=0;
   for(let j=0;j<256;j++)if(bus.ram[address+j]===image[start+j])score++;
   if(score>topScore){topScore=score;topAddress=address;}
  }
  if(topScore===256)exact++;
  best.push({score:topScore,address:topAddress,track:Math.floor(sectorIndex/16),sector:sectorIndex%16});
 }
 best.sort((a,b)=>b.score-a.score);
 sectorScanCache=' | later-sector scan T0-2 exact '+exact+
  ' | closest '+best.slice(0,5).map(x=>'T'+x.track+'S'+x.sector+'@'+hex16(x.address)+':'+x.score+'/256').join(',');
 return sectorScanCache;
}
function textPageDiagnostic(){
 const base=bus.page2&&!bus.store80?0x800:0x400;
 const hex=(n:number)=>n.toString(16).padStart(2,'0');
 const lines:string[]=[];
 let nonzero=0,printable=0;
 for(let row=0;row<24;row++){
  let sample='';
  for(let col=0;col<40;col++){
   const address=base+((row&7)<<7)+Math.floor(row/8)*40+col;
   const b=bus.videoRead(address);
   if(b!==0)nonzero++;
   const glyph=b&0x3f;
   const code=glyph<32?glyph+64:glyph;
   if(code>=32&&code<=126)printable++;
   if(col<16)sample+=String.fromCharCode(code);
  }
  if(row<4||row>=20)lines.push(row+':'+sample);
 }
 const writes=bus.recentTextWrites.map(w=>(w.aux?'A':'M')+hex16(w.address)+'='+hex(w.value)).join(',');
 return ' | text page '+hex16(base)+' nonzero '+nonzero+'/960 printable '+printable+
  ' | rows '+lines.join(' / ')+' | recent text writes '+writes;
}
function traceDiagnostic(){
 return ' | boot $0800 '+(reachedBootSector?'YES':'NO')+
  ' | firmware return '+(returnedToFirmware?firmwareReturn:'NO')+
  ' | recent PCs '+bootTrace.map(hex16).join(' ')+cpuContext()+diskReadDiagnostic()+loaderDiagnostic()+bootSectorDiagnostic()+sectorScanDiagnostic()+textPageDiagnostic();
}
function frame(){
 if(!running)return;
 try {for(let i=0;i<12000&&!cpu.halted;i++)traceStep();draw();if(cpu.halted)running=false;}
 catch(e){
  const pc=(cpu.pc-1)&0xffff;
  const bytes=Array.from({length:16},(_,i)=>bus.read((pc-8+i)&0xffff).toString(16).padStart(2,'0')).join(' ');
  lastError=String(e)+' | At $'+pc.toString(16).padStart(4,'0')+' nearby: '+bytes+' | S6 disk '+bus.disk.fingerprint(0)+' | S6 track '+bus.disk.track+' nibble '+bus.disk.readPosition+' latch $'+bus.disk.readLatch.toString(16).padStart(2,'0')+' motor '+(bus.disk.motor?'on':'off')+traceDiagnostic();
  running=false;draw();
 }
 if(running)requestAnimationFrame(frame);
}
function loadDemo(){
 stop();lastError='';
 romMode=false;cpu.demoStopOnBrk=true;bus.ram.fill(0);bus.aux.fill(0);bus.reset();
 const message='HELLO, APPLE II!';
 const program:number[]=[];
 for(let i=0;i<message.length;i++){const a=0x400+i;program.push(0xa9,message.charCodeAt(i)|128,0x8d,a&255,a>>8);}
 program.push(0);bus.ram.set(program,0x8000);cpu.reset(0x8000);draw();
}
function draw(){
 ctx.fillStyle='#071007';ctx.fillRect(0,0,canvas.width,canvas.height);
 const columns=bus.col80?80:40;
 const charWidth=canvas.width/columns;
 ctx.font=(bus.col80?'10':'18')+'px monospace';
 ctx.textBaseline='top';
 if(!bus.text)renderGraphics(ctx,bus,canvas.width,canvas.height);
 if(bus.text||bus.mixed)for(let row=0;row<24;row++){
  if(!bus.text&&row<20)continue;
  for(let col=0;col<columns;col++){
   const address=(bus.store80?0x400:(bus.page2?0x800:0x400))+((row&7)<<7)+Math.floor(row/8)*40+(bus.col80?Math.floor(col/2):col);
   const b=bus.col80?bus.videoRead(address,col%2===0):bus.videoRead(address);
   const glyph=b&0x3f;
   const ch=String.fromCharCode(glyph<32?glyph+64:glyph);
   const inverse=b<0x40;
   const flash=b>=0x40&&b<0x80&&Math.floor(Date.now()/500)%2===0;
   const x=col*charWidth,y=row*16;
   if(inverse||flash){ctx.fillStyle='#7dff89';ctx.fillRect(x,y,charWidth,16);ctx.fillStyle='#071007';}
   else ctx.fillStyle='#7dff89';
   ctx.fillText(ch,x,y);
  }
 }
 status.textContent='PC: $'+cpu.pc.toString(16).padStart(4,'0')+' A: $'+cpu.a.toString(16).padStart(2,'0')+' | '+(romMode?'ROM':'DEMO')+' | '+(running?'RUNNING':cpu.halted?'HALTED':'PAUSED')+' | '+columns+' COL'+' | S6: '+(bus.disk.formats[0]??'-')+' T'+bus.disk.track+' N'+bus.disk.readPosition+' L$'+bus.disk.readLatch.toString(16).padStart(2,'0')+' | Drives: '+[6,5].flatMap(slot=>bus.diskControllers[slot].mountedDrives.map((mounted,i)=>'S'+slot+'D'+(i+1)+':'+(mounted?'M':'-'))).join(' ')+(lastError?' | '+lastError:'')+(romMode&&!lastError?traceDiagnostic():'');
}
document.querySelector('#reset')!.addEventListener('click',()=>{stop();lastError='';if(romMode){bus.reset();cpu.reset();draw();}else loadDemo();});
document.querySelector('#boot-disk')!.addEventListener('click',()=>{
 stop();lastError='';sectorScanCache='';bus.disk.resetReadStats();bus.disk.resetHeadStats();bus.resetVideoWrites();pcVisits.fill(0);instructionCount=0;bootTrace.length=0;reachedBootSector=false;returnedToFirmware=false;firmwareReturn='';
 if(!bus.romLoaded){lastError='Load the Apple IIe system ROM first';draw();return;}
 if(!bus.disk.bootROMLoaded){lastError='Load the 256-byte slot 6 Disk II boot ROM first';draw();return;}
 if(!bus.disk.images[0]){lastError='Mount a disk in Slot 6 Drive 1 first';draw();return;}
 bus.reset();bus.disk.access(0xc0ea);bus.disk.rewind(0);bus.disk.access(0xc0e8);bus.ram.fill(0);bus.aux.fill(0);
 romMode=true;cpu.demoStopOnBrk=false;cpu.reset(0xc600);
 running=true;frame();
});
document.querySelector('#step')!.addEventListener('click',()=>{stop();try{traceStep();draw();}catch(e){status.textContent=String(e);}});
document.querySelector('#run')!.addEventListener('click',()=>{if(running){stop();draw();}else{running=true;frame();}});
document.querySelector('#rom')!.addEventListener('change',async event=>{
 const file=(event.target as HTMLInputElement).files?.[0];if(!file)return;
 try{
  stop();lastError='';
  bus.loadROM(new Uint8Array(await file.arrayBuffer()));
  bus.ram.fill(0);bus.reset();romMode=true;cpu.demoStopOnBrk=false;cpu.reset();draw();
 }catch(e){status.textContent=String(e);}
});
document.querySelectorAll<HTMLInputElement>('.disk-image').forEach(input=>input.addEventListener('change',async event=>{
 const file=(event.target as HTMLInputElement).files?.[0];if(!file)return;
 try{const slot=Number(input.dataset.slot),drive=Number(input.dataset.drive);bus.diskControllers[slot].mount(drive,new Uint8Array(await file.arrayBuffer()));lastError='';draw();}
 catch(e){lastError=String(e);draw();}
}));
document.querySelectorAll<HTMLInputElement>('.disk-rom').forEach(input=>input.addEventListener('change',async event=>{
 const file=(event.target as HTMLInputElement).files?.[0];if(!file)return;
 try{bus.diskControllers[Number(input.dataset.slot)].loadBootROM(new Uint8Array(await file.arrayBuffer()));lastError='';draw();}
 catch(e){lastError=String(e);draw();}
}));
keyboard.addEventListener('keydown',e=>{
 let code=0;
 if(e.key==='Enter')code=13;
 else if(e.key==='Backspace')code=8;
 else if(e.key==='Escape')code=27;
 else if(e.key.length===1)code=e.key.toUpperCase().charCodeAt(0)&127;
 if(code){bus.key(code);e.preventDefault();draw();}
});
keyboard.addEventListener('input',()=>{for(const ch of keyboard.value){bus.key(ch.toUpperCase().charCodeAt(0)&127);}keyboard.value='';draw();});
loadDemo();
