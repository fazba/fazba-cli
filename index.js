#!/usr/bin/env node
//解决不同的用户node路径不同的问题，可以让系统动态的去查找node来执行你的脚本文件。

// @ts-check
// 高版本的node支持，node 前缀
import fs from 'node:fs'
import path from 'node:path'

/**解析命令行的参数 链接：https://npm.im/minimist */
import minimist from 'minimist'
/**询问选择之类的  链接：https://npm.im/prompts */
import prompts from 'prompts'
/**终端颜色输出的库 链接：https://npm.im/kolorist */
import {
  blue,
  cyan,
  green,
  lightRed,
  magenta,
  red,
  reset,
  yellow
} from 'kolorist'

import { formatTargetDir, isEmpty, isValidPackageName, toValidPackageName, emptyDir } from './tools.js'
import afterDone from './afterDone.js'
import copyLocalTemplate from './copyLocalTemplate.js'
import downloadTemplate from './downloadTemplate.js'
// Avoids autoconversion to number of the project name by defining that the args
// non associated with an option ( _ ) needs to be parsed as a string. See #4606
const argv = minimist(process.argv.slice(2), { string: ['_'] })
/**当前 Nodejs 的执行目录 */
const cwd = process.cwd()

/**
 * 获取模板列表
 */
const tempDir = path.join(cwd, 'fazba-cli-directory')
await downloadTemplate(tempDir, 'fazba-cli-directory')
const listDir = path.join(tempDir, 'list.json')
const FRAMEWORKS = JSON.parse(fs.readFileSync(listDir), 'utf-8')
fs.rmSync(tempDir, { recursive: true, force: true })
//添加颜色
FRAMEWORKS.map(v => {
  v.color = green
  v?.variants?.map(val => {
    val.color = blue
  })
})

const TEMPLATES = FRAMEWORKS.map(
  (f) => (f.variants && f.variants.map((v) => v.name)) || [f.name]
).reduce((a, b) => a.concat(b), [])

//
init().catch((e) => {
  console.error(e)
})

async function init() {
  /**命令行第一个参数 */
  let targetDir = formatTargetDir(argv._[0])
  /**命令行参数 --template 或者 -t */
  let template = argv.template || argv.t

  const defaultTargetDir = 'vite-project'

  const getProjectName = () => targetDir === '.' ? path.basename(path.resolve()) : targetDir

  let result = {}
  try {
    result = await prompts(
      [
        {
          type: targetDir ? null : 'text',
          name: 'projectName',
          message: reset('Project name:'),
          initial: defaultTargetDir,
          onState: (state) => {
            targetDir = formatTargetDir(state.value) || defaultTargetDir
          }
        },
        {
          type: () =>
            !fs.existsSync(targetDir) || isEmpty(targetDir) ? null : 'confirm', //Prompt属性可以是函数。type字段的计算结果为虚值(falsy)的 Prompt 配置对象将被跳过。
          name: 'overwrite',
          message: () =>
            (targetDir === '.'
              ? 'Current directory'
              : `Target directory "${targetDir}"`) +
            ` is not empty. Remove existing files and continue?`
        },
        {
          type: (_, { overwrite } = {}) => {
            if (overwrite === false) {
              throw new Error(red('✖') + ' Operation cancelled')
            }
            return null
          },
          name: 'overwriteChecker'
        },
        {
          type: () => (isValidPackageName(getProjectName()) ? null : 'text'),
          name: 'packageName',
          message: reset('Package name:'),
          initial: () => toValidPackageName(getProjectName()),
          validate: (dir) =>
            isValidPackageName(dir) || 'Invalid package.json name'
        },
        {
          type: template && TEMPLATES.includes(template) ? null : 'select',
          name: 'framework',
          message:
            typeof template === 'string' && !TEMPLATES.includes(template)
              ? reset(
                `"${template}" isn't a valid template. Please choose from below: `
              )
              : reset('Select a framework:'),
          initial: 0,
          choices: FRAMEWORKS.map((framework) => {
            const frameworkColor = framework.color
            return {
              title: frameworkColor(framework.name),
              value: framework
            }
          })
        },
        {
          type: (framework) =>
            framework && framework.variants ? 'select' : null,
          name: 'variant',
          message: reset('Select a variant:'),
          // @ts-ignore
          choices: (framework) =>
            framework.variants.map((variant) => {
              const variantColor = variant.color
              return {
                title: variantColor(variant.name),
                value: variant.name
              }
            })
        }
      ],
      {
        onCancel: () => {
          throw new Error(red('✖') + ' Operation cancelled')
        }
      }
    )
  } catch (cancelled) {
    console.log(cancelled.message)
    return
  }

  // user choice associated with prompts
  const { framework, overwrite, packageName, variant } = result
  /**目标地址 */
  const root = path.join(cwd, targetDir)
  // 重emptyDir写已有目录 / 或者创建不存在的目录
  if (overwrite) {
    emptyDir(root)  // 删除文件夹
  } else if (!fs.existsSync(root)) {  //fs.existsSync如果路径存在则返回 true，否则返回 false。
    fs.mkdirSync(root, { recursive: true }) // 新建文件夹
  }
  // determine template
  template = variant || framework?.name || template //issue：原先framework应该为framework.name
  console.log(`\nScaffolding project in ${root}...`)
  /**
   * 写入文件
   */
  await downloadTemplate(root, `template-${template}`)
  // copyLocalTemplate(template, root, overwrite)

  // package.json 文件单独处理
  const targetPath = path.join(root, `package.json`)
  const pkg = JSON.parse(fs.readFileSync(targetPath, 'utf-8'))
  pkg.name = packageName || getProjectName()
  fs.writeFileSync(targetPath, JSON.stringify(pkg, null, 2))
  /**
   * 打印安装完成后的信息
   */
  afterDone(root, cwd)

}