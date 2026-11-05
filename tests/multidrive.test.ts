import {describe,it,expect} from 'vitest';
import {AppleIIeBus} from '../src/bus';
import {DiskII} from '../src/disk';
describe('four floppy drives across two controllers',()=>{
 it('mounts two independent images on one card',()=>{
  const d=new DiskII(),a=new Uint8Array(143360),b=new Uint8Array(143360);
  a[0]=11;b[0]=22;d.mount(0,a);d.mount(1,b);
  expect(d.sector(0,0)[0]).toBe(11);d.access(0xc0eb);
  expect(d.sector(0,0)[0]).toBe(22);d.access(0xc0ea);
  expect(d.sector(0,0)[0]).toBe(11);
 });
 it('keeps each drive head position separate',()=>{
  const d=new DiskII();d.access(0xc0e3);expect(d.track).toBe(1);
  d.access(0xc0eb);expect(d.track).toBe(0);
  d.access(0xc0ea);expect(d.track).toBe(1);
 });
 it('routes slot 5 and slot 6 I/O separately',()=>{
  const b=new AppleIIeBus();b.read(0xc0d9);
  expect(b.disk5.motor).toBe(true);expect(b.disk.motor).toBe(false);
  b.read(0xc0e9);expect(b.disk.motor).toBe(true);
 });
 it('supports four independent mounts',()=>{
  const b=new AppleIIeBus();
  for(const slot of [5,6])for(let drive=0;drive<2;drive++){
   const data=new Uint8Array(143360);data[0]=slot*10+drive;
   b.diskControllers[slot].mount(drive,data);
  }
  for(const slot of [5,6])for(let drive=0;drive<2;drive++){
   b.diskControllers[slot].access(drive===0?0xc0ea:0xc0eb);
   expect(b.diskControllers[slot].sector(0,0)[0]).toBe(slot*10+drive);
  }
 });
});
