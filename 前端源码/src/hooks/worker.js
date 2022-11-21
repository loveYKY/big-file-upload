//  三个线程都一样的代码就拿出一个了
self.importScripts('../../node_modules/spark-md5')

self.addEventListener(
  'message',
  function (e) {
    const { files } = e.data
    const spark = new self.SparkMD5.ArrayBuffer()
    let fileReader
    for (var i = 0; i < files.length; i++) {
      fileReader = new FileReader()
      fileReader.readAsArrayBuffer(files[i])
    }
    fileReader.onload = function (e) {
      spark.append(e.target.result)
      if (i == files.length) {
        self.postMessage({
          progress: 100,
          hash: spark.end()
        })
      }
    }
  },
  false
)
