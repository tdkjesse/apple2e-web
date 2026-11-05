import { CPU6502 } from './cpu';
const cpu = new CPU6502();
cpu.demoStopOnBrk = true;
const canvas = document.querySelector<HTMLCanvasElement>('#screen')!;
const ctx = canvas.getContext('2d')!;
const status = document.querySelector<HTMLElement>('#status')!;
function loadDemo() {
  cpu.memory.fill(0);
  const message = 'HELLO, APPLE II!';
  const program: number[] = [];
  for (let i = 0; i < message.length; i++) {
    const address = 0x400 + i;
    program.push(0xa9, message.charCodeAt(i) | 0x80, 0x8d, address & 255, address >> 8);
  }
  program.push(0x00);
  cpu.memory.set(program, 0x8000);
  cpu.reset();
  draw();
}
function draw() {
  ctx.fillStyle = '#071007'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#7dff89'; ctx.font = '18px monospace'; ctx.textBaseline = 'top';
  for (let row = 0; row < 24; row++) {
    let line = '';
    for (let col = 0; col < 40; col++) {
      const addr = 0x400 + ((row & 7) << 7) + Math.floor(row / 8) * 40 + col;
      const b = cpu.memory[addr];
      line += b >= 0xa0 ? String.fromCharCode(b & 0x7f) : ' ';
    }
    ctx.fillText(line, 8, row * 16);
  }
  status.textContent = 'PC: ' + cpu.pc.toString(16).padStart(4,'0') + ' A: ' + cpu.a.toString(16).padStart(2,'0') + ' Halted: ' + cpu.halted;
}
document.querySelector('#reset')!.addEventListener('click', loadDemo);
document.querySelector('#step')!.addEventListener('click', () => { try { cpu.step(); draw(); } catch (e) { status.textContent = String(e); } });
document.querySelector('#run')!.addEventListener('click', () => { try { cpu.run(); draw(); } catch (e) { status.textContent = String(e); } });
loadDemo();
