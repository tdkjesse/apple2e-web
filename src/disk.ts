// Phase 6: Disk II drive state and sector-image validation.
// Raw sector images cannot be fed directly to the Disk II shift register:
// boot support requires 6-and-2 GCR nibblization and controller boot ROM.
export class DiskII {
 image:Uint8Array|null=null;
 motor=false;drive=0;track=0;phase=0;writeMode=false;
 private phases=[false,false,false,false];
 load(data:Uint8Array){
  if(data.length!==35*16*256)throw new Error('Expected a 140 KiB, 35-track, 16-sector .dsk image');
  this.image=new Uint8Array(data);this.motor=false;this.track=0;this.phase=0;
  this.phases.fill(false);this.writeMode=false;
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
   if(on&&!this.phases[phase]){
    const forward=(this.phase+1)&3,backward=(this.phase+3)&3;
    if(phase===forward)this.track=Math.min(34,this.track+1);
    else if(phase===backward)this.track=Math.max(0,this.track-1);
    this.phase=phase;
   }
   this.phases[phase]=on;
  }else if(sw===8)this.motor=false;
  else if(sw===9)this.motor=true;
  else if(sw===10)this.drive=0;
  else if(sw===11)this.drive=1;
  else if(sw===14)this.writeMode=false;
  else if(sw===15)this.writeMode=true;
  // Placeholder: Disk II nibble latch is not implemented; do not fake sector bytes.
  void value;
  return 0;
 }
}
