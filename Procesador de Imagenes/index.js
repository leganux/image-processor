#!/usr/bin/env node

import sharp from 'sharp';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function getWatermarkPosition(config, imageWidth, imageHeight, watermarkWidth, watermarkHeight) {
    const padding = config.watermark.padding || 20;
    let x, y;

    switch (config.watermark.position) {
        case 'bottom-right':
            x = imageWidth - watermarkWidth - padding;
            y = imageHeight - watermarkHeight - padding;
            break;
        case 'bottom-left':
            x = padding;
            y = imageHeight - watermarkHeight - padding;
            break;
        case 'top-right':
            x = imageWidth - watermarkWidth - padding;
            y = padding;
            break;
        case 'top-left':
            x = padding;
            y = padding;
            break;
        case 'center':
            x = (imageWidth - watermarkWidth) / 2;
            y = (imageHeight - watermarkHeight) / 2;
            break;
        default:
            x = imageWidth - watermarkWidth - padding;
            y = imageHeight - watermarkHeight - padding;
    }

    return { x, y };
}

async function processImages() {
    try {
        // Read configuration
        const config = JSON.parse(await fs.readFile(path.join(__dirname, 'config.json'), 'utf8'));
        
        // Verify watermark image exists if enabled
        if (config.watermark.enabled) {
            const watermarkPath = path.resolve(__dirname, config.watermark.imagePath);
            if (!await fs.pathExists(watermarkPath)) {
                console.log(chalk.red(`❌ Error: No se encontró la imagen de marca de agua en: ${config.watermark.imagePath}`));
                console.log(chalk.blue('👉 Asegúrate de colocar una imagen para la marca de agua en la ubicación especificada'));
                return;
            }
        }

        // Ensure input and output directories exist
        await fs.ensureDir(config.inputFolder);
        await fs.ensureDir(config.outputFolder);

        // Get all files from input directory
        const files = await fs.readdir(config.inputFolder);
        
        if (files.length === 0) {
            console.log(chalk.yellow('⚠️  No hay archivos en la carpeta de entrada'));
            console.log(chalk.blue(`👉 Coloca tus imágenes en la carpeta: ${config.inputFolder}`));
            return;
        }

        console.log(chalk.blue('🚀 Iniciando procesamiento de imágenes...'));

        // Prepare watermark if enabled
        let watermarkBuffer;
        let watermarkMetadata;
        if (config.watermark.enabled) {
            const watermarkPath = path.resolve(__dirname, config.watermark.imagePath);
            watermarkBuffer = await sharp(watermarkPath)
                .resize(config.watermark.width)
                .ensureAlpha()
                .toBuffer();
            watermarkMetadata = await sharp(watermarkBuffer).metadata();
        }
        
        // Process each file
        for (const file of files) {
            const inputPath = path.join(config.inputFolder, file);
            const stats = await fs.stat(inputPath);
            
            // Skip if it's a directory
            if (stats.isDirectory()) continue;
            
            // Skip if it's not an image
            if (!/\.(jpg|jpeg|png|gif|webp|tiff)$/i.test(file)) {
                console.log(chalk.yellow(`⚠️  Saltando archivo no soportado: ${file}`));
                continue;
            }

            const outputFileName = `${path.parse(file).name}.${config.outputFormat}`;
            const outputPath = path.join(config.outputFolder, outputFileName);

            try {
                let imageProcess = sharp(inputPath);

                // If it's a PNG and removeWhiteBackground is enabled
                if (config.removeWhiteBackground && path.extname(file).toLowerCase() === '.png') {
                    imageProcess = imageProcess.removeAlpha().flatten({ background: { r: 0, g: 0, b: 0, alpha: 0 } });
                }

                // Resize the image
                imageProcess = imageProcess.resize(config.width, config.height, {
                    fit: 'cover',
                    position: 'center'
                });

                // Add watermark if enabled
                if (config.watermark.enabled && watermarkBuffer && watermarkMetadata) {
                    const { x, y } = await getWatermarkPosition(
                        config,
                        config.width,
                        config.height,
                        watermarkMetadata.width,
                        watermarkMetadata.height
                    );

                    imageProcess = imageProcess.composite([
                        {
                            input: watermarkBuffer,
                            top: Math.round(y),
                            left: Math.round(x),
                            blend: 'over',
                            opacity: config.watermark.opacity
                        }
                    ]);
                }

                // Set output format and quality
                await imageProcess
                    .toFormat(config.outputFormat, { quality: 90 })
                    .toFile(outputPath);

                console.log(chalk.green(`✅ Procesado: ${file} -> ${outputFileName}`));
            } catch (err) {
                console.log(chalk.red(`❌ Error procesando ${file}: ${err.message}`));
            }
        }

        console.log(chalk.green('\n✨ ¡Proceso completado!'));
        console.log(chalk.blue(`📁 Las imágenes procesadas están en: ${config.outputFolder}`));

    } catch (err) {
        if (err.code === 'ENOENT' && err.path.includes('config.json')) {
            console.log(chalk.red('❌ Error: No se encontró el archivo config.json'));
            console.log(chalk.blue('👉 Asegúrate de que el archivo config.json esté en el mismo directorio que el script'));
        } else {
            console.log(chalk.red(`❌ Error: ${err.message}`));
        }
        process.exit(1);
    }
}

// Run the script
processImages();
