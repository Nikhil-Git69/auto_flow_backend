import { Route, Get, Post, Query, Body, Tags, Path } from 'tsoa';
import { IAnalysis } from '../models/Analysis';
import AnalysisModel from '../models/Analysis';
import { generateCorrectedPDF, Issue } from '../services/aiAnalysisService';

@Route('analysis')
@Tags('Analysis')
export class AnalysisController {
  
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
      originalBase64: string; 
      issues: Issue[]; 
      fixedIssueIds: string[]; 
      fileName?: string 
    }
  ): Promise<{ success: boolean; data: any }> {
    const { originalBase64, issues, fixedIssueIds, fileName } = body;

    const base64Data = originalBase64.includes('base64,') 
      ? originalBase64.split('base64,')[1] 
      : originalBase64;
    
    const originalBuffer = Buffer.from(base64Data, 'base64');

    // FIXED: Now passing originalBuffer, issues, AND fixedIssueIds
    const correctedBuffer = await generateCorrectedPDF(
      originalBuffer,
      issues, 
      fixedIssueIds
    );

    const timestamp = new Date().toISOString().split('T')[0];
    return {
      success: true,
      data: {
        correctedFile: correctedBuffer.toString('base64'),
        fileName: fileName ? fileName.replace('.pdf', `_fixed_${timestamp}.pdf`) : `fixed_${timestamp}.pdf`,
        mimeType: 'application/pdf',
        size: correctedBuffer.length
      }
    };
  }

  @Post('/')
  public async createAnalysis(
    @Body() body: Omit<IAnalysis, '_id' | 'createdAt' | 'updatedAt'>
  ): Promise<IAnalysis> {
    return await AnalysisModel.create(body);
  }
}