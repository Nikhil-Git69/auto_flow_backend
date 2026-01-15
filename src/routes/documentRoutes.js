// backend/routes/documentRoutes.js
const express = require('express');
const multer = require('multer');
const mongoose = require('mongoose');
const Document = require('../models/Document');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Save corrected document to MongoDB
router.post('/save-corrected', upload.single('file'), async (req, res) => {
  try {
    const { userId, originalAnalysisId, fixesApplied, issuesFixed } = req.body;
    const file = req.file;

    if (!file || !userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields' 
      });
    }

    // Create new document record
    const correctedDocument = new Document({
      userId,
      originalAnalysisId,
      fileName: file.originalname,
      fileType: file.mimetype,
      fileSize: file.size,
      fileData: file.buffer, // Store file as Buffer
      fixesApplied: parseInt(fixesApplied) || 0,
      issuesFixed: JSON.parse(issuesFixed || '[]'),
      uploadedAt: new Date()
    });

    await correctedDocument.save();

    res.status(201).json({
      success: true,
      message: 'Document saved successfully',
      documentId: correctedDocument._id,
      downloadUrl: `/api/documents/download/${correctedDocument._id}`
    });

  } catch (error) {
    console.error('Error saving document:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to save document',
      error: error.message 
    });
  }
});

// Get user's corrected documents
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const documents = await Document.find({ userId })
      .sort({ uploadedAt: -1 })
      .select('fileName fileType fileSize fixesApplied uploadedAt');

    res.json({
      success: true,
      documents
    });

  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch documents' 
    });
  }
});

// Download document
router.get('/download/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;
    
    const document = await Document.findById(documentId);
    
    if (!document) {
      return res.status(404).json({ 
        success: false, 
        message: 'Document not found' 
      });
    }

    res.set({
      'Content-Type': document.fileType,
      'Content-Disposition': `attachment; filename="${document.fileName}"`,
      'Content-Length': document.fileSize
    });

    res.send(document.fileData);

  } catch (error) {
    console.error('Error downloading document:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to download document' 
    });
  }
});

module.exports = router;