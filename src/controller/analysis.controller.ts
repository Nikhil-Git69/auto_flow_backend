import { Route, Get, Post, Query, Body, Tags } from 'tsoa';
import { IAnalysis } from '../models/Analysis';
import AnalysisModel from '../models/Analysis';
import { 
  generateCorrectedDocument,
  Issue,
  extractTextFromWordDocument,
  analyzeDocumentWithAI,
  generateCorrectedPDF
} from '../services/aiAnalysisService';

@Route('analysis')
@Tags('Analysis')
export class AnalysisController {
  /**
   * Main Analysis Endpoint: Triggers AI and saves to DB
   */
  @Post('/analyze')
  public async analyzeDocument(
    @Body() body: { 
      fileBuffer: string; // Base64 string from frontend
      fileName: string;
      requirements: string;
      userId: string;
      templateBuffer?: string; // Optional Base64
      formatType?: string; // Add formatType
      fileMimeType?: string; // Add fileMimeType
    }
  ): Promise<{ success: boolean; data?: IAnalysis; error?: string }> {
    try {
      const buffer = Buffer.from(body.fileBuffer, 'base64');
      const templateBuffer = body.templateBuffer ? Buffer.from(body.templateBuffer, 'base64') : undefined;
      
      // Convert templateBuffer to Multer.File-like object if exists
      let templateFile: any = undefined;
      if (templateBuffer) {
        templateFile = {
          buffer: templateBuffer,
          mimetype: 'application/pdf',
          originalname: 'template.pdf'
        };
      }

      // Get file MIME type from request or guess from filename
      const fileMimeType = body.fileMimeType || getMimeTypeFromFileName(body.fileName);
      const formatType = body.formatType || 'default';

      // 1. Run AI Audit with 6 parameters
      const aiResponse = await analyzeDocumentWithAI(
        buffer,                       // fileBuffer
        body.fileName,                // fileName
        fileMimeType,                 // fileMimeType
        formatType,                   // formatType
        body.requirements,            // formatRequirements
        templateFile                  // templateFile (Multer.File-like object)
      );

      // 2. Map response to Database Schema
      const newAnalysis = {
        userId: body.userId,
        fileName: body.fileName,
        analysisId: `ANL-${Date.now()}`,
        score: aiResponse.score || 0,
        summary: aiResponse.summary,
        issues: aiResponse.issues.map((iss: any, idx: number) => ({
          ...iss,
          id: `iss-${idx}-${Date.now()}` // Generate unique ID for frontend tracking
        })),
        fileData: buffer,
        fileType: fileMimeType,
        analyzedAt: new Date(),
        // Add topology analysis metadata
        analysisType: aiResponse.analysisType,
        geminiModel: aiResponse.geminiModel,
        pdfStructure: aiResponse.pdfStructure,
        structureAnalysis: aiResponse.structureAnalysis,
        visualAnalysisPerformed: aiResponse.visualAnalysisPerformed,
        formatType: formatType,
        formatRequirements: body.requirements
      };

      // 3. Save to MongoDB
      const saved = await AnalysisModel.create(newAnalysis);

      return { success: true, data: saved };
    } catch (error: any) {
      console.error("❌ Analysis Error:", error.message);
      return { success: false, error: error.message };
    }
  }

  @Get('/')
  public async getAnalyses(
    @Query() page: number = 1,
    @Query() limit: number = 10,
    @Query() userId?: string
  ): Promise<{ data: IAnalysis[]; total: number }> {
    const filter: any = userId ? { userId } : {};
    const total = await AnalysisModel.countDocuments(filter);
    const data = await AnalysisModel.find(filter)
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ analyzedAt: -1 });
    return { data, total };
  }
  
  @Post('/export')
  public async exportCorrected(
    @Body() body: { 
      analysisId: string;
      originalBase64?: string;
      issues: Issue[]; 
      fixedIssueIds: string[]; 
      fileName?: string;
    }
  ): Promise<{ success: boolean; data: any }> {
    try {
      const { analysisId, originalBase64, issues, fixedIssueIds, fileName } = body;
      let originalBuffer: Buffer;
      
      if (analysisId) {
        const analysis = await AnalysisModel.findOne({ analysisId }).select('+fileData');
        if (!analysis || !analysis.fileData) throw new Error("Original file not found.");
        originalBuffer = analysis.fileData as Buffer;
        
        const correctedDoc = await generateCorrectedDocument(originalBuffer, analysis.fileName, issues, fixedIssueIds);

        return {
          success: true,
          data: {
            correctedFile: correctedDoc.buffer.toString('base64'),
            fileName: correctedDoc.fileName,
            mimeType: correctedDoc.mimeType
          }
        };
      } else {
        throw new Error("Missing analysisId.");
      }
    } catch (error: any) {
      return { success: false, data: { error: error.message } };
    }
  }

  @Post('/extract-text')
  public async extractText(
    @Body() body: { fileBuffer: string; fileName: string; }
  ): Promise<{ success: boolean; data: any }> {
    try {
      const buffer = Buffer.from(body.fileBuffer, 'base64');
      const extractedDoc = await extractTextFromWordDocument(buffer, body.fileName);
      return { success: true, data: extractedDoc };
    } catch (error: any) {
      return { success: false, data: { error: error.message } };
    }
  }
}

// Helper function to guess MIME type from filename
function getMimeTypeFromFileName(fileName: string): string {
  const ext = fileName.toLowerCase().split('.').pop();
  
  switch (ext) {
    case 'pdf':
      return 'application/pdf';
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'doc':
      return 'application/msword';
    case 'txt':
      return 'text/plain';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    default:
      return 'application/octet-stream';
  }
}