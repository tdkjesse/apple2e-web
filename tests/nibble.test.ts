import {describe,it,expect} from 'vitest';
import {encodeSector62,encodeTrack,GCR62,DOS33_PHYSICAL_TO_LOGICAL} from '../src/nibble';
describe('Disk II DOS 3.3 nibblization',()=>{
 it('encodes 256 bytes as 343 legal GCR disk bytes',()=>{
  const bytes=Uint8Array.from({length:256},(_,i)=>i);
  const encoded=encodeSector62(bytes);
  expect(encoded.length).toBe(343);
  for(const value of encoded)expect(GCR62.includes(value)).toBe(true);
 });
 it('encodes all-zero sectors with valid checksum',()=>{
  const encoded=encodeSector62(new Uint8Array(256));
  expect(encoded.every(value=>value===0x96)).toBe(true);
 });
 it('builds a full track with 16 address and data prologues',()=>{
  const bytes=new Uint8Array(4096);
  const track=encodeTrack(bytes,0);
  const count=(sequence:number[])=>{
   let n=0;for(let i=0;i<track.length-sequence.length;i++)
    if(sequence.every((b,j)=>track[i+j]===b))n++;
   return n;
  };
  expect(count([0xd5,0xaa,0x96])).toBe(16);
  expect(count([0xd5,0xaa,0xad])).toBe(16);
  expect(DOS33_PHYSICAL_TO_LOGICAL.length).toBe(16);
 });

 it('round-trips nontrivial sectors through an independent 6-and-2 decoder',()=>{
  const reverse=new Map(Array.from(GCR62,(v,i)=>[v,i]));
  const swap=[0,2,1,3];
  for(const seed of [0,1,73,255]){
   const source=Uint8Array.from({length:256},(_,i)=>(i*37+seed+(i*i%251))&255);
   const encoded=encodeSector62(source);
   let previous=0;
   const decoded=new Uint8Array(342);
   for(let i=0;i<342;i++){
    const n=reverse.get(encoded[i]);expect(n).toBeDefined();
    decoded[i]=n!^previous;previous=decoded[i];
   }
   expect(reverse.get(encoded[342])!^previous).toBe(0);
   const result=new Uint8Array(256);
   for(let i=0;i<256;i++)result[i]=decoded[86+i]<<2;
   for(let i=0;i<86;i++){
    const aux=decoded[85-i];
    result[i]|=swap[aux&3];
    if(i+86<256)result[i+86]|=swap[(aux>>2)&3];
    if(i+172<256)result[i+172]|=swap[(aux>>4)&3];
   }
   expect(result).toEqual(source);
  }
 });
 it('matches historical PRENIBL16 low-bit placement for isolated source bits',()=>{
  // Each input starts with an otherwise zero-filled sector. The final
  // auxiliary nibble is written at encoded offset 85 (reverse aux order).
  const cases:[number,number][]=[[0,0x9a],[86,0xa7],[172,0xd6]];
  for(const [offset,expected] of cases){
   const sector=new Uint8Array(256);sector[offset]=1;
   const encoded=encodeSector62(sector);
   expect(encoded[85]).toBe(expected);
  }
 });
 it('rejects incorrect sector and track lengths',()=>{
  expect(()=>encodeSector62(new Uint8Array(255))).toThrow();
  expect(()=>encodeTrack(new Uint8Array(100),0)).toThrow();
 });
});
