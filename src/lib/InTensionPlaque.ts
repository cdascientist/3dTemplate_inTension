import * as THREE from 'three';
import { Font } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';

async function loadHelvetikerBold() {
  const urls = [
    'https://cdn.jsdelivr.net/npm/three@0.169.0/examples/fonts/helvetiker_bold.typeface.json',
    'https://unpkg.com/three@0.169.0/examples/fonts/helvetiker_bold.typeface.json',
    'https://raw.githubusercontent.com/mrdoob/three.js/r169/examples/fonts/helvetiker_bold.typeface.json',
  ];
  for (const url of urls) {
    try {
      const resp = await fetch(url);
      if (!resp.ok) continue;
      const json = await resp.json();
      return new Font(json);
    } catch (e) {
      console.warn(`Font CDN ${url} failed:`, e);
    }
  }
  return null;
}

function makeBoltShape(THREE: any) {
  const s = new THREE.Shape();
  s.moveTo( 0.30,  1.00); 
  s.lineTo( 0.10,  0.05); 
  s.lineTo(-0.30, -0.05); 
  s.lineTo(-0.30, -1.00); 
  s.lineTo(-0.10, -0.05); 
  s.lineTo( 0.30,  0.05); 
  s.closePath();
  return s;
}

export class InTensionPlaque extends THREE.Group {
  opts: any;
  _disposables: any[];
  plaqueMesh?: THREE.Mesh;
  haloMesh?: THREE.Mesh;
  overlayMesh?: THREE.Mesh;
  internalPointLight?: THREE.PointLight;
  textInMesh?: THREE.Mesh;
  textRightMesh?: THREE.Mesh;
  boltMesh?: THREE.Mesh;
  boltGlowMesh?: THREE.Mesh;
  textInGlowMesh?: THREE.Mesh;
  textRightGlowMesh?: THREE.Mesh;
  _makeNoise?: any;

  constructor(options = {}) {
    super();
    this.opts = {
      textLeft: 'In',
      textRight: 'Tension',
      width: 5.0,
      height: 3.0,
      depth: 0.45,
      cornerRadius: 0.4,
      italic: true,
      seed: 1,
      anisotropy: 4,
      internalLight: true,
      overlay: true,
      ...options,
    };
    this._disposables = [];
    this._buildPlaque();
    if (this.opts.overlay) this._buildOverlay();
    this._buildTextAsync();
  }

  _makeRand(seed?: number) {
    let s = ((seed ?? this.opts.seed) >>> 0) || 1;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 0x100000000;
    };
  }

  _buildPlaque() {
    const o = this.opts;
    const rand = this._makeRand();
    const TEX_W = 1024, TEX_H = 640;

    const makeNoise = (w: number, h: number, scale: number, octaves = 4, rng = rand) => {
      const grids: any[] = [];
      for (let oct = 0; oct < octaves; oct++) {
        const sc = Math.max(2, scale * Math.pow(2, oct));
        const gw = Math.ceil(w / sc) + 2, gh = Math.ceil(h / sc) + 2;
        const g = new Float32Array(gw * gh);
        for (let i = 0; i < g.length; i++) g[i] = rng();
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
    this._makeNoise = makeNoise;

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

      x.globalCompositeOperation = 'multiply';
      x.strokeStyle = '#000';
      x.lineCap = 'round';
      for (let i = 0; i < 55; i++) {
        const x0 = rand() * TEX_W, y0 = rand() * TEX_H;
        const ang = rand() * Math.PI * 2;
        const len = 60 + rand() * 200;
        x.lineWidth = 1 + rand() * 1.4;
        x.beginPath(); x.moveTo(x0, y0);
        for (let s = 1; s <= 4; s++) {
          const t = s / 4;
          x.lineTo(x0 + Math.cos(ang) * len * t + (rand() - 0.5) * 18,
                   y0 + Math.sin(ang) * len * t + (rand() - 0.5) * 18);
        }
        x.stroke();
      }
      x.globalCompositeOperation = 'source-over';
      const vg = x.createRadialGradient(TEX_W/2, TEX_H/2, TEX_W*0.25, TEX_W/2, TEX_H/2, TEX_W*0.7);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.65)');
      x.fillStyle = vg; x.fillRect(0, 0, TEX_W, TEX_H);
      x.fillStyle = '#000'; x.fillRect(0, 0, 4, 4);
      return c;
    })();

    const lightCanvas = (() => {
      const c = document.createElement('canvas');
      c.width = TEX_W; c.height = TEX_H;
      const x = c.getContext('2d')!;
      x.fillStyle = '#000'; x.fillRect(0, 0, TEX_W, TEX_H);
      const cx = TEX_W / 2, cy = TEX_H / 2;
      x.lineCap = 'round'; x.lineJoin = 'round';

      const seeds = [
        { ang:  0.05,              len: 380, w: 3.6, depth: 7 },
        { ang:  Math.PI - 0.05,    len: 380, w: 3.6, depth: 7 },
        { ang: -0.55,              len: 260, w: 2.4, depth: 6 },
        { ang:  Math.PI + 0.55,    len: 260, w: 2.4, depth: 6 },
        { ang:  0.7,               len: 240, w: 2.2, depth: 6 },
        { ang:  Math.PI - 0.7,     len: 240, w: 2.2, depth: 6 },
        { ang: -Math.PI / 2 - 0.2, len: 180, w: 1.7, depth: 5 },
        { ang: -Math.PI / 2 + 0.2, len: 180, w: 1.7, depth: 5 },
        { ang:  Math.PI / 2 - 0.2, len: 200, w: 1.8, depth: 5 },
        { ang:  Math.PI / 2 + 0.2, len: 200, w: 1.8, depth: 5 },
      ];
      const seed0 = (this.opts.seed >>> 0) || 1;
      const drawAllPaths = (widthMul: number, colorPass: string) => {
        let s = seed0;
        const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000; };
        const drawTree: any = (sx: number, sy: number, ang: number, length: number, depth: number, width: number) => {
          if (depth <= 0 || length < 4) return;
          const segs = 5 + Math.floor(r() * 4);
          const ex = sx + Math.cos(ang) * length;
          const ey = sy + Math.sin(ang) * length * 0.85;
          x.lineWidth = Math.max(0.4, width * widthMul);
          x.beginPath(); x.moveTo(sx, sy);
          for (let i = 1; i < segs; i++) {
            const t = i / segs;
            const jit = length * 0.18;
            x.lineTo(sx + (ex - sx) * t + (r() - 0.5) * jit,
                     sy + (ey - sy) * t + (r() - 0.5) * jit);
          }
          x.lineTo(ex, ey); x.stroke();
          if (r() < 0.85) drawTree(ex, ey, ang + (r() - 0.5) * 0.6,
            length * (0.65 + r() * 0.2), depth - 1, width * 0.78);
          if (r() < 0.55) {
            const sn = r() < 0.5 ? -1 : 1;
            drawTree(ex, ey, ang + sn * (0.55 + r() * 0.5),
              length * (0.45 + r() * 0.25), depth - 1, width * 0.6);
          }
          if (r() < 0.25) {
            const sn = r() < 0.5 ? -1 : 1;
            drawTree(ex, ey, ang + sn * (1.0 + r() * 0.6),
              length * (0.3 + r() * 0.2), depth - 2, width * 0.45);
          }
        };
        x.strokeStyle = colorPass;
        for (const sd of seeds) drawTree(cx + Math.cos(sd.ang)*14, cy + Math.sin(sd.ang)*12,
                                          sd.ang, sd.len, sd.depth, sd.w);
      };
      x.shadowColor = '#a855f7'; x.shadowBlur = 20;
      drawAllPaths(1.0, 'rgba(168, 85, 247, 0.92)');
      x.shadowBlur = 4;
      drawAllPaths(0.35, 'rgba(245, 220, 255, 1)');
      x.shadowBlur = 6;
      x.strokeStyle = 'rgba(199, 125, 255, 0.7)';
      for (let i = 0; i < 4; i++) {
        const ang = rand() * Math.PI * 2;
        const r0 = 100 + rand() * 200;
        const x0 = cx + Math.cos(ang) * r0;
        const y0 = cy + Math.sin(ang) * r0 * 0.85;
        const ang2 = ang + (rand() - 0.5) * 1.4;
        const len = 50 + rand() * 80;
        x.lineWidth = 1; x.beginPath(); x.moveTo(x0, y0);
        for (let sj = 1; sj <= 4; sj++) {
          const t = sj / 4;
          x.lineTo(x0 + Math.cos(ang2) * len * t + (rand() - 0.5) * 14,
                   y0 + Math.sin(ang2) * len * t + (rand() - 0.5) * 14);
        }
        x.stroke();
      }
      x.shadowBlur = 0;
      x.fillStyle = '#000'; x.fillRect(0, 0, 4, 4);
      return c;
    })();

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
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const dx = (at(x+1, y) - at(x-1, y)) * 2.0;
        const dy = (at(x, y+1) - at(x, y-1)) * 2.0;
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

    const stoneTex  = new THREE.CanvasTexture(stoneCanvas);
    stoneTex.colorSpace = THREE.SRGBColorSpace;
    const emissTex  = new THREE.CanvasTexture(lightCanvas);
    emissTex.colorSpace = THREE.SRGBColorSpace;
    const normalTex = new THREE.CanvasTexture(normalCanvas);
    for (const t of [stoneTex, emissTex, normalTex]) {
      t.anisotropy = o.anisotropy;
      t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
      this._disposables.push(t);
    }

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
      generateTopUV(g: any, v: any, ia: number, ib: number, ic: number) {
        return [
          new THREE.Vector2((v[ia*3] + halfW) / W, (v[ia*3+1] + halfH) / H),
          new THREE.Vector2((v[ib*3] + halfW) / W, (v[ib*3+1] + halfH) / H),
          new THREE.Vector2((v[ic*3] + halfW) / W, (v[ic*3+1] + halfH) / H),
        ];
      },
      generateSideWallUV() {
        return [new THREE.Vector2(0,0), new THREE.Vector2(0,0),
                new THREE.Vector2(0,0), new THREE.Vector2(0,0)];
      }
    };
    const plaqueGeo = new THREE.ExtrudeGeometry(shape, {
      depth: D, bevelEnabled: true,
      bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 6,
      curveSegments: 24, UVGenerator: uvGen,
    });
    plaqueGeo.translate(0, 0, -D / 2);
    this._disposables.push(plaqueGeo);

    const plaqueMat = new THREE.MeshStandardMaterial({
      map: stoneTex, normalMap: normalTex,
      normalScale: new THREE.Vector2(1.4, 1.4),
      emissiveMap: emissTex, emissive: 0xffffff,
      emissiveIntensity: 0.75,
      roughness: 0.78, metalness: 0.2,
      envMapIntensity: 0.55,
    });
    this._disposables.push(plaqueMat);
    this.plaqueMesh = new THREE.Mesh(plaqueGeo, plaqueMat);
    this.add(this.plaqueMesh);

    const haloCanvas = document.createElement('canvas');
    haloCanvas.width = haloCanvas.height = 512;
    {
      const ctx = haloCanvas.getContext('2d')!;
      const g = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
      g.addColorStop(0, 'rgba(199, 125, 255, 0.9)');
      g.addColorStop(0.25, 'rgba(168, 85, 247, 0.55)');
      g.addColorStop(0.55, 'rgba(106, 13, 173, 0.2)');
      g.addColorStop(1, 'rgba(0, 0, 0, 0)');
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

    if (o.internalLight) {
      this.internalPointLight = new THREE.PointLight(0xc77dff, 2.0, 6, 1.5);
      this.internalPointLight.position.set(0, 0, 0);
      this.add(this.internalPointLight);

      const upperLight = new THREE.DirectionalLight(0xe0b0ff, 6.0);
      upperLight.position.set(0, o.height! / 2 + 5, o.depth! / 2 + 5);
      upperLight.target.position.set(0, 0, 0);
      this.add(upperLight);
      this.add(upperLight.target);

      const lowerLight = new THREE.DirectionalLight(0xffb0ff, 6.0);
      lowerLight.position.set(0, -o.height! / 2 - 5, o.depth! / 2 + 5);
      lowerLight.target.position.set(0, 0, 0);
      this.add(lowerLight);
      this.add(lowerLight.target);
    }
  }

  _buildOverlay() {
    const o = this.opts;
    const W = o.width, H = o.height, R = o.cornerRadius, D = o.depth;
    const rand = this._makeRand((o.seed >>> 0) + 7919);
    const TEX_W = 1024, TEX_H = 640;

    const diffuseCanvas = (() => {
      const c = document.createElement('canvas');
      c.width = TEX_W; c.height = TEX_H;
      const x = c.getContext('2d')!;
      x.clearRect(0, 0, TEX_W, TEX_H);

      const n1 = this._makeNoise(TEX_W, TEX_H, 6, 5, rand);
      const n2 = this._makeNoise(TEX_W, TEX_H, 20, 3, rand);
      const img = x.createImageData(TEX_W, TEX_H);
      for (let i = 0; i < TEX_W * TEX_H; i++) {
        const v = n1[i] * 0.6 + n2[i] * 0.4;
        const k = Math.pow(v, 1.1);
        const j = i * 4;
        img.data[j]   = 120 + k * 80;
        img.data[j+1] = 105 + k * 70;
        img.data[j+2] = 145 + k * 90;
        img.data[j+3] = 90 + k * 80;
      }
      x.putImageData(img, 0, 0);

      x.globalCompositeOperation = 'source-over';
      x.strokeStyle = 'rgba(40, 20, 60, 0.6)';
      x.lineCap = 'round';
      for (let i = 0; i < 28; i++) {
        const x0 = rand() * TEX_W, y0 = rand() * TEX_H;
        const ang = rand() * Math.PI * 2;
        const len = 80 + rand() * 220;
        x.lineWidth = 0.6 + rand() * 1.0;
        x.beginPath(); x.moveTo(x0, y0);
        const segs = 5;
        for (let s = 1; s <= segs; s++) {
          const t = s / segs;
          x.lineTo(x0 + Math.cos(ang) * len * t + (rand() - 0.5) * 22,
                   y0 + Math.sin(ang) * len * t + (rand() - 0.5) * 22);
        }
        x.stroke();
      }
      return c;
    })();

    const normalCanvas = (() => {
      const w = diffuseCanvas.width, h = diffuseCanvas.height;
      const src = diffuseCanvas.getContext('2d')!.getImageData(0, 0, w, h).data;
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
      const strength = 2.5;
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

    const diffuseTex = new THREE.CanvasTexture(diffuseCanvas);
    diffuseTex.colorSpace = THREE.SRGBColorSpace;
    const normalTex = new THREE.CanvasTexture(normalCanvas);
    [diffuseTex, normalTex].forEach(t => {
      t.anisotropy = o.anisotropy;
      this._disposables.push(t);
    });

    const inset = 0.08;
    const innerShape = new THREE.Shape();
    const w2 = W - inset * 2, h2 = H - inset * 2, r2 = R - inset * 0.5;
    innerShape.moveTo(-w2/2 + r2, -h2/2);
    innerShape.lineTo( w2/2 - r2, -h2/2);
    innerShape.quadraticCurveTo( w2/2, -h2/2,  w2/2, -h2/2 + r2);
    innerShape.lineTo( w2/2,  h2/2 - r2);
    innerShape.quadraticCurveTo( w2/2,  h2/2,  w2/2 - r2,  h2/2);
    innerShape.lineTo(-w2/2 + r2,  h2/2);
    innerShape.quadraticCurveTo(-w2/2,  h2/2, -w2/2,  h2/2 - r2);
    innerShape.lineTo(-w2/2, -h2/2 + r2);
    innerShape.quadraticCurveTo(-w2/2, -h2/2, -w2/2 + r2, -h2/2);

    const overlayGeo = new THREE.ShapeGeometry(innerShape, 24);
    overlayGeo.computeBoundingBox();
    const bb = overlayGeo.boundingBox!;
    const bbw = bb.max.x - bb.min.x, bbh = bb.max.y - bb.min.y;
    const uvAttr = overlayGeo.attributes.uv;
    const posAttr = overlayGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i), y = posAttr.getY(i);
      uvAttr.setXY(i, (x - bb.min.x) / bbw, (y - bb.min.y) / bbh);
    }
    uvAttr.needsUpdate = true;
    this._disposables.push(overlayGeo);

    const overlayMat = new THREE.MeshPhysicalMaterial({
      map: diffuseTex,
      normalMap: normalTex,
      normalScale: new THREE.Vector2(0.8, 0.8),
      transparent: true,
      opacity: 0.55,
      roughness: 0.32,
      metalness: 0.08,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      envMapIntensity: 1.8,
      depthWrite: false,
      side: THREE.FrontSide,
    });
    this._disposables.push(overlayMat);

    this.overlayMesh = new THREE.Mesh(overlayGeo, overlayMat);
    this.overlayMesh.position.z = D / 2 + 0.005;
    this.add(this.overlayMesh);
  }

  async _buildTextAsync() {
    const o = this.opts;
    const font = await loadHelvetikerBold();
    if (!font) {
      console.error('InTensionPlaque: font load failed from all CDNs');
      return;
    }
    const D = o.depth;
    const TEXT_SIZE = o.height * 0.22;
    const TEXT_DEPTH = D * 0.4;

    const textOpts = {
      font,
      size: TEXT_SIZE,
      depth: TEXT_DEPTH,
      curveSegments: 14,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.025,
      bevelSegments: 5,
    };

    const inGeo  = new TextGeometry(o.textLeft,  textOpts);
    const tGeo   = new TextGeometry(o.textRight, textOpts);
    inGeo.center();
    tGeo.center();

    if (o.italic) {
      const sx = 0.20;
      const m = new THREE.Matrix4().set(
        1, sx, 0, 0,
        0, 1,  0, 0,
        0, 0,  1, 0,
        0, 0,  0, 1
      );
      inGeo.applyMatrix4(m);
      tGeo.applyMatrix4(m);
    }

    inGeo.computeBoundingBox();
    tGeo.computeBoundingBox();
    const inW = inGeo.boundingBox!.max.x - inGeo.boundingBox!.min.x;
    const tW  = tGeo.boundingBox!.max.x  - tGeo.boundingBox!.min.x;

    const boltShape = makeBoltShape(THREE);
    const boltGeoRaw = new THREE.ExtrudeGeometry(boltShape, {
      depth: TEXT_DEPTH * 1.05,
      bevelEnabled: true,
      bevelThickness: 0.018,
      bevelSize: 0.014,
      bevelSegments: 4,
      curveSegments: 6,
    });
    const boltTargetH = TEXT_SIZE * 1.45;
    const boltScale = boltTargetH / 2;
    boltGeoRaw.scale(boltScale, boltScale, 1);
    boltGeoRaw.rotateZ(-0.25);
    boltGeoRaw.computeBoundingBox();
    const boltBB = boltGeoRaw.boundingBox!;
    const boltW = boltBB.max.x - boltBB.min.x;
    this._disposables.push(boltGeoRaw);

    const gap = TEXT_SIZE * 0.18;
    const totalW = inW + gap + boltW + gap + tW;
    const maxW = o.width * 0.85;
    const fit = totalW > maxW ? maxW / totalW : 1;

    if (fit < 1) {
      inGeo.scale(fit, fit, 1);
      tGeo.scale(fit, fit, 1);
      boltGeoRaw.scale(fit, fit, 1);
      inGeo.computeBoundingBox();
      tGeo.computeBoundingBox();
      boltGeoRaw.computeBoundingBox();
    }

    const inW2  = inGeo.boundingBox!.max.x  - inGeo.boundingBox!.min.x;
    const tW2   = tGeo.boundingBox!.max.x   - tGeo.boundingBox!.min.x;
    const boltW2 = boltGeoRaw.boundingBox!.max.x - boltGeoRaw.boundingBox!.min.x;
    const gap2  = gap * fit;
    const totalW2 = inW2 + gap2 + boltW2 + gap2 + tW2;
    const startX = -totalW2 / 2;

    this._disposables.push(inGeo, tGeo);

    const textMat = new THREE.MeshPhysicalMaterial({
      color: 0x6a14a0, metalness: 0.92, roughness: 0.22,
      clearcoat: 1.0, clearcoatRoughness: 0.08,
      emissive: 0xb050e0, emissiveIntensity: 0.55,
      envMapIntensity: 2.4,
    });
    this._disposables.push(textMat);

    const FRONT_Z = D / 2 + 0.055;
    const GLOW_Z  = D / 2 + 0.025;

    this.textInMesh = new THREE.Mesh(inGeo, textMat);
    this.textInMesh.position.set(startX + inW2 / 2, 0, FRONT_Z);
    this.add(this.textInMesh);

    const inGlowGeo = inGeo.clone();
    inGlowGeo.scale(1.06, 1.06, 0.4);
    this._disposables.push(inGlowGeo);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xd870ff, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this._disposables.push(glowMat);
    this.textInGlowMesh = new THREE.Mesh(inGlowGeo, glowMat);
    this.textInGlowMesh.position.set(startX + inW2 / 2, 0, GLOW_Z);
    this.add(this.textInGlowMesh);

    this.textRightMesh = new THREE.Mesh(tGeo, textMat);
    this.textRightMesh.position.set(startX + inW2 + gap2 + boltW2 + gap2 + tW2 / 2, 0, FRONT_Z);
    this.add(this.textRightMesh);

    const tGlowGeo = tGeo.clone();
    tGlowGeo.scale(1.06, 1.06, 0.4);
    this._disposables.push(tGlowGeo);
    const glowMat2 = new THREE.MeshBasicMaterial({
      color: 0xd870ff, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this._disposables.push(glowMat2);
    this.textRightGlowMesh = new THREE.Mesh(tGlowGeo, glowMat2);
    this.textRightGlowMesh.position.set(
      startX + inW2 + gap2 + boltW2 + gap2 + tW2 / 2, 0, GLOW_Z);
    this.add(this.textRightGlowMesh);

    const boltMat = new THREE.MeshPhysicalMaterial({
      color: 0xb558e8, metalness: 0.95, roughness: 0.14,
      clearcoat: 1.0, clearcoatRoughness: 0.05,
      emissive: 0xe892ff, emissiveIntensity: 1.0,
      envMapIntensity: 2.8,
    });
    this._disposables.push(boltMat);

    const boltCenterX = startX + inW2 + gap2 + boltW2 / 2;
    this.boltMesh = new THREE.Mesh(boltGeoRaw, boltMat);
    this.boltMesh.position.set(boltCenterX, 0, FRONT_Z);
    this.add(this.boltMesh);

    const boltGlowGeo = boltGeoRaw.clone();
    boltGlowGeo.scale(1.18, 1.18, 0.4);
    this._disposables.push(boltGlowGeo);
    const boltGlowMat = new THREE.MeshBasicMaterial({
      color: 0xff9bff, transparent: true, opacity: 0.7,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this._disposables.push(boltGlowMat);
    this.boltGlowMesh = new THREE.Mesh(boltGlowGeo, boltGlowMat);
    this.boltGlowMesh.position.set(boltCenterX, 0, GLOW_Z);
    this.add(this.boltGlowMesh);
  }

  update(t: number) {
    if (this.plaqueMesh) {
      const m = this.plaqueMesh.material as THREE.MeshStandardMaterial;
      const flick = 0.6
        + Math.sin(t * 7.3) * 0.18
        + Math.sin(t * 13.7) * 0.12
        + (Math.random() < 0.035 ? 0.45 : 0);
      const f = Math.max(0.28, flick);
      m.emissiveIntensity = f;

      if (this.haloMesh)
        (this.haloMesh.material as THREE.MeshBasicMaterial).opacity = 0.45 + Math.sin(t * 3.0) * 0.1;
      if (this.internalPointLight)
        this.internalPointLight.intensity = 1.5 + f * 3.5;
      if (this.textInMesh)
        (this.textInMesh.material as THREE.MeshPhysicalMaterial).emissiveIntensity = 0.4 + f * 0.7;
      if (this.textInGlowMesh)
        (this.textInGlowMesh.material as THREE.MeshBasicMaterial).opacity = 0.3 + f * 0.4;
      if (this.textRightGlowMesh)
        (this.textRightGlowMesh.material as THREE.MeshBasicMaterial).opacity = 0.3 + f * 0.4;
      if (this.boltMesh) {
        const boltFlick = 0.7 + Math.sin(t * 11) * 0.3 + Math.sin(t * 19) * 0.2;
        (this.boltMesh.material as THREE.MeshPhysicalMaterial).emissiveIntensity = Math.max(0.5, boltFlick);
      }
      if (this.boltGlowMesh)
        (this.boltGlowMesh.material as THREE.MeshBasicMaterial).opacity =
          0.5 + Math.sin(t * 11) * 0.2 + (Math.random() < 0.04 ? 0.2 : 0);
    }
  }

  dispose() {
    for (const d of this._disposables) {
      if (d && typeof d.dispose === 'function') d.dispose();
    }
    this._disposables = [];
  }
}
