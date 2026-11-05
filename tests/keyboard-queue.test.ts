import {describe,it,expect} from 'vitest';
import {AppleIIeBus} from '../src/bus';
describe('Apple II keyboard strobe',()=>{
 it('holds keys until the software acknowledges each one',()=>{
  const bus=new AppleIIeBus();
  bus.key(65);bus.key(66);
  expect(bus.read(0xc000)).toBe(0xc1);
  expect(bus.read(0xc000)).toBe(0xc1);
  bus.read(0xc010);
  expect(bus.read(0xc000)).toBe(0xc2);
  bus.write(0xc010,0);
  expect(bus.read(0xc000)&128).toBe(0);
  expect(bus.keyStats.submitted).toBe(2);
  expect(bus.keyStats.acknowledged).toBe(2);
 });
 it('clears pending input on reset',()=>{
  const bus=new AppleIIeBus();bus.key(65);bus.key(66);bus.reset();
  expect(bus.pendingKeys).toBe(0);
  expect(bus.read(0xc000)).toBe(0);
 });
});
