/**
 * Reader for Postshot ".psht" project files ("jawset bcf" container).
 *
 * Layout (reverse-engineered from Postshot v1.x files):
 *   "jawset bcf\0" + 1 byte, then a data region, then a node index; the last 8 bytes
 *   hold the index offset (u64). Each index node is:
 *   typeHash(8) ptr(8) nameLen(u32) name dataOffset(u64) dataSize(u64) childCount(u64) children...
 * The trained model lives under ".../rdnc-field/splats/points" as planar float32 arrays
 * holding raw 3DGS parameters (log scale, logit opacity, unnormalized xyzw quaternion,
 * SH DC, and higher SH bands interleaved as [coef][rgb]).
 */

import { GaussianCloud } from '../types/gaussian';

const SH_C0 = 0.28209479177387814;
const MAGIC = 'jawset bcf';

interface BcfNode {
  name: string;
  offset: number;
  size: number;
  children: BcfNode[];
}

export class PshtNoSplatsError extends Error {
  constructor(fileName: string) {
    super(
      `"${fileName}" is a Postshot project without a trained splat model. Train it in Postshot, save, and import it again.`
    );
    this.name = 'PshtNoSplatsError';
  }
}

export async function isBcfFile(file: Blob): Promise<boolean> {
  if (file.size < MAGIC.length + 8) return false;
  const head = new Uint8Array(await file.slice(0, MAGIC.length).arrayBuffer());
  return new TextDecoder().decode(head) === MAGIC;
}

async function readBytes(file: Blob, offset: number, length: number): Promise<ArrayBuffer> {
  return file.slice(offset, offset + length).arrayBuffer();
}

function parseIndex(buf: ArrayBuffer): BcfNode {
  const view = new DataView(buf);
  const decoder = new TextDecoder();
  let p = 0;
  const readNode = (): BcfNode => {
    const nameLen = view.getUint32(p + 16, true);
    const name = decoder.decode(new Uint8Array(buf, p + 20, nameLen));
    p += 20 + nameLen;
    const offset = Number(view.getBigUint64(p, true));
    const size = Number(view.getBigUint64(p + 8, true));
    const childCount = Number(view.getBigUint64(p + 16, true));
    p += 24;
    const children: BcfNode[] = [];
    for (let i = 0; i < childCount; i++) children.push(readNode());
    return { name, offset, size, children };
  };
  return readNode();
}

function child(node: BcfNode | undefined, name: string): BcfNode | undefined {
  return node?.children.find((c) => c.name === name);
}

function findAll(node: BcfNode, name: string, out: BcfNode[] = []): BcfNode[] {
  if (node.name === name) out.push(node);
  for (const c of node.children) findAll(c, name, out);
  return out;
}

async function readFloats(file: Blob, node: BcfNode | undefined, count: number, label: string): Promise<Float32Array> {
  if (!node || node.size < count * 4) throw new Error(`Postshot model is missing "${label}" data.`);
  return new Float32Array(await readBytes(file, node.offset, count * 4));
}

async function readVector(file: Blob, attr: BcfNode | undefined, comps: string[], count: number, label: string) {
  const vecChildren = child(attr, 'children');
  return Promise.all(comps.map((c) => readFloats(file, child(child(vecChildren, c), 'data'), count, `${label}.${c}`)));
}

export async function parseBcfSplats(file: File): Promise<GaussianCloud> {
  const tail = new DataView(await readBytes(file, file.size - 8, 8));
  const indexOffset = Number(tail.getBigUint64(0, true));
  if (indexOffset <= 0 || indexOffset >= file.size - 8) throw new Error('Corrupt Postshot file: invalid index offset.');
  const root = parseIndex(await readBytes(file, indexOffset, file.size - 8 - indexOffset));

  // A project can hold several radiance fields; use the largest trained one.
  const candidates = findAll(root, 'rdnc-field')
    .map((rf) => child(child(rf, 'splats'), 'points'))
    .filter((pts): pts is BcfNode => !!pts && !!child(pts, 'size'));
  if (candidates.length === 0) throw new PshtNoSplatsError(file.name);
  const points = candidates.sort((a, b) => b.size - a.size)[0];

  const sizeNode = child(points, 'size')!;
  const count = Number(new DataView(await readBytes(file, sizeNode.offset, 8)).getBigUint64(0, true));
  if (!count) throw new PshtNoSplatsError(file.name);

  const attrs = child(points, 'children');
  const [px, py, pz] = await readVector(file, child(attrs, 'pos'), ['x', 'y', 'z'], count, 'pos');
  const [rx, ry, rz, rw] = await readVector(file, child(attrs, 'rotation'), ['x', 'y', 'z', 'w'], count, 'rotation');
  const [sx, sy, sz] = await readVector(file, child(attrs, 'scale'), ['x', 'y', 'z'], count, 'scale');
  const [dr, dg, db] = await readVector(file, child(attrs, 'sph_hrm_deg0'), ['x', 'y', 'z'], count, 'sph_hrm_deg0');
  const opacityLogit = await readFloats(file, child(child(attrs, 'opacity'), 'data'), count, 'opacity');

  const positions = new Float32Array(count * 3);
  const scales = new Float32Array(count * 3);
  const rotations = new Float32Array(count * 4);
  const colors = new Float32Array(count * 3);
  const opacities = new Float32Array(count);
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const i4 = i * 4;
    positions[i3] = px[i];
    positions[i3 + 1] = py[i];
    positions[i3 + 2] = pz[i];
    scales[i3] = Math.exp(sx[i]);
    scales[i3 + 1] = Math.exp(sy[i]);
    scales[i3 + 2] = Math.exp(sz[i]);
    const qLen = Math.hypot(rw[i], rx[i], ry[i], rz[i]) || 1;
    rotations[i4] = rw[i] / qLen;
    rotations[i4 + 1] = rx[i] / qLen;
    rotations[i4 + 2] = ry[i] / qLen;
    rotations[i4 + 3] = rz[i] / qLen;
    // Kept unclamped so PLY export round-trips the original SH DC values exactly.
    colors[i3] = 0.5 + SH_C0 * dr[i];
    colors[i3 + 1] = 0.5 + SH_C0 * dg[i];
    colors[i3 + 2] = 0.5 + SH_C0 * db[i];
    opacities[i] = 1 / (1 + Math.exp(-opacityLogit[i]));
  }

  // Bounds from the 1st-99th percentile so far-away background splats don't dominate framing.
  const sample = Math.min(count, 200000);
  const step = count / sample;
  const xs = new Float32Array(sample), ys = new Float32Array(sample), zs = new Float32Array(sample);
  for (let s = 0; s < sample; s++) {
    const i = Math.floor(s * step);
    xs[s] = px[i]; ys[s] = py[i]; zs[s] = pz[i];
  }
  xs.sort(); ys.sort(); zs.sort();
  const lo = Math.floor(sample * 0.01), hi = Math.max(lo, Math.ceil(sample * 0.99) - 1);
  minX = xs[lo]; maxX = xs[hi]; minY = ys[lo]; maxY = ys[hi]; minZ = zs[lo]; maxZ = zs[hi];

  const cloud: GaussianCloud = {
    count,
    positions,
    scales,
    rotations,
    colors,
    opacities,
    bounds: {
      min: [minX, minY, minZ],
      max: [maxX, maxY, maxZ],
      center: [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2],
      radius: Math.max(maxX - minX, maxY - minY, maxZ - minZ) / 2,
    },
  };

  const shNode = child(attrs, 'sph_hrm_degN');
  const shData = child(shNode, 'data');
  const elementSizeNode = child(shNode, 'element_size');
  if (shData && elementSizeNode) {
    const elementSize = Number(new DataView(await readBytes(file, elementSizeNode.offset, 8)).getBigUint64(0, true));
    const coeffsPerSplat = elementSize / 4;
    if (coeffsPerSplat > 0 && coeffsPerSplat % 3 === 0 && shData.size >= count * elementSize) {
      cloud.harmonics = await readHarmonics(file, shData.offset, count, coeffsPerSplat);
    }
  }

  return cloud;
}

/** Converts Postshot's per-splat [coef][rgb] layout to the PLY f_rest order [rgb][coef]. */
async function readHarmonics(file: Blob, offset: number, count: number, coeffsPerSplat: number): Promise<Float32Array> {
  const bands = coeffsPerSplat / 3;
  const out = new Float32Array(count * coeffsPerSplat);
  const splatsPerChunk = 1 << 18;
  for (let start = 0; start < count; start += splatsPerChunk) {
    const n = Math.min(splatsPerChunk, count - start);
    const src = new Float32Array(await readBytes(file, offset + start * coeffsPerSplat * 4, n * coeffsPerSplat * 4));
    for (let i = 0; i < n; i++) {
      const base = i * coeffsPerSplat;
      const dst = (start + i) * coeffsPerSplat;
      for (let k = 0; k < bands; k++) {
        out[dst + k] = src[base + k * 3];
        out[dst + bands + k] = src[base + k * 3 + 1];
        out[dst + 2 * bands + k] = src[base + k * 3 + 2];
      }
    }
  }
  return out;
}
