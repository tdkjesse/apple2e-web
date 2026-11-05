import {encodeTrack} from './nibble';
// Phase 6: Disk II drive state and sector-image validation.
// Raw sector images cannot be fed directly to the Disk II shift register:
// boot support requires 6-and-2 GCR nibblization and controller boot ROM.
export class DiskII {
 image:Uint8Array|null=null;
 readonly images:(Uint8Array|null)[]=[null,null];
 private readonly rawNibble:[Uint8Array[]|null,Uint8Array[]|null]=[null,null];
 readonly formats:['DSK'|'NIB'|null,'DSK'|'NIB'|null]=[null,null];
 private readonly nibbleTracks:[(Uint8Array|null)[],(Uint8Array|null)[]]=[Array(35).fill(null),Array(35).fill(null)];
 private readonly positions=[0,0];
 // Fingerprint the actual mounted sector bytes, not the file name or generated GCR stream.
 fingerprint(drive:number):string{
  const image=this.images[drive];if(!image)return 'none';
  let hash=2166136261;
  for(const byte of image){hash=Math.imul(hash^byte,16777619)>>>0;}
  return hash.toString(16).padStart(8,'0');
 }
 rewind(drive:number){if(drive!==0&&drive!==1)throw new RangeError('Drive must be 0 or 1');this.positions[drive]=0;this.cycleRemainder=0;this.nextNibbleCycles=32;this.latch=0;this.dataReady=false;this.tracks[drive]=0;this.phasesByDrive[drive]=0;this.halfTracks[drive]=0;this.coils[drive].fill(false);if(this.drive===drive)this.syncDrive();}

 private q6=false;
 private q7=false;
 private latch=0;
 private dataReady=false;
 readonly readStats={ready:0,waiting:0,overwritten:0,produced:0};
 resetReadStats(){this.readStats.ready=0;this.readStats.waiting=0;this.readStats.overwritten=0;this.readStats.produced=0;}
 readonly sectorProbe={track:0,addresses:0,dataMarks:0,lastSector:-1,lastVolume:-1,invalidChecksums:0,sectorCounts:Array(16).fill(0) as number[],recent:[] as string[]};
 private probeBytes:number[]=[];
 private probeAddressRemaining=0;
 private probeAddressBytes:number[]=[];
 resetSectorProbe(){const p=this.sectorProbe;p.track=this.track;p.addresses=0;p.dataMarks=0;p.lastSector=-1;p.lastVolume=-1;p.invalidChecksums=0;p.sectorCounts.fill(0);p.recent.length=0;this.probeBytes.length=0;this.probeAddressRemaining=0;this.probeAddressBytes.length=0;}
 private observeNibble(byte:number){
  const p=this.sectorProbe;
  if(this.track!==p.track){this.resetSectorProbe();p.track=this.track;}
  const h=this.probeBytes;
  h.push(byte);if(h.length>11)h.shift();
  const n=h.length;
  if(n>=3&&h[n-3]===0xd5&&h[n-2]===0xaa&&h[n-1]===0xad)p.dataMarks++;
  if(n>=3&&h[n-3]===0xd5&&h[n-2]===0xaa&&h[n-1]===0x96){
   this.probeAddressRemaining=8;
   this.probeAddressBytes.length=0;
  }else if(this.probeAddressRemaining>0){
   this.probeAddressBytes.push(byte);this.probeAddressRemaining--;
   if(this.probeAddressRemaining===0){
    const a=this.probeAddressBytes;
    const decode=(x:number,y:number)=>((x<<1)|1)&y;
    const volume=decode(a[0],a[1]),track=decode(a[2],a[3]);
    const sector=decode(a[4],a[5]),checksum=decode(a[6],a[7]);
    p.addresses++;p.lastVolume=volume;p.lastSector=sector;
    if((volume^track^sector)!==checksum)p.invalidChecksums++;
    if(sector<16)p.sectorCounts[sector]++;
    p.recent.push('T'+track+'S'+sector);if(p.recent.length>12)p.recent.shift();
   }
  }
 }
 readonly cpuReadProbe={total:0,ready:0,waiting:0,highBit:0,zero:0,last:[] as string[],prologues:0,dataPrologues:0};
 private cpuReadHistory:number[]=[];
 resetCpuReadProbe(){const p=this.cpuReadProbe;p.total=0;p.ready=0;p.waiting=0;p.highBit=0;p.zero=0;p.last.length=0;p.prologues=0;p.dataPrologues=0;this.cpuReadHistory.length=0;}
 private observeCpuRead(value:number,ready:boolean){
  const p=this.cpuReadProbe;p.total++;
  if(ready)p.ready++;else p.waiting++;
  if(value&128)p.highBit++;
  if(value===0)p.zero++;
  if(ready){
   const h=this.cpuReadHistory;h.push(value);if(h.length>3)h.shift();
   if(h.length===3&&h[0]===0xd5&&h[1]===0xaa){
    if(h[2]===0x96)p.prologues++;
    if(h[2]===0xad)p.dataPrologues++;
   }
   p.last.push(value.toString(16).padStart(2,'0'));
   if(p.last.length>16)p.last.shift();
  }
 }
 private cycleRemainder=0;
 // Apple II sync $FF bytes contain extra zero bit cells; allow comparison with legacy fixed timing.
 syncTiming=true;
 private nextNibbleCycles=32;
 // Disk II nominal byte rate is about one byte per 32 1 MHz CPU cycles.
 tick(cycles:number){
  if(!this.motor||!this.mountedDrives[this.drive]||this.q7)return;
  this.cycleRemainder+=cycles;
  while(this.cycleRemainder>=this.nextNibbleCycles){this.cycleRemainder-=this.nextNibbleCycles;if(this.dataReady)this.readStats.overwritten++;
   this.latch=this.readNibble();this.dataReady=true;this.readStats.produced++;
   this.nextNibbleCycles=this.syncTiming&&this.latch===0xff?40:32;}
 }

 readonly bootROM=new Uint8Array(256);
 bootROMLoaded=false;
 loadBootROM(bytes:Uint8Array){if(bytes.length!==256)throw new Error('Disk II slot ROM must be exactly 256 bytes');this.bootROM.set(bytes);this.bootROMLoaded=true;}
 readNibble(){
  const image=this.images[this.drive];if(!this.motor||!image)return 0;
  const t=this.tracks[this.drive];let stream=this.rawNibble[this.drive]?.[t]??this.nibbleTracks[this.drive][t];
  if(!stream){stream=encodeTrack(image.subarray(t*4096,(t+1)*4096),t);this.nibbleTracks[this.drive][t]=stream;}
  const pos=this.positions[this.drive]%stream.length;
  const byte=stream[pos];this.positions[this.drive]=(pos+1)%stream.length;
  this.observeNibble(byte);
  return byte;
 }

 readonly tracks=[0,0];
 readonly phasesByDrive=[0,0];
 private readonly halfTracks=[0,0];
 readonly headStats={transitions:0,history:[] as string[]};
 resetHeadStats(){this.headStats.transitions=0;this.headStats.history.length=0;}
 private readonly coils=[[false,false,false,false],[false,false,false,false]];
 mount(drive:number,data:Uint8Array){
  if(drive!==0&&drive!==1)throw new RangeError('Drive must be 0 or 1');
  if(data.length!==143360&&data.length!==232960)throw new Error('Expected 143360-byte .dsk or 232960-byte .nib image');
  this.formats[drive]=data.length===232960?'NIB':'DSK';
  this.rawNibble[drive]=data.length===232960?Array.from({length:35},(_,t)=>new Uint8Array(data.slice(t*6656,(t+1)*6656))):null;
  this.images[drive]=new Uint8Array(data);this.nibbleTracks[drive].fill(null);this.positions[drive]=0;this.cycleRemainder=0;this.nextNibbleCycles=32;this.latch=0;this.tracks[drive]=0;this.phasesByDrive[drive]=0;this.halfTracks[drive]=0;
  this.coils[drive].fill(false);if(drive===this.drive)this.syncDrive();
 }
 private syncDrive(){this.image=this.images[this.drive];this.track=this.tracks[this.drive];this.phase=this.phasesByDrive[this.drive];}
 get mountedDrives(){return this.images.map(image=>image!==null);}
 get readPosition(){return this.positions[this.drive];}
 get readLatch(){return this.latch;}
 get readCycles(){return this.cycleRemainder;}

 motor=false;drive=0;track=0;phase=0;writeMode=false;
 
 load(data:Uint8Array){
  this.mount(0,data);this.motor=false;this.writeMode=false;
 }
 get mounted(){return this.image!==null;}
 // Sector inspection is independent of the future nibble-stream implementation.
 sector(track:number,sector:number):Uint8Array{
  if(!this.image)throw new Error('No disk mounted');
  if(!Number.isInteger(track)||track<0||track>=35||!Number.isInteger(sector)||sector<0||sector>=16)
   throw new RangeError('Track/sector out of range');
  if(this.formats[this.drive]!=='DSK')throw new Error('Sector access requires a .dsk image');
  return this.image.slice((track*16+sector)*256,(track*16+sector+1)*256);
 }
 access(address:number,value?:number):number{
  const sw=address&15;
  if(sw<8){
   const phase=sw>>1,on=!!(sw&1);
   if(on&&!this.coils[this.drive][phase]){
    const forward=(this.phase+1)&3,backward=(this.phase+3)&3;
    if(phase===forward)this.halfTracks[this.drive]=Math.min(68,this.halfTracks[this.drive]+1);
    else if(phase===backward)this.halfTracks[this.drive]=Math.max(0,this.halfTracks[this.drive]-1);
    const previousTrack=this.track;
    this.track=Math.floor(this.halfTracks[this.drive]/2);
    if(this.track!==previousTrack){
     this.headStats.transitions++;
     this.headStats.history.push('D'+(this.drive+1)+':'+previousTrack+'>'+this.track);
     if(this.headStats.history.length>12)this.headStats.history.shift();
    }
    this.phase=phase;
   }
   this.coils[this.drive][phase]=on;
   this.tracks[this.drive]=this.track;this.phasesByDrive[this.drive]=this.phase;
  }else if(sw===8){this.motor=false;this.cycleRemainder=0;this.latch=0;this.dataReady=false;}
  else if(sw===9){if(!this.motor){this.cycleRemainder=0;this.latch=0;}this.motor=true;}
  else if(sw===10){this.drive=0;this.syncDrive();}
  else if(sw===11){this.drive=1;this.syncDrive();}
  else if(sw===12)this.q6=false;
  else if(sw===13)this.q6=true;
  else if(sw===14){this.q7=false;this.writeMode=false;}
  else if(sw===15){this.q7=true;this.writeMode=true;}
  // Reading the Q6-low data register acknowledges the current byte.
  // Until another byte arrives, bit 7 is clear, allowing the boot ROM's BMI polling loop to wait.
  if(sw===12&&!this.q6&&!this.q7&&value===undefined){
   if(this.dataReady)this.readStats.ready++;else this.readStats.waiting++;
   const ready=this.dataReady;
   const result=ready?this.latch:this.latch&0x7f;
   this.observeCpuRead(result,ready);
   this.dataReady=false;
   return result;
  }
  return this.latch;
 }
}
