/**
 * Minimal type declarations for silk-wasm (optional dependency)
 * Users need to: npm install silk-wasm
 */

declare module "silk-wasm" {
  export function decode(buffer: Uint8Array): Uint8Array
  export function encode(buffer: Uint8Array): Uint8Array
}
