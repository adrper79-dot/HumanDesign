/**
 * Minimal QR Code Generator — Client-side only.
 * Used by 2FA setup so TOTP secrets never leave the browser.
 * Supports byte mode, EC level M, versions 1–7 (~122 byte max).
 */
(function(window) {
  'use strict';

  // ── GF(256) with primitive polynomial x^8+x^4+x^3+x^2+1 (0x11D) ──
  var EXP = new Uint8Array(512);
  var LOG = new Uint8Array(256);
  (function() {
    var x = 1;
    for (var i = 0; i < 255; i++) {
      EXP[i] = x;
      LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11D;
    }
    for (var i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  })();

  function gfMul(a, b) {
    return (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]];
  }

  // ── Reed-Solomon EC ──
  function rsGenerator(n) {
    var g = [1];
    for (var i = 0; i < n; i++) {
      var ng = new Array(g.length + 1);
      for (var k = 0; k < ng.length; k++) ng[k] = 0;
      for (var j = 0; j < g.length; j++) {
        ng[j] ^= g[j];
        ng[j + 1] ^= gfMul(g[j], EXP[i]);
      }
      g = ng;
    }
    return g;
  }

  function rsEncode(data, ecCount) {
    var gen = rsGenerator(ecCount);
    var rem = new Uint8Array(ecCount);
    for (var i = 0; i < data.length; i++) {
      var f = data[i] ^ rem[0];
      for (var j = 0; j < ecCount - 1; j++) rem[j] = rem[j + 1];
      rem[ecCount - 1] = 0;
      if (f !== 0) {
        for (var j = 0; j < ecCount; j++) rem[j] ^= gfMul(gen[j + 1], f);
      }
    }
    return rem;
  }

  // ── Version tables (EC-M) ──
  // { ec: EC codewords per block, blocks: [[numBlocks, dataCWperBlock], ...] }
  var EC_M = [
    null,
    { ec: 10, blocks: [[1, 16]] },   // V1: 16 data CW, 14 chars
    { ec: 16, blocks: [[1, 28]] },   // V2: 28, 26
    { ec: 26, blocks: [[1, 44]] },   // V3: 44, 42
    { ec: 18, blocks: [[2, 32]] },   // V4: 64, 62
    { ec: 24, blocks: [[2, 43]] },   // V5: 86, 84
    { ec: 16, blocks: [[4, 27]] },   // V6: 108, 106
    { ec: 18, blocks: [[4, 31]] }    // V7: 124, 122
  ];

  // Alignment pattern center coordinates per version
  var ALIGN = [null, [], [6,18], [6,22], [6,26], [6,30], [6,34], [6,22,38]];

  // Remainder bits after codewords (fills unused modules)
  var REM_BITS = [0, 0, 7, 7, 7, 7, 7, 0];

  // ── Select smallest version that fits ──
  function selectVersion(byteLen) {
    for (var v = 1; v <= 7; v++) {
      var total = 0;
      for (var g = 0; g < EC_M[v].blocks.length; g++)
        total += EC_M[v].blocks[g][0] * EC_M[v].blocks[g][1];
      if (byteLen <= total - 2) return v;
    }
    throw new Error('Data too long for QR (max ~122 bytes)');
  }

  // ── Encode data in byte mode → array of data codewords ──
  function encodeData(bytes, version) {
    var info = EC_M[version];
    var totalDataCW = 0;
    for (var g = 0; g < info.blocks.length; g++)
      totalDataCW += info.blocks[g][0] * info.blocks[g][1];
    var capacity = totalDataCW * 8;
    var bits = [];

    function push(val, len) {
      for (var i = len - 1; i >= 0; i--) bits.push((val >> i) & 1);
    }

    push(0b0100, 4);           // byte mode indicator
    push(bytes.length, 8);     // character count (8 bits for V1-9)
    for (var i = 0; i < bytes.length; i++) push(bytes[i], 8);

    // terminator (up to 4 zero bits)
    var term = Math.min(4, capacity - bits.length);
    for (var i = 0; i < term; i++) bits.push(0);

    // pad to byte boundary
    while (bits.length % 8) bits.push(0);

    // pad codewords
    var padToggle = 0;
    while (bits.length < capacity) {
      push(padToggle ? 0x11 : 0xEC, 8);
      padToggle ^= 1;
    }

    // bits → codewords
    var cw = new Uint8Array(totalDataCW);
    for (var i = 0; i < totalDataCW; i++) {
      var v = 0;
      for (var b = 0; b < 8; b++) v = (v << 1) | bits[i * 8 + b];
      cw[i] = v;
    }
    return cw;
  }

  // ── Split into blocks, add EC, interleave ──
  function interleave(data, version) {
    var info = EC_M[version];
    var ecLen = info.ec;
    var dataBlocks = [], ecBlocks = [];
    var off = 0;

    for (var g = 0; g < info.blocks.length; g++) {
      var num = info.blocks[g][0], dPerBlock = info.blocks[g][1];
      for (var b = 0; b < num; b++) {
        var block = data.slice(off, off + dPerBlock);
        dataBlocks.push(block);
        ecBlocks.push(rsEncode(block, ecLen));
        off += dPerBlock;
      }
    }

    var result = [];
    var maxD = 0;
    for (var i = 0; i < dataBlocks.length; i++)
      if (dataBlocks[i].length > maxD) maxD = dataBlocks[i].length;
    for (var i = 0; i < maxD; i++)
      for (var j = 0; j < dataBlocks.length; j++)
        if (i < dataBlocks[j].length) result.push(dataBlocks[j][i]);
    for (var i = 0; i < ecLen; i++)
      for (var j = 0; j < ecBlocks.length; j++)
        if (i < ecBlocks[j].length) result.push(ecBlocks[j][i]);
    return result;
  }

  // ── Matrix helpers ──
  function makeMatrix(version) {
    var size = version * 4 + 17;
    var mod = [], res = [];
    for (var r = 0; r < size; r++) {
      mod.push(new Int8Array(size));
      res.push(new Uint8Array(size));
    }
    return { m: mod, r: res, s: size };
  }

  function setMod(q, row, col, dark) {
    if (row >= 0 && row < q.s && col >= 0 && col < q.s) {
      q.m[row][col] = dark ? 1 : 0;
      q.r[row][col] = 1;
    }
  }

  function placeFinder(q, row, col) {
    for (var dr = -1; dr <= 7; dr++) {
      for (var dc = -1; dc <= 7; dc++) {
        var rr = row + dr, cc = col + dc;
        if (rr < 0 || rr >= q.s || cc < 0 || cc >= q.s) continue;
        var dark;
        if (dr === -1 || dr === 7 || dc === -1 || dc === 7) dark = false;       // separator
        else if (dr === 0 || dr === 6 || dc === 0 || dc === 6) dark = true;     // border
        else if (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4) dark = true;         // center
        else dark = false;
        setMod(q, rr, cc, dark);
      }
    }
  }

  function placeAlignments(q, version) {
    var pos = ALIGN[version];
    if (!pos || pos.length === 0) return;
    for (var pi = 0; pi < pos.length; pi++) {
      for (var pj = 0; pj < pos.length; pj++) {
        var cr = pos[pi], cc = pos[pj];
        if (cr <= 8 && cc <= 8) continue;              // top-left finder
        if (cr <= 8 && cc >= q.s - 8) continue;        // top-right finder
        if (cr >= q.s - 8 && cc <= 8) continue;        // bottom-left finder
        for (var dr = -2; dr <= 2; dr++) {
          for (var dc = -2; dc <= 2; dc++) {
            var dark = (Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0));
            setMod(q, cr + dr, cc + dc, dark);
          }
        }
      }
    }
  }

  function placeTiming(q) {
    for (var i = 8; i < q.s - 8; i++) {
      var dark = (i & 1) === 0;
      if (!q.r[6][i]) setMod(q, 6, i, dark);
      if (!q.r[i][6]) setMod(q, i, 6, dark);
    }
  }

  function reserveFormat(q, version) {
    // Format info around top-left finder (row 8, cols 0-8; col 8, rows 0-8)
    for (var i = 0; i <= 8; i++) { q.r[8][i] = 1; q.r[i][8] = 1; }
    // Format info second copy (row 8, cols size-8..size-1; col 8, rows size-7..size-1)
    for (var i = 0; i < 8; i++) q.r[8][q.s - 1 - i] = 1;
    for (var i = 0; i < 7; i++) q.r[q.s - 1 - i][8] = 1;
    // Dark module
    q.m[version * 4 + 9][8] = 1;
    q.r[version * 4 + 9][8] = 1;
    // Version info (V7 only in our range)
    if (version >= 7) {
      for (var i = 0; i < 6; i++)
        for (var j = 0; j < 3; j++) {
          q.r[i][q.s - 11 + j] = 1;
          q.r[q.s - 11 + j][i] = 1;
        }
    }
  }

  function placeData(q, bits) {
    var idx = 0, up = true;
    for (var right = q.s - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5; // skip timing column
      for (var v = 0; v < q.s; v++) {
        var row = up ? q.s - 1 - v : v;
        for (var j = 0; j < 2; j++) {
          var col = right - j;
          if (col < 0 || q.r[row][col]) continue;
          q.m[row][col] = (idx < bits.length) ? bits[idx] : 0;
          idx++;
        }
      }
      up = !up;
    }
  }

  // ── Masking ──
  var MASKS = [
    function(r,c){ return (r+c)%2===0; },
    function(r)  { return r%2===0; },
    function(r,c){ return c%3===0; },
    function(r,c){ return (r+c)%3===0; },
    function(r,c){ return (((r>>1)+(c/3|0))%2)===0; },
    function(r,c){ return (r*c)%2+(r*c)%3===0; },
    function(r,c){ return ((r*c)%2+(r*c)%3)%2===0; },
    function(r,c){ return ((r+c)%2+(r*c)%3)%2===0; }
  ];

  function applyMask(q, maskIdx) {
    var fn = MASKS[maskIdx];
    for (var r = 0; r < q.s; r++)
      for (var c = 0; c < q.s; c++)
        if (!q.r[r][c] && fn(r, c)) q.m[r][c] ^= 1;
  }

  function penalty(q) {
    var s = q.s, score = 0, r, c;
    // Rule 1: runs of 5+ same-color
    for (r = 0; r < s; r++) {
      var run = 1;
      for (c = 1; c < s; c++) {
        if (q.m[r][c] === q.m[r][c-1]) { run++; }
        else { if (run >= 5) score += run - 2; run = 1; }
      }
      if (run >= 5) score += run - 2;
    }
    for (c = 0; c < s; c++) {
      var run = 1;
      for (r = 1; r < s; r++) {
        if (q.m[r][c] === q.m[r-1][c]) { run++; }
        else { if (run >= 5) score += run - 2; run = 1; }
      }
      if (run >= 5) score += run - 2;
    }
    // Rule 2: 2×2 blocks
    for (r = 0; r < s - 1; r++)
      for (c = 0; c < s - 1; c++) {
        var v = q.m[r][c];
        if (v === q.m[r][c+1] && v === q.m[r+1][c] && v === q.m[r+1][c+1]) score += 3;
      }
    // Rule 3: finder-like 1011101 with 4 light on either side
    var PA = [1,0,1,1,1,0,1,0,0,0,0];
    var PB = [0,0,0,0,1,0,1,1,1,0,1];
    for (r = 0; r < s; r++)
      for (c = 0; c <= s - 11; c++) {
        var mA = true, mB = true;
        for (var i = 0; i < 11; i++) {
          if (q.m[r][c+i] !== PA[i]) mA = false;
          if (q.m[r][c+i] !== PB[i]) mB = false;
        }
        if (mA) score += 40;
        if (mB) score += 40;
      }
    for (c = 0; c < s; c++)
      for (r = 0; r <= s - 11; r++) {
        var mA = true, mB = true;
        for (var i = 0; i < 11; i++) {
          if (q.m[r+i][c] !== PA[i]) mA = false;
          if (q.m[r+i][c] !== PB[i]) mB = false;
        }
        if (mA) score += 40;
        if (mB) score += 40;
      }
    // Rule 4: dark/light ratio
    var dark = 0;
    for (r = 0; r < s; r++)
      for (c = 0; c < s; c++) if (q.m[r][c]) dark++;
    var pct = dark * 100 / (s * s);
    var p5 = Math.floor(pct / 5) * 5;
    score += Math.min(Math.abs(p5 - 50), Math.abs(p5 + 5 - 50)) / 5 * 10;
    return score;
  }

  // ── Format info (BCH 15,5) ──
  function formatBits(mask) {
    // EC-M indicator = 00, so data = (0 << 3) | mask = mask
    var d = mask;
    var bits = d << 10;
    for (var i = 4; i >= 0; i--)
      if (bits & (1 << (i + 10))) bits ^= (0x537 << i);
    return ((d << 10) | bits) ^ 0x5412;
  }

  function writeFormat(q, fb) {
    // First copy: row 8 cols 0-5,7,8 and col 8 rows 7,5-0
    var posA = [
      [8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[8,7],[8,8],
      [7,8],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8]
    ];
    // Second copy: col 8 rows size-1..size-7 and row 8 cols size-8..size-1
    var posB = [];
    for (var i = 0; i < 7; i++) posB.push([q.s - 1 - i, 8]);
    for (var i = 0; i < 8; i++) posB.push([8, q.s - 8 + i]);
    for (var i = 0; i < 15; i++) {
      var bit = (fb >> (14 - i)) & 1;
      q.m[posA[i][0]][posA[i][1]] = bit;
      q.m[posB[i][0]][posB[i][1]] = bit;
    }
  }

  // ── Version info (BCH 18,6) — only V7+ ──
  function writeVersion(q, version) {
    if (version < 7) return;
    var d = version;
    var bits = d << 12;
    for (var i = 5; i >= 0; i--)
      if (bits & (1 << (i + 12))) bits ^= (0x1F25 << i);
    var vb = (d << 12) | bits;
    for (var i = 0; i < 18; i++) {
      var bit = (vb >> i) & 1;
      var r = Math.floor(i / 3), c = i % 3;
      q.m[r][q.s - 11 + c] = bit;
      q.m[q.s - 11 + c][r] = bit;
    }
  }

  // ── Main entry ──
  function generate(text) {
    var bytes = typeof TextEncoder !== 'undefined'
      ? new TextEncoder().encode(text)
      : (function() { var a = []; for (var i = 0; i < text.length; i++) a.push(text.charCodeAt(i) & 0xFF); return a; })();

    var version = selectVersion(bytes.length);
    var data = encodeData(bytes, version);
    var codewords = interleave(data, version);

    // codewords → bits
    var bits = [];
    for (var i = 0; i < codewords.length; i++)
      for (var b = 7; b >= 0; b--) bits.push((codewords[i] >> b) & 1);
    var rem = REM_BITS[version];
    for (var i = 0; i < rem; i++) bits.push(0);

    // Build matrix
    var q = makeMatrix(version);
    placeFinder(q, 0, 0);
    placeFinder(q, 0, q.s - 7);
    placeFinder(q, q.s - 7, 0);
    placeTiming(q);
    placeAlignments(q, version);
    reserveFormat(q, version);
    placeData(q, bits);

    // Pick best mask
    var bestMask = 0, bestPen = Infinity;
    for (var mi = 0; mi < 8; mi++) {
      // clone matrix (only m, not r — reserved stays the same)
      var clone = { m: [], r: q.r, s: q.s };
      for (var rr = 0; rr < q.s; rr++) clone.m.push(new Int8Array(q.m[rr]));
      applyMask(clone, mi);
      writeFormat(clone, formatBits(mi));
      writeVersion(clone, version);
      var p = penalty(clone);
      if (p < bestPen) { bestPen = p; bestMask = mi; }
    }

    applyMask(q, bestMask);
    writeFormat(q, formatBits(bestMask));
    writeVersion(q, version);
    return q;
  }

  // ── Render to data URL ──
  function toDataURL(text, scale) {
    scale = scale || 4;
    var q = generate(text);
    var margin = scale * 4; // 4-module quiet zone
    var total = q.s * scale + margin * 2;
    var canvas = document.createElement('canvas');
    canvas.width = total;
    canvas.height = total;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, total, total);
    ctx.fillStyle = '#000';
    for (var r = 0; r < q.s; r++)
      for (var c = 0; c < q.s; c++)
        if (q.m[r][c]) ctx.fillRect(margin + c * scale, margin + r * scale, scale, scale);
    return canvas.toDataURL('image/png');
  }

  window.QRCode = { toDataURL: toDataURL };
})(window);
