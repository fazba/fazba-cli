// @ts-check
import fs from 'node:fs'
import path from 'node:path'



/**
 * @param {string | undefined} targetDir
 * 替换反斜杠 / 为空字符串
 */
export function formatTargetDir(targetDir) {
  return targetDir?.trim().replace(/\/+$/g, '')
}
/**
 * @param {string} path
 */
export function isEmpty(path) {
  const files = fs.readdirSync(path)
  return files.length === 0 || (files.length === 1 && files[0] === '.git')
}
/**
 * @param {string} projectName
 */
export function isValidPackageName(projectName) {
  return /^(?:@[a-z0-9-*~][a-z0-9-*._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(
    projectName
  )
}
/**
 * @param {string} projectName
 */
export function toValidPackageName(projectName) {
  return projectName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/^[._]/, '')
    .replace(/[^a-z0-9-~]+/g, '-')
}
/**
 * @param {string} dir
 * 递归删除文件夹，相当于 rm -rf xxx
 */
export function emptyDir(dir) {
  if (!fs.existsSync(dir)) {
    return
  }
  for (const file of fs.readdirSync(dir)) {
    fs.rmSync(path.resolve(dir, file), { recursive: true, force: true })
  }
}
/**
 * @param {string} srcDir
 * @param {string} destDir
 * 如果是文件夹用 copyDir 拷贝
 */
function copyDir(srcDir, destDir) {
  /**同步地创建目录。 返回 undefined 或创建的第一个目录路径（如果 recursive 为 true） */
  fs.mkdirSync(destDir, { recursive: true })
  for (const file of fs.readdirSync(srcDir)) {  //fs.readdirSync返回一个包含“指定目录下所有文件名称”的数组对象
    const srcFile = path.resolve(srcDir, file)
    const destFile = path.resolve(destDir, file)
    copy(srcFile, destFile)
  }
}
export function copy(src, dest) {
  const stat = fs.statSync(src)
  if (stat.isDirectory()) {
    copyDir(src, dest)
  } else {
    fs.copyFileSync(src, dest)
  }
}
/**
 * @param {string | undefined} userAgent process.env.npm_config_user_agent
 * @returns object | undefined
 */
export function pkgFromUserAgent(userAgent) {
  if (!userAgent) return undefined
  const pkgSpec = userAgent.split(' ')[0]
  const pkgSpecArr = pkgSpec.split('/')
  return {
    name: pkgSpecArr[0],
    version: pkgSpecArr[1]
  }
}