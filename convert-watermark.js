import sharp from 'sharp';

sharp('watermark.svg')
    .resize(200)
    .png()
    .toFile('watermark.png')
    .then(() => console.log('✅ Watermark convertido exitosamente'))
    .catch(err => console.error('❌ Error:', err));
