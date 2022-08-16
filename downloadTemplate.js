// @ts-check
import download from 'download-git-repo'
import { red } from 'kolorist'


export default function downloadTemplate(destination, template) {
  return new Promise((resolve, reject) => {
    if (!destination) throw new Error(red('✖') + 'root error')
    download('fazba/' + template, destination, function (err) {
      if (!err) {
        console.log('下载完成!');
        resolve()
      } else {
        console.log('下载失败!');
        reject(err)
      }
    })
  })
}