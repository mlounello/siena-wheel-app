class SienaWheel {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.opts = opts;

    this.questions = [];
    this.rotation = 0; // radians
    this.isSpinning = false;

    this._stopCallbacksOnce = [];

    // Center logo support
    this.logoImg = null;
    this.logoReady = false;
    if (this.opts.logoSrc) {
      this._loadLogo(this.opts.logoSrc);
    }

    this._resizeToCanvasAttr();
    window.addEventListener("resize", () => this._resizeToCanvasAttr());

    this._draw();
  }

  _loadLogo(src) {
    const img = new Image();
    img.onload = () => {
      this.logoImg = img;
      this.logoReady = true;
      this._draw();
    };
    img.onerror = () => {
      this.logoImg = null;
      this.logoReady = false;
      this._draw();
    };
    img.src = src;
  }

  _resizeToCanvasAttr() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const size = Math.floor(Math.min(rect.width, rect.height) * dpr);
    if (size > 0) {
      this.canvas.width = size;
      this.canvas.height = size;
    }
    this._draw();
  }

  setQuestions(questions) {
    this.questions = Array.isArray(questions) ? questions.slice() : [];
    this._draw();
  }

  onceStopped(cb) {
    if (typeof cb === "function") this._stopCallbacksOnce.push(cb);
  }

  spinToIndex(index, { minTurns = 5, maxTurns = 8, durationMs = 5200 } = {}) {
    if (this.isSpinning) return;
    if (!this.questions || this.questions.length === 0) return;
    if (index < 0 || index >= this.questions.length) return;

    const n = this.questions.length;
    const slice = (Math.PI * 2) / n;

    // Pointer at top (-90deg). We want chosen slice center under pointer.
    const pointerAngle = -Math.PI / 2;
    const chosenCenter = (index + 0.5) * slice;

    let targetRotation = pointerAngle - chosenCenter;
    targetRotation = this._norm(targetRotation);

    const turns = this._randInt(minTurns, maxTurns);
    const startRotation = this.rotation;
    const startNorm = this._norm(startRotation);

    let finalRotation = targetRotation + turns * Math.PI * 2;

    // Keep same base revolution so it doesn't jump backward
    const startBase = startRotation - startNorm;
    finalRotation += startBase;

    if (finalRotation <= startRotation) {
      finalRotation += Math.PI * 2;
    }

    this._animateSpin(startRotation, finalRotation, durationMs, index);
  }

  _animateSpin(from, to, durationMs, selectedIndex) {
    this.isSpinning = true;
    const start = performance.now();

    const tick = (now) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = this._easeOutCubic(t);

      this.rotation = from + (to - from) * eased;
      this._draw();

      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        this.isSpinning = false;
        this.rotation = to;
        this._draw();

        const selected = this.questions[selectedIndex] || null;

        const cbs = this._stopCallbacksOnce.slice();
        this._stopCallbacksOnce = [];
        for (const cb of cbs) {
          try { cb(selected); } catch {}
        }

        if (typeof this.opts.onStopped === "function") {
          try { this.opts.onStopped(selected); } catch {}
        }
      }
    };

    requestAnimationFrame(tick);
  }

  _draw() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cx = w / 2;
    const cy = h / 2;

    ctx.clearRect(0, 0, w, h);

    const n = this.questions.length;
    if (n === 0) {
      this._drawEmpty(cx, cy, Math.min(cx, cy));
      return;
    }

    const radius = Math.min(cx, cy) * 0.93;
    const inner = radius * 0.12;
    const slice = (Math.PI * 2) / n;

    // White outline ring to pop off background
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 1.01, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    ctx.lineWidth = radius * 0.028;
    ctx.stroke();

    // Subtle inner ring for depth
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.985, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(0,0,0,0.18)";
    ctx.lineWidth = radius * 0.012;
    ctx.stroke();
    ctx.restore();

    // Rotate entire wheel
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.rotation);

    for (let i = 0; i < n; i++) {
      const startA = i * slice;
      const endA = startA + slice;

      const isEven = i % 2 === 0;

      // Alternate slice colors
      const fill = isEven ? "#fcc917" : "#006b54";
      // Text color per your spec
      const textColor = isEven ? "#006b55" : "#fcc917";

      // Slice wedge
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, startA, endA);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();

      // Slice divider (subtle white)
      ctx.beginPath();
      ctx.arc(0, 0, radius, startA, endA);
      ctx.strokeStyle = "rgba(255,255,255,0.22)";
      ctx.lineWidth = radius * 0.008;
      ctx.stroke();

      // Clip to slice so text never bleeds over edges
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius * 0.985, startA, endA);
      ctx.closePath();
      ctx.clip();

      const q = this.questions[i];
      const label = String(q.text || "").trim();

      const mid = startA + slice / 2;
      ctx.rotate(mid);

      ctx.textAlign = "left";
      ctx.textBaseline = "middle";

      // Text area inside slice
      const pad = radius * 0.06;
      const tx = inner + radius * 0.14;
      const maxWidth = radius - tx - pad;

      // Lines allowed depends on slice count
      const maxLines = n <= 10 ? 3 : 2;

      // Shrink-to-fit
      let fontSize = Math.floor(radius * 0.06);
      const minFont = Math.floor(radius * 0.038);

      let wrapped = { lines: [label], fit: true };
      for (; fontSize >= minFont; fontSize -= 2) {
        ctx.font = `800 ${fontSize}px system-ui, -apple-system, Segoe UI, Arial`;
        wrapped = this._wrapText(ctx, label, maxWidth, maxLines);
        if (wrapped.fit) break;
      }

      ctx.fillStyle = textColor;

      // Subtle shadow only when gold-on-green
      if (!isEven) {
        ctx.shadowColor = "rgba(0,0,0,0.28)";
        ctx.shadowBlur = radius * 0.012;
      } else {
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
      }

      const lineHeight = Math.floor(fontSize * 1.08);
      const totalH = wrapped.lines.length * lineHeight;
      let y = -totalH / 2 + lineHeight / 2;

      for (const line of wrapped.lines) {
        ctx.fillText(line, tx, y);
        y += lineHeight;
      }

      ctx.rotate(-mid);
      ctx.restore();
    }

    // Center hub (solid #1b4932)
    const hubR = inner * 1.35;

    ctx.beginPath();
    ctx.arc(0, 0, hubR, 0, Math.PI * 2);
    ctx.fillStyle = "#1b4932";
    ctx.fill();

    // Hub white outline
    ctx.beginPath();
    ctx.arc(0, 0, hubR, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = inner * 0.13;
    ctx.stroke();

    // Center logo (spins with the wheel)
    if (this.logoReady && this.logoImg) {
      const img = this.logoImg;

      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, hubR * 0.82, 0, Math.PI * 2);
      ctx.clip();

      // Scale to fit inside hub
      const maxSize = hubR * 1.45; // increase to 1.65 if your logo looks too small
      const scale = Math.min(maxSize / img.width, maxSize / img.height);

      const dw = img.width * scale;
      const dh = img.height * scale;

      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
      ctx.restore();
    } else {
      const txt = (this.opts.brandText || "SIENA").trim();
      if (txt) {
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `900 ${Math.floor(inner * 0.54)}px system-ui, -apple-system, Segoe UI, Arial`;
        ctx.shadowColor = "rgba(0,0,0,0.25)";
        ctx.shadowBlur = inner * 0.15;
        ctx.fillText(txt, 0, 0);
      }
    }

    ctx.restore();
  }

  _wrapText(ctx, text, maxWidth, maxLines) {
    // Wrap by words, hard-truncate last line with ellipsis if needed.
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length === 0) return { lines: [""], fit: true };

    const lines = [];
    let line = "";

    let i = 0;
    for (; i < words.length; i++) {
      const w = words[i];
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width <= maxWidth) {
        line = test;
      } else {
        if (line) lines.push(line);
        line = w;

        if (lines.length === maxLines - 1) {
          i++;
          break;
        }
      }
    }

    if (lines.length < maxLines && line) lines.push(line);

    const truncated = i < words.length;
    if (truncated) {
      let last = lines[lines.length - 1] || "";
      last = this._ellipsizeToWidth(ctx, last, maxWidth);
      lines[lines.length - 1] = last;
      return { lines, fit: false };
    }

    const fitsAll = lines.every(l => ctx.measureText(l).width <= maxWidth);
    return { lines, fit: fitsAll };
  }

  _ellipsizeToWidth(ctx, str, maxWidth) {
    const ell = "…";
    if (ctx.measureText(str).width <= maxWidth) return str;
    let s = str;
    while (s.length > 0 && ctx.measureText(s + ell).width > maxWidth) {
      s = s.slice(0, -1).trimEnd();
    }
    return s.length ? s + ell : ell;
  }

  _drawEmpty(cx, cy, r) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(cx, cy);

    ctx.fillStyle = "rgba(255,255,255,0.10)";
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.9, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = r * 0.03;
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `800 ${Math.floor(r * 0.085)}px system-ui, -apple-system, Segoe UI, Arial`;
    ctx.fillText("Waiting for operator...", 0, 0);
    ctx.restore();
  }

  _easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  _randInt(min, max) {
    const a = Math.ceil(min);
    const b = Math.floor(max);
    return Math.floor(Math.random() * (b - a + 1)) + a;
  }

  _norm(a) {
    const two = Math.PI * 2;
    let x = a % two;
    if (x < 0) x += two;
    return x;
  }
}