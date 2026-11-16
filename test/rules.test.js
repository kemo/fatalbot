// The rules of AGENTS.md that a test can hold: the brain is portable, and only the senses read an enemy.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const files = readdirSync(SRC).filter((f) => f.endsWith('.js')).map((f) => ({ name: f, text: readFileSync(join(SRC, f), 'utf8') }));
// The code without its comments: a comment may name what the code must not use.
const code = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

test('the brain imports nothing from outside src/', () => {
  for (const { name, text } of files) {
    for (const [, from] of code(text).matchAll(/(?:import|export)[^'"]*from\s*['"]([^'"]+)['"]/g)) {
      assert.match(from, /^\.\/[a-z-]+\.js$/, `${name} imports ${from}`);
    }
  }
});

test('the brain uses no clock, no unseeded random and no host API', () => {
  const banned = [/Math\.random/, /Date\.now|new Date/, /\bperformance\b/, /\bprocess\./, /\bwindow\b|\bdocument\b/, /\bsetTimeout\b|\bsetInterval\b/, /\brequire\(/];
  for (const { name, text } of files) for (const re of banned) assert.doesNotMatch(code(text), re, `${name} uses ${re}`);
});

test('the trigonometry of the brain goes through geometry.js', () => {
  for (const { name, text } of files) {
    if (name === 'geometry.js') continue;
    assert.doesNotMatch(code(text), /Math\.(sin|cos|tan|atan2?|asin|acos|hypot|log2?|exp|pow)\b/, `${name} calls Math trigonometry`);
    // The same functions by another way: Math['atan2'], const { hypot } = Math, const M = Math.
    assert.doesNotMatch(code(text), /Math\s*\[|=\s*Math\s*[;,)\n]/, `${name} takes functions out of Math`);
  }
});

test('only the senses read the players and the bomb of a frame', () => {
  for (const { name, text } of files) {
    if (name === 'senses.js' || name === 'contract.js') continue;
    assert.doesNotMatch(code(text), /frame\.(players|bomb|smokes|events)\b/, `${name} reads the frame's raw state`);
    // The same state by another way: the frame that the brain keeps (brain.now), and a frame taken apart.
    assert.doesNotMatch(code(text), /\bnow\.(players|bomb|smokes|events)\b/, `${name} reads the kept frame's raw state`);
    assert.doesNotMatch(code(text), /\{[^}]*\b(players|bomb|smokes|events)\b[^}]*\}\s*=\s*[\w.]*\b(frame|now)\b/, `${name} takes the raw state out of a frame`);
  }
});

// U+2013 and U+2014, built from their numbers so that this file holds neither.
const DASH = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);

test('no em-dash and no en-dash in the repository text', () => {
  const root = join(SRC, '..');
  const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === 'out' || e.name === 'vendor') return [];
    return e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)];
  });
  for (const file of walk(root)) {
    if (!/\.(js|md|json)$/.test(file)) continue;
    assert.doesNotMatch(readFileSync(file, 'utf8'), DASH, `${file} holds a dash that the project forbids`);
  }
});
