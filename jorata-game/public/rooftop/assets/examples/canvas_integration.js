// Engine-agnostic Canvas helper. All paths are relative to the assets directory.
export function drawFrame(ctx, texture, animation, frame, anchorX, anchorY, scale = 1) {
 const f = Math.max(0, Math.min(frame, animation.frame_count - 1));
 const w = animation.frame_width, h = animation.frame_height;
 const sx = (f % animation.sheet_columns) * w;
 const sy = Math.floor(f / animation.sheet_columns) * h;
 ctx.drawImage(texture, sx, sy, w, h,
  anchorX - animation.anchor.x * scale, anchorY - animation.anchor.y * scale,
  w * scale, h * scale);
}
export function frameAt(animation, elapsedMs) {
 const f = Math.floor(elapsedMs * animation.fps / 1000);
 return animation.loop ? f % animation.frame_count : Math.min(f, animation.frame_count - 1);
}
export function placeCollider(rect, object, anchorX, anchorY, scale = 1) {
 return {x: anchorX + (rect.x-object.anchor.x)*scale,
  y: anchorY + (rect.y-object.anchor.y)*scale,
  width: rect.width*scale, height: rect.height*scale};
}
// Each attack active frame is zero-indexed. Keep a per-attack Set of hit target IDs.
// The suggested hitboxes are relative to character anchor, not sprite top-left.
// For a horizontal flip, negate the hitbox x coordinate and subtract its width.
