<template>
  <div class="upload">
    <h3>大文件上传、断点续传</h3>
    <form>
      <div class="upload-file">
        <label for="file">请选择文件</label>
        <input type="file" name="file" id="big-file" @change="uploadChange" />
      </div>
      <span>{{ file?.name }}</span>
      <div class="upload-progress">
        当前进度：
        <p>
          <span :style="`width: ${progress}%`" id="big-current"></span>
        </p>
      </div>
    </form>
    <div class="control">
      <button class="btn" @click="beginUpload">开始</button>
      <button class="btn" @click="cancelUpload">取消</button>
    </div>
  </div>
</template>

<script>
import { computed, defineComponent, ref } from 'vue'
import axios from 'axios'

export default defineComponent({
  setup() {
    //axios请求取消token
    const CancelToken = axios.CancelToken
    const cancel = ref(null)
    //请求路径
    const baseUrl = 'http://localhost:3001'
    //完整文件
    const file = ref(null)
    //上传的文件切片数组
    const fileArr = ref([])
    //文件MD5
    const md5Val = ref('')
    //文件后缀名
    const ext = ref('')
    //文件当前上传的切片的index
    const chunkIndex = ref(0)
    //控制文件是否允许上传（在获得MD5并且验证了文件切片index以后才为true）
    const controlUpload = ref(false)
    //上传进度
    const progress = computed({
      get: function () {
        return (chunkIndex.value / fileArr.value.length) * 100
      }
    })

    //监听上传事件
    const uploadChange = e => {
      //每次有文件上传时，先将controlUpload设为false
      controlUpload.value = false
      //拿到完整的文件
      file.value = e.target.files[0] == undefined ? null : e.target.files[0]
      if (!file.value) {
        //如果没拿到文件，就清除进度条
        document.querySelector('#big-current').style.width = 0 + '%'
      } else {
        let index = file.value.name.lastIndexOf('.')
        ext.value = file.value.name.substr(index + 1)

        let files = sliceFile(file.value)
        fileArr.value = files
        //获取文件的MD5
        getMd5(files).then(() => {
          //根据MD5校验文件
          uploadCheck()
        })
      }
    }
    //切割文件方法
    const sliceFile = file => {
      const files = []
      //定义每个chunk的大小
      const chunkSize = 128 * 1024
      //根据chunkSize进行切片
      for (let i = 0; i < file.size; i += chunkSize) {
        const end = i + chunkSize >= file.size ? file.size : i + chunkSize
        let currentFile = file.slice(i, end > file.size ? file.size : end)
        files.push(currentFile)
      }
      //返回切片后的文件数组
      return files
    }

    //利用spark-MD5获取文件的MD5值：使用webWorker开启子线程
    const getMd5 = async files => {
      return new Promise(resolve => {
        let worker = new Worker('../src/hooks/worker.js')
        worker.postMessage({ files })
        //监听MD5计算完成事件
        worker.onmessage = event => {
          md5Val.value = event.data.hash
          resolve()
        }
      })
    }

    //上传文件前检查
    const uploadCheck = async () => {
      let res = await axios({
        url: `${baseUrl}/file/check?md5Val=${md5Val.value}&total=${fileArr.value.length}`,
        method: 'post'
      })

      if (res.data.code == 200) {
        //获得文件上传进度
        chunkIndex.value = res.data.data.data.chunk.length
          ? res.data.data.data.chunk.length
          : 0
      }
      //文件切片顺序已检查完毕，此时可以上传
      controlUpload.value = true
    }

    //分块上传请求
    const uploadSlice = async () => {
      //判断此时是否已经上传完毕
      if (chunkIndex.value == fileArr.value.length) {
        mergeFile()
      } else {
        let formData = new FormData()
        formData.append('file', fileArr.value[chunkIndex.value])

        axios({
          url: `${baseUrl}/file/upload?current=${chunkIndex.value}&md5Val=${md5Val.value}&total=${fileArr.value.length}`,
          method: 'post',
          data: formData,
          cancelToken: new CancelToken(function executor(c) {
            cancel.value = c
          })
        })
          .then(res => {
            if (res.data.code == 200) {
              ++chunkIndex.value
              uploadSlice()
            }
          })
          .catch(err => {
            console.log(err)
          })
      }
    }

    //合并文件请求
    const mergeFile = async () => {
      let res = await axios({
        url: `${baseUrl}/file/merge?md5Val=${md5Val.value}&total=${fileArr.value.length}&ext=${ext.value}`,
        method: 'post'
      })
      if (res.data.code == 200) {
        alert('上传成功！')
      } else {
        alert(res.data.data.info)
      }
    }

    //开始上传文件事件
    const beginUpload = () => {
      if (controlUpload.value) {
        uploadSlice()
      } else if (file.value == null) {
        alert('请上传文件')
      } else {
        alert('正在检查文件')
      }
    }
    const cancelUpload = () => {
      if (cancel.value) {
        cancel.value('取消请求')
      }
    }

    return {
      file,
      uploadChange,
      progress,
      beginUpload,
      cancelUpload,
      controlUpload
    }
  }
})
</script>

<style lang="scss" scoped>
body {
  margin: 0;
  font-size: 16px;
  background: #f8f8f8;
}
h1,
h2,
h3,
h4,
h5,
h6,
p {
  margin: 0;
}

.upload {
  box-sizing: border-box;
  margin: 30px auto;
  padding: 15px 20px;
  width: 500px;
  height: auto;
  border-radius: 15px;
  background: #fff;
}

.upload h3 {
  font-size: 20px;
  line-height: 2;
  text-align: center;
}

.upload .upload-file {
  position: relative;
  margin: 30px auto;
}

.upload .upload-file label {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 150px;
  border: 1px dashed #ccc;
}

.upload .upload-file input {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
}

.upload-progress {
  margin-top: 20px;
  display: flex;
  align-items: center;
}

.upload-progress p {
  position: relative;
  display: inline-block;
  flex: 1;
  height: 15px;
  border-radius: 10px;
  background: #ccc;
  overflow: hidden;
}

.upload-progress p span {
  position: absolute;
  left: 0;
  top: 0;
  width: 0;
  height: 100%;
  background: linear-gradient(
    to right bottom,
    rgb(163, 76, 76),
    rgb(231, 73, 52)
  );
  transition: all 0.4s;
}

.upload-link {
  margin: 30px auto;
}

.upload-link a {
  text-decoration: none;
  color: rgb(6, 102, 192);
}
.control {
  margin-top: 30px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.btn {
  width: 88px;
  background-color: #fff;
  border: 1px solid black;
  border-radius: 6px;
}
.btn:hover {
  background-color: #4d88ff;
}

@media all and (max-width: 768px) {
  .upload {
    width: 300px;
  }
}
</style>
