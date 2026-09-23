const express = require('express');
const whatsappWebhookController = require('../controllers/whatsappWebhookController');

const router = express.Router();

router.get('/webhook', whatsappWebhookController.verifyWebhook);
router.post('/webhook', whatsappWebhookController.receiveWebhook);

module.exports = router;
