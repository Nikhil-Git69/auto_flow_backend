import { Router, Request, Response } from "express";
import multer from "multer";
import Analysis from "../models/Analysis";
import {
  analyzeDocumentWithAI,
  generateCorrectedDocument,
  extractTextFromWordDocument,
  generateCorrectedPDF, // Added
  generateCorrectedText // Added
} from "../services/aiAnalysisService";
import { v4 as uuidv4 } from 'uuid';
import { notifyAnalysisCompleted } from '../services/webhookService';

const router = Router();

const storage = multer.memoryStorage();

// Configure multer to handle multiple files
const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024,
    fieldSize: 100 * 1024 * 1024,
    fields: 10,
    files: 2
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'image/png',
      'image/jpeg',
      'image/jpg'
    ];

    const fileExtension = file.originalname.split('.').pop()?.toLowerCase();
    const allowedExtensions = ['pdf', 'doc', 'docx', 'txt', 'png', 'jpg', 'jpeg'];

    const isMimeTypeValid = allowedTypes.includes(file.mimetype);
    const isExtensionValid = allowedExtensions.includes(fileExtension || '');

    if (isMimeTypeValid || isExtensionValid) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}`));
    }
  }
});

// =========== UPLOAD & ANALYZE ===========
router.post("/upload-file", (req: Request, res: Response) => {
  upload.fields([
    { name: 'document', maxCount: 1 },
    { name: 'templateFile', maxCount: 1 }
  ])(req, res, async (err: any) => {
    try {
      if (err) {
        console.error('Multer error:', err.message);
        return res.status(400).json({ success: false, error: err.message });
      }

      // 1. Correctly extract files from req.files
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const documentFile = files?.['document']?.[0];
      const templateFile = files?.['templateFile']?.[0];

      if (!documentFile) {
        return res.status(400).json({ success: false, error: "No document file uploaded" });
      }

      // 2. Extract Body Parameters
      const formatType = req.body.formatType || 'default';
      const formatRequirements = req.body.formatRequirements || '';
      const fileName = req.body.fileName || documentFile.originalname;
      const userId = req.body.userId; // Extract userId

      console.log(`🔧 [Route] Analyzing ${fileName} with format: ${formatType} for user: '${userId}'`);

      if (!userId) {
        console.warn("⚠️ [UPLOAD] WARNING: No userId provided in request body! Analysis will not be linked to a user.");
      } else {
        console.log(`✅ [UPLOAD] userId '${userId}' received successfully.`);
      }

      console.log("DEBUG: formatType received:", req.body.formatType);
      console.log("DEBUG: templateFile exists:", !!files?.templateFile?.[0]);
      // 3. Call AI Service (Passes all required arguments)
      const analysisId = `analysis-${uuidv4()}`;
      const analysisResult = await analyzeDocumentWithAI(
        documentFile.buffer,
        documentFile.originalname,
        documentFile.mimetype,
        formatType,
        formatRequirements,
        templateFile,
        analysisId
      );

      if (!analysisResult.success) {
        return res.status(500).json({ success: false, error: analysisResult.summary });
      }

      // 3.5 AUTO-CORRECTION LOGIC
      let correctedContent = '';
      let correctedPdfBase64 = '';

      // Auto-correct Text/Word documents
      if (analysisResult.processedContent && !documentFile.mimetype.includes('pdf')) {
        console.log("✨ Generating auto-corrected text...");
        // NEW: Call the text correction service
        // We need to import generateCorrectedText first! 
        // Assuming it's exported from aiAnalysisService (I will add the import in a separate step if needed, or I can use the replace block to add it)
        // CHECK: I need to make sure generateCorrectedText is imported.
        // I'll add the import in a separate tool call to be safe, or just assume I'll do it.
        // Let's use the function here assuming it will be imported.
        correctedContent = await generateCorrectedText(
          analysisResult.processedContent,
          analysisResult.issues
        );
      }

      // Auto-correct PDF (generate visual highlights immediately)
      if (documentFile.mimetype.includes('pdf')) {
        console.log("✨ Generating auto-corrected PDF (visual)...");
        const issuesWithIds = (analysisResult.issues || []).map((issue: any) => ({
          ...issue,
          id: issue.id || uuidv4(),
          pageNumber: issue.pageNumber || 1,
          position: issue.position || { top: 0, left: 0, width: 0, height: 0 }
        }));

        const fixedIssueIds = issuesWithIds.map((val: { id: any; }) => val.id); // Fix all
        const pdfBuffer = await generateCorrectedPDF(documentFile.buffer, issuesWithIds, fixedIssueIds);
        correctedPdfBase64 = pdfBuffer.toString('base64');
      }

      // 4. Create and Save Analysis Model
      const analysis = new Analysis({
        analysisId: analysisId,
        userId: userId, // Save userId
        fileName: fileName,
        fileSize: documentFile.size,
        fileType: documentFile.mimetype,
        fileData: documentFile.buffer,
        formatType: formatType,
        formatRequirements: formatRequirements,
        score: analysisResult.score,
        summary: analysisResult.summary,
        issues: (analysisResult.issues || []).map((issue: any) => ({
          id: issue.id || uuidv4(),
          type: issue.type || 'General',
          severity: issue.severity || 'Medium',
          description: issue.description || '',
          suggestion: issue.suggestion || '',
          originalText: issue.originalText || '',
          correctedText: issue.correctedText || '',
          pageNumber: issue.pageNumber || 1,
          position: issue.position || { top: 0, left: 0, width: 0, height: 0 },
          isFixed: false // Keep as false so user sees the issues, even if content is corrected
        })),
        status: "completed",
        analyzedAt: new Date(),
        uploadDate: new Date(),
        processedContent: analysisResult.processedContent,
        correctedContent: correctedContent, // Store corrected text
        metadata: analysisResult.metadata, // Store extracted metadata
        images: analysisResult.images || [] // Store extracted figures
      });

      await analysis.save();

      // Send webhook notification (non-blocking)
      // Try to get user details if available
      let userEmail = '';
      let userName = '';
      if (userId) {
        try {
          const User = require('../models/User').default;
          const user = await User.findById(userId);
          if (user) {
            userEmail = user.email;
            userName = user.name;
          }
        } catch (err) {
          console.warn('Could not fetch user details for webhook');
        }
      }

      notifyAnalysisCompleted({
        userId: userId || 'unknown',
        userName: userName,
        userEmail: userEmail,
        analysisId: analysis.analysisId,
        fileName: analysis.fileName,
        fileType: analysis.fileType,
        score: analysis.score,
        issues: (analysis.issues as any[]).length,
        summary: analysis.summary,
        analyzedAt: analysis.analyzedAt
      }).catch(err => console.error('Webhook error:', err));

      res.status(200).json({
        success: true,
        message: "Document analyzed and auto-corrected successfully",
        data: {
          analysisId: analysis.analysisId,
          totalScore: analysis.score, // Return ACTUAL score
          originalScore: analysis.score,
          issues: analysis.issues, // Issues are NOT fixed in the DB record, so they show up
          summary: analysis.summary,
          fileName: analysis.fileName,
          fileType: analysis.fileType,
          formatType: analysis.formatType,
          analyzedAt: analysis.analyzedAt,
          processedContent: analysisResult.processedContent,
          correctedContent: correctedContent, // Return for Word/Text
          correctedPdfBase64: correctedPdfBase64, // Return for PDF
          metadata: analysis.metadata // Return extracted metadata
        }
      });

    } catch (err: any) {
      console.error("Upload handler error:", err);
      res.status(500).json({ success: false, error: "Internal server error", details: err.message });
    }
  });
});

// =========== EXPORT CORRECTED DOCUMENT ===========
router.post("/export-corrected", async (req: Request, res: Response) => {
  try {
    const { analysisId, fixedIssueIds } = req.body;

    const analysis = await Analysis.findOne({ analysisId });
    if (!analysis || !(analysis as any).fileData) {
      return res.status(404).json({ success: false, error: "Analysis or original file not found" });
    }

    const correctedDoc = await generateCorrectedDocument(
      (analysis as any).fileData,
      analysis.fileName,
      analysis.issues as any,
      fixedIssueIds
    );

    res.setHeader('Content-Type', correctedDoc.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${correctedDoc.fileName}"`);
    res.send(correctedDoc.buffer);
  } catch (err: any) {
    res.status(500).json({ success: false, error: "Export failed", details: err.message });
  }
});

// =========== GET ALL ANALYSES FOR USER ===========
router.get("/", async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;
    console.log(`🔍 [GET /analysis] Fetching history for userId: '${userId}'`);

    if (!userId) {
      console.warn("⚠️ [GET /analysis] Missing userId query parameter");
      return res.status(400).json({ success: false, error: "Missing userId query parameter" });
    }

    const analyses = await Analysis.find({ userId })
      .sort({ analyzedAt: -1 }) // Newest first
      .select('-fileData'); // Exclude heavy file data if it exists

    console.log(`✅ [GET /analysis] Found ${analyses.length} records for user '${userId}'`);
    res.json({ success: true, data: analyses });
  } catch (err: any) {
    console.error("❌ [GET /analysis] Error:", err.message);
    res.status(500).json({ success: false, error: "Failed to fetch history", details: err.message });
  }
});

// =========== DOWNLOAD ORIGINAL DOCUMENT ===========
router.get("/:id/download", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Ensure id is a string, not an array
    const analysisId = Array.isArray(id) ? id[0] : id;

    if (!analysisId) {
      return res.status(400).json({
        success: false,
        error: 'Analysis ID is required'
      });
    }

    // Check if the ID is a valid MongoDB ObjectId
    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(analysisId);

    let query;
    if (isValidObjectId) {
      // If it's a valid ObjectId, search both _id and analysisId
      query = { $or: [{ _id: id }, { analysisId: id }] };
    } else {
      // If it's not a valid ObjectId (e.g., "analysis-xxx"), only search analysisId
      query = { analysisId: id };
    }

    // Find analysis and explicitly select the fileData field (which is select: false by default)
    const analysis = await Analysis.findOne(query).select('+fileData');

    if (!analysis || !(analysis as any).fileData) {
      return res.status(404).json({ success: false, error: "Original file not found" });
    }

    // Set headers to force download with the original filename
    res.setHeader('Content-Type', analysis.fileType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${analysis.fileName}"`);

    // Send the raw buffer
    res.send((analysis as any).fileData);
  } catch (err: any) {
    console.error("Error downloading file:", err);
    res.status(500).json({ success: false, error: "Failed to download file", details: err.message });
  }
});

// =========== REMAINING GETTERS ===========
router.get("/id/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const analysisId = Array.isArray(id) ? id[0] : id;
    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(analysisId);

    const query = isValidObjectId
      ? { $or: [{ _id: analysisId }, { analysisId: analysisId }] }
      : { analysisId: analysisId };

    const analysis = await Analysis.findOne(query);
    if (!analysis) return res.status(404).json({ success: false, error: "Not found" });
    res.json({ success: true, data: analysis });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE endpoint to remove an analysis by ID (URL parameter)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Ensure id is a string, not an array
    const analysisId = Array.isArray(id) ? id[0] : id;

    if (!analysisId) {
      return res.status(400).json({
        success: false,
        error: 'Analysis ID is required'
      });
    }

    console.log('🗑️ Deleting analysis by ID:', analysisId);

    // Check if the ID is a valid MongoDB ObjectId
    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(analysisId);

    let query;
    if (isValidObjectId) {
      // If it's a valid ObjectId, search both _id and analysisId
      query = { $or: [{ _id: analysisId }, { analysisId: analysisId }] };
    } else {
      // If it's not a valid ObjectId (e.g., "analysis-xxx"), only search analysisId
      query = { analysisId: analysisId };
    }

    // Find and delete the analysis
    const result = await Analysis.deleteOne(query);

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Analysis not found'
      });
    }

    console.log('✅ Analysis deleted successfully');

    res.json({
      success: true,
      message: 'Analysis deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting analysis:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// DELETE endpoint to remove an analysis (legacy - using query params)
router.delete('/', async (req: Request, res: Response) => {
  try {
    const { userId, fileName, uploadDate } = req.query;

    if (!userId || !fileName || !uploadDate) {
      return res.status(400).json({
        success: false,
        error: 'userId, fileName, and uploadDate are required'
      });
    }

    console.log('🗑️ Deleting analysis - userId:', userId, 'fileName:', fileName, 'uploadDate:', uploadDate);

    // Find and delete the analysis matching all criteria
    const result = await Analysis.deleteOne({
      userId,
      fileName,
      analyzedAt: uploadDate
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Analysis not found'
      });
    }

    console.log('✅ Analysis deleted successfully');

    res.json({
      success: true,
      message: 'Analysis deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting analysis:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ... (Other stats and list routes remain largely the same, just ensure they use .fileType from the model)

export default router;