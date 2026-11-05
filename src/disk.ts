import {encodeTrack} from './nibble';
// Phase 6: Disk II drive state and sector-image validation.
// Raw sector images cannot be fed directly to the Disk II shift register:
// boot support requires 6-and-2 GCR nibblization and controller boot ROM.
export class DiskII {
 image:Uint8Array|null=null;
 readonly images:(Uint8Array|null)[]=[null,null];
 private readonly nibbleTracks:[(Uint8Array|null)[],(Uint8Array|null)[]]=[Array(35).fill(null),Array(35).fill(null)];
 private readonly positions=[0,0];
 private q6=false;
 private q7=false;
 private latch=0;
 readonly bootROM=new Uint8Array(256);
 bootROMLoaded=false;
 loadBootROM(bytes:Uint8Array){if(bytes.length!==256)throw new Error('Disk II slot ROM must be exactly 256 bytes');this.bootROM.set(bytes);this.bootROMLoaded=true;}
 readNibble(){
  const image=this.images[this.drive];if(!this.motor||!image)return 0;
  const t=this.tracks[this.drive];let stream=this.nibbleTracks[this.drive][t];
  if(!stream){stream=encodeTrack(image.subarray(t*4096,(t+1)*4096),t);this.nibbleTracks[this.drive][t]=stream;}
  const pos=this.positions[this.drive]%stream.length;
  const byte=stream[pos];this.positions[this.drive]=(pos+1)%stream.length;
  return byte;
 }

 readonly tracks=[0,0];
 readonly phasesByDrive=[0,0];
 private readonly coils=[[false,false,false,false],[false,false,false,false]];
 mount(drive:number,data:Uint8Array){
  if(drive!==0&&drive!==1)throw new RangeError('Drive must be 0 or 1');
  if(data.length!==143360)throw new Error('Expected a 140 KiB, 35-track, 16-sector .dsk image');
  this.images[drive]=new Uint8Array(data);this.nibbleTracks[drive].fill(null);this.positions[drive]=0;this.tracks[drive]=0;this.phasesByDrive[drive]=0;
  this.coils[drive].fill(false);if(drive===this.drive)this.syncDrive();
 }
 private syncDrive(){this.image=this.images[this.drive];this.track=this.tracks[this.drive];this.phase=this.phasesByDrive[this.drive];}
 get mountedDrives(){return this.images.map(image=>image!==null);}

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
  return this.image.slice((track*16+sector)*256,(track*16+sector+1)*256);
 }
 access(address:number,value?:number):number{
  const sw=address&15;
  if(sw<8){
   const phase=sw>>1,on=!!(sw&1);
   if(on&&!this.coils[this.drive][phase]){
    const forward=(this.phase+1)&3,backward=(this.phase+3)&3;
    if(phase===forward)this.track=Math.min(34,this.track+1);
    else if(phase===backward)this.track=Math.max(0,this.track-1);
    this.phase=phase;
   }
   this.coils[this.drive][phase]=on;
   this.tracks[this.drive]=this.track;this.phasesByDrive[this.drive]=this.phase;
  }else if(sw===8)this.motor=false;
  else if(sw===9)this.motor=true;
  else if(sw===10){this.drive=0;this.syncDrive();}
  else if(sw===11){this.drive=1;this.syncDrive();}
  else if(sw===12)this.q6=false;
  else if(sw===13)this.q6=true;
  else if(sw===14){this.q7=false;this.writeMode=false;}
  else if(sw===15){this.q7=true;this.writeMode=true;}
  // Read-only byte-latch approximation. Cycle-accurate shift timing and writes remain future work.
  if(!this.q6&&!this.q7&&value===undefined&&sw===12)this.latch=this.readNibble();
  return this.latch;
 }
}
