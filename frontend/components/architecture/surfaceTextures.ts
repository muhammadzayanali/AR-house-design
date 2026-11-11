"use client";

import { CanvasTexture, LinearSRGBColorSpace, RepeatWrapping, SRGBColorSpace, type Texture } from "three";

/** Original procedural surfaces. Not photographs and not a scan. */

function makeCanvas(size: number) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext("2d");
  if (!g) throw new Error("canvas");
  return { canvas, g, size };
}

function texture(canvas: HTMLCanvasElement, repeat: number, color: boolean): Texture {
  const map = new CanvasTexture(canvas);
  map.wrapS = RepeatWrapping;
  map.wrapT = RepeatWrapping;
  map.repeat.set(repeat, repeat);
  map.colorSpace = color ? SRGBColorSpace : LinearSRGBColorSpace;
  map.anisotropy = 2;
  return map;
}

function hexToRgb(hex: string) {
  const n = hex.replace("#", "");
  return {
    r: parseInt(n.slice(0, 2), 16),
    g: parseInt(n.slice(2, 4), 16),
    b: parseInt(n.slice(4, 6), 16),
  };
}

function clamp(n: number) {
  return Math.max(0, Math.min(255, n));
}

export function plasterMaps(hex: string, repeat = 1) {
  const { canvas, g, size } = makeCanvas(256);
  const { r, g: gg, b } = hexToRgb(hex);
  const img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const speck = (Math.random() - 0.5) * 22;
      const mottling = Math.sin(x * 0.07) * Math.cos(y * 0.05) * 8;
      img.data[i] = clamp(r + speck + mottling);
      img.data[i + 1] = clamp(gg + speck * 0.95 + mottling);
      img.data[i + 2] = clamp(b + speck * 0.85 + mottling);
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  g.globalAlpha = 0.07;
  g.strokeStyle = "#3a3228";
  g.lineWidth = 1;
  for (let y = 4; y < size; y += 6) {
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= size; x += 16) g.lineTo(x, y + Math.sin(x * 0.2 + y) * 1.4);
    g.stroke();
  }
  const bump = makeCanvas(256);
  const src = g.getImageData(0, 0, size, size);
  const out = bump.g.createImageData(size, size);
  for (let i = 0; i < src.data.length; i += 4) {
    const l = src.data[i] * 0.3 + src.data[i + 1] * 0.5 + src.data[i + 2] * 0.2;
    out.data[i] = out.data[i + 1] = out.data[i + 2] = l;
    out.data[i + 3] = 255;
  }
  bump.g.putImageData(out, 0, 0);
  return { map: texture(canvas, repeat, true), bump: texture(bump.canvas, repeat, false) };
}

export function roofTileMap(repeat = 1) {
  const { canvas, g, size } = makeCanvas(256);
  g.fillStyle = "#4a2218";
  g.fillRect(0, 0, size, size);
  const rowH = 28;
  const tileW = 36;
  for (let row = 0; row < size / rowH + 2; row++) {
    const y = row * rowH;
    const shift = row % 2 ? tileW / 2 : 0;
    for (let x = -tileW; x < size + tileW; x += tileW) {
      g.fillStyle = (row + x / tileW) % 2 === 0 ? "#c56a48" : "#a84e34";
      g.beginPath();
      g.ellipse(x + shift + tileW / 2, y + 8, tileW / 2 - 2, rowH * 0.7, 0, Math.PI, 0, true);
      g.fill();
      g.strokeStyle = "#2c120c";
      g.lineWidth = 3;
      g.stroke();
      g.strokeStyle = "rgba(255,220,190,0.35)";
      g.lineWidth = 1;
      g.beginPath();
      g.ellipse(x + shift + tileW / 2, y + 6, tileW / 2 - 6, rowH * 0.35, 0, Math.PI, 0, true);
      g.stroke();
    }
  }
  return texture(canvas, repeat, true);
}

export function grassMap(repeat = 1) {
  const { canvas, g, size } = makeCanvas(256);
  g.fillStyle = "#3e6238";
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 1800; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    g.strokeStyle = Math.random() > 0.5 ? "#6ea35a" : "#2d4a28";
    g.globalAlpha = 0.55;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (Math.random() - 0.5) * 3, y - 4 - Math.random() * 5);
    g.stroke();
  }
  g.globalAlpha = 1;
  return texture(canvas, repeat, true);
}

export function stonePaveMap(repeat = 1) {
  const { canvas, g, size } = makeCanvas(256);
  g.fillStyle = "#8d8680";
  g.fillRect(0, 0, size, size);
  g.strokeStyle = "#5c564e";
  g.lineWidth = 2;
  const step = 42;
  for (let y = 0; y < size; y += step) {
    const shift = (y / step) % 2 ? step / 2 : 0;
    for (let x = -step; x < size + step; x += step) {
      g.fillStyle = (x + y) % (step * 2) === 0 ? "#a39b92" : "#8a837c";
      g.fillRect(x + shift + 2, y + 2, step - 4, step - 4);
      g.strokeRect(x + shift + 2, y + 2, step - 4, step - 4);
    }
  }
  return texture(canvas, repeat, true);
}

export function timberMap(repeat = 1) {
  const { canvas, g, size } = makeCanvas(256);
  g.fillStyle = "#6e4a32";
  g.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y++) {
    const n = Math.sin(y * 0.35) * 8 + (Math.random() - 0.5) * 10;
    g.strokeStyle = `rgba(40, 24, 14, ${0.15 + Math.random() * 0.15})`;
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(size, y + n * 0.05);
    g.stroke();
  }
  return texture(canvas, repeat, true);
}
