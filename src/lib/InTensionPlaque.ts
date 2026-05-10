import * as THREE from 'three';

export class InTensionPlaque extends THREE.Group {
  opts: any;
  _disposables: any[];
  plaqueMesh?: THREE.Mesh;
  haloMesh?: THREE.Mesh;
  textMesh?: THREE.Mesh;

  constructor(options = {}) {
    super();
    this.opts = {
      text: 'InTension',
      width: 5.0,
      height: 3.0,
      depth: 0.45,
      cornerRadius: 0.4,
      italic: true,
      seed: 1,
      anisotropy: 4,
      ...options,
    };
    this._disposables = [];
    this._build();
  }

  _build() {
    const o = this.opts;

    /* -------- seeded RNG so the same input gives the same plaque -------- */
    let s = o.seed >>> 0;
    const rand = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 0x100000000;
    };

    /* ===================================================================
       PROCEDURAL TEXTURES
       =================================================================== */
    const TEX_W = 1024, TEX_H = 640;

    const makeNoise = (w: number, h: number, scale: number, octaves = 4) => {
      const grids = [];
      for (let oct = 0; oct < octaves; oct++) {
        const sc = Math.max(2, scale * Math.pow(2, oct));
        const gw = Math.ceil(w / sc) + 2, gh = Math.ceil(h / sc) + 2;
        const g = new Float32Array(gw * gh);
        for (let i = 0; i < g.length; i++) g[i] = rand();
        grids.push({ s: sc, gw, g });
      }
      const out = new Float32Array(w * h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let v = 0, amp = 1, sum = 0;
        for (const { s: sc, gw, g } of grids) {
          const fx = x / sc, fy = y / sc;
          const ix = fx | 0, iy = fy | 0;
          const tx = fx - ix, ty = fy - iy;
          const a = g[iy * gw + ix];
          const b = g[iy * gw + ix + 1];
          const cc = g[(iy + 1) * gw + ix];
          const d = g[(iy + 1) * gw + ix + 1];
          const u = tx * tx * (3 - 2 * tx);
          const vv = ty * ty * (3 - 2 * ty);
          v += amp * (a * (1 - u) * (1 - vv) + b * u * (1 - vv) + cc * (1 - u) * vv + d * u * vv);
          sum += amp; amp *= 0.5;
        }
        out[y * w + x] = v / sum;
      }
      return out;
    };

    /* recursive midpoint-displacement lightning */
    const bolt = (ctx: any, x0: number, y0: number, x1: number, y1: number, displace: number, depth: number, w0: number) => {
      if (depth <= 0) {
        ctx.lineWidth = w0;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        return;
      }
      const mx = (x0 + x1) / 2 + (rand() - 0.5) * displace;
      const my = (y0 + y1) / 2 + (rand() - 0.5) * displace;
      bolt(ctx, x0, y0, mx, my, displace * 0.55, depth - 1, w0);
      bolt(ctx, mx, my, x1, y1, displace * 0.55, depth - 1, w0);
      if (depth > 1 && rand() < 0.7) {
        const ang = Math.atan2(y1 - y0, x1 - x0) + (rand() - 0.5) * 1.6;
        const len = displace * (0.9 + rand() * 0.8);
        bolt(ctx, mx, my,
             mx + Math.cos(ang) * len, my + Math.sin(ang) * len,
             displace * 0.4, depth - 2, w0 * 0.65);
      }
    };

    /* ----- diffuse: dark cracked stone ----- */
    const stoneCanvas = (() => {
      const c = document.createElement('canvas');
      c.width = TEX_W; c.height = TEX_H;
      const x = c.getContext('2d')!;
      x.fillStyle = '#0a0510'; x.fillRect(0, 0, TEX_W, TEX_H);

      const n1 = makeNoise(TEX_W, TEX_H, 8, 5);
      const n2 = makeNoise(TEX_W, TEX_H, 32, 3);
      const img = x.getImageData(0, 0, TEX_W, TEX_H);
      for (let i = 0; i < TEX_W * TEX_H; i++) {
        const v = n1[i] * 0.7 + n2[i] * 0.3;
        const k = Math.pow(v, 1.5);
        const j = i * 4;
        img.data[j]   = 8  + k * 28;
        img.data[j+1] = 4  + k * 14;
        img.data[j+2] = 14 + k * 40;
        img.data[j+3] = 255;
      }
      x.putImageData(img, 0, 0);

      /* surface cracks */
      x.globalCompositeOperation = 'multiply';
      x.strokeStyle = '#000';
      for (let i = 0; i < 55; i++) {
        const x0 = rand() * TEX_W, y0 = rand() * TEX_H;
        const ang = rand() * Math.PI * 2;
        const len = 80 + rand() * 260;
        bolt(x, x0, y0, x0 + Math.cos(ang) * len, y0 + Math.sin(ang) * len,
             30, 5, 1 + rand() * 1.6);
      }
      x.globalCompositeOperation = 'source-over';

      const vg = x.createRadialGradient(TEX_W/2, TEX_H/2, TEX_W*0.25, TEX_W/2, TEX_H/2, TEX_W*0.7);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.65)');
      x.fillStyle = vg; x.fillRect(0, 0, TEX_W, TEX_H);

      x.fillStyle = '#000'; x.fillRect(0, 0, 4, 4);
      return c;
    })();

    /* ----- emissive: horizontal-biased lightning radiating from center ----- */
    const lightCanvas = (() => {
      const c = document.createElement('canvas');
      c.width = TEX_W; c.height = TEX_H;
      const x = c.getContext('2d')!;
      x.fillStyle = '#000'; x.fillRect(0, 0, TEX_W, TEX_H);

      const cx = TEX_W / 2, cy = TEX_H / 2;
      x.lineCap = 'round'; x.lineJoin = 'round';

      /* PASS 1 — wide outer purple glow */
      x.shadowColor = '#a855f7';
      x.shadowBlur = 22;
      x.strokeStyle = 'rgba(168, 85, 247, 0.95)';

      /* Two main horizontal "arms" L and R with heavy branching,
         plus diagonal secondary arms — matches the reference pattern */
      const mainArms = [
        { ang: 0,                 len: 480, w: 3.4 },   // right
        { ang: Math.PI,           len: 480, w: 3.4 },   // left
        { ang: -0.45,             len: 380, w: 2.4 },   // up-right
        { ang: Math.PI + 0.45,    len: 380, w: 2.4 },   // up-left
        { ang: 0.55,              len: 360, w: 2.2 },   // down-right
        { ang: Math.PI - 0.55,    len: 360, w: 2.2 },   // down-left
        { ang: -Math.PI / 2,      len: 280, w: 1.8 },   // up
        { ang:  Math.PI / 2,      len: 280, w: 1.8 },   // down
      ];
      for (const { ang, len, w } of mainArms) {
        const ex = cx + Math.cos(ang) * len;
        const ey = cy + Math.sin(ang) * len * 0.75;
        bolt(x, cx + Math.cos(ang) * 18, cy + Math.sin(ang) * 14, ex, ey,
             Math.min(len * 0.18, 90), 7, w);
      }

      /* PASS 2 — bright white-purple hot core, same paths but thinner & sharper */
      x.shadowBlur = 4;
      x.strokeStyle = 'rgba(245, 220, 255, 1)';
      for (const { ang, len, w } of mainArms) {
        const ex = cx + Math.cos(ang) * len;
        const ey = cy + Math.sin(ang) * len * 0.75;
        /* reseed for slight variance from pass 1 */
        bolt(x, cx + Math.cos(ang) * 18, cy + Math.sin(ang) * 14, ex, ey,
             Math.min(len * 0.18, 90), 7, Math.max(0.5, w * 0.35));
      }

      /* PASS 3 — a few tiny stray sparks around the field */
      x.shadowBlur = 8;
      x.strokeStyle = 'rgba(199, 125, 255, 0.85)';
      for (let i = 0; i < 6; i++) {
        const ang = rand() * Math.PI * 2;
        const r0 = 60 + rand() * 200;
        const x0 = cx + Math.cos(ang) * r0;
        const y0 = cy + Math.sin(ang) * r0 * 0.7;
        const ang2 = ang + (rand() - 0.5) * 1.4;
        const len = 60 + rand() * 120;
        bolt(x, x0, y0,
             x0 + Math.cos(ang2) * len, y0 + Math.sin(ang2) * len * 0.7,
             40, 5, 1.2);
      }

      /* keep (0,0) corner black for side-wall UV */
      x.shadowBlur = 0;
      x.fillStyle = '#000'; x.fillRect(0, 0, 4, 4);
      return c;
    })();

    /* ----- normal map derived from stone luminance ----- */
    const normalCanvas = (() => {
      const w = stoneCanvas.width, h = stoneCanvas.height;
      const src = stoneCanvas.getContext('2d')!.getImageData(0, 0, w, h).data;
      const out = document.createElement('canvas');
      out.width = w; out.height = h;
      const dCtx = out.getContext('2d')!;
      const dst = dCtx.createImageData(w, h);
      const lum = (i: number) => (src[i] * 0.299 + src[i+1] * 0.587 + src[i+2] * 0.114) / 255;
      const at = (xx: number, yy: number) => {
        if (xx < 0) xx = 0; else if (xx >= w) xx = w - 1;
        if (yy < 0) yy = 0; else if (yy >= h) yy = h - 1;
        return lum((yy * w + xx) * 4);
      };
      const strength = 2.0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const dx = (at(x+1, y) - at(x-1, y)) * strength;
        const dy = (at(x, y+1) - at(x, y-1)) * strength;
        const dz = 1.0;
        const len = Math.hypot(dx, dy, dz);
        const i = (y * w + x) * 4;
        dst.data[i]   = (-dx / len * 0.5 + 0.5) * 255;
        dst.data[i+1] = (-dy / len * 0.5 + 0.5) * 255;
        dst.data[i+2] = ( dz / len * 0.5 + 0.5) * 255;
        dst.data[i+3] = 255;
      }
      dCtx.putImageData(dst, 0, 0);
      return out;
    })();

    /* ----- text canvas: PURPLE METALLIC, not silver ----- */
    const textCanvas = (() => {
      const c = document.createElement('canvas');
      c.width = 2048; c.height = 512;
      const x = c.getContext('2d')!;
      x.clearRect(0, 0, c.width, c.height);

      const fam = `'Helvetica Neue', 'Arial Black', Arial, sans-serif`;
      const style = o.italic ? 'italic' : 'normal';
      const targetW = c.width * 0.90;
      let size = 320;
      x.font = `${style} 900 ${size}px ${fam}`;
      while (x.measureText(o.text).width > targetW && size > 60) {
        size -= 6; x.font = `${style} 900 ${size}px ${fam}`;
      }
      x.textAlign = 'center';
      x.textBaseline = 'middle';

      const cx = c.width / 2;
      const cy = c.height / 2 + size * 0.04;
      const top = cy - size * 0.5;

      /* (1) faux 3D extrusion — back→front, dark purple stack */
      const depth = 18;
      for (let i = depth; i >= 1; i--) {
        const t = 1 - i / depth;
        const r = Math.floor(28 + t * 50);
        const g = Math.floor(8  + t * 18);
        const b = Math.floor(60 + t * 90);
        x.fillStyle = `rgb(${r}, ${g}, ${b})`;
        x.fillText(o.text, cx + i * 0.6, cy + i * 1.5);
      }

      /* (2) dark base shadow */
      x.shadowColor = 'rgba(0,0,0,0.85)';
      x.shadowBlur = 28; x.shadowOffsetY = 12;
      x.fillStyle = '#000';
      x.fillText(o.text, cx, cy);
      x.shadowColor = 'transparent';
      x.shadowBlur = 0; x.shadowOffsetY = 0;

      /* (3) main purple-metallic gradient — strong purple core, white highlight band */
      const grad = x.createLinearGradient(0, top, 0, top + size);
      grad.addColorStop(0.00, '#ffffff');
      grad.addColorStop(0.08, '#f3d8ff');
      grad.addColorStop(0.22, '#d670ff');
      grad.addColorStop(0.42, '#a020e0');
      grad.addColorStop(0.50, '#5a0a8e');
      grad.addColorStop(0.60, '#8420c0');
      grad.addColorStop(0.78, '#d878f0');
      grad.addColorStop(1.00, '#601890');
      x.fillStyle = grad;
      x.fillText(o.text, cx, cy);

      /* (4) bright specular sliver across the top */
      x.globalCompositeOperation = 'source-atop';
      const hg = x.createLinearGradient(0, top, 0, top + size * 0.35);
      hg.addColorStop(0,   'rgba(255,255,255,0.95)');
      hg.addColorStop(0.6, 'rgba(255,255,255,0.15)');
      hg.addColorStop(1,   'rgba(255,255,255,0.0)');
      x.fillStyle = hg;
      x.fillRect(0, top, c.width, size * 0.4);

      /* (5) violet under-glow on the bottom */
      const ug = x.createLinearGradient(0, cy + size * 0.15, 0, cy + size * 0.5);
      ug.addColorStop(0, 'rgba(199, 125, 255, 0.0)');
      ug.addColorStop(1, 'rgba(232, 165, 255, 0.55)');
      x.fillStyle = ug;
      x.fillRect(0, cy + size * 0.13, c.width, size * 0.4);
      x.globalCompositeOperation = 'source-over';

      return c;
    })();

    /* ----- wrap canvases as Three textures ----- */
    const stoneTex  = new THREE.CanvasTexture(stoneCanvas);
    stoneTex.colorSpace = THREE.SRGBColorSpace;
    const emissTex  = new THREE.CanvasTexture(lightCanvas);
    emissTex.colorSpace = THREE.SRGBColorSpace;
    const normalTex = new THREE.CanvasTexture(normalCanvas);
    const textTex   = new THREE.CanvasTexture(textCanvas);
    textTex.colorSpace = THREE.SRGBColorSpace;
    for (const t of [stoneTex, emissTex, normalTex, textTex]) {
      t.anisotropy = o.anisotropy;
      t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
      this._disposables.push(t);
    }

    /* ===================================================================
       GEOMETRY: rounded extruded plaque with custom UVs
       =================================================================== */
    const W = o.width, H = o.height, R = o.cornerRadius, D = o.depth;
    const shape = new THREE.Shape();
    shape.moveTo(-W/2 + R, -H/2);
    shape.lineTo( W/2 - R, -H/2);
    shape.quadraticCurveTo( W/2, -H/2,  W/2, -H/2 + R);
    shape.lineTo( W/2,  H/2 - R);
    shape.quadraticCurveTo( W/2,  H/2,  W/2 - R,  H/2);
    shape.lineTo(-W/2 + R,  H/2);
    shape.quadraticCurveTo(-W/2,  H/2, -W/2,  H/2 - R);
    shape.lineTo(-W/2, -H/2 + R);
    shape.quadraticCurveTo(-W/2, -H/2, -W/2 + R, -H/2);

    const halfW = W / 2, halfH = H / 2;
    const uvGen = {
      generateTopUV(geometry: any, vertices: any, indexA: number, indexB: number, indexC: number) {
        const ax = vertices[indexA*3], ay = vertices[indexA*3+1];
        const bx = vertices[indexB*3], by = vertices[indexB*3+1];
        const cx = vertices[indexC*3], cy = vertices[indexC*3+1];
        return [
          new THREE.Vector2((ax + halfW) / W, (ay + halfH) / H),
          new THREE.Vector2((bx + halfW) / W, (by + halfH) / H),
          new THREE.Vector2((cx + halfW) / W, (cy + halfH) / H),
        ];
      },
      generateSideWallUV() {
        return [
          new THREE.Vector2(0, 0),
          new THREE.Vector2(0, 0),
          new THREE.Vector2(0, 0),
          new THREE.Vector2(0, 0),
        ];
      }
    };

    const plaqueGeo = new THREE.ExtrudeGeometry(shape, {
      depth: D,
      bevelEnabled: true,
      bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 6,
      curveSegments: 24,
      UVGenerator: uvGen,
    });
    plaqueGeo.translate(0, 0, -D / 2);
    this._disposables.push(plaqueGeo);

    const plaqueMat = new THREE.MeshStandardMaterial({
      map: stoneTex,
      normalMap: normalTex,
      normalScale: new THREE.Vector2(1.4, 1.4),
      emissiveMap: emissTex,
      emissive: 0xffffff,
      emissiveIntensity: 0.75,
      roughness: 0.78,
      metalness: 0.2,
      envMapIntensity: 0.55,
    });
    this._disposables.push(plaqueMat);

    this.plaqueMesh = new THREE.Mesh(plaqueGeo, plaqueMat);
    this.add(this.plaqueMesh);

    /* halo — soft radial gradient, no hard edges */
    const haloCanvas = document.createElement('canvas');
    haloCanvas.width = haloCanvas.height = 512;
    {
      const ctx = haloCanvas.getContext('2d')!;
      const g = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
      g.addColorStop(0,    'rgba(199, 125, 255, 0.9)');
      g.addColorStop(0.25, 'rgba(168,  85, 247, 0.55)');
      g.addColorStop(0.55, 'rgba(106,  13, 173, 0.2)');
      g.addColorStop(1,    'rgba(0, 0, 0, 0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 512);
    }
    const haloTex = new THREE.CanvasTexture(haloCanvas);
    haloTex.colorSpace = THREE.SRGBColorSpace;
    this._disposables.push(haloTex);

    const haloGeo = new THREE.PlaneGeometry(W * 1.8, H * 2.0);
    const haloMat = new THREE.MeshBasicMaterial({
      map: haloTex, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this._disposables.push(haloGeo, haloMat);
    this.haloMesh = new THREE.Mesh(haloGeo, haloMat);
    this.haloMesh.position.z = -D / 2 - 0.18;
    this.add(this.haloMesh);

    /* text plane */
    const textW = W * 0.82;
    const textH = textW / (textCanvas.width / textCanvas.height);
    const textGeo = new THREE.PlaneGeometry(textW, textH);
    const textMat = new THREE.MeshBasicMaterial({
      map: textTex, transparent: true, depthWrite: false, alphaTest: 0.02,
    });
    this._disposables.push(textGeo, textMat);
    this.textMesh = new THREE.Mesh(textGeo, textMat);
    this.textMesh.position.set(0, 0, D / 2 + 0.03);
    this.add(this.textMesh);
  }

  /** Drive the electric flicker. Call once per frame with elapsed seconds. */
  update(t: number) {
    if (!this.plaqueMesh) return;
    const m = this.plaqueMesh.material as THREE.MeshStandardMaterial;
    const flick = 0.6
      + Math.sin(t * 7.3) * 0.18
      + Math.sin(t * 13.7) * 0.12
      + (Math.random() < 0.035 ? 0.45 : 0);
    m.emissiveIntensity = Math.max(0.28, flick);
    if (this.haloMesh) {
      (this.haloMesh.material as THREE.MeshBasicMaterial).opacity = 0.45 + Math.sin(t * 3.0) * 0.1;
    }
  }

  /** Free all GPU resources owned by this plaque. */
  dispose() {
    for (const d of this._disposables) {
      if (d && typeof d.dispose === 'function') d.dispose();
    }
    this._disposables = [];
  }
}
