import {describe,it,expect} from 'vitest';
import {hiresAddress,textAddress} from '../src/graphics';
describe('Apple II graphics memory layout',()=>{
 it('interleaves text rows',()=>{
  expect(textAddress(0x400,0,0)).toBe(0x400);
  expect(textAddress(0x400,1,0)).toBe(0x480);
  expect(textAddress(0x400,8,0)).toBe(0x428);
  expect(textAddress(0x800,16,39)).toBe(0x800+80+39);
 });
 it('interleaves high resolution scanlines',()=>{
  expect(hiresAddress(0x2000,0,0)).toBe(0x2000);
  expect(hiresAddress(0x2000,1,0)).toBe(0x2400);
  expect(hiresAddress(0x2000,8,0)).toBe(0x2080);
  expect(hiresAddress(0x2000,64,0)).toBe(0x2028);
  expect(hiresAddress(0x4000,191,39)).toBe(0x4000+0x1c00+0x380+80+39);
 });
});
