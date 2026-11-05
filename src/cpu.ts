export class CPU6502 {
  readonly memory = new Uint8Array(65536);
  a = 0; x = 0; y = 0; pc = 0; sp = 0xfd; status = 0x24; halted = false;
  reset(pc = 0x8000) { this.a = this.x = this.y = 0; this.pc = pc; this.sp = 0xfd; this.status = 0x24; this.halted = false; }
  private fetch() { const value = this.memory[this.pc]; this.pc = (this.pc + 1) & 0xffff; return value; }
  private word() { const lo = this.fetch(); return lo | (this.fetch() << 8); }
  private zn(value: number) { this.status = (this.status & ~0x82) | (value === 0 ? 2 : 0) | (value & 0x80); }
  step() {
    if (this.halted) return;
    const opcode = this.fetch();
    switch (opcode) {
      case 0xa9: this.a = this.fetch(); this.zn(this.a); break;
      case 0xa2: this.x = this.fetch(); this.zn(this.x); break;
      case 0xa0: this.y = this.fetch(); this.zn(this.y); break;
      case 0x8d: this.memory[this.word()] = this.a; break;
      case 0x8e: this.memory[this.word()] = this.x; break;
      case 0x8c: this.memory[this.word()] = this.y; break;
      case 0xe8: this.x = (this.x + 1) & 255; this.zn(this.x); break;
      case 0xc8: this.y = (this.y + 1) & 255; this.zn(this.y); break;
      case 0x4c: this.pc = this.word(); break;
      case 0xea: break;
      case 0x00: this.halted = true; break; // temporary demo stop, not real BRK
      default: throw new Error('Unsupported opcode $' + opcode.toString(16).padStart(2,'0'));
    }
  }
  run(maxInstructions = 10000) { let n = 0; while (!this.halted && n < maxInstructions) { this.step(); n++; } return n; }
}
