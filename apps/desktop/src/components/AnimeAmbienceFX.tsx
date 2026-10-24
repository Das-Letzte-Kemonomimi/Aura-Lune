import React, { useEffect, useRef } from 'react';

export type AmbienceMode =
  | 'sakura'
  | 'neon_rain'
  | 'fireflies'
  | 'snow'
  | 'meteor_shower'
  | 'matrix_rain'
  | 'momiji'
  | 'off';

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

interface Firefly {
  x: number;
  y: number;
  radius: number;
  speedX: number;
  speedY: number;
  phase: number;
  pulseSpeed: number;
  driftAngle: number;
  color: string;
  glowColor: string;
}

interface SnowFlake {
  x: number;
  y: number;
  radius: number;
  speedY: number;
  speedX: number;
  sway: number;
  swaySpeed: number;
  color: string;
}

interface Meteor {
  x: number;
  y: number;
  length: number;
  speed: number;
  angle: number;
  thickness: number;
  color: string;
  tailColor: string;
  active: boolean;
  cooldown: number;
}

interface Star {
  x: number;
  y: number;
  radius: number;
  phase: number;
  pulseSpeed: number;
  color: string;
}

interface MatrixDrop {
  x: number;
  y: number;
  speed: number;
  chars: string[];
  charIndex: number;
  tickCounter: number;
}

interface MomijiLeaf {
  x: number;
  y: number;
  size: number;
  speedY: number;
  speedX: number;
  angle: number;
  angleSpeed: number;
  flip: number;
  flipSpeed: number;
  sway: number;
  swaySpeed: number;
  color: string;
  stemColor: string;
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

    // 1. Inicjalizacja płatków Sakury
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

    // 2. Inicjalizacja kropel Cyberpunk Neon Rain
    const neonColors = [
      'rgba(6, 182, 212, 0.85)', // Cyan
      'rgba(168, 85, 247, 0.80)', // Purple
      'rgba(244, 63, 94, 0.75)', // Pink
    ];

    const drops: NeonDrop[] = Array.from({ length: 48 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      length: 18 + Math.random() * 26,
      speed: 12 + Math.random() * 14,
      color: neonColors[Math.floor(Math.random() * neonColors.length)],
      width: 1 + Math.random() * 1.5,
    }));

    // 3. Inicjalizacja świetlików (Fireflies / Stardust)
    const fireflyGlowColors = [
      'rgba(234, 179, 8, 0.55)',
      'rgba(163, 230, 53, 0.50)',
      'rgba(52, 211, 153, 0.45)',
      'rgba(251, 191, 36, 0.55)',
    ];
    const fireflyCoreColors = [
      'rgba(254, 240, 138, 0.95)',
      'rgba(217, 249, 157, 0.95)',
      'rgba(167, 243, 208, 0.95)',
      'rgba(253, 230, 138, 0.95)',
    ];

    const fireflies: Firefly[] = Array.from({ length: 34 }, () => {
      const cIdx = Math.floor(Math.random() * fireflyGlowColors.length);
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        radius: 1.8 + Math.random() * 2.2,
        speedX: (Math.random() - 0.5) * 0.4,
        speedY: 0.25 + Math.random() * 0.45,
        phase: Math.random() * Math.PI * 2,
        pulseSpeed: 0.02 + Math.random() * 0.03,
        driftAngle: Math.random() * Math.PI * 2,
        color: fireflyCoreColors[cIdx],
        glowColor: fireflyGlowColors[cIdx],
      };
    });

    // 4. Inicjalizacja płatków śniegu (Snow)
    const snowColors = [
      'rgba(255, 255, 255, 0.85)',
      'rgba(240, 249, 255, 0.80)',
      'rgba(224, 242, 254, 0.75)',
    ];

    const snowflakes: SnowFlake[] = Array.from({ length: 48 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: 1.2 + Math.random() * 2.6,
      speedY: 0.6 + Math.random() * 1.1,
      speedX: (Math.random() - 0.5) * 0.3,
      sway: Math.random() * Math.PI * 2,
      swaySpeed: 0.015 + Math.random() * 0.025,
      color: snowColors[Math.floor(Math.random() * snowColors.length)],
    }));

    // 5. Inicjalizacja Meteor Shower / Starlight
    const backgroundStars: Star[] = Array.from({ length: 45 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: 0.8 + Math.random() * 1.8,
      phase: Math.random() * Math.PI * 2,
      pulseSpeed: 0.015 + Math.random() * 0.03,
      color: Math.random() > 0.4 ? 'rgba(255, 255, 255, 0.9)' : 'rgba(167, 139, 250, 0.85)',
    }));

    const meteors: Meteor[] = Array.from({ length: 5 }, () => ({
      x: Math.random() * width,
      y: -50,
      length: 60 + Math.random() * 80,
      speed: 14 + Math.random() * 10,
      angle: Math.PI / 4 + (Math.random() - 0.5) * 0.2, // ~45 deg
      thickness: 1.5 + Math.random() * 1.5,
      color: 'rgba(255, 255, 255, 0.95)',
      tailColor: Math.random() > 0.5 ? 'rgba(139, 92, 246, 0.7)' : 'rgba(56, 189, 248, 0.7)',
      active: false,
      cooldown: Math.floor(Math.random() * 120),
    }));

    // 6. Inicjalizacja Cyber Matrix Rain
    const katakana =
      'アカサタナハマヤラワイキシチニヒミリウクスツヌフムユルエケセテネヘメレオコソトノホモヨロヲン0123456789AZX';
    const matrixDropCount = Math.floor(width / 16);
    const matrixDrops: MatrixDrop[] = Array.from({ length: matrixDropCount }, (_, i) => ({
      x: i * 16 + 8,
      y: (Math.random() * -height) / 2,
      speed: 3 + Math.random() * 4,
      chars: Array.from({ length: 12 }, () => katakana[Math.floor(Math.random() * katakana.length)]),
      charIndex: 0,
      tickCounter: 0,
    }));

    // 7. Inicjalizacja jesiennych liści klonu (Momiji)
    const momijiColors = [
      { fill: 'rgba(220, 38, 38, 0.85)', stem: '#7f1d1d' }, // Crimson
      { fill: 'rgba(234, 88, 12, 0.85)', stem: '#9a3412' }, // Red-orange
      { fill: 'rgba(245, 158, 11, 0.85)', stem: '#b45309' }, // Amber
      { fill: 'rgba(185, 28, 28, 0.88)', stem: '#450a0a' }, // Deep Scarlet
    ];

    const momijiLeaves: MomijiLeaf[] = Array.from({ length: 30 }, () => {
      const col = momijiColors[Math.floor(Math.random() * momijiColors.length)];
      return {
        x: Math.random() * width,
        y: Math.random() * height - height,
        size: 11 + Math.random() * 10,
        speedY: 0.8 + Math.random() * 1.3,
        speedX: 0.3 + Math.random() * 0.7,
        angle: Math.random() * Math.PI * 2,
        angleSpeed: 0.01 + Math.random() * 0.025,
        flip: Math.random() * Math.PI,
        flipSpeed: 0.02 + Math.random() * 0.035,
        sway: Math.random() * Math.PI * 2,
        swaySpeed: 0.02 + Math.random() * 0.03,
        color: col.fill,
        stemColor: col.stem,
      };
    });

    // Rysowanie pojedynczego płatka sakury
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

    // Rysowanie liścia klonu (Momiji) o 5 klapach
    const drawMomiji = (m: MomijiLeaf) => {
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.rotate(m.angle);
      ctx.scale(1, Math.sin(m.flip));

      const s = m.size;
      ctx.beginPath();
      ctx.moveTo(0, s * 0.6); // Ogonek
      ctx.lineTo(0, 0);

      // 5 klap liścia
      // Centralna klapa
      ctx.lineTo(-s * 0.25, -s * 0.4);
      ctx.lineTo(-s * 0.15, -s * 0.55);
      ctx.lineTo(0, -s * 0.95);
      ctx.lineTo(s * 0.15, -s * 0.55);
      ctx.lineTo(s * 0.25, -s * 0.4);

      // Lewa klapa
      ctx.lineTo(-s * 0.65, -s * 0.3);
      ctx.lineTo(-s * 0.5, -s * 0.1);
      ctx.lineTo(-s * 0.8, s * 0.1);

      // Prawa klapa
      ctx.lineTo(s * 0.8, s * 0.1);
      ctx.lineTo(s * 0.5, -s * 0.1);
      ctx.lineTo(s * 0.65, -s * 0.3);
      ctx.closePath();

      ctx.fillStyle = m.color;
      ctx.fill();
      ctx.strokeStyle = m.stemColor;
      ctx.lineWidth = 0.8;
      ctx.stroke();

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
      } else if (mode === 'fireflies') {
        for (const f of fireflies) {
          f.y -= f.speedY;
          f.driftAngle += 0.015;
          f.x += Math.sin(f.driftAngle) * 0.55 + f.speedX;
          f.phase += f.pulseSpeed;

          if (f.y < -20) {
            f.y = height + 15;
            f.x = Math.random() * width;
          }
          if (f.x > width + 20) {
            f.x = -20;
          } else if (f.x < -20) {
            f.x = width + 20;
          }

          const brightness = Math.max(0.08, (Math.sin(f.phase) + 1) / 2);

          // Zewnętrzna poświata
          ctx.save();
          ctx.beginPath();
          ctx.arc(f.x, f.y, f.radius * 2.8, 0, Math.PI * 2);
          ctx.fillStyle = f.glowColor;
          ctx.globalAlpha = brightness * 0.65;
          ctx.fill();

          // Jasny rdzeń
          ctx.beginPath();
          ctx.arc(f.x, f.y, f.radius * 0.9, 0, Math.PI * 2);
          ctx.fillStyle = f.color;
          ctx.globalAlpha = brightness * 0.95;
          ctx.fill();
          ctx.restore();
        }
      } else if (mode === 'snow') {
        for (const s of snowflakes) {
          s.y += s.speedY;
          s.sway += s.swaySpeed;
          s.x += Math.sin(s.sway) * 0.65 + s.speedX;

          if (s.y > height + 15) {
            s.y = -10;
            s.x = Math.random() * width;
          }
          if (s.x > width + 15) {
            s.x = -15;
          } else if (s.x < -15) {
            s.x = width + 15;
          }

          ctx.beginPath();
          ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
          ctx.fillStyle = s.color;
          ctx.fill();
        }
      } else if (mode === 'meteor_shower') {
        // Tło gwiazd
        for (const s of backgroundStars) {
          s.phase += s.pulseSpeed;
          const alpha = 0.3 + (Math.sin(s.phase) + 1) * 0.35;
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
          ctx.fillStyle = s.color;
          ctx.fill();
          ctx.restore();
        }

        // Spadające meteory
        for (const m of meteors) {
          if (!m.active) {
            m.cooldown--;
            if (m.cooldown <= 0) {
              m.active = true;
              m.x = Math.random() * width * 1.2 - width * 0.2;
              m.y = -40;
              m.cooldown = 80 + Math.floor(Math.random() * 150);
            }
            continue;
          }

          const dx = Math.cos(m.angle) * m.length;
          const dy = Math.sin(m.angle) * m.length;

          const grad = ctx.createLinearGradient(m.x, m.y, m.x - dx, m.y - dy);
          grad.addColorStop(0, m.color);
          grad.addColorStop(0.3, m.tailColor);
          grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

          ctx.save();
          ctx.beginPath();
          ctx.moveTo(m.x, m.y);
          ctx.lineTo(m.x - dx, m.y - dy);
          ctx.strokeStyle = grad;
          ctx.lineWidth = m.thickness;
          ctx.lineCap = 'round';
          ctx.stroke();

          // Jasna kropka głowicy meteoru
          ctx.beginPath();
          ctx.arc(m.x, m.y, m.thickness * 1.4, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.shadowBlur = 8;
          ctx.shadowColor = m.tailColor;
          ctx.fill();
          ctx.restore();

          m.x += Math.cos(m.angle) * m.speed;
          m.y += Math.sin(m.angle) * m.speed;

          if (m.y > height + 100 || m.x > width + 100) {
            m.active = false;
          }
        }
      } else if (mode === 'matrix_rain') {
        ctx.font = '13px monospace';
        for (const drop of matrixDrops) {
          drop.tickCounter++;
          if (drop.tickCounter % 3 === 0) {
            // Losowo zmień jeden znak
            const rIdx = Math.floor(Math.random() * drop.chars.length);
            drop.chars[rIdx] = katakana[Math.floor(Math.random() * katakana.length)];
          }

          for (let i = 0; i < drop.chars.length; i++) {
            const charY = drop.y - i * 15;
            if (charY < -20 || charY > height + 20) continue;

            if (i === 0) {
              // Prowadzący znak - biały, świecący
              ctx.fillStyle = '#ffffff';
              ctx.shadowColor = '#4ade80';
              ctx.shadowBlur = 6;
            } else {
              // Ogon zielono-neonowy z zanikaniem
              const alpha = Math.max(0.1, 1 - i / drop.chars.length);
              ctx.fillStyle = `rgba(74, 222, 128, ${alpha})`;
              ctx.shadowBlur = 0;
            }
            ctx.fillText(drop.chars[i], drop.x, charY);
          }

          drop.y += drop.speed;
          if (drop.y - drop.chars.length * 15 > height) {
            drop.y = -20;
            drop.speed = 3 + Math.random() * 4;
          }
        }
      } else if (mode === 'momiji') {
        const wind = Math.sin(tick * 0.01) * 1.1;
        for (const m of momijiLeaves) {
          m.y += m.speedY;
          m.sway += m.swaySpeed;
          m.x += Math.sin(m.sway) * 0.8 + m.speedX + wind;
          m.angle += m.angleSpeed;
          m.flip += m.flipSpeed;

          if (m.y > height + 25) {
            m.y = -25;
            m.x = Math.random() * width;
          }
          if (m.x > width + 30) {
            m.x = -30;
          } else if (m.x < -30) {
            m.x = width + 30;
          }

          drawMomiji(m);
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
