import {describe,it,expect} from 'vitest';
import {CPU6502} from '../src/cpu';
function cpu(bytes:number[],pc=0x8000){const c=new CPU6502();c.memory.set(bytes,pc);c.reset(pc);return c;}
describe('6502 instruction and interrupt regression tests',()=>{
 it('executes branch and counts taken cycles',()=>{const c=cpu([0xa9,0,0xf0,2,0xa9,7,0xa9,9]);expect(c.step()).toBe(2);expect(c.step()).toBe(3);c.step();expect(c.a).toBe(9);});
 it('handles indexed zero-page wrapping',()=>{const c=cpu([0xa2,2,0xb5,0xff]);c.memory[1]=0x42;c.step();c.step();expect(c.a).toBe(0x42);});
 it('pushes and restores accumulator',()=>{const c=cpu([0xa9,0x5a,0x48,0xa9,0,0x68]);c.step();c.step();c.step();c.step();expect(c.a).toBe(0x5a);});
 it('JSR and RTS return to following instruction',()=>{const c=cpu([0x20,0x06,0x80,0xa9,0x77,0xea,0x60]);c.step();expect(c.pc).toBe(0x8006);c.step();expect(c.pc).toBe(0x8003);c.step();expect(c.a).toBe(0x77);});
 it('uses indirect JMP page-wrap behavior',()=>{const c=cpu([0x6c,0xff,0x12]);c.memory[0x12ff]=0x34;c.memory[0x1200]=0x56;c.memory[0x1300]=0x99;c.step();expect(c.pc).toBe(0x5634);});
 it('supports BRK vector and RTI',()=>{const c=cpu([0x00,0xea]);c.memory[0xfffe]=0x00;c.memory[0xffff]=0x90;c.memory[0x9000]=0x40;c.step();expect(c.pc).toBe(0x9000);c.step();expect(c.pc).toBe(0x8002);});
 it('supports decimal ADC',()=>{const c=cpu([0xf8,0xa9,0x15,0x69,0x27]);c.step();c.step();c.step();expect(c.a).toBe(0x42);});
 it('supports decimal SBC',()=>{const c=cpu([0xf8,0x38,0xa9,0x42,0xe9,0x27]);for(let i=0;i<4;i++)c.step();expect(c.a).toBe(0x15);});
 it('preserves demo stop as opt-in',()=>{const c=cpu([0]);c.demoStopOnBrk=true;c.step();expect(c.halted).toBe(true);});
});
