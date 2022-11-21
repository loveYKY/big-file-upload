### 大文件上传和断点续传

- 实现大文件上传的重点在于对大文件进行切片，即将大文件切割成多个小文件进行上传，最后再进行合并
- 实现断点续传的重点在于后端对已上传文件内容和数量的确认，这依托于文件独有的MD5，同个文件的切片的MD5值是相同的，而一旦文件内容发生了改变，MD5也会与之发生改变

1. 定义页面和样式

   ```html
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
             <span :style="`width: ${progress}px`" id="big-current"></span>
           </p>
         </div>
       </form>
       <div class="control">
         <button class="btn" @click="beginUpload">开始</button>
         <button class="btn" @click="cancelUpload">取消</button>
       </div>
     </div>
   </template>
   
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
     height: 32px;
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
   
   ```

   <img src="C:\Users\AERO\AppData\Roaming\Typora\typora-user-images\image-20221122010210815.png" alt="image-20221122010210815" style="zoom:80%;" />



2. 定义变量

   ```JS
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
   ```

3. 实现文件切割和MD5计算

   通过input标签获得上传的文件后，对文件进行切割+计算MD5值

   ```JS
   //index.vue
   
   //...
   <input type="file" name="file" id="big-file" @change="uploadChange" />
   //...    
   
   //监听上传事件
   const uploadChange = e => {
     //每次有文件上传时，先将controlUpload设为false,此时点击开始按钮不允许上传，会提示正在检验文件
     controlUpload.value = false
     //拿到完整的文件，赋值给file变量
     file.value = e.target.files[0] == undefined ? null : e.target.files[0]
     if (!file.value) {
       //如果没拿到文件，就清除进度条
       document.querySelector('#big-current').style.width = 0 + '%'
     } else {
       let index = file.value.name.lastIndexOf('.')
       //获取文件的后缀，赋值给ext变量
       ext.value = file.value.name.substr(index + 1)
   
       //调用文件切割方法
       let files = sliceFile(file.value)
       fileArr.value = files
       //获取文件的MD5,由于计算MD5所耗费的时间很大，这里利用了异步任务+webWorker子线程来优化
       getMd5(files).then(() => {
         //完成文件切割和MD5计算以后，进行文件上传
         upload()
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
       //向webWorker发送数据
       worker.postMessage({ files })
       //监听MD5计算完成事件
       worker.onmessage = event => {
         //将计算得到的MD5赋值给md5Val变量  
         md5Val.value = event.data.hash
         resolve()
       }
     })
   }
   
   //../src/hooks/worker.js
   self.importScripts('../../node_modules/spark-md5')
   
   self.addEventListener(
     'message',
     function (e) {
       const { files } = e.data
       const spark = new self.SparkMD5.ArrayBuffer()
       let fileReader
       //利用sparkMD5计算webWorker接收到的数据
       for (var i = 0; i < files.length; i++) {
         fileReader = new FileReader()
         fileReader.readAsArrayBuffer(files[i])
       }
       fileReader.onload = function (e) {
         spark.append(e.target.result)
         if (i == files.length) {
           //计算完毕所有文件切片的MD5值时，发送完毕事件
           self.postMessage({
             progress: 100,
             hash: spark.end()
           })
         }
       }
     },
     false
   )
   ```

4. 文件上传前检查(实现断点续传)

   ```JS
   //上传文件前检查
   const uploadCheck = async () => {
      //文件上传要带上文件的MD5参数以及文件切片数量 
     let res = await axios({
       url: `${baseUrl}/file/check?md5Val=${md5Val.value}&total=${fileArr.value.length}`,
       method: 'post'
     })
   
     //后端会根据MD5进行检查文件是否上传过，如果上传过，会返回一个包含文件切片序号的数组，如果没有上传过就返回空数组
     if (res.data.code == 200) {
       //根据后端返回的chunk数组长度得到此时上传的进度
       chunkIndex.value = res.data.data.data.chunk.length
         ? res.data.data.data.chunk.length
         : 0
     }
     //文件切片顺序已检查完毕，此时可以上传
     controlUpload.value = true
   }
   ```

5. 串行上传切片文件,上传完成后调用合并文件接口

   ```js
     <button class="btn" @click="beginUpload">开始</button>
     <button class="btn" @click="cancelUpload">取消</button>
   
   
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
   
   
   //分块上传请求
   const uploadSlice = async () => {
     //判断此时是否已经上传完毕
     if (chunkIndex.value == fileArr.value.length) {
       //如果上传全部完毕则调用合并文件方法
       mergeFile()
     } else {
       //否则利用formData进行文件上传  
       let formData = new FormData()
       formData.append('file', fileArr.value[chunkIndex.value])
   
       //串行上传切片文件
       axios({
         url: `${baseUrl}/file/upload?current=${chunkIndex.value}&md5Val=${md5Val.value}&total=${fileArr.value.length}`,
         method: 'post',
         data: formData,
         //利用axios的cancelToken实现停止文件上传  
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
   ```

   