import {CPU6502} from './cpu';
import {AppleIIeBus} from './bus';
const bus=new AppleIIeBus(),cpu=new CPU6502();
cpu.bus=bus;cpu.demoStopOnBrk=true;
const canvas=document.querySelector<HTMLCanvasElement>('#screen')!;
const ctx=canvas.getContext('2d')!;
const status=document.querySelector<HTMLElement>('#status')!;
const keyboard=document.querySelector<HTMLInputElement>('#keyboard')!;
let romMode=false;
let running=false;
let lastError='';
function stop(){running=false;}
function frame(){
 if(!running)return;
 try {cpu.run(12000);draw();if(cpu.halted)running=false;}
 catch(e){
  const pc=(cpu.pc-1)&0xffff;
  const bytes=Array.from({length:16},(_,i)=>bus.read((pc-8+i)&0xffff).toString(16).padStart(2,'0')).join(' ');
  lastError=String(e)+' | At $'+pc.toString(16).padStart(4,'0')+' nearby: '+bytes+' | S6 disk '+bus.disk.fingerprint(0)+' | S6 track '+bus.disk.track+' motor '+(bus.disk.motor?'on':'off');
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
 if(!bus.text&&!bus.mixed){ctx.fillStyle='#7dff89';ctx.fillText('GRAPHICS MODE (NOT YET IMPLEMENTED)',8,20);}
 else for(let row=0;row<24;row++){
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
 status.textContent='PC: $'+cpu.pc.toString(16).padStart(4,'0')+' A: $'+cpu.a.toString(16).padStart(2,'0')+' | '+(romMode?'ROM':'DEMO')+' | '+(running?'RUNNING':cpu.halted?'HALTED':'PAUSED')+' | '+columns+' COL'+' | Drives: '+[6,5].flatMap(slot=>bus.diskControllers[slot].mountedDrives.map((mounted,i)=>'S'+slot+'D'+(i+1)+':'+(mounted?'M':'-'))).join(' ')+(lastError?' | '+lastError:'');
}
document.querySelector('#reset')!.addEventListener('click',()=>{stop();lastError='';if(romMode){bus.reset();cpu.reset();draw();}else loadDemo();});
document.querySelector('#boot-disk')!.addEventListener('click',()=>{
 stop();lastError='';
 if(!bus.romLoaded){lastError='Load the Apple IIe system ROM first';draw();return;}
 if(!bus.disk.bootROMLoaded){lastError='Load the 256-byte slot 6 Disk II boot ROM first';draw();return;}
 if(!bus.disk.images[0]){lastError='Mount a disk in Slot 6 Drive 1 first';draw();return;}
 bus.reset();bus.disk.access(0xc0ea);bus.disk.rewind(0);bus.disk.access(0xc0e8);bus.ram.fill(0);bus.aux.fill(0);
 romMode=true;cpu.demoStopOnBrk=false;cpu.reset(0xc600);
 running=true;frame();
});
document.querySelector('#step')!.addEventListener('click',()=>{stop();try{cpu.step();draw();}catch(e){status.textContent=String(e);}});
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
