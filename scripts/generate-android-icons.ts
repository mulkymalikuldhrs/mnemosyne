#!/usr/bin/env bun
/**
 * Script to generate Android adaptive icon assets from the source icon.
 * Uses sharp to resize the generated icon into all required mipmap densities.
 */
import sharp from 'sharp'
import path from 'path'
import fs from 'fs'

const PROJECT_ROOT = '/home/z/my-project'
const SOURCE_ICON = path.join(PROJECT_ROOT, 'android-icon-source.png')
const RES_DIR = path.join(PROJECT_ROOT, 'android/app/src/main/res')

// Android mipmap density sizes
// ic_launcher (full icon): 48, 72, 96, 144, 192
// ic_launcher_foreground (foreground layer): 108, 162, 216, 324, 432
const MIPMAP_DENSITIES: Record<string, { launcher: number; foreground: number }> = {
  'mipmap-mdpi': { launcher: 48, foreground: 108 },
  'mipmap-hdpi': { launcher: 72, foreground: 162 },
  'mipmap-xhdpi': { launcher: 96, foreground: 216 },
  'mipmap-xxhdpi': { launcher: 144, foreground: 324 },
  'mipmap-xxxhdpi': { launcher: 192, foreground: 432 },
}

// Splash screen drawable sizes for Capacitor
const DRAWABLE_DENSITIES: Record<string, { w: number; h: number }> = {
  'drawable-port-mdpi': { w: 480, h: 800 },
  'drawable-port-hdpi': { w: 720, h: 1280 },
  'drawable-port-xhdpi': { w: 960, h: 1704 },
  'drawable-port-xxhdpi': { w: 1440, h: 2560 },
  'drawable-port-xxxhdpi': { w: 1920, h: 3200 },
}

async function generateLauncherIcons() {
  console.log('📱 Generating Android launcher icons...')

  for (const [density, sizes] of Object.entries(MIPMAP_DENSITIES)) {
    const dir = path.join(RES_DIR, density)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    // Generate ic_launcher.png
    await sharp(SOURCE_ICON)
      .resize(sizes.launcher, sizes.launcher, { fit: 'cover' })
      .png()
      .toFile(path.join(dir, 'ic_launcher.png'))
    console.log(`  ✓ ${density}/ic_launcher.png (${sizes.launcher}x${sizes.launcher})`)

    // Generate ic_launcher_round.png
    await sharp(SOURCE_ICON)
      .resize(sizes.launcher, sizes.launcher, { fit: 'cover' })
      .png()
      .toFile(path.join(dir, 'ic_launcher_round.png'))
    console.log(`  ✓ ${density}/ic_launcher_round.png (${sizes.launcher}x${sizes.launcher})`)

    // Generate ic_launcher_foreground.png (larger, with padding for adaptive icon)
    await sharp(SOURCE_ICON)
      .resize(sizes.foreground, sizes.foreground, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toFile(path.join(dir, 'ic_launcher_foreground.png'))
    console.log(`  ✓ ${density}/ic_launcher_foreground.png (${sizes.foreground}x${sizes.foreground})`)
  }
}

async function generateSplashDrawables() {
  console.log('\n🎨 Generating splash screen drawables...')

  for (const [density, dims] of Object.entries(DRAWABLE_DENSITIES)) {
    const dir = path.join(RES_DIR, density)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    // Create a dark background with the icon centered
    const iconSize = Math.min(dims.w, dims.h) * 0.3

    // First, resize the icon
    const iconBuffer = await sharp(SOURCE_ICON)
      .resize(Math.round(iconSize), Math.round(iconSize), {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer()

    // Create splash background with icon overlay
    await sharp({
      create: {
        width: dims.w,
        height: dims.h,
        channels: 4,
        background: { r: 15, g: 23, b: 42, alpha: 1 }, // #0f172a
      },
    })
      .composite([
        {
          input: iconBuffer,
          gravity: 'center',
        },
      ])
      .png()
      .toFile(path.join(dir, 'splash.png'))
    console.log(`  ✓ ${density}/splash.png (${dims.w}x${dims.h})`)
  }
}

async function updateLauncherBackground() {
  console.log('\n🎨 Updating launcher background color...')
  const bgFile = path.join(RES_DIR, 'values/ic_launcher_background.xml')
  const content = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#0f172a</color>
</resources>`
  fs.writeFileSync(bgFile, content)
  console.log('  ✓ ic_launcher_background.xml updated to #0f172a')
}

async function main() {
  if (!fs.existsSync(SOURCE_ICON)) {
    console.error('❌ Source icon not found:', SOURCE_ICON)
    process.exit(1)
  }

  await generateLauncherIcons()
  await generateSplashDrawables()
  await updateLauncherBackground()

  console.log('\n✅ All Android icon and splash assets generated successfully!')
}

main().catch(console.error)
