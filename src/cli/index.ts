import fs from 'fs'
import path from 'path'

import sharp from 'sharp'

import type { GetOptimizeResult, Manifest } from './types'
import { cliProgressBarIncrement, cliProgressBarStart, cliProgressBarStop } from './utils/cliProgressBar'
import formatValidate from './utils/formatValidate'
import uniqueItems from './utils/uniqueItems'

const cwd = process.cwd()

type OptimizeImagesProps = {
  srcDir: string
  manifestJsonPath: string
  outputDir?: string
}

export const optimizeImages = async ({ srcDir, manifestJsonPath, outputDir }: OptimizeImagesProps) => {
  const destDir = outputDir ?? srcDir

  let manifest: Manifest
  try {
    manifest = uniqueItems(
      fs
        .readFileSync(manifestJsonPath, 'utf-8')
        .trim()
        .split(/\n/g)
        .map((line) => JSON.parse(line))
    )
  } catch (error) {
    throw Error(typeof error === 'string' ? error : 'Unexpected error.')
  }

  cliProgressBarStart(manifest.length)

  const promises: Promise<void>[] = []

  const getOptimizeResult: GetOptimizeResult = async ({ image, originalWidth, output, width, quality, extension }) => {
    if (formatValidate(extension)) {
      const filePath = path.join(destDir, output)

      const fileDir = filePath.split('/').slice(0, -1).join('/')
      if (!fs.existsSync(fileDir)) {
        fs.mkdirSync(fileDir, { recursive: true })
      }

      const resizeWidth = Math.min(originalWidth, width)

      switch (extension) {
        case 'jpeg':
          await image.resize({ width: resizeWidth }).jpeg({ quality }).toFile(filePath)
          break
        case 'jpg':
          await image.resize({ width: resizeWidth }).jpeg({ quality }).toFile(filePath)
          break
        case 'png':
          await image.resize({ width: resizeWidth }).png({ quality }).toFile(filePath)
          break
        case 'webp':
          await image.resize({ width: resizeWidth }).webp({ quality }).toFile(filePath)
          break
        case 'avif':
          await image.resize({ width: resizeWidth }).avif({ quality }).toFile(filePath)
          break
      }

      cliProgressBarIncrement()
    } else {
      throw Error(
        `Not an allowed format.\`${extension}\`\nGive \`unoptimize\`prop to /next/image to disable optimization.`
      )
    }
  }

  for (const item of manifest) {
    const originalFilePath = path.join(srcDir, item.src)
    const image = () => sharp(originalFilePath, { sequentialRead: true })

    const originalWidth = (await image().metadata()).width ?? 1280

    promises.push(
      getOptimizeResult({
        image: image(),
        originalWidth,
        ...item,
      })
    )
  }

  try {
    await Promise.all(promises)
    cliProgressBarStop()
  } catch (error) {
    console.error('Error processing files', error)
  }
}

export const run = () => {
  // eslint-disable-next-line no-console
  console.log('\x1b[35m', 'next-export-optimize-images: Optimize images.', '\x1b[39m')

  const srcDir = path.resolve(cwd, 'out')
  const manifestJsonPath = path.resolve(cwd, '.next/custom-optimized-images.nd.json')

  optimizeImages({ srcDir, manifestJsonPath })
  // eslint-disable-next-line no-console
  console.log('\x1b[35m', 'Optimization complete!', '\x1b[39m')
}