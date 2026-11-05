import {describe,it,expect} from 'vitest';
import {AppleIIeBus} from '../src/bus';
import {CPU6502} from '../src/cpu';
describe('Apple IIe first-stage hardware bus',()=>{
 it('latches key and clears strobe',()=>{const b=new AppleIIeBus();b.key(65);expect(b.read(0xc000)).toBe(0xc1);b.read(0xc010);expect(b.read(0xc000)).toBe(0x41);});
 it('protects loaded ROM and provides reset vector',()=>{const b=new AppleIIeBus();const r=new Uint8Array(0x3000);r[0x2ffc]=0x34;r[0x2ffd]=0x12;b.loadROM(r);b.write(0xfffc,0);const c=new CPU6502();c.bus=b;c.reset();expect(c.pc).toBe(0x1234);});
 it('switches text and page2 on access',()=>{const b=new AppleIIeBus();b.read(0xc050);b.write(0xc055,0);expect(b.text).toBe(false);expect(b.page2).toBe(true);b.read(0xc051);expect(b.text).toBe(true);});
 it('CPU reads keyboard through bus',()=>{const b=new AppleIIeBus();const c=new CPU6502();c.bus=b;b.ram.set([0xad,0,0xc0],0x8000);b.key(65);c.reset(0x8000);c.step();expect(c.a).toBe(0xc1);});
 it('rejects incorrectly sized ROM',()=>{const b=new AppleIIeBus();expect(()=>b.loadROM(new Uint8Array(100))).toThrow();});
});
