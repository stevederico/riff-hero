import type { Grade } from '../game/types.ts';
import { laneCenter, laneWidth, project } from './projection.ts';
import type { Layout } from './projection.ts';
import {
  GRADE_COLORS, GRADE_LABELS, MISS_COLOR, SURGE_COLOR, drawGlow, font, laneColor,
} from './theme.ts';

const GRAVITY = 900;
const MAX_PARTICLES = 260;
const SPARKS_PER_HIT: Record<Grade, number> = { perfect: 14, great: 9, good: 6 };
const POPUP_SECONDS = 0.55;
const RING_SECONDS = 0.3;
const FULL_TURN = Math.PI * 2;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  color: string;
}

interface Popup {
  text: string;
  color: string;
  lane: number;
  age: number;
}

interface Ring {
  lane: number;
  color: string;
  age: number;
}

/** Short lived eye candy: sparks, rings and grade popups. */
export class Effects {
  isReducedMotion = false;
  private particles: Particle[] = [];
  private popups: Popup[] = [];
  private rings: Ring[] = [];
  /** Screen shake strength, fading to 0. */
  shake = 0;

  clear(): void {
    this.particles = [];
    this.popups = [];
    this.rings = [];
    this.shake = 0;
  }

  /** A note was hit in a lane. */
  hit(layout: Layout, lane: number, grade: Grade, isSurging: boolean): void {
    const color = isSurging ? SURGE_COLOR : laneColor(lane);
    this.rings.push({ lane, color, age: 0 });
    this.popup(lane, GRADE_LABELS[grade], GRADE_COLORS[grade]);
    if (!this.isReducedMotion) this.burst(layout, lane, color, SPARKS_PER_HIT[grade]);
  }

  /** A note was missed in a lane. */
  miss(lane: number): void {
    this.popup(lane, 'MISS', MISS_COLOR);
    if (!this.isReducedMotion) this.shake = Math.min(1, this.shake + 0.5);
  }

  /** A few sparks from a lane that is holding a sustain. */
  sustain(layout: Layout, lane: number, isSurging: boolean): void {
    if (this.isReducedMotion) return;
    this.burst(layout, lane, isSurging ? SURGE_COLOR : laneColor(lane), 1);
  }

  update(seconds: number): void {
    for (const particle of this.particles) {
      particle.age += seconds;
      particle.vy += GRAVITY * seconds;
      particle.x += particle.vx * seconds;
      particle.y += particle.vy * seconds;
    }
    this.popups.forEach((popup) => { popup.age += seconds; });
    this.rings.forEach((ring) => { ring.age += seconds; });
    this.particles = this.particles.filter((particle) => particle.age < particle.life);
    this.popups = this.popups.filter((popup) => popup.age < POPUP_SECONDS);
    this.rings = this.rings.filter((ring) => ring.age < RING_SECONDS);
    this.shake = Math.max(0, this.shake - seconds * 5);
  }

  draw(g: CanvasRenderingContext2D, layout: Layout): void {
    this.drawRings(g, layout);
    this.drawParticles(g);
    this.drawPopups(g, layout);
  }

  private popup(lane: number, text: string, color: string): void {
    this.popups = this.popups.filter((popup) => popup.lane !== lane);
    this.popups.push({ text, color, lane, age: 0 });
  }

  private burst(layout: Layout, lane: number, color: string, count: number): void {
    const origin = project(layout, laneCenter(lane), 0);
    const reach = laneWidth(layout);
    for (let i = 0; i < count && this.particles.length < MAX_PARTICLES; i += 1) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.9;
      const speed = reach * (2.5 + Math.random() * 4.5);
      this.particles.push({
        x: origin.x + (Math.random() - 0.5) * reach * 0.5,
        y: origin.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        age: 0,
        life: 0.3 + Math.random() * 0.35,
        size: reach * (0.03 + Math.random() * 0.05),
        color: Math.random() < 0.3 ? '#ffffff' : color,
      });
    }
  }

  private drawRings(g: CanvasRenderingContext2D, layout: Layout): void {
    for (const ring of this.rings) {
      const progress = ring.age / RING_SECONDS;
      const center = project(layout, laneCenter(ring.lane), 0);
      const radius = laneWidth(layout) * (0.4 + progress * 0.55);
      drawGlow(g, ring.color, center.x, center.y, radius * 2.4, (1 - progress) * 0.9);
      g.strokeStyle = ring.color;
      g.globalAlpha = 1 - progress;
      g.lineWidth = 3;
      g.beginPath();
      g.ellipse(center.x, center.y, radius, radius * 0.42, 0, 0, FULL_TURN);
      g.stroke();
    }
    g.globalAlpha = 1;
  }

  private drawParticles(g: CanvasRenderingContext2D): void {
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (const particle of this.particles) {
      g.globalAlpha = 1 - particle.age / particle.life;
      g.fillStyle = particle.color;
      g.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size);
    }
    g.restore();
  }

  private drawPopups(g: CanvasRenderingContext2D, layout: Layout): void {
    const size = Math.max(11, laneWidth(layout) * 0.16);
    g.font = font(size, 800);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const popup of this.popups) {
      const progress = popup.age / POPUP_SECONDS;
      const base = project(layout, laneCenter(popup.lane), 0.09);
      g.globalAlpha = 1 - progress ** 2;
      g.lineWidth = 4;
      g.strokeStyle = 'rgba(5, 3, 12, 0.8)';
      const y = base.y - progress * size * 2.2;
      g.strokeText(popup.text, base.x, y);
      g.fillStyle = popup.color;
      g.fillText(popup.text, base.x, y);
    }
    g.globalAlpha = 1;
  }
}
