import { Buffer } from 'node:buffer';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { execa } from 'execa';

const createMedia = async () => {
  const media = fileURLToPath(new URL('../public/media/', import.meta.url));
  await mkdir(media, { recursive: true });
  const scores = [
    {
      name: 'window',
      notes: [72, 76, 79, 76, 74, 72, 69, 67, 72, 74, 76, 79, 81, 79, 76, 72],
      bass: [48, 53, 45, 55],
    },
    {
      name: 'tide',
      notes: [69, 72, 76, 79, 76, 72, 69, 67, 65, 69, 72, 76, 74, 72, 69, 65],
      bass: [45, 53, 48, 55],
    },
    {
      name: 'rain',
      notes: [67, 71, 74, 79, 78, 74, 71, 67, 64, 67, 71, 74, 72, 71, 67, 64],
      bass: [43, 48, 40, 50],
    },
  ];
  const rate = 44100;
  const duration = 24;
  const frequency = (note: number) => 440 * 2 ** ((note - 69) / 12);
  for (const score of scores) {
    const samples = Buffer.alloc(rate * duration * 2);
    for (let i = 0; i < rate * duration; i++) {
      const t = i / rate;
      const step = Math.floor(t / 1.5);
      const age = t % 1.5;
      const freq = frequency(score.notes[step]);
      const bell =
        (Math.sin(2 * Math.PI * freq * age) +
          0.25 * Math.sin(2 * Math.PI * freq * 2 * age)) *
        Math.min(1, age / 0.012) *
        Math.exp(-age * 2.7);
      const bassFreq = frequency(score.bass[Math.floor(t / 6)]);
      const pad =
        (Math.sin(2 * Math.PI * bassFreq * t) +
          0.4 * Math.sin(2 * Math.PI * bassFreq * 1.5 * t)) *
        0.18;
      const fade = Math.min(1, t / 0.3, (duration - t) / 1.2);
      samples.writeInt16LE(
        Math.round((bell * 0.3 + pad) * fade * 25000),
        i * 2,
      );
    }
    await execa(
      'ffmpeg',
      [
        '-y',
        '-f',
        's16le',
        '-ar',
        String(rate),
        '-ac',
        '1',
        '-i',
        'pipe:0',
        '-codec:a',
        'libmp3lame',
        '-b:a',
        '96k',
        '-map_metadata',
        '-1',
        `${media}/${score.name}.mp3`,
      ],
      { input: samples, stderr: 'ignore' },
    );
  }
  const covers = [
    {
      name: 'window',
      sky: '#e4c3a4',
      ground: '#456d68',
      sun: '#f9e8c4',
      line: '#335d5a',
      shape:
        '<path d="M0 420Q180 360 330 440T800 400V800H0Z" fill="#67938c"/><path d="M100 0v800M580 0v800M0 370h800" stroke="#335d5a" stroke-width="24"/><path d="M170 800q-40-220 20-330m-20 170q130-150 170-80m-160 150Q40 580 20 640" stroke="#e4d7a3" fill="none" stroke-width="14"/>',
    },
    {
      name: 'tide',
      sky: '#a4c3c8',
      ground: '#325972',
      sun: '#f0d49f',
      line: '#e1e8d3',
      shape:
        '<path d="M0 410Q180 330 420 420T800 380V800H0Z" fill="#558b9c"/><path d="M0 540Q230 450 440 540T800 500V800H0Z" fill="#325972"/><path d="M0 700Q260 560 440 660T800 620V800H0Z" fill="#e8d2ad"/><path d="M70 600q220-100 420-20" stroke="#e1e8d3" stroke-width="5" fill="none"/>',
    },
    {
      name: 'rain',
      sky: '#bab7d3',
      ground: '#414c64',
      sun: '#f2d5ad',
      line: '#e2dae9',
      shape:
        '<path d="M0 440 170 280 320 440 500 200 800 440V800H0Z" fill="#737c94"/><path d="M0 600Q260 500 450 590T800 520V800H0Z" fill="#414c64"/><ellipse cx="470" cy="690" rx="200" ry="45" fill="#aaaec9"/><path d="m100 120-15 70m240-40-15 70m390-70-15 70m-230 70-15 70" stroke="#e2dae9" stroke-width="6"/>',
    },
  ];
  for (const cover of covers)
    await writeFile(
      `${media}/${cover.name}.svg`,
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800"><rect width="800" height="800" fill="${cover.sky}"/><circle cx="610" cy="180" r="88" fill="${cover.sun}"/>${cover.shape}</svg>\n`,
    );
};
void createMedia();
