// First-stage Apple IIe bus: main RAM, read-only system ROM, keyboard latch,
// and basic text/graphics soft switches. Auxiliary banking and slot I/O follow later.
export class AppleIIeBus {
 readonly ram=new Uint8Array(65536);
 readonly rom=new Uint8Array(0x3000);
 romLoaded=false;
 keyboard=0;
 text=true; mixed=false; page2=false; hires=false; col80=false;
 reset(){this.keyboard=0;this.text=true;this.mixed=false;this.page2=false;this.hires=false;this.col80=false;}
 loadROM(data:Uint8Array){
   if(data.length!==0x3000)throw new Error('Expected 12 KiB ($D000-$FFFF) ROM image');
   this.rom.set(data);this.romLoaded=true;
 }
 key(code:number){this.keyboard=(code&0x7f)|0x80;}
 read(address:number):number {
   const a=address&65535;
   if(a===0xc000)return this.keyboard;
   if(a===0xc010){const k=this.keyboard;this.keyboard&=0x7f;return k;}
   if(a>=0xc050&&a<=0xc057){this.switch(a);return 0;}
   if(a===0xc01a)return this.text?0x80:0;
   if(a===0xc01b)return this.mixed?0x80:0;
   if(a===0xc01c)return this.page2?0x80:0;
   if(a===0xc01d)return this.hires?0x80:0;
   if(a===0xc01f)return this.col80?0x80:0;
   if(a>=0xd000&&this.romLoaded)return this.rom[a-0xd000];
   return this.ram[a];
 }
 write(address:number,value:number){
   const a=address&65535;
   if(a>=0xc050&&a<=0xc057){this.switch(a);return;}
   if(a===0xc00c){this.col80=false;return;}
   if(a===0xc00d){this.col80=true;return;}
   if(a===0xc010){this.keyboard&=0x7f;return;}
   if(a>=0xc000&&a<0xd000)return;
   if(a>=0xd000&&this.romLoaded)return;
   this.ram[a]=value&255;
 }
 private switch(a:number){
   switch(a){
     case 0xc050:this.text=false;break;case 0xc051:this.text=true;break;
     case 0xc052:this.mixed=false;break;case 0xc053:this.mixed=true;break;
     case 0xc054:this.page2=false;break;case 0xc055:this.page2=true;break;
     case 0xc056:this.hires=false;break;case 0xc057:this.hires=true;break;
   }
 }
}
