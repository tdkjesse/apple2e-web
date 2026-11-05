import {describe,it,expect} from 'vitest';
import {DiskII} from '../src/disk';
import {AppleIIeBus} from '../src/bus';
describe('Phase 6 Disk II groundwork',()=>{
 it('accepts 140K images and preserves a private copy',()=>{
  const d=new DiskII(),bytes=new Uint8Array(143360);bytes[256]=0x42;
  d.load(bytes);bytes[256]=0;expect(d.sector(0,1)[0]).toBe(0x42);
 });
 it('rejects invalid images and out-of-range sectors',()=>{
  const d=new DiskII();expect(()=>d.load(new Uint8Array(10))).toThrow();
  d.load(new Uint8Array(143360));expect(()=>d.sector(35,0)).toThrow();
 });
 it('responds to slot 6 motor and drive selection',()=>{
  const b=new AppleIIeBus();b.read(0xc0e9);expect(b.disk.motor).toBe(true);
  b.write(0xc0eb,0);expect(b.disk.drive).toBe(1);
  b.read(0xc0e8);expect(b.disk.motor).toBe(false);
 });
 it('does not pretend raw sector bytes are controller nibble data',()=>{
  const d=new DiskII();d.load(new Uint8Array(143360).fill(0xff));
  d.access(0xc0e9);expect(d.access(0xc0ec)).toBe(0);
 });
});
