// ----------------------------------------------------------------------------
// AstroCart math unit, version 2, at $0420-$043F.
//
// A port of the reference model (astromath.h, which the a7800 emulator fork
// and the FPGA's docs/MATHUNIT.md share). Version 1 ($0430-$043F): multiply,
// divide, square root, multiply-accumulate, random numbers. The trig block
// ($0420-$042F): rotate a vector, the angle and length of a vector, by CORDIC.
// The arithmetic is the definition: the hardware does the same steps, so the
// results must match it bit for bit (they are within about 1.5 of the exact
// values, not correctly rounded).
//
// A cartridge has the unit when header bytes 59-61 are "ACM".
// ----------------------------------------------------------------------------

var a = 0, b = 0, d = 0;      // 16 bits
var n = 0, acc = 0, x = 1;    // 32 bits, unsigned
var ctrl = 0;
var tx = 0, ty = 0, tt = 0;   // trig block: X, Y, T (16 bits)

function s16(v) { return (v << 16) >> 16; }
function s32(v) { return v | 0; }

function reset() {
  a = b = d = 0; n = acc = 0; ctrl = 0; x = 1; tx = ty = tt = 0;
}

function isSigned() { return (ctrl & 1) !== 0; }

// the product A x B (32 bits)
function p() {
  if (isSigned()) return (s16(a) * s16(b)) >>> 0;
  return (a * b) >>> 0;
}

// N / D (32 bits; $FFFFFFFF when D = 0)
function q() {
  if (d === 0) return 0xFFFFFFFF;
  if (!isSigned()) return Math.floor(n / d) >>> 0;
  return Math.trunc(s32(n) / s16(d)) >>> 0;   // toward zero; $80000000 / -1 wraps
}

// N mod D (16 bits; the low half of N when D = 0)
function r() {
  if (d === 0) return n & 0xFFFF;
  if (!isSigned()) return (n % d) & 0xFFFF;
  return (s32(n) % s16(d)) & 0xFFFF;          // sign of N
}

// floor(sqrt(N)), N unsigned
function s() {
  var rem = 0, root = 0, v = n >>> 0;
  for (var i = 0; i < 16; i++) {
    rem = ((rem << 2) | (v >>> 30)) >>> 0;
    v = (v << 2) >>> 0;
    root = (root << 1) >>> 0;
    var t = ((root << 1) | 1) >>> 0;
    if (rem >= t) { rem = (rem - t) >>> 0; root = (root | 1) >>> 0; }
  }
  return root & 0xFFFF;
}

// ---- trig block: CORDIC, 18 steps, 4 guard bits on the vector and 5 on the
// angle. Right shifts of negative numbers are arithmetic. ----
var TRIG_STEPS = 18;
var TRIG_KINV = 79594;        // 2^17 / (the CORDIC gain 1.646760)
var TRIG_KINV16 = 39797;      // 2^16 / the gain
var TRIG_ATAN = [262144, 154753, 81767, 41506, 20834, 10427, 5215, 2608, 1304,
                 652, 326, 163, 81, 41, 20, 10, 5, 3];   // atan(2^-i), 2^21 = a full turn

// v >> sh for a value that may not fit 32 bits (an exact floor)
function sra(v, sh) { return Math.floor(v / Math.pow(2, sh)); }

function sat(v) {             // clamp to 16 bits signed
  return (v > 32767 ? 32767 : v < -32768 ? -32768 : v) & 0xFFFF;
}

// (X, Y) turned by T: XR = X cos T - Y sin T, YR = X sin T + Y cos T
function rotate() {
  var qd = ((tt + 0x2000) >>> 14) & 3;          // the nearest quarter turn: exact,
  var xi = (qd & 1) ? s16(ty) : s16(tx);        // a swap and changes of sign
  var yi = (qd & 1) ? s16(tx) : s16(ty);
  var nx = (qd === 1 || qd === 2), ny = (qd === 2 || qd === 3);
  var rem = s16((tt - (qd << 14)) & 0xFFFF);    // what is left: -$2000..$1FFF
  var cx, cy;
  if (rem === 0) {
    // nothing left: x 16 (the guard bits), no steps
    cx = (nx ? -xi : xi) * 16;
    cy = (ny ? -yi : yi) * 16;
  } else {
    cx = sra(xi * (nx ? -TRIG_KINV16 : TRIG_KINV16), 12);   // x 16 / gain
    cy = sra(yi * (ny ? -TRIG_KINV16 : TRIG_KINV16), 12);
    var z = rem * 32;
    for (var i = 0; i < TRIG_STEPS; i++) {
      var dx = cy >> i, dy = cx >> i;
      if (z >= 0) { cx -= dx; cy += dy; z -= TRIG_ATAN[i]; }
      else        { cx += dx; cy -= dy; z += TRIG_ATAN[i]; }
    }
  }
  return [sat((cx + 8) >> 4), sat((cy + 8) >> 4)];   // round off the guard bits, clamp
}

// ANG = the direction of (X, Y) ($10000 = a full turn), LEN = its length
function vector() {
  var cx = s16(tx), cy = s16(ty);
  if (cx === 0 && cy === 0) return [0, 0];
  var neg = cx < 0;                             // left half: turn it half way round
  if (neg) { cx = -cx; cy = -cy; }
  cx *= 8; cy *= 8;
  var sh = 0;                                   // scale small vectors up
  while (cx >= -0x40000 && cx < 0x40000 && cy >= -0x40000 && cy < 0x40000) { cx *= 2; cy *= 2; sh++; }
  var z = 0;
  for (var i = 0; i < TRIG_STEPS; i++) {
    var dx = cy >> i, dy = cx >> i;
    if (cy < 0) { cx -= dx; cy += dy; z -= TRIG_ATAN[i]; }
    else        { cx += dx; cy -= dy; z += TRIG_ATAN[i]; }
  }
  var ang = ((neg ? 0x8000 : 0) + ((z + 16) >> 5)) & 0xFFFF;
  var pr = (cx >> 3) * TRIG_KINV;               // length x 2^(17+sh)
  var l = sra(pr, 14) >> sh;                    // length x 8
  return [ang, ((l + 4) >> 3) & 0xFFFF];
}

function trigWrite(offset, v) {
  switch (offset & 15) {
    case 0x0: tx = (tx & 0xFF00) | v; break;
    case 0x1: tx = (tx & 0x00FF) | (v << 8); break;
    case 0x2: ty = (ty & 0xFF00) | v; break;
    case 0x3: ty = (ty & 0x00FF) | (v << 8); break;
    case 0x4: tt = (tt & 0xFF00) | v; break;
    case 0x5: tt = (tt & 0x00FF) | (v << 8); break;
    default: break;
  }
}

function trigRead(offset) {
  switch (offset & 15) {
    case 0x0: return rotate()[0] & 0xFF;
    case 0x1: return rotate()[0] >> 8;
    case 0x2: return rotate()[1] & 0xFF;
    case 0x3: return rotate()[1] >> 8;
    case 0x4: return vector()[0] & 0xFF;
    case 0x5: return vector()[0] >> 8;
    case 0x6: return vector()[1] & 0xFF;
    case 0x7: return vector()[1] >> 8;
    case 0xF: return 0xA2;                      // version: the trig block is here
    default: return 0x00;
  }
}

// offset 0-31 = $0420-$043F
function write(offset, v) {
  v &= 0xFF;
  if (!(offset & 16)) { trigWrite(offset, v); return; }
  switch (offset & 15) {
    case 0x0: a = (a & 0xFF00) | v; break;
    case 0x1: a = (a & 0x00FF) | (v << 8); break;
    case 0x2: b = (b & 0xFF00) | v; break;
    case 0x3: b = (b & 0x00FF) | (v << 8); break;
    case 0x4: n = ((n & 0xFFFFFF00) | v) >>> 0; break;
    case 0x5: n = ((n & 0xFFFF00FF) | (v << 8)) >>> 0; break;
    case 0x6: n = ((n & 0xFF00FFFF) | (v << 16)) >>> 0; break;
    case 0x7: n = ((n & 0x00FFFFFF) | (v << 24)) >>> 0; break;
    case 0x8: d = (d & 0xFF00) | v; break;
    case 0x9: d = (d & 0x00FF) | (v << 8); break;
    case 0xA: ctrl = v & 1; break;
    case 0xB:
      if (v === 1) acc = 0;
      else if (v === 2) acc = (acc + p()) >>> 0;
      else if (v === 3) acc = (acc - p()) >>> 0;
      else if (v === 4) n = acc;
      break;
    case 0xE:
      x = ((x << 8) | v) >>> 0;
      if (x === 0) x = 1;
      break;
    default: break;
  }
}

// A read of offset 30 ($043E) steps the random generator: call once per bus read.
function read(offset) {
  if (!(offset & 16)) return trigRead(offset);
  switch (offset & 15) {
    case 0x0: return p() & 0xFF;
    case 0x1: return (p() >>> 8) & 0xFF;
    case 0x2: return (p() >>> 16) & 0xFF;
    case 0x3: return p() >>> 24;
    case 0x4: return q() & 0xFF;
    case 0x5: return (q() >>> 8) & 0xFF;
    case 0x6: return (q() >>> 16) & 0xFF;
    case 0x7: return q() >>> 24;
    case 0x8: return r() & 0xFF;
    case 0x9: return r() >> 8;
    case 0xA: return s() & 0xFF;
    case 0xB: return s() >> 8;
    case 0xC: return ctrl;
    case 0xD: return d === 0 ? 0x01 : 0x00;
    case 0xE:
      x = (x ^ (x << 13)) >>> 0;
      x = (x ^ (x >>> 17)) >>> 0;
      x = (x ^ (x << 5)) >>> 0;
      return x & 0xFF;
    default: return 0xA1;
  }
}

// Save state: the registers as bytes
function save() {
  var out = [];
  var put = function (v, bytes) { for (var i = 0; i < bytes; i++) out.push((v >>> (8 * i)) & 0xFF); };
  put(a, 2); put(b, 2); put(d, 2); put(n, 4); put(acc, 4); put(x, 4);
  put(ctrl, 1); put(tx, 2); put(ty, 2); put(tt, 2);
  return out;
}
var SAVE_SIZE = 25;

function load(buf, off) {
  var get = function (bytes) { var v = 0; for (var i = 0; i < bytes; i++) v += buf[off++] * Math.pow(2, 8 * i); return v; };
  a = get(2); b = get(2); d = get(2); n = get(4); acc = get(4); x = get(4);
  ctrl = get(1); tx = get(2); ty = get(2); tt = get(2);
  return off;
}

export {
  reset as Reset,
  read as Read,
  write as Write,
  save as Save,
  load as Load,
  SAVE_SIZE
}
