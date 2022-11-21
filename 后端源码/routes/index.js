const bigFormController = require('../controller/index')

const express = require('express')
const router = express.Router()

router.post('/check', bigFormController.check)
router.post('/upload', bigFormController.upload)
router.post('/merge', bigFormController.merge)
module.exports = router