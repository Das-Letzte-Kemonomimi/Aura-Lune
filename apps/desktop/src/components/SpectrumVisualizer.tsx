import React, { useEffect, useRef, useState } from 'react';

interface SpectrumVisualizerProps {
  spectrum?: number[];
  isPlaying: boolean;
  className?: string;
  style?: React.CSSProperties;
  currentLang?: string;
}

export type VisualizerMode = 'bars' | 'circular' | 'wave' | 'mirrored';

export const SpectrumVisualizer: React.FC<SpectrumVisualizerProps> = ({
  spectrum = [],
  isPlaying,
  className,
  style,
  currentLang = 'en',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [mode, setMode] = useState<VisualizerMode>('bars');
  const peaksRef = useRef<number[]>([]);
  const smoothedRef = useRef<number[]>([]);
  const rotationRef = useRef<number>(0);
  const spectrumRef = useRef<number[]>(spectrum);

  useEffect(() => {
    spectrumRef.current = spectrum;
  }, [spectrum]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      if (canvas.clientWidth && canvas.width !== canvas.clientWidth) {
        canvas.width = canvas.clientWidth;
      }
      if (canvas.clientHeight && canvas.height !== canvas.clientHeight) {
        canvas.height = canvas.clientHeight;
      }
      const width = canvas.width || 600;
      const height = canvas.height || 88;
      ctx.clearRect(0, 0, width, height);

      // Weź 16-24 pasm z backendu lub minimalny szum w spoczynku
      const currentSpectrum = spectrumRef.current;
      const bands = currentSpectrum && currentSpectrum.length > 0 ? currentSpectrum : Array(16).fill(0.02);
      const bandCount = bands.length;

      // Inicjalizacja tablic wygładzania i szczytów
      while (peaksRef.current.length < bandCount) peaksRef.current.push(0);
      while (smoothedRef.current.length < bandCount) smoothedRef.current.push(0);

      // Aktualizacja wartości wygładzonych i grawitacji szczytów
      for (let i = 0; i < bandCount; i++) {
        const raw = isPlaying ? Math.min(1.0, Math.max(0.04, bands[i])) : 0.02;
        // Dynamiczny boost nieliniowy dla pasm audio, aby słupki żywo skakały na pełną wysokość
        const boosted = isPlaying ? Math.min(1.0, Math.pow(raw, 0.62) * 1.38) : 0.02;
        // Wygładzanie wykładnicze (lerp)
        smoothedRef.current[i] += (boosted - smoothedRef.current[i]) * 0.42;

        // Szczyty
        if (smoothedRef.current[i] > peaksRef.current[i]) {
          peaksRef.current[i] = smoothedRef.current[i];
        } else {
          peaksRef.current[i] = Math.max(0, peaksRef.current[i] - 0.016); // opadanie
        }
      }

      if (mode === 'bars') {
        const barWidth = (width - (bandCount - 1) * 3) / bandCount;

        for (let i = 0; i < bandCount; i++) {
          const val = smoothedRef.current[i];
          const barHeight = Math.max(6, val * (height - 8));
          const x = i * (barWidth + 3);
          const y = height - barHeight;

          // Gradient neonowy o bogatej dynamice
          const grad = ctx.createLinearGradient(0, height, 0, y);
          grad.addColorStop(0, 'rgba(6, 182, 212, 0.35)');
          grad.addColorStop(0.45, 'rgba(168, 85, 247, 0.8)');
          grad.addColorStop(1, 'rgba(244, 63, 94, 0.98)');

          ctx.fillStyle = grad;
          ctx.beginPath();
          // Zaokrąglony słupek
          ctx.roundRect(x, y, barWidth, barHeight, [4, 4, 0, 0]);
          ctx.fill();

          // Kapturek szczytu (Peak cap) w jaskrawym kolorze neonu
          const peakY = height - Math.max(6, peaksRef.current[i] * (height - 8)) - 3;
          ctx.fillStyle = '#ff6b81';
          ctx.fillRect(x, Math.max(0, peakY), barWidth, 3);
        }
      } else if (mode === 'wave') {
        ctx.beginPath();
        const step = width / (bandCount - 1);

        ctx.moveTo(0, height - smoothedRef.current[0] * (height - 8));
        for (let i = 1; i < bandCount; i++) {
          const prevX = (i - 1) * step;
          const prevY = height - smoothedRef.current[i - 1] * (height - 8);
          const currX = i * step;
          const currY = height - smoothedRef.current[i] * (height - 8);
          const midX = (prevX + currX) / 2;
          ctx.quadraticCurveTo(prevX, prevY, midX, (prevY + currY) / 2);
        }
        ctx.lineTo(width, height - smoothedRef.current[bandCount - 1] * (height - 8));

        // Obrys fali
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Wypełnienie gradientem
        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.closePath();
        const fillGrad = ctx.createLinearGradient(0, 0, 0, height);
        fillGrad.addColorStop(0, 'rgba(6, 182, 212, 0.25)');
        fillGrad.addColorStop(1, 'rgba(168, 85, 247, 0.02)');
        ctx.fillStyle = fillGrad;
        ctx.fill();
      } else if (mode === 'mirrored') {
        const halfWidth = width / 2;
        const barWidth = (halfWidth - (bandCount - 1) * 2) / bandCount;

        for (let i = 0; i < bandCount; i++) {
          const val = smoothedRef.current[i];
          const barHeight = Math.max(3, val * (height / 2 - 4));

          const grad = ctx.createLinearGradient(0, height / 2 - barHeight, 0, height / 2 + barHeight);
          grad.addColorStop(0, '#f43f5e');
          grad.addColorStop(0.5, '#06b6d4');
          grad.addColorStop(1, '#a855f7');

          ctx.fillStyle = grad;

          // Prawa strona
          const rightX = halfWidth + i * (barWidth + 2);
          ctx.fillRect(rightX, height / 2 - barHeight, barWidth, barHeight * 2);

          // Lewa strona (lustrzana)
          const leftX = halfWidth - (i + 1) * (barWidth + 2);
          ctx.fillRect(leftX, height / 2 - barHeight, barWidth, barHeight * 2);
        }
      } else if (mode === 'circular') {
        const cx = width / 2;
        const cy = height / 2;
        const baseRadius = Math.min(width, height) * 0.22;
        const totalRays = 48;

        rotationRef.current += isPlaying ? 0.007 : 0.002;
        const rot = rotationRef.current;

        // Okrąg wewnętrzny
        ctx.beginPath();
        ctx.arc(cx, cy, baseRadius - 2, 0, 2 * Math.PI);
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        for (let i = 0; i < totalRays; i++) {
          const angle = (i / totalRays) * 2 * Math.PI + rot;
          const bandIdx = Math.abs((i % bandCount) - Math.floor(bandCount / 2));
          const val = smoothedRef.current[bandIdx % bandCount] || 0.05;
          const rayLen = Math.max(3, val * (Math.min(width, height) * 0.25));

          const x1 = cx + Math.cos(angle) * baseRadius;
          const y1 = cy + Math.sin(angle) * baseRadius;
          const x2 = cx + Math.cos(angle) * (baseRadius + rayLen);
          const y2 = cy + Math.sin(angle) * (baseRadius + rayLen);

          const grad = ctx.createLinearGradient(x1, y1, x2, y2);
          grad.addColorStop(0, '#06b6d4');
          grad.addColorStop(0.5, '#a855f7');
          grad.addColorStop(1, '#ff4d94');

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.strokeStyle = grad;
          ctx.lineWidth = 2.4;
          ctx.lineCap = 'round';
          ctx.stroke();

          // Kropka na szczycie promienia
          ctx.fillStyle = '#ff6b81';
          ctx.beginPath();
          ctx.arc(x2, y2, 1.2, 0, 2 * Math.PI);
          ctx.fill();
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying, mode]);

  const cycleMode = () => {
    const modes: VisualizerMode[] = ['bars', 'circular', 'wave', 'mirrored'];
    const next = modes[(modes.indexOf(mode) + 1) % modes.length];
    setMode(next);
  };

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        height: '88px',
        borderRadius: '12px',
        background: 'rgba(0, 0, 0, 0.45)',
        border: '1px solid var(--border-subtle)',
        overflow: 'hidden',
        cursor: 'pointer',
        boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.5)',
        willChange: 'transform',
        transform: 'translateZ(0)',
        ...style,
      }}
      onClick={cycleMode}
      title={
        currentLang === 'pl'
          ? 'Kliknij, aby przełączyć styl wizualizera (Słupki FFT • Halo Okrągłe • Fala Neonowa • Lustro Stereo)'
          : currentLang === 'de'
          ? 'Klicken, um Visualisierer-Stil umzuschalten (FFT-Balken • Rundes Halo • Neonwelle • Stereo-Spiegel)'
          : currentLang === 'fi'
          ? 'Napsauta vaihtaaksesi visualisointityyliä (FFT-palkit • Pyöreä Halo • Neonaalto • Stereopeili)'
          : currentLang === 'la'
          ? 'Preme ad stilum visualizatoris mutandum'
          : 'Click to cycle visualizer mode (FFT Bars • Circular Halo • Neon Wave • Stereo Mirror)'
      }
    >
      <canvas
        ref={canvasRef}
        width={600}
        height={88}
        style={{ width: '100%', height: '100%', display: 'block', willChange: 'transform', transform: 'translateZ(0)' }}
      />
      <div
        style={{
          position: 'absolute',
          top: '3px',
          right: '7px',
          fontSize: '0.62rem',
          fontFamily: 'var(--font-mono)',
          fontWeight: 700,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          pointerEvents: 'none',
          opacity: 0.6,
        }}
      >
        {mode}
      </div>
    </div>
  );
};
