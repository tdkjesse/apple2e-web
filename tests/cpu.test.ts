import { describe, expect, it } from 'vitest';
import { CPU6502 } from '../src/cpu';
describe('CPU6502 subset', () => {
  it('loads accumulator', () => { const c = new CPU6502(); c.memory.set([0xa9,0x42,0],0x8000); c.reset(); c.step(); expect(c.a).toBe(0x42); });
  it('stores accumulator', () => { const c = new CPU6502(); c.memory.set([0xa9,0x61,0x8d,0,4,0],0x8000); c.reset(); c.run(); expect(c.memory[0x400]).toBe(0x61); });
  it('sets zero flag', () => { const c = new CPU6502(); c.memory.set([0xa9,0],0x8000); c.reset(); c.step(); expect(c.status & 2).toBe(2); });
  it('wraps X', () => { const c = new CPU6502(); c.memory.set([0xa2,255,0xe8,0],0x8000); c.reset(); c.run(); expect(c.x).toBe(0); });
  it('jumps', () => { const c = new CPU6502(); c.memory.set([0x4c,0x34,0x12],0x8000); c.reset(); c.step(); expect(c.pc).toBe(0x1234); });
});
