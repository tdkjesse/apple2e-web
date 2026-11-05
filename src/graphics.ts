import {AppleIIeBus} from './bus';

// Apple II scan lines are interleaved in three groups of eight.
export function textAddress(base:number,row:number,col:number){
 return base+((row&7)<<7)+Math.floor(row/8)*40+col;
}
export function hiresAddress(base:number,y:number,col:number){
 return base+((y&7)<<10)+(((y>>3)&7)<<7)+Math.floor(y/64)*40+col;
}
const loresPalette=['#000000','#b31b3b','#2852c7','#b05edb','#197c31','#777777','#2b9dff','#80baff','#80510b','#ef711f','#aaaaaa','#f4a4c8','#4fce47','#e6df55','#74e8c8','#ffffff'];
export function renderGraphics(ctx:CanvasRenderingContext2D,bus:AppleIIeBus,width:number,height:number){
 const scaleX=width/280,scaleY=height/192;
 const lines=bus.mixed?160:192;
 if(!bus.hires){
  const base=bus.page2&&!bus.store80?0x800:0x400;
  for(let y=0;y<lines/4;y++)for(let col=0;col<40;col++){
   const byte=bus.videoRead(textAddress(base,Math.floor(y/2),col));
   const color=(y&1)?byte>>4:byte&15;
   ctx.fillStyle=loresPalette[color];
   ctx.fillRect(col*7*scaleX,y*4*scaleY,7*scaleX+0.2,4*scaleY+0.2);
  }
  return;
 }
 const base=bus.page2&&!bus.store80?0x4000:0x2000;
 for(let y=0;y<lines;y++){
  for(let col=0;col<40;col++){
   const byte=bus.videoRead(hiresAddress(base,y,col));
   for(let bit=0;bit<7;bit++){
    const x=col*7+bit;
    const on=(byte>>bit)&1;
    if(!on)ctx.fillStyle='#000000';
    else{
     const previous=bit>0?(byte>>(bit-1))&1:col>0?(bus.videoRead(hiresAddress(base,y,col-1))>>6)&1:0;
     const next=bit<6?(byte>>(bit+1))&1:col<39?bus.videoRead(hiresAddress(base,y,col+1))&1:0;
     ctx.fillStyle=previous||next?'#ffffff':((x+(byte>>7))&1)?(byte&128?'#ff8b36':'#45d855'):(byte&128?'#4a9bff':'#ad55d7');
    }
    ctx.fillRect(x*scaleX,y*scaleY,scaleX+0.2,scaleY+0.2);
   }
  }
 }
}
