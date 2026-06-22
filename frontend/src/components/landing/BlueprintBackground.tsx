import { useEffect, useRef } from 'react';

export function BlueprintBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrame: number;
    let offset = 0;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx.scale(dpr, dpr);
    };

    const draw = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      ctx.clearRect(0, 0, w, h);

      // Grid
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.05)';
      ctx.lineWidth = 1;
      const grid = 48;
      for (let x = 0; x < w; x += grid) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += grid) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Floating fasteners
      const t = Date.now() / 1000;
      const fasteners = [
        { x: w * 0.12, y: h * 0.22, r: 14, type: 'nut' as const, phase: 0 },
        { x: w * 0.88, y: h * 0.18, r: 18, type: 'bolt' as const, phase: 1.2 },
        { x: w * 0.78, y: h * 0.72, r: 12, type: 'washer' as const, phase: 2.4 },
        { x: w * 0.18, y: h * 0.78, r: 16, type: 'gear' as const, phase: 0.8 },
        { x: w * 0.92, y: h * 0.55, r: 10, type: 'nut' as const, phase: 3.5 },
        { x: w * 0.05, y: h * 0.55, r: 11, type: 'washer' as const, phase: 4.1 },
      ];

      fasteners.forEach((f) => {
        const float = Math.sin(t + f.phase) * 6;
        const rotate = (t * 0.3 + f.phase) * (f.type === 'gear' ? 1 : 0.15);
        ctx.save();
        ctx.translate(f.x, f.y + float);
        ctx.rotate(rotate);
        ctx.strokeStyle = 'rgba(12, 74, 110, 0.12)';
        ctx.fillStyle = 'rgba(12, 74, 110, 0.04)';
        ctx.lineWidth = 1.5;

        if (f.type === 'nut') {
          drawHex(ctx, 0, 0, f.r);
          ctx.beginPath();
          ctx.arc(0, 0, f.r * 0.35, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        } else if (f.type === 'bolt') {
          drawHex(ctx, 0, -f.r * 0.6, f.r * 0.6);
          ctx.fillRect(-f.r * 0.3, -f.r * 0.2, f.r * 0.6, f.r * 1.6);
          ctx.strokeRect(-f.r * 0.3, -f.r * 0.2, f.r * 0.6, f.r * 1.6);
          // threads
          for (let i = 0; i < 5; i++) {
            const y = f.r * 0.2 + i * f.r * 0.28;
            ctx.beginPath();
            ctx.moveTo(-f.r * 0.3, y);
            ctx.lineTo(f.r * 0.3, y);
            ctx.stroke();
          }
        } else if (f.type === 'washer') {
          ctx.beginPath();
          ctx.arc(0, 0, f.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(0, 0, f.r * 0.4, 0, Math.PI * 2);
          ctx.stroke();
        } else if (f.type === 'gear') {
          drawGear(ctx, 0, 0, f.r, 10);
        }
        ctx.restore();
      });

      offset = (offset + 0.2) % 100;
      animationFrame = requestAnimationFrame(draw);
    };

    const drawHex = (c: CanvasRenderingContext2D, x: number, y: number, r: number) => {
      c.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        const px = x + r * Math.cos(angle);
        const py = y + r * Math.sin(angle);
        if (i === 0) c.moveTo(px, py);
        else c.lineTo(px, py);
      }
      c.closePath();
      c.fill();
      c.stroke();
    };

    const drawGear = (c: CanvasRenderingContext2D, x: number, y: number, r: number, teeth: number) => {
      c.beginPath();
      for (let i = 0; i < teeth * 2; i++) {
        const angle = (i / (teeth * 2)) * Math.PI * 2;
        const radius = i % 2 === 0 ? r * 1.3 : r;
        const px = x + radius * Math.cos(angle);
        const py = y + radius * Math.sin(angle);
        if (i === 0) c.moveTo(px, py);
        else c.lineTo(px, py);
      }
      c.closePath();
      c.fill();
      c.stroke();
      c.beginPath();
      c.arc(x, y, r * 0.35, 0, Math.PI * 2);
      c.fill();
      c.stroke();
    };

    resize();
    draw();
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden="true"
    />
  );
}
