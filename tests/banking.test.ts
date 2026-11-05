import {describe,it,expect} from 'vitest';
import {AppleIIeBus} from '../src/bus';
describe('Apple IIe bank switching',()=>{
 it('separates main and auxiliary read/write banks',()=>{
  const b=new AppleIIeBus();b.write(0x200,0x11);b.write(0xc005,0);b.write(0x200,0x22);
  expect(b.read(0x200)).toBe(0x11);b.write(0xc003,0);expect(b.read(0x200)).toBe(0x22);
 });
 it('ALTZP switches zero page and stack together',()=>{
  const b=new AppleIIeBus();b.write(0x100,0x33);b.write(0xc009,0);b.write(0x100,0x44);
  expect(b.read(0x100)).toBe(0x44);b.write(0xc008,0);expect(b.read(0x100)).toBe(0x33);
 });
 it('80STORE maps text page through PAGE2',()=>{
  const b=new AppleIIeBus();b.write(0x400,0x55);b.write(0xc001,0);b.write(0xc055,0);b.write(0x400,0x66);
  expect(b.read(0x400)).toBe(0x66);b.write(0xc054,0);expect(b.read(0x400)).toBe(0x55);
 });
 it('language card has banked D000 and shared E000',()=>{
  const b=new AppleIIeBus();b.read(0xc081);b.read(0xc081);b.write(0xd000,0x21);b.write(0xe000,0x41);
  b.read(0xc083);expect(b.read(0xd000)).toBe(0x21);expect(b.read(0xe000)).toBe(0x41);
  b.read(0xc08b);b.read(0xc08b);b.write(0xd000,0x31);b.read(0xc08b);
  expect(b.read(0xd000)).toBe(0x31);expect(b.read(0xe000)).toBe(0x41);
  b.read(0xc083);expect(b.read(0xd000)).toBe(0x21);
 });
 it('reset clears switches without erasing RAM',()=>{
  const b=new AppleIIeBus();b.write(0x300,0x77);b.write(0xc003,0);b.reset();
  expect(b.read(0x300)).toBe(0x77);expect(b.ramrd).toBe(false);
 });
});
