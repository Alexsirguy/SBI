/** A hand-written playground for the gallery and the prompt: sunlight split by a raindrop. */
export const RAINBOW_CODE = `const BANDS = [
  ["Red", "#e5383b", 42.4], ["Orange", "#f48c06", 42.0], ["Yellow", "#e9c46a", 41.6],
  ["Green", "#2a9d8f", 41.2], ["Blue", "#277da1", 40.8], ["Violet", "#7b2cbf", 40.4],
];
kit.onFrame((ctx, state) => {
  const { width, height, time, values } = state;
  const drop = { x: width * 0.62, y: height * 0.42, r: Math.min(width, height) * 0.22 };
  const spread = values.spread ?? 1;
  ctx.fillStyle = kit.colors.sky;
  ctx.fillRect(0, 0, width, height);
  ctx.beginPath();
  ctx.arc(drop.x, drop.y, drop.r, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fill();
  ctx.strokeStyle = kit.colors.note;
  ctx.lineWidth = 2;
  ctx.stroke();
  const entry = { x: drop.x - drop.r * 0.8, y: drop.y - drop.r * 0.6 };
  kit.arrow(ctx, 0, entry.y, entry.x, entry.y, kit.colors.ink);
  const pulse = (time * 0.4) % 1;
  ctx.beginPath();
  ctx.arc(entry.x * pulse, entry.y, 4, 0, Math.PI * 2);
  ctx.fillStyle = kit.colors.marker;
  ctx.fill();
  const back = { x: drop.x + drop.r * 0.95, y: drop.y + drop.r * 0.3 };
  for (const [, color, angle] of BANDS) {
    const turn = ((angle - 41.4) * spread + 41.4) * (Math.PI / 180);
    const exit = { x: drop.x - drop.r * 0.55, y: drop.y + drop.r * 0.83 };
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(entry.x, entry.y);
    ctx.lineTo(back.x, back.y);
    ctx.lineTo(exit.x, exit.y);
    ctx.lineTo(exit.x - Math.cos(turn) * width, exit.y + Math.sin(turn) * width * 0.35);
    ctx.stroke();
  }
  kit.marker(ctx, 1, drop.x, drop.y - drop.r - 16);
  kit.marker(ctx, 2, back.x + 16, back.y);
});`;
