// @ts-check
import download from 'download-git-repo'
import { red } from 'kolorist'


export default function downloadTemplate(destination, template, msg) {
  return new Promise((resolve, reject) => {
    if (!destination) throw new Error(red('✖') + 'root error')
    download('fazba/' + template, destination, function (err) {
      if (!err) {
        console.log(msg + '完成!');
        resolve()
      } else {
        console.log(msg + '失败!');
        reject(err)
      }
    })
  })
}