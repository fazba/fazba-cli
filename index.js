#!/usr/bin/env node

// 高版本的node支持，node 前缀
// @ts-check
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

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

// Avoids autoconversion to number of the project name by defining that the args
// non associated with an option ( _ ) needs to be parsed as a string. See #4606
const argv = minimist(process.argv.slice(2), { string: ['_'] })
/**当前 Nodejs 的执行目录 */
const cwd = process.cwd()

const FRAMEWORKS = [
  {
    name: 'echarts',
    color: green,
  },
  {
    name: 'typescript',
    color: green,
  },
  {
    name: 'vue3.2',
    color: green,
    variants: [
      {
        name: 'vue3.2',
        display: 'TypeScript',
        color: green
      },
      {
        name: 'vue3.2-ts',
        display: 'TypeScript',
        color: blue
      }
    ]
  },
]

const TEMPLATES = FRAMEWORKS.map(
  (f) => (f.variants && f.variants.map((v) => v.name)) || [f.name]
).reduce((a, b) => a.concat(b), [])
/**兼容某些编辑器或者电脑上不支持.gitignore */
const renameFiles = {
  _gitignore: '.gitignore'
}

async function init() {
  /**命令行第一个参数 */
  let targetDir = formatTargetDir(argv._[0])
  /**命令行参数 --template 或者 -t */
  let template = argv.template || argv.t

  const defaultTargetDir = 'vite-project'

  const getProjectName = () => targetDir === '.' ? path.basename(path.resolve()) : targetDir

  let result = {}
  /**询问项目名、选择框架，选择框架变体:比如 react => react-ts 等 */
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
  // 重写已有目录 / 或者创建不存在的目录
  /**目录 */
  const root = path.join(cwd, targetDir)

  if (overwrite) {
    emptyDir(root)  // 删除文件夹
  } else if (!fs.existsSync(root)) {  //fs.existsSync如果路径存在则返回 true，否则返回 false。
    fs.mkdirSync(root, { recursive: true }) // 新建文件夹
  }

  // determine template
  template = variant || framework?.name || template //issue：原先framework应该为framework.name
  console.log(`\nScaffolding project in ${root}...`)
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
  // package.json 文件单独处理
  const pkg = JSON.parse(
    fs.readFileSync(path.join(templateDir, `package.json`), 'utf-8')
  )
  pkg.name = packageName || getProjectName()
  write('package.json', JSON.stringify(pkg, null, 2))
  // 打印安装完成后的信息
  const pkgInfo = pkgFromUserAgent(process.env.npm_config_user_agent)
  const pkgManager = pkgInfo ? pkgInfo.name : 'npm'
  console.log(`\nDone. Now run:\n`)
  if (root !== cwd) {
    console.log(`  cd ${path.relative(cwd, root)}`)
  }
  /**使用了什么包管理器创建项目，那么就输出 npm/yarn/pnpm 相应的命令 */
  switch (pkgManager) {
    case 'yarn':
      console.log('  yarn')
      console.log('  yarn dev')
      break
    default:
      console.log(`  ${pkgManager} install`)
      console.log(`  ${pkgManager} run dev`)
      break
  }
}

/**
 * @param {string | undefined} targetDir
 * 替换反斜杠 / 为空字符串
 */
function formatTargetDir(targetDir) {
  return targetDir?.trim().replace(/\/+$/g, '')
}
/**
 * @param {string} path
 */
function isEmpty(path) {
  const files = fs.readdirSync(path)
  return files.length === 0 || (files.length === 1 && files[0] === '.git')
}
/**
 * @param {string} projectName
 */
function isValidPackageName(projectName) {
  return /^(?:@[a-z0-9-*~][a-z0-9-*._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(
    projectName
  )
}
/**
 * @param {string} projectName
 */
function toValidPackageName(projectName) {
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
function emptyDir(dir) {
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
function copy(src, dest) {
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
function pkgFromUserAgent(userAgent) {
  if (!userAgent) return undefined
  const pkgSpec = userAgent.split(' ')[0]
  const pkgSpecArr = pkgSpec.split('/')
  return {
    name: pkgSpecArr[0],
    version: pkgSpecArr[1]
  }
}


init().catch((e) => {
  console.error(e)
})