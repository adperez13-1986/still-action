import { DAY_SPAN, RUN_DEPTHS } from './areas'
import type { Level } from './dungeon'
import type { Boss } from './boss'

/**
 * The day moves with you (design/content/SPEC.md §7). Each depth has a span of the day,
 * from its own hour to the next (DAY_SPAN): the grade follows how far Still has got
 * through the level's spine rooms, and at the last depth the Arbiter's HP, down to first
 * dark. It only ever goes forward inside a level, and it eases on game time, so a pause
 * or a hitstop holds it. At a room step of 0.2 and 0.4/s, each change takes about 5 s:
 * you never see it happen, you notice the fog is closer.
 */
export const DAY_EASE = { rooms: 0.4, boss: 1.5 }

export class DayTracker {
  /** Target progress, 0..1, never decreasing within a level. */
  target = 0
  /** What's drawn: eases toward the target. */
  shown = 0
  private depth = 1

  /** A new level: its span from the start (a felled Arbiter's square on resume is already at first dark). */
  enter(depth: number, bossFelled = false) {
    this.depth = Math.max(1, Math.min(RUN_DEPTHS, depth))
    this.target = this.shown = bossFelled && this.by === 'boss' ? 1 : 0
  }

  get by() {
    return DAY_SPAN[this.depth]!.by
  }

  /** rooms: the spine room he's in; boss: how much of its HP is gone; hold: nothing moves. */
  update(dt: number, level: Level | null, still: { x: number; z: number }, boss: Boss | null) {
    if (!level) return
    if (this.by === 'rooms') {
      const r = level.spineAt(still.x, still.z)
      if (r) this.target = Math.max(this.target, level.progressOf(r))
    } else if (this.by === 'boss') {
      if (boss && !boss.dead) this.target = Math.max(this.target, 1 - boss.hp / boss.maxHp)
    }
    const rate = this.by === 'boss' ? DAY_EASE.boss : DAY_EASE.rooms
    this.shown += (this.target - this.shown) * Math.min(1, dt * rate)
    if (Math.abs(this.target - this.shown) < 1e-5) this.shown = this.target
  }

  /** At once: the Arbiter's kill lands on first dark on the same tick. */
  snap(p: number) {
    this.target = this.shown = p
  }
}
