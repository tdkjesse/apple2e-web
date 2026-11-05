// NMOS 6502 core: documented opcodes, stack, interrupts and cycle counts.
// Undocumented opcodes deliberately throw; Apple IIe 65C02 extensions are future work.
type Mode = 'imp'|'acc'|'imm'|'zp'|'zpx'|'zpy'|'abs'|'abx'|'aby'|'ind'|'izx'|'izy'|'rel';
type Op = { name:string; mode:Mode; cycles:number; page?:boolean };
const OPS: Record<number,Op> = {};
function define(name:string, modes:Mode[], codes:number[], cycles:number[], pages:Mode[] = []) {
  codes.forEach((code,i)=>OPS[code]={name,mode:modes[i],cycles:cycles[i],page:pages.includes(modes[i])});
}
const R:Mode[]=['izx','zp','imm','abs','izy','zpx','aby','abx'];
const rc=[6,3,2,4,5,4,4,4];
for(const [name,base] of [['ORA',0x00],['AND',0x20],['EOR',0x40],['ADC',0x60],['LDA',0xa0],['CMP',0xc0],['SBC',0xe0]] as const)
  define(name,R,R.map((_,i)=>base+[1,5,9,13,17,21,25,29][i]),rc,['izy','aby','abx']);
define('STA',['izx','zp','abs','izy','zpx','aby','abx'],[0x81,0x85,0x8d,0x91,0x95,0x99,0x9d],[6,3,4,6,4,5,5]);
define('LDX',['imm','zp','zpy','abs','aby'],[0xa2,0xa6,0xb6,0xae,0xbe],[2,3,4,4,4],['aby']);
define('LDY',['imm','zp','zpx','abs','abx'],[0xa0,0xa4,0xb4,0xac,0xbc],[2,3,4,4,4],['abx']);
define('STX',['zp','zpy','abs'],[0x86,0x96,0x8e],[3,4,4]);
define('STY',['zp','zpx','abs'],[0x84,0x94,0x8c],[3,4,4]);
define('CPX',['imm','zp','abs'],[0xe0,0xe4,0xec],[2,3,4]);
define('CPY',['imm','zp','abs'],[0xc0,0xc4,0xcc],[2,3,4]);
define('BIT',['zp','abs'],[0x24,0x2c],[3,4]);
for(const [name,codes] of [['ASL',[0x0a,0x06,0x16,0x0e,0x1e]],['ROL',[0x2a,0x26,0x36,0x2e,0x3e]],['LSR',[0x4a,0x46,0x56,0x4e,0x5e]],['ROR',[0x6a,0x66,0x76,0x6e,0x7e]]] as const)
 define(name,['acc','zp','zpx','abs','abx'],[...codes],[2,5,6,6,7]);
define('INC',['zp','zpx','abs','abx'],[0xe6,0xf6,0xee,0xfe],[5,6,6,7]);
define('DEC',['zp','zpx','abs','abx'],[0xc6,0xd6,0xce,0xde],[5,6,6,7]);
for(const [name,code] of [['BPL',0x10],['BMI',0x30],['BVC',0x50],['BVS',0x70],['BCC',0x90],['BCS',0xb0],['BNE',0xd0],['BEQ',0xf0]] as const)
 define(name,['rel'],[code],[2]);
for(const [name,code,cycles] of [
 ['BRK',0x00,7],['PHP',0x08,3],['CLC',0x18,2],['JSR',0x20,6],['PLP',0x28,4],['SEC',0x38,2],
 ['RTI',0x40,6],['PHA',0x48,3],['CLI',0x58,2],['RTS',0x60,6],['PLA',0x68,4],['SEI',0x78,2],
 ['DEY',0x88,2],['TXA',0x8a,2],['TYA',0x98,2],['TXS',0x9a,2],['TAY',0xa8,2],['TAX',0xaa,2],
 ['CLV',0xb8,2],['TSX',0xba,2],['INY',0xc8,2],['DEX',0xca,2],['CLD',0xd8,2],['INX',0xe8,2],
 ['NOP',0xea,2],['SED',0xf8,2]] as const) define(name,['imp'],[code],[cycles]);
define('JMP',['abs','ind'],[0x4c,0x6c],[3,5]);

export class CPU6502 {
 readonly memory = new Uint8Array(65536);
 bus?: {read(address:number):number;write(address:number,value:number):void};
 a=0; x=0; y=0; pc=0; sp=0xfd; status=0x24; halted=false; cycles=0;
 demoStopOnBrk=false; // Only for the temporary browser demo; not authentic hardware.
 private irqPending=false; private nmiPending=false;
 reset(pc?:number) {
   this.a=this.x=this.y=0; this.sp=0xfd; this.status=0x24; this.halted=false; this.cycles=0;
   this.irqPending=this.nmiPending=false;
   this.pc=pc ?? this.read16(0xfffc);
 }
 private read(addr:number){return this.bus?this.bus.read(addr&0xffff):this.memory[addr&0xffff];}
 private write(addr:number,value:number){if(this.bus)this.bus.write(addr&0xffff,value&255);else this.memory[addr&0xffff]=value&255;}
 private read16(addr:number){return this.read(addr)|(this.read(addr+1)<<8);}
 private fetch(){const v=this.read(this.pc);this.pc=(this.pc+1)&65535;return v;}
 private word(){const lo=this.fetch();return lo|(this.fetch()<<8);}
 private push(v:number){this.write(0x100|this.sp,v);this.sp=(this.sp-1)&255;}
 private pop(){this.sp=(this.sp+1)&255;return this.read(0x100|this.sp);}
 private flag(mask:number){return (this.status&mask)!==0;}
 private set(mask:number,yes:boolean){this.status=yes?this.status|mask:this.status&~mask;}
 private zn(v:number){this.set(2,(v&255)===0);this.set(0x80,!!(v&0x80));}
 private compare(a:number,b:number){const r=(a-b)&255;this.set(1,a>=b);this.zn(r);}
 private interrupt(vector:number,brk:boolean){
   this.push(this.pc>>8);this.push(this.pc&255);
   this.push((this.status|0x20)&(brk?255:~0x10));
   this.set(4,true);this.pc=this.read16(vector);this.cycles+=7;
 }
 requestIRQ(){this.irqPending=true;}
 requestNMI(){this.nmiPending=true;}
 private adc(v:number){
   const carry=this.flag(1)?1:0;const sum=this.a+v+carry;const binary=sum&255;
   this.set(0x40,!!(~(this.a^v)&(this.a^binary)&0x80));
   if(this.flag(8)){
     // NMOS 6502 decimal mode: N/Z/V reflect binary result.
     this.zn(binary);
     let lo=(this.a&15)+(v&15)+carry;
     let hi=(this.a>>4)+(v>>4);
     if(lo>9){lo+=6;hi++;}
     this.set(1,hi>9);
     if(hi>9)hi+=6;
     this.a=((hi<<4)|(lo&15))&255;
   }else{this.set(1,sum>255);this.a=binary;this.zn(this.a);}
 }
 private sbc(v:number){
   const borrow=this.flag(1)?0:1;const diff=this.a-v-borrow;const binary=diff&255;
   this.set(0x40,!!((this.a^v)&(this.a^binary)&0x80));
   this.set(1,diff>=0);
   if(this.flag(8)){
     this.zn(binary);
     let lo=(this.a&15)-(v&15)-borrow;
     let hi=(this.a>>4)-(v>>4);
     if(lo<0){lo-=6;hi--;}
     if(hi<0)hi-=6;
     this.a=((hi<<4)|(lo&15))&255;
   }else{this.a=binary;this.zn(this.a);}
 }
 step():number {
   if(this.halted)return 0;
   if(this.nmiPending){this.nmiPending=false;this.interrupt(0xfffa,false);return 7;}
   if(this.irqPending&&!this.flag(4)){this.irqPending=false;this.interrupt(0xfffe,false);return 7;}
   const start=this.pc,code=this.fetch(),op=OPS[code];
   if(!op)throw new Error('Unsupported opcode $'+code.toString(16).padStart(2,'0')+' at $'+start.toString(16).padStart(4,'0'));
   let addr=0,cross=false;
   switch(op.mode){
     case 'imm':addr=this.pc;this.pc=(this.pc+1)&65535;break;
     case 'zp':addr=this.fetch();break;
     case 'zpx':addr=(this.fetch()+this.x)&255;break;
     case 'zpy':addr=(this.fetch()+this.y)&255;break;
     case 'abs':addr=this.word();break;
     case 'abx':case 'aby':{const base=this.word();addr=(base+(op.mode==='abx'?this.x:this.y))&65535;cross=(base&0xff00)!==(addr&0xff00);break;}
     case 'izx':{const p=(this.fetch()+this.x)&255;addr=this.read(p)|(this.read((p+1)&255)<<8);break;}
     case 'izy':{const p=this.fetch(),base=this.read(p)|(this.read((p+1)&255)<<8);addr=(base+this.y)&65535;cross=(base&0xff00)!==(addr&0xff00);break;}
     case 'ind':{const p=this.word();addr=this.read(p)|(this.read((p&0xff00)|((p+1)&255))<<8);break;}
     case 'rel':{const b=this.fetch();addr=b<128?b:b-256;break;}
   }
   let extra=op.page&&cross?1:0;
   const v=()=>this.read(addr);
   switch(op.name){
     case 'LDA':this.a=v();this.zn(this.a);break;
     case 'LDX':this.x=v();this.zn(this.x);break;
     case 'LDY':this.y=v();this.zn(this.y);break;
     case 'STA':this.write(addr,this.a);break;
     case 'STX':this.write(addr,this.x);break;
     case 'STY':this.write(addr,this.y);break;
     case 'ORA':this.a|=v();this.zn(this.a);break;
     case 'AND':this.a&=v();this.zn(this.a);break;
     case 'EOR':this.a^=v();this.zn(this.a);break;
     case 'ADC':this.adc(v());break;
     case 'SBC':this.sbc(v());break;
     case 'CMP':this.compare(this.a,v());break;
     case 'CPX':this.compare(this.x,v());break;
     case 'CPY':this.compare(this.y,v());break;
     case 'BIT':{const b=v();this.set(2,(this.a&b)===0);this.set(0x40,!!(b&0x40));this.set(0x80,!!(b&0x80));break;}
     case 'ASL':case 'LSR':case 'ROL':case 'ROR':{
       const old=op.mode==='acc'?this.a:v(),carry=this.flag(1)?1:0;
       let n=0;
       if(op.name==='ASL'){this.set(1,!!(old&128));n=(old<<1)&255;}
       if(op.name==='LSR'){this.set(1,!!(old&1));n=old>>1;}
       if(op.name==='ROL'){this.set(1,!!(old&128));n=((old<<1)|carry)&255;}
       if(op.name==='ROR'){this.set(1,!!(old&1));n=(old>>1)|(carry<<7);}
       if(op.mode==='acc')this.a=n;else this.write(addr,n);
       this.zn(n);break;
     }
     case 'INC':case 'DEC':{const n=(v()+(op.name==='INC'?1:-1))&255;this.write(addr,n);this.zn(n);break;}
     case 'JMP':this.pc=addr;break;
     case 'JSR':{const target=addr;const ret=(this.pc-1)&65535;this.push(ret>>8);this.push(ret&255);this.pc=target;break;}
     case 'RTS':this.pc=((this.pop()|(this.pop()<<8))+1)&65535;break;
     case 'BRK':if(this.demoStopOnBrk){this.halted=true;break;}this.pc=(this.pc+1)&65535;this.interrupt(0xfffe,true);this.cycles-=7;break;
     case 'RTI':this.status=(this.pop()|0x20)&~0x10;this.pc=this.pop()|(this.pop()<<8);break;
     case 'PHA':this.push(this.a);break;
     case 'PHP':this.push(this.status|0x30);break;
     case 'PLA':this.a=this.pop();this.zn(this.a);break;
     case 'PLP':this.status=(this.pop()|0x20)&~0x10;break;
     case 'TAX':this.x=this.a;this.zn(this.x);break;
     case 'TXA':this.a=this.x;this.zn(this.a);break;
     case 'TAY':this.y=this.a;this.zn(this.y);break;
     case 'TYA':this.a=this.y;this.zn(this.a);break;
     case 'TSX':this.x=this.sp;this.zn(this.x);break;
     case 'TXS':this.sp=this.x;break;
     case 'INX':this.x=(this.x+1)&255;this.zn(this.x);break;
     case 'INY':this.y=(this.y+1)&255;this.zn(this.y);break;
     case 'DEX':this.x=(this.x-1)&255;this.zn(this.x);break;
     case 'DEY':this.y=(this.y-1)&255;this.zn(this.y);break;
     case 'CLC':this.set(1,false);break;
     case 'SEC':this.set(1,true);break;
     case 'CLI':this.set(4,false);break;
     case 'SEI':this.set(4,true);break;
     case 'CLV':this.set(0x40,false);break;
     case 'CLD':this.set(8,false);break;
     case 'SED':this.set(8,true);break;
     case 'BPL':case 'BMI':case 'BVC':case 'BVS':case 'BCC':case 'BCS':case 'BNE':case 'BEQ':{
       const f=({BPL:!this.flag(0x80),BMI:this.flag(0x80),BVC:!this.flag(0x40),BVS:this.flag(0x40),BCC:!this.flag(1),BCS:this.flag(1),BNE:!this.flag(2),BEQ:this.flag(2)} as Record<string,boolean>)[op.name];
       if(f){const old=this.pc;this.pc=(this.pc+addr)&65535;extra+=1+((old&0xff00)!==(this.pc&0xff00)?1:0);}break;
     }
   }
   const used=op.cycles+extra;this.cycles+=used;return used;
 }
 run(maxInstructions=10000){let n=0;while(!this.halted&&n<maxInstructions){this.step();n++;}return n;}
}
