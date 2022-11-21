const express = require('express');
const app = express()
const cors = require('cors')
// 解决跨域
app.use(cors())

const bigRouter = require('./routes/index')

app.use('/file', bigRouter)


app.listen(3001, ()=>{
    console.log('http://localhost:3001/')
})