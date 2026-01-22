// import { Router, Request, Response } from "express";
// import multer from "multer";
// import Analysis from "../models/Analysis";
// import { analyzeDocumentWithAI, generateCorrectedPDF } from "../services/aiAnalysisService";
// import { v4 as uuidv4 } from 'uuid';

// const router = Router();

// const storage = multer.memoryStorage();
// const upload = multer({
//   storage,
//   limits: { fileSize: 50 * 1024 * 1024 },
//   fileFilter: (req, file, cb) => {
//     const allowedTypes = [
//       'application/pdf', 'application/msword',
//       'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
//       'text/plain', 'image/png', 'image/jpeg', 'image/jpg'
//     ];
//     if (allowedTypes.includes(file.mimetype)) {
//       cb(null, true);
//     } else {
//       cb(new Error('Invalid file type. Only PDF, DOC, DOCX, TXT, PNG, JPG, JPEG are allowed.'));
//     }
//   }
// });

// // =========== UPLOAD & ANALYZE ===========
// router.post("/upload-file", upload.single("document"), async (req: Request, res: Response) => {
//   try {
//     if (!req.file) {
//       return res.status(400).json({ success: false, error: "No file uploaded" });
//     }

//     const userId = req.body.userId || "anonymous";
//     const fileName = req.body.fileName || req.file.originalname;
    
//     // Calls the service that uses Gemini 1.5 Flash
//     const analysisResult = await analyzeDocumentWithAI(req.file.buffer, req.file.originalname);

//     if (!analysisResult.success) {
//       return res.status(500).json({ success: false, error: analysisResult.summary });
//     }

//     const analysis = new Analysis({
//       analysisId: `analysis-${uuidv4()}`,
//       userId,
//       fileName,
//       fileSize: req.file.size,
//       fileType: req.file.mimetype,
//       score: analysisResult.score,
//       summary: analysisResult.summary,
//       // Mapping detailed issues including coordinates for specific highlighting
//       issues: (analysisResult.issues || []).map((issue: any) => ({
//         id: issue.id || uuidv4(),
//         type: issue.type || 'General',
//         severity: issue.severity || 'Medium',
//         description: issue.description || '',
//         suggestion: issue.suggestion || '',
//         context: issue.context || '', // Added for word-specific clarity
//         pageNumber: issue.pageNumber || 1,
//         position: issue.position || { top: 0, left: 0, width: 0, height: 0 },
//         isFixed: false
//       })),
//       status: "completed",
//       analyzedAt: new Date(),
//       uploadDate: new Date()
//     });

//     await analysis.save();
//     const savedDoc = analysis as any;

//     res.status(200).json({
//       success: true,
//       data: {
//         analysisId: savedDoc.analysisId,
//         totalScore: savedDoc.score,
//         issues: savedDoc.issues,
//         summary: savedDoc.summary,
//         fileName: savedDoc.fileName,
//         analyzedAt: savedDoc.analyzedAt
//       }
//     });

//   } catch (err: any) {
//     console.error("Upload error:", err);
//     res.status(500).json({ success: false, error: "Failed to analyze document" });
//   }
// });

// // =========== EXPORT CORRECTED PDF ===========
// // This fixes the DOCTYPE error by ensuring a proper PDF stream response
// router.post("/export-corrected", async (req: Request, res: Response) => {
//   try {
//     const { analysisId, fixedIssueIds } = req.body;

//     const analysis = await Analysis.findOne({ analysisId });
//     if (!analysis) return res.status(404).json({ error: "Analysis not found" });

//     // IMPORTANT: You need the ORIGINAL file buffer. 
//     // If you stored it in the DB as a 'Buffer' type:
//     const originalFileBuffer = (analysis as any).fileData; 

//     // If you don't have the buffer saved, you might need to use a placeholder 
//     // or fetch it from your upload directory:
//     // const originalFileBuffer = fs.readFileSync(path.join(__dirname, '../../uploads', analysis.fileName));

//     if (!originalFileBuffer || !Buffer.isBuffer(originalFileBuffer)) {
//         return res.status(400).json({ error: "Original file content missing" });
//     }

//     const correctedPdfBuffer = await generateCorrectedPDF(
//       originalFileBuffer, // This MUST be a Buffer
//       fixedIssueIds,
//       (analysis.issues as any) // Pass the issues here if needed
//     );

//     res.setHeader('Content-Type', 'application/pdf');
//     res.send(correctedPdfBuffer);
//   } catch (err) {
//     res.status(500).send("Export failed");
//   }
// });

// // =========== GET ISSUE FIXES ===========
// router.get("/:id/fixes", async (req: Request, res: Response) => {
//   try {
//     const analysis = await Analysis.findOne({ 
//       $or: [{ _id: req.params.id }, { analysisId: req.params.id }]
//     });
    
//     if (!analysis) return res.status(404).json({ success: false, error: "Not found" });
    
//     const issuesList = (analysis.issues as any[]) || [];
//     const fixedIssues = issuesList.filter((issue: any) => issue.isFixed === true);
    
//     res.json({
//       success: true,
//       data: { totalFixes: fixedIssues.length, fixes: fixedIssues }
//     });
//   } catch (err: any) {
//     res.status(500).json({ success: false, error: "Failed to get fixes" });
//   }
// });

// // =========== READ SINGLE ===========
// router.get("/:id", async (req: Request, res: Response) => {
//   try {
//     const analysis = await Analysis.findOne({ 
//       $or: [{ _id: req.params.id }, { analysisId: req.params.id }]
//     });
    
//     if (!analysis) return res.status(404).json({ success: false, error: "Not found" });
//     res.json({ success: true, data: analysis });
//   } catch (err: any) {
//     res.status(500).json({ success: false, error: "Server error" });
//   }
// });

// export default router;
// import { Router, Request, Response } from "express";
// import multer from "multer";
// import Analysis from "../models/Analysis";
// import { 
//   analyzeDocumentWithAI, 
//   generateCorrectedPDF,
//   generateCorrectedDocument, // NEW: Added
//   extractTextFromWordDocument // NEW: Added
// } from "../services/aiAnalysisService";
// import { v4 as uuidv4 } from 'uuid';

// const router = Router();

// const storage = multer.memoryStorage();
// const upload = multer({
//   storage,
//   limits: { fileSize: 50 * 1024 * 1024 },
//   fileFilter: (req, file, cb) => {
//     const allowedTypes = [
//       'application/pdf', 'application/msword',
//       'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
//       'text/plain', 'image/png', 'image/jpeg', 'image/jpg'
//     ];
//     if (allowedTypes.includes(file.mimetype)) {
//       cb(null, true);
//     } else {
//       cb(new Error('Invalid file type. Only PDF, DOC, DOCX, TXT, PNG, JPG, JPEG are allowed.'));
//     }
//   }
// });

// // =========== UPLOAD & ANALYZE ===========
// router.post("/upload-file", upload.single("document"), async (req: Request, res: Response) => {
//   try {
//     if (!req.file) {
//       return res.status(400).json({ success: false, error: "No file uploaded" });
//     }

//     const userId = req.body.userId || "anonymous";
//     const fileName = req.body.fileName || req.file.originalname;
    
//     // UPDATED: Now passes file mimetype for proper processing
//     const analysisResult = await analyzeDocumentWithAI(
//       req.file.buffer, 
//       req.file.originalname,
//       req.file.mimetype
//     );

//     if (!analysisResult.success) {
//       return res.status(500).json({ success: false, error: analysisResult.summary });
//     }

//     // Store original file buffer for later export
//     const fileData = req.file.buffer;

//     const analysis = new Analysis({
//       analysisId: `analysis-${uuidv4()}`,
//       userId,
//       fileName,
//       fileSize: req.file.size,
//       fileType: req.file.mimetype,
//       fileData: fileData, // Store file data for export
//       score: analysisResult.score,
//       summary: analysisResult.summary,
//       // UPDATED: Include originalText and correctedText for Word documents
//       issues: (analysisResult.issues || []).map((issue: any) => ({
//         id: issue.id || uuidv4(),
//         type: issue.type || 'General',
//         severity: issue.severity || 'Medium',
//         description: issue.description || '',
//         suggestion: issue.suggestion || '',
//         context: issue.context || '',
//         originalText: issue.originalText || '', // NEW
//         correctedText: issue.correctedText || '', // NEW
//         pageNumber: issue.pageNumber || 1,
//         position: issue.position || { top: 0, left: 0, width: 0, height: 0 },
//         isFixed: false
//       })),
//       status: "completed",
//       analyzedAt: new Date(),
//       uploadDate: new Date()
//     });

//     await analysis.save();
//     const savedDoc = analysis as any;

//     res.status(200).json({
//       success: true,
//       data: {
//         analysisId: savedDoc.analysisId,
//         totalScore: savedDoc.score,
//         issues: savedDoc.issues,
//         summary: savedDoc.summary,
//         fileName: savedDoc.fileName,
//         fileType: savedDoc.fileType,
//         analyzedAt: savedDoc.analyzedAt,
//         // NEW: Return processed content for Word files
//         processedContent: analysisResult.processedContent
//       }
//     });

//   } catch (err: any) {
//     console.error("Upload error:", err);
//     res.status(500).json({ success: false, error: "Failed to analyze document" });
//   }
// });

// // =========== EXPORT CORRECTED DOCUMENT ===========
// // UPDATED: Now handles both PDF and Word documents
// router.post("/export-corrected", async (req: Request, res: Response) => {
//   try {
//     const { analysisId, fixedIssueIds } = req.body;

//     if (!analysisId || !fixedIssueIds) {
//       return res.status(400).json({ error: "Missing analysisId or fixedIssueIds" });
//     }

//     const analysis = await Analysis.findOne({ analysisId });
//     if (!analysis) return res.status(404).json({ error: "Analysis not found" });

//     // Get the original file buffer
//     const originalFileBuffer = (analysis as any).fileData;
//     if (!originalFileBuffer || !Buffer.isBuffer(originalFileBuffer)) {
//       return res.status(400).json({ error: "Original file content missing" });
//     }

//     // UPDATED: Use new function that handles both PDF and Word
//     const correctedDoc = await generateCorrectedDocument(
//       originalFileBuffer,
//       analysis.fileName,
//       analysis.issues as any,
//       fixedIssueIds,
//       analysis.fileType
//     );

//     // Set appropriate headers
//     res.setHeader('Content-Type', correctedDoc.mimeType);
//     res.setHeader('Content-Disposition', `attachment; filename="${correctedDoc.fileName}"`);
    
//     res.send(correctedDoc.buffer);
//   } catch (err: any) {
//     console.error("Export error:", err);
//     res.status(500).send("Export failed");
//   }
// });

// // =========== NEW: EXTRACT TEXT FROM WORD DOCUMENT ===========
// router.post("/extract-text", upload.single("document"), async (req: Request, res: Response) => {
//   try {
//     if (!req.file) {
//       return res.status(400).json({ success: false, error: "No file uploaded" });
//     }

//     // Check if it's a Word document
//     const fileExtension = req.file.originalname.split('.').pop()?.toLowerCase();
//     if (!['docx', 'doc', 'txt'].includes(fileExtension || '')) {
//       return res.status(400).json({ success: false, error: "Only Word documents (.docx, .doc, .txt) are supported" });
//     }

//     const extractedDoc = await extractTextFromWordDocument(req.file.buffer, req.file.originalname);
    
//     res.status(200).json({
//       success: true,
//       data: {
//         fileName: req.file.originalname,
//         fileType: extractedDoc.fileType,
//         textContent: extractedDoc.textContent,
//         wordCount: extractedDoc.wordCount,
//         metadata: extractedDoc.metadata
//       }
//     });

//   } catch (err: any) {
//     console.error("Text extraction error:", err);
//     res.status(500).json({ success: false, error: "Failed to extract text from document" });
//   }
// });

// // =========== GET ISSUE FIXES ===========
// router.get("/:id/fixes", async (req: Request, res: Response) => {
//   try {
//     const analysis = await Analysis.findOne({ 
//       $or: [{ _id: req.params.id }, { analysisId: req.params.id }]
//     });
    
//     if (!analysis) return res.status(404).json({ success: false, error: "Not found" });
    
//     const issuesList = (analysis.issues as any[]) || [];
//     const fixedIssues = issuesList.filter((issue: any) => issue.isFixed === true);
    
//     res.json({
//       success: true,
//       data: { totalFixes: fixedIssues.length, fixes: fixedIssues }
//     });
//   } catch (err: any) {
//     res.status(500).json({ success: false, error: "Failed to get fixes" });
//   }
// });

// // =========== READ SINGLE ===========
// router.get("/:id", async (req: Request, res: Response) => {
//   try {
//     const analysis = await Analysis.findOne({ 
//       $or: [{ _id: req.params.id }, { analysisId: req.params.id }]
//     });
    
//     if (!analysis) return res.status(404).json({ success: false, error: "Not found" });
//     res.json({ success: true, data: analysis });
//   } catch (err: any) {
//     res.status(500).json({ success: false, error: "Server error" });
//   }
// });

// export default router;
import { Router, Request, Response } from "express";
import multer from "multer";
import Analysis from "../models/Analysis";
import { 
  analyzeDocumentWithAI, 
  generateCorrectedDocument,
  extractTextFromWordDocument
} from "../services/aiAnalysisService";
import { v4 as uuidv4 } from 'uuid';

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

      console.log(`🔧 [Route] Analyzing ${fileName} with format: ${formatType}`);
      console.log("DEBUG: formatType received:", req.body.formatType);
      console.log("DEBUG: templateFile exists:", !!files?.templateFile?.[0]);
      // 3. Call AI Service (Passes all 6 required arguments)
      const analysisResult = await analyzeDocumentWithAI(
        documentFile.buffer, 
        documentFile.originalname,
        documentFile.mimetype, // FIX: Use mimetype, not filetype
        formatType,
        formatRequirements,
        templateFile
      );

      if (!analysisResult.success) {
        return res.status(500).json({ success: false, error: analysisResult.summary });
      }

      // 4. Create and Save Analysis Model
      const analysis = new Analysis({
        analysisId: `analysis-${uuidv4()}`,
        fileName: fileName,
        fileSize: documentFile.size,
        fileType: documentFile.mimetype, // FIX: This resolves the analysis.filetype error
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
          isFixed: false
        })),
        status: "completed",
        analyzedAt: new Date(),
        uploadDate: new Date(),
        processedContent: analysisResult.processedContent
      });

      await analysis.save();

      res.status(200).json({
        success: true,
        message: "Document analyzed successfully",
        data: {
          analysisId: analysis.analysisId,
          totalScore: analysis.score,
          issues: analysis.issues,
          summary: analysis.summary,
          fileName: analysis.fileName,
          fileType: analysis.fileType,
          formatType: analysis.formatType,
          analyzedAt: analysis.analyzedAt
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

// =========== REMAINING GETTERS ===========
router.get("/id/:id", async (req: Request, res: Response) => {
  try {
    const analysis = await Analysis.findOne({ 
      $or: [{ _id: req.params.id }, { analysisId: req.params.id }]
    });
    if (!analysis) return res.status(404).json({ success: false, error: "Not found" });
    res.json({ success: true, data: analysis });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ... (Other stats and list routes remain largely the same, just ensure they use .fileType from the model)

export default router;