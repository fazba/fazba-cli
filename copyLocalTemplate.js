// @ts-check
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

import { copy } from './tools.js'



export default function (template, root) {
  /**兼容某些编辑器或者电脑上不支持.gitignore */
  const renameFiles = {
    _gitignore: '.gitignore'
  }
  const templateDir = path.resolve(
    fileURLToPath(import.meta.url),
    '..',
    `template-${template}`
  )
  /**写入文件 */
  const write = (file, content) => {
    const targetPath = renameFiles[file]
      ? path.join(root, renameFiles[file])
      : path.join(root, file)
    if (content) {
      fs.writeFileSync(targetPath, content)
    } else {
      copy(path.join(templateDir, file), targetPath)
    }
  }
  // 根据模板路径的文件写入目标路径
  const files = fs.readdirSync(templateDir) //返回一个包含“指定目录下所有文件名称”的数组
  for (const file of files.filter((f) => f !== 'package.json')) {
    write(file)
  }
}