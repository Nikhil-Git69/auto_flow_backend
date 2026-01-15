import { Router, Request, Response } from "express";
import multer from "multer";
import Analysis from "../models/Analysis";
import { analyzeDocumentWithAI, generateCorrectedPDF } from "../services/aiAnalysisService";
import { v4 as uuidv4 } from 'uuid';

const router = Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain', 'image/png', 'image/jpeg', 'image/jpg'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOC, DOCX, TXT, PNG, JPG, JPEG are allowed.'));
    }
  }
});

// =========== UPLOAD & ANALYZE ===========
router.post("/upload-file", upload.single("document"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No file uploaded" });
    }

    const userId = req.body.userId || "anonymous";
    const fileName = req.body.fileName || req.file.originalname;
    
    // Calls the service that uses Gemini 1.5 Flash
    const analysisResult = await analyzeDocumentWithAI(req.file.buffer, req.file.originalname);

    if (!analysisResult.success) {
      return res.status(500).json({ success: false, error: analysisResult.summary });
    }

    const analysis = new Analysis({
      analysisId: `analysis-${uuidv4()}`,
      userId,
      fileName,
      fileSize: req.file.size,
      fileType: req.file.mimetype,
      score: analysisResult.score,
      summary: analysisResult.summary,
      // Mapping detailed issues including coordinates for specific highlighting
      issues: (analysisResult.issues || []).map((issue: any) => ({
        id: issue.id || uuidv4(),
        type: issue.type || 'General',
        severity: issue.severity || 'Medium',
        description: issue.description || '',
        suggestion: issue.suggestion || '',
        context: issue.context || '', // Added for word-specific clarity
        pageNumber: issue.pageNumber || 1,
        position: issue.position || { top: 0, left: 0, width: 0, height: 0 },
        isFixed: false
      })),
      status: "completed",
      analyzedAt: new Date(),
      uploadDate: new Date()
    });

    await analysis.save();
    const savedDoc = analysis as any;

    res.status(200).json({
      success: true,
      data: {
        analysisId: savedDoc.analysisId,
        totalScore: savedDoc.score,
        issues: savedDoc.issues,
        summary: savedDoc.summary,
        fileName: savedDoc.fileName,
        analyzedAt: savedDoc.analyzedAt
      }
    });

  } catch (err: any) {
    console.error("Upload error:", err);
    res.status(500).json({ success: false, error: "Failed to analyze document" });
  }
});

// =========== EXPORT CORRECTED PDF ===========
// This fixes the DOCTYPE error by ensuring a proper PDF stream response
router.post("/export-corrected", async (req: Request, res: Response) => {
  try {
    const { analysisId, fixedIssueIds } = req.body;

    const analysis = await Analysis.findOne({ analysisId });
    if (!analysis) return res.status(404).json({ error: "Analysis not found" });

    // IMPORTANT: You need the ORIGINAL file buffer. 
    // If you stored it in the DB as a 'Buffer' type:
    const originalFileBuffer = (analysis as any).fileData; 

    // If you don't have the buffer saved, you might need to use a placeholder 
    // or fetch it from your upload directory:
    // const originalFileBuffer = fs.readFileSync(path.join(__dirname, '../../uploads', analysis.fileName));

    if (!originalFileBuffer || !Buffer.isBuffer(originalFileBuffer)) {
        return res.status(400).json({ error: "Original file content missing" });
    }

    const correctedPdfBuffer = await generateCorrectedPDF(
      originalFileBuffer, // This MUST be a Buffer
      fixedIssueIds,
      (analysis.issues as any) // Pass the issues here if needed
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.send(correctedPdfBuffer);
  } catch (err) {
    res.status(500).send("Export failed");
  }
});

// =========== GET ISSUE FIXES ===========
router.get("/:id/fixes", async (req: Request, res: Response) => {
  try {
    const analysis = await Analysis.findOne({ 
      $or: [{ _id: req.params.id }, { analysisId: req.params.id }]
    });
    
    if (!analysis) return res.status(404).json({ success: false, error: "Not found" });
    
    const issuesList = (analysis.issues as any[]) || [];
    const fixedIssues = issuesList.filter((issue: any) => issue.isFixed === true);
    
    res.json({
      success: true,
      data: { totalFixes: fixedIssues.length, fixes: fixedIssues }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: "Failed to get fixes" });
  }
});

// =========== READ SINGLE ===========
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const analysis = await Analysis.findOne({ 
      $or: [{ _id: req.params.id }, { analysisId: req.params.id }]
    });
    
    if (!analysis) return res.status(404).json({ success: false, error: "Not found" });
    res.json({ success: true, data: analysis });
  } catch (err: any) {
    res.status(500).json({ success: false, error: "Server error" });
  }
});

export default router;