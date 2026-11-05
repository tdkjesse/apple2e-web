import {DiskII} from './disk';
// Apple IIe main/auxiliary memory and language-card model (initial implementation).
export class AppleIIeBus {
 readonly disk=new DiskII();
 readonly disk5=new DiskII();
 readonly diskControllers:Record<number,DiskII>={5:this.disk5,6:this.disk};
 tick(cycles:number){this.disk.tick(cycles);this.disk5.tick(cycles);}

 readonly videoWrites={text:0,hires:0,last:0};
 readonly recentTextWrites:{address:number;value:number;aux:boolean}[]=[];
 resetVideoWrites(){this.videoWrites.text=0;this.videoWrites.hires=0;this.videoWrites.last=0;this.recentTextWrites.length=0;}
 readonly ram=new Uint8Array(65536);
 readonly aux=new Uint8Array(65536);
 readonly rom=new Uint8Array(0x4000);
 romStart=0xd000;
 private readonly lcMain=new Uint8Array(0x4000);
 private readonly lcAux=new Uint8Array(0x4000);
 romLoaded=false; keyboard=0;
 private readonly keyQueue:number[]=[];
 readonly keyStats={submitted:0,acknowledged:0};
 get pendingKeys(){return this.keyQueue.length+(this.keyboard&128?1:0);}
 private advanceKey(){if(this.keyQueue.length)this.keyboard=this.keyQueue.shift()!|128;else this.keyboard&=127;}
 private acknowledgeKey(){this.keyStats.acknowledged++;this.advanceKey();}
 text=true;mixed=false;page2=false;hires=false;col80=false;
 store80=false;ramrd=false;ramwrt=false;altzp=false;intcxrom=false;slotc3rom=false;
 lcRead=false;lcWrite=false;lcBank2=true;
 private lcPrewrite=false;
 reset(){
  this.keyboard=0;this.keyQueue.length=0;this.keyStats.submitted=0;this.keyStats.acknowledged=0;this.text=true;this.mixed=false;this.page2=false;this.hires=false;this.col80=false;
  this.store80=this.ramrd=this.ramwrt=this.altzp=this.intcxrom=this.slotc3rom=false;
  this.lcRead=this.lcWrite=false;this.lcBank2=true;this.lcPrewrite=false;
 }
 loadROM(data:Uint8Array){
  if(data.length!==0x3000&&data.length!==0x4000)throw new Error('Expected 12 KiB or 16 KiB Apple IIe ROM image');
  this.rom.fill(0);this.romStart=data.length===0x4000?0xc000:0xd000;
  this.rom.set(data,this.romStart-0xc000);this.romLoaded=true;
 }
 key(code:number){
  this.keyStats.submitted++;
  if(this.keyboard&128)this.keyQueue.push(code&127);
  else this.keyboard=(code&127)|128;
 }
 private bank(a:number,write:boolean):Uint8Array{
  if(a<0x200)return this.altzp?this.aux:this.ram;
  if(this.store80&&((a>=0x400&&a<0x800)||(this.hires&&a>=0x2000&&a<0x4000)))
   return this.page2?this.aux:this.ram;
  return (write?this.ramwrt:this.ramrd)?this.aux:this.ram;
 }
 private lcArray(){return this.altzp?this.lcAux:this.lcMain;}
 private lcOffset(a:number){return a<0xe000?(this.lcBank2?0:0x1000)+(a-0xd000):0x2000+(a-0xe000);}
 private languageSwitch(a:number){
  const mode=a&3;
  this.lcBank2=(a&8)===0;
  this.lcRead=mode===0||mode===3;
  if((a&1)===0){this.lcWrite=false;this.lcPrewrite=false;}
  else{
   if(this.lcPrewrite)this.lcWrite=true;
   this.lcPrewrite=true;
  }
 }
 private softSwitch(a:number){
  switch(a){
   case 0xc050:this.text=false;break;case 0xc051:this.text=true;break;
   case 0xc052:this.mixed=false;break;case 0xc053:this.mixed=true;break;
   case 0xc054:this.page2=false;break;case 0xc055:this.page2=true;break;
   case 0xc056:this.hires=false;break;case 0xc057:this.hires=true;break;
  }
 }
 private setMemorySwitch(a:number){
  const on=!!(a&1);
  switch(a&0xfffe){
   case 0xc000:this.store80=on;break;
   case 0xc002:this.ramrd=on;break;
   case 0xc004:this.ramwrt=on;break;
   case 0xc006:this.intcxrom=on;break;
   case 0xc008:this.altzp=on;break;
   case 0xc00a:this.slotc3rom=on;break;
   case 0xc00c:this.col80=on;break;
  }
 }
 read(address:number):number{
  const a=address&65535;
  if(a>=0xc0d0&&a<=0xc0df)return this.disk5.access(a);
  if(a>=0xc0e0&&a<=0xc0ef)return this.disk.access(a);
  if(a===0xc000)return this.keyboard;
  if(a===0xc010){const v=this.keyboard;this.acknowledgeKey();return v;}
  if(a>=0xc080&&a<=0xc08f){this.languageSwitch(a);return 0;}
  if(a>=0xc050&&a<=0xc057){this.softSwitch(a);return 0;}
  const statuses:Record<number,boolean>={
   0xc011:this.lcBank2,0xc012:this.lcRead,0xc013:this.ramrd,0xc014:this.ramwrt,
   0xc015:this.intcxrom,0xc016:this.altzp,0xc017:this.slotc3rom,
   0xc018:this.store80,0xc01a:this.text,0xc01b:this.mixed,0xc01c:this.page2,
   0xc01d:this.hires,0xc01f:this.col80
  };
  if(Object.prototype.hasOwnProperty.call(statuses,a))return statuses[a]?128:0;
  if(a>=0xd000){
   if(this.lcRead)return this.lcArray()[this.lcOffset(a)];
   return this.romLoaded?this.rom[a-0xc000]:this.ram[a];
  }
  if(a>=0xc500&&a<=0xc6ff&&!this.intcxrom){
   const controller=a<0xc600?this.disk5:this.disk;
   if(controller.bootROMLoaded)return controller.bootROM[a&255];
  }
  if(a>=0xc100&&a<=0xcfff&&this.romLoaded&&this.romStart===0xc000){
   // Internal Cx ROM is selected when INTCXROM is on; C3 also uses internal ROM
   // unless SLOTC3ROM is enabled. External slot ROMs are not emulated yet.
   if(this.intcxrom||(a>=0xc300&&a<0xc400&&!this.slotc3rom))return this.rom[a-0xc000];
  }
  if(a>=0xc000)return 0; // Remaining slot I/O / external slot ROM not implemented.
  return this.bank(a,false)[a];
 }
 write(address:number,value:number){
  const a=address&65535,v=value&255;
  if(a>=0xc0d0&&a<=0xc0df){this.disk5.access(a,v);return;}
  if(a>=0xc0e0&&a<=0xc0ef){this.disk.access(a,v);return;}
  if(a>=0xc080&&a<=0xc08f){this.languageSwitch(a);return;}
  if(a>=0xc050&&a<=0xc057){this.softSwitch(a);return;}
  if(a===0xc010){this.acknowledgeKey();return;}
  if(a>=0xc000&&a<=0xc00f){this.setMemorySwitch(a);return;}
  if(a>=0xd000){if(this.lcWrite)this.lcArray()[this.lcOffset(a)]=v;return;}
  if(a>=0xc000)return;
  if(a>=0x400&&a<0xc00){
   this.videoWrites.text++;this.videoWrites.last=a;
   const aux=this.bank(a,true)===this.aux;
   this.recentTextWrites.push({address:a,value:v,aux});
   if(this.recentTextWrites.length>12)this.recentTextWrites.shift();
  }
  if(a>=0x2000&&a<0x6000){this.videoWrites.hires++;this.videoWrites.last=a;}
  this.bank(a,true)[a]=v;
 }
 // Video fetch bypasses CPU RAMRD and follows 80STORE/PAGE2 mapping.
 videoRead(address:number,auxiliary=false){
  const a=address&65535;
  if(auxiliary)return this.aux[a];
  if(this.store80&&((a>=0x400&&a<0x800)||(this.hires&&a>=0x2000&&a<0x4000)))
   return (this.page2?this.aux:this.ram)[a];
  return this.ram[a];
 }
}
