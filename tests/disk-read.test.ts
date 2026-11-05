import {describe,it,expect} from 'vitest';
import {DiskII} from '../src/disk';
import {AppleIIeBus} from '../src/bus';
describe('Disk II ROM and nibble read integration',()=>{
 it('reads encoded track bytes with motor on and wraps independently',()=>{
  const d=new DiskII();d.mount(0,new Uint8Array(143360));
  expect(d.readNibble()).toBe(0);
  d.access(0xc0e9);
  expect(d.readNibble()).toBe(0xff);
  for(let i=0;i<15;i++)d.readNibble();
  expect(d.readNibble()).toBe(0xd5);
 });
 it('reads the Q6-low read latch',()=>{
  const d=new DiskII();d.mount(0,new Uint8Array(143360));
  d.access(0xc0e9);expect(d.access(0xc0ec)).toBe(0);
  d.tick(31);expect(d.access(0xc0ec)).toBe(0);
  d.tick(1);expect(d.access(0xc0ec)).toBe(0xff);
  expect(d.access(0xc0ec)).toBe(0xff);
 });
 it('advances one nibble per 32 CPU cycles without consuming on repeated polls',()=>{
  const d=new DiskII();d.mount(0,new Uint8Array(143360));d.access(0xc0e9);
  d.tick(32*16);expect(d.access(0xc0ec)).toBe(0xff);
  d.tick(32);expect(d.access(0xc0ec)).toBe(0xd5);
  expect(d.access(0xc0ec)).toBe(0xd5);
  d.access(0xc0e8);d.tick(320);expect(d.access(0xc0ec)).toBe(0);
 });
 it('distinguishes disk contents and resets head position for a fresh boot',()=>{
  const d=new DiskII();const a=new Uint8Array(143360),b=new Uint8Array(143360);
  b[0]=1;d.mount(0,a);const first=d.fingerprint(0);
  d.mount(0,b);expect(d.fingerprint(0)).not.toBe(first);
  d.access(0xc0e9);d.readNibble();d.access(0xc0e3);
  d.rewind(0);expect(d.track).toBe(0);expect(d.readNibble()).toBe(0xff);
 });
 it('validates boot ROM size and maps slots independently',()=>{
  const b=new AppleIIeBus();
  expect(()=>b.disk.loadBootROM(new Uint8Array(255))).toThrow();
  const a=new Uint8Array(256),c=new Uint8Array(256);a[0]=0xa5;c[0]=0x5a;
  b.disk.loadBootROM(a);b.disk5.loadBootROM(c);
  expect(b.read(0xc600)).toBe(0xa5);expect(b.read(0xc500)).toBe(0x5a);
  b.write(0xc007,0);expect(b.read(0xc600)).toBe(0);
 });
});
