import rawMountainAshBundle from '../large_old_eucalypt_content_layer_v4.json';

export { rawMountainAshBundle };

export function getRawMountainAshBundle() {
  return structuredClone(rawMountainAshBundle);
}
