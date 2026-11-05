import {describe,it,expect} from 'vitest';
import {AppleIIeBus} from '../src/bus';
describe('Apple II speaker',()=>{
 it('toggles on both read and write of C030',()=>{
  const bus=new AppleIIeBus();
  bus.tick(10);bus.read(0xc030);
  bus.tick(15);bus.write(0xc030,0);
  expect(bus.speakerEdges).toEqual([10,25]);
  expect(bus.speakerLevel).toBe(0);
 });
 it('resets the speaker and edge history',()=>{
  const bus=new AppleIIeBus();bus.read(0xc030);bus.reset();
  expect(bus.speakerEdges).toEqual([]);
  expect(bus.speakerCycles).toBe(0);
  expect(bus.speakerLevel).toBe(0);
 });
});
