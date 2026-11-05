import {describe,it,expect} from 'vitest';
import {AppleIIeBus} from '../src/bus';
import {CPU6502} from '../src/cpu';
describe('16 KiB Enhanced Apple IIe ROM loading',()=>{
 it('maps D000-FFFF and reset vector from a 16 KiB image',()=>{
  const b=new AppleIIeBus(),r=new Uint8Array(0x4000);
  r[0x1000]=0x42;r[0x3ffc]=0x00;r[0x3ffd]=0xe0;
  b.loadROM(r);expect(b.read(0xd000)).toBe(0x42);
  const cpu=new CPU6502();cpu.bus=b;cpu.reset();expect(cpu.pc).toBe(0xe000);
 });
 it('maps internal Cx ROM only with its selection switches',()=>{
  const b=new AppleIIeBus(),r=new Uint8Array(0x4000);
  r[0x100]=0x21;r[0x300]=0x32;r[0x800]=0x48;b.loadROM(r);
  expect(b.read(0xc100)).toBe(0);
  expect(b.read(0xc300)).toBe(0x32);
  b.write(0xc007,0);expect(b.read(0xc100)).toBe(0x21);
  expect(b.read(0xc800)).toBe(0x48);
  b.write(0xc006,0);b.write(0xc00b,0);expect(b.read(0xc300)).toBe(0);
 });
 it('keeps keyboard and soft-switch I/O ahead of C0 ROM bytes',()=>{
  const b=new AppleIIeBus(),r=new Uint8Array(0x4000);r[0]=0x55;
  b.loadROM(r);b.key(65);expect(b.read(0xc000)).toBe(0xc1);
 });
 it('continues to accept 12 KiB firmware',()=>{
  const b=new AppleIIeBus(),r=new Uint8Array(0x3000);r[0]=0x77;
  b.loadROM(r);expect(b.read(0xd000)).toBe(0x77);
 });
});
