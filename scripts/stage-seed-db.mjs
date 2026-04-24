import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const sourcePath = join(process.env.APPDATA ?? '', 'life-plan-lite', 'life-plan-lite.sqlite')
const targetPath = resolve('resources', 'seed-data', 'life-plan-lite.sqlite')

if (!process.env.APPDATA) {
  console.error('APPDATA is not available, so the current local database cannot be staged.')
  process.exit(1)
}

if (!existsSync(sourcePath)) {
  console.error(`No local database was found at ${sourcePath}.`)
  process.exit(1)
}

mkdirSync(dirname(targetPath), { recursive: true })
copyFileSync(sourcePath, targetPath)
console.log(`Staged seed database from ${sourcePath} to ${targetPath}`)
