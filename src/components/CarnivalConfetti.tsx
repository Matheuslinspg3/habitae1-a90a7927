import { useMemo } from "react";

const COLORS = [
  "hsl(270 70% 55%)",   // roxo
  "hsl(45 90% 55%)",    // dourado
  "hsl(150 60% 45%)",   // verde
  "hsl(330 70% 55%)",   // rosa
  "hsl(25 90% 55%)",    // laranja
  "hsl(190 70% 50%)",   // azul
];

const SHAPES = ["square", "circle", "strip"] as const;

interface Particle {
  id: number;
  left: number;
  delay: number;
  duration: number;
  color: string;
  shape: typeof SHAPES[number];
  size: number;
  drift: number;
}

export function CarnivalConfetti() {
  const particles = useMemo(() => {
    const arr: Particle[] = [];
    for (let i = 0; i < 25; i++) {
      arr.push({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 8,
        duration: 6 + Math.random() * 6,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
        size: 4 + Math.random() * 6,
        drift: -30 + Math.random() * 60,
      });
    }
    return arr;
  }, []);

  return (
    <div
      className="carnival-confetti-container"
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 9999,
        overflow: "hidden",
      }}
    >
      {particles.map((p) => (
        <div
          key={p.id}
          className="carnival-confetti-piece"
          style={{
            position: "absolute",
            left: `${p.left}%`,
            top: "-10px",
            width: p.shape === "strip" ? p.size * 0.4 : p.size,
            height: p.shape === "strip" ? p.size * 2.5 : p.size,
            backgroundColor: p.color,
            borderRadius: p.shape === "circle" ? "50%" : p.shape === "strip" ? "2px" : "1px",
            opacity: 0.7,
            animation: `confettiFall ${p.duration}s linear ${p.delay}s infinite`,
            ["--confetti-drift" as string]: `${p.drift}px`,
          }}
        />
      ))}
    </div>
  );
}
