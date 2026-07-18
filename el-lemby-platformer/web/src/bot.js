// The runner bot: proves stages completable in the node test suite AND
// plays the arcade attract-mode demo on the title screen. Same policy as
// the C# test bot.

import { CFG } from "./config.js";

export function botDrive(world, input, now) {
  const p = world.player;
  const bottom = p.y - 11;

  const wallAhead =
    world.isSolidAtPoint(p.x + 14, bottom + 2) || world.isSolidAtPoint(p.x + 14, p.y + 8);
  const nearGround = p.grounded || now - p.lastGroundedAt <= CFG.coyoteTime;
  const gapBelow = (x) => !world.isSolidAtPoint(x, CFG.tile);
  const deadlyAhead = gapBelow(p.x + 8) || gapBelow(p.x + 24) || gapBelow(p.x + 40);
  // Press only at the true edge: air at the feet AND the very next ground
  // column void — otherwise descending from a stall with a pit on the
  // horizon wastes the coyote jump mid-fall.
  const edgeAtFeet =
    nearGround && !world.isSolidAtPoint(p.x + 8, bottom - 6) && gapBelow(p.x + 8);

  input.moveX = 1;
  if (wallAhead || edgeAtFeet) {
    input.jumpPressedAt = now;
  }
  input.jumpHeld = wallAhead || deadlyAhead;
}
