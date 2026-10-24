import React, { useEffect, useRef } from 'react';

export type AmbienceMode = 'sakura' | 'neon_rain' | 'off';

interface AnimeAmbienceFXProps {
  mode: AmbienceMode;
  opacity?: number;
}

interface Petal {
  x: number;
  y: number;
  size: number;
  speedY: number;
  speedX: number;
  angle: number;
  angleSpeed: number;
  flip: number;
  flipSpeed: number;
  color: string;
}

interface NeonDrop {
  x: number;
  y: number;
  length: number;
  speed: number;
  color: string;
  width: number;
}

export const AnimeAmbienceFX: React.FC<AnimeAmbienceFXProps> = ({ mode, opacity = 0.55 }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (mode === 'off') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    const scale = 0.5;
    let width = (canvas.width = Math.max(320, Math.floor(window.innerWidth * scale)));
    let height = (canvas.height = Math.max(240, Math.floor(window.innerHeight * scale)));

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = Math.max(320, Math.floor(window.innerWidth * scale));
      height = canvas.height = Math.max(240, Math.floor(window.innerHeight * scale));
    };
    window.addEventListener('resize', handleResize);

    // Inicjalizacja płatków Sakury
    const petalColors = [
      'rgba(255, 183, 197, 0.75)',
      'rgba(244, 114, 182, 0.70)',
      'rgba(251, 207, 232, 0.80)',
      'rgba(253, 232, 240, 0.85)',
    ];

    const petals: Petal[] = Array.from({ length: 36 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height - height,
      size: 9 + Math.random() * 8,
      speedY: 0.9 + Math.random() * 1.4,
      speedX: 0.4 + Math.random() * 0.9,
      angle: Math.random() * Math.PI * 2,
      angleSpeed: 0.01 + Math.random() * 0.02,
      flip: Math.random() * Math.PI,
      flipSpeed: 0.015 + Math.random() * 0.03,
      color: petalColors[Math.floor(Math.random() * petalColors.length)],
    }));

    // Inicjalizacja kropel Cyberpunk Neon Rain
    const neonColors = [
      'rgba(6, 182, 212, 0.85)',   // Cyan
      'rgba(168, 85, 247, 0.80)',  // Purple
      'rgba(244, 63, 94, 0.75)',   // Pink
    ];

    const drops: NeonDrop[] = Array.from({ length: 48 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      length: 18 + Math.random() * 26,
      speed: 12 + Math.random() * 14,
      color: neonColors[Math.floor(Math.random() * neonColors.length)],
      width: 1 + Math.random() * 1.5,
    }));

    // Rysowanie płatka sakury (szybkie renderowanie bez kosztownego shadowBlur)
    const drawPetal = (p: Petal) => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.scale(1, Math.sin(p.flip));

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(p.size / 2, -p.size / 2, p.size, -p.size / 4, p.size, 0);
      ctx.bezierCurveTo(p.size, p.size / 4, p.size / 2, p.size / 2, 0, 0);
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.restore();
    };

    let tick = 0;
    const render = () => {
      tick++;
      ctx.clearRect(0, 0, width, height);

      if (mode === 'sakura') {
        const wind = Math.sin(tick * 0.008) * 0.75;
        for (const p of petals) {
          p.y += p.speedY;
          p.x += p.speedX + wind;
          p.angle += p.angleSpeed;
          p.flip += p.flipSpeed;

          if (p.y > height + 20) {
            p.y = -20;
            p.x = Math.random() * width;
          }
          if (p.x > width + 20) {
            p.x = -20;
          } else if (p.x < -20) {
            p.x = width + 20;
          }

          drawPetal(p);
        }
      } else if (mode === 'neon_rain') {
        for (const d of drops) {
          ctx.beginPath();
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x - 2, d.y + d.length);
          ctx.strokeStyle = d.color;
          ctx.lineWidth = d.width;
          ctx.lineCap = 'round';
          ctx.stroke();

          d.y += d.speed;
          d.x -= 1.2;

          if (d.y > height + 40) {
            d.y = -d.length;
            d.x = Math.random() * width;
          }
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [mode]);

  if (mode === 'off') return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 2,
        opacity,
        transition: 'opacity 0.5s ease',
        willChange: 'transform',
        transform: 'translateZ(0)',
      }}
    />
  );
};
