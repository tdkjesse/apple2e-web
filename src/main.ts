import {CPU6502} from './cpu';
import {AppleIIeBus} from './bus';
const bus=new AppleIIeBus(),cpu=new CPU6502();
cpu.bus=bus;cpu.demoStopOnBrk=true;
const canvas=document.querySelector<HTMLCanvasElement>('#screen')!;
const ctx=canvas.getContext('2d')!;
const status=document.querySelector<HTMLElement>('#status')!;
const keyboard=document.querySelector<HTMLInputElement>('#keyboard')!;
let romMode=false;
function loadDemo(){
 romMode=false;cpu.demoStopOnBrk=true;bus.ram.fill(0);bus.reset();
 const message='HELLO, APPLE II!';
 const program:number[]=[];
 for(let i=0;i<message.length;i++){const a=0x400+i;program.push(0xa9,message.charCodeAt(i)|128,0x8d,a&255,a>>8);}
 program.push(0);bus.ram.set(program,0x8000);cpu.reset(0x8000);draw();
}
function draw(){
 ctx.fillStyle='#071007';ctx.fillRect(0,0,canvas.width,canvas.height);
 ctx.fillStyle='#7dff89';ctx.font='18px monospace';ctx.textBaseline='top';
 if(!bus.text&&!bus.mixed){ctx.fillText('GRAPHICS MODE (NOT YET IMPLEMENTED)',8,20);}
 else for(let row=0;row<24;row++){
  if(!bus.text&&row<20)continue;
  let line='';
  for(let col=0;col<40;col++){
   const addr=(bus.page2?0x800:0x400)+((row&7)<<7)+Math.floor(row/8)*40+col;
   const b=bus.read(addr);line+=b>=0xa0?String.fromCharCode(b&0x7f):' ';
  }
  ctx.fillText(line,8,row*16);
 }
 status.textContent='PC: $'+cpu.pc.toString(16).padStart(4,'0')+' A: $'+cpu.a.toString(16).padStart(2,'0')+' Halted: '+cpu.halted+' | '+(romMode?'ROM':'DEMO')+' | Key: $'+bus.keyboard.toString(16).padStart(2,'0');
}
function runSteps(count:number){try{cpu.run(count);draw();}catch(e){status.textContent=String(e);}}
document.querySelector('#reset')!.addEventListener('click',()=>{if(romMode){bus.reset();cpu.reset();draw();}else loadDemo();});
document.querySelector('#step')!.addEventListener('click',()=>{try{cpu.step();draw();}catch(e){status.textContent=String(e);}});
document.querySelector('#run')!.addEventListener('click',()=>runSteps(10000));
document.querySelector('#rom')!.addEventListener('change',async event=>{
 const file=(event.target as HTMLInputElement).files?.[0];if(!file)return;
 try{
  bus.loadROM(new Uint8Array(await file.arrayBuffer()));
  bus.ram.fill(0);bus.reset();romMode=true;cpu.demoStopOnBrk=false;cpu.reset();draw();
 }catch(e){status.textContent=String(e);}
});
keyboard.addEventListener('keydown',e=>{
 let code=0;
 if(e.key==='Enter')code=13;
 else if(e.key==='Backspace')code=8;
 else if(e.key==='Escape')code=27;
 else if(e.key.length===1)code=e.key.toUpperCase().charCodeAt(0)&127;
 if(code){bus.key(code);e.preventDefault();draw();}
});
keyboard.addEventListener('input',()=>{keyboard.value='';});
loadDemo();
