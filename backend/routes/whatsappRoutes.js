const express = require('express');
const whatsappController = require('../controllers/whatsappController');
const { requireAdminPanelAccess } = require('../middleware/adminPanelAccess');

const router = express.Router();

router.use(requireAdminPanelAccess);

router.get('/stats', whatsappController.getStats);
router.get('/conversations', whatsappController.listConversations);
router.get('/conversations/:id/messages', whatsappController.getMessages);
router.post('/conversations/:id/reply', whatsappController.sendReply);
router.patch('/conversations/:id/status', whatsappController.updateConversationStatus);
router.patch('/customers/:id', whatsappController.updateCustomerCardCode);
router.post('/send-document', whatsappController.sendDocumentPdf);

router.get('/document-types', whatsappController.listDocumentTypes);
router.get('/message-templates', whatsappController.listMessageTemplates);
router.put('/message-templates/:documentType', whatsappController.upsertMessageTemplate);
router.delete('/message-templates/:documentType', whatsappController.deleteMessageTemplate);

module.exports = router;
