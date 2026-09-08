import sharp from 'sharp';
import { readdirSync } from 'node:fs';
const SERIE = ['pharma-warehouse.jpg','office-floor.jpg','office-corridor.jpg',
               'founder.jpg','team-desk.jpg','quarantine.jpg','records.jpg','efda-office.jpg'];
const L = 300, H = 200, PAD = 6;
const tuiles = [];
for (let i = 0; i < SERIE.length; i++) {
  for (const [j, base] of [[0,'originaux'], [1,'src/img/company']]) {
    tuiles.push({
      input: await sharp(`${base}/${SERIE[i]}`).resize(L, H, { fit: 'cover' }).png().toBuffer(),
      left: PAD + j * (L + PAD),
      top: PAD + i * (H + PAD),
    });
  }
}
await sharp({ create: { width: PAD + 2 * (L + PAD), height: PAD + SERIE.length * (H + PAD),
                        channels: 3, background: '#111' } })
  .composite(tuiles).png().toFile('verif/etalonnage.png');
console.log('avant (gauche) / apres (droite) -> verif/etalonnage.png');
