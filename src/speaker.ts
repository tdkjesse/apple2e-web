import {AppleIIeBus} from './bus';
const CPU_HZ=1023000;
export class AppleSpeaker {
 private context:AudioContext|null=null;
 private nextTime=0;
 private lastCycle=0;
 private level=0;
 private highPass=0;
 private previousSample=0;
 private readonly bus:AppleIIeBus;
 enabled=false;
 volume=0.2;
 constructor(bus:AppleIIeBus){this.bus=bus;}
 async enable(){
  if(!this.context)this.context=new AudioContext();
  await this.context.resume();this.enabled=true;
  this.nextTime=this.context.currentTime;this.lastCycle=this.bus.speakerCycles;
  this.level=this.bus.speakerLevel;this.bus.speakerEdges.length=0;
 }
 disable(){this.enabled=false;this.bus.speakerEdges.length=0;this.lastCycle=this.bus.speakerCycles;}
 flush(speed:number){
  const edges=this.bus.speakerEdges.splice(0);
  const end=this.bus.speakerCycles;
  if(!this.enabled||!this.context){this.lastCycle=end;this.level=this.bus.speakerLevel;return;}
  const ctx=this.context;
  if(this.nextTime<ctx.currentTime)this.nextTime=ctx.currentTime;
  // Drop excessive buffered audio rather than introducing multi-second latency.
  if(this.nextTime>ctx.currentTime+0.35){this.lastCycle=end;this.level=this.bus.speakerLevel;return;}
  // No speaker transitions means silence, not a continuous DC voltage.
  if(edges.length===0){this.lastCycle=end;this.level=this.bus.speakerLevel;this.nextTime=ctx.currentTime;this.highPass=0;this.previousSample=0;return;}
  const duration=Math.max(0,(end-this.lastCycle)/(CPU_HZ*speed));
  const count=Math.min(65536,Math.floor(duration*ctx.sampleRate));
  if(count<1){this.lastCycle=end;this.level=this.bus.speakerLevel;return;}
  const buffer=ctx.createBuffer(1,count,ctx.sampleRate);
  const samples=buffer.getChannelData(0);
  let index=0,level=this.level;
  for(let i=0;i<count;i++){
   const cycle=this.lastCycle+(i+0.5)*CPU_HZ*speed/ctx.sampleRate;
   while(index<edges.length&&edges[index]<=cycle){level^=1;index++;}
   const raw=(level?1:-1)*this.volume;
   // DC-blocking high-pass filter prevents clicks from a held speaker level.
   this.highPass=0.995*(this.highPass+raw-this.previousSample);
   this.previousSample=raw;
   const fade=Math.min(1,i/64,(count-1-i)/64);
   samples[i]=this.highPass*Math.max(0,fade);
  }
  const source=ctx.createBufferSource();source.buffer=buffer;source.connect(ctx.destination);
  source.start(this.nextTime);this.nextTime+=count/ctx.sampleRate;
  this.level=this.bus.speakerLevel;this.lastCycle=end;
 }
}
