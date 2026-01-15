import { GoogleGenerativeAI, Part } from "@google/generative-ai";
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import dotenv from "dotenv";

dotenv.config();

const API_KEY = process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

export interface Issue {
  id: string;
  type: "Layout" | "Typography" | "Grammar" | "Accessibility" | "Content" | "Formatting" | "Spelling";
  severity: "Critical" | "Major" | "Minor";
  description: string;
  suggestion: string;
  location: string;
  pageNumber: number;
  position?: { top: number; left: number; width: number; height: number; };
  originalText?: string;
  correctedText?: string;
}

const generateWithRetry = async (model: any, content: any, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await model.generateContent(content);
    } catch (error: any) {
      if ((error.message?.includes('503') || error.status === 503) && i < retries - 1) {
        const delay = Math.pow(2, i) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
};

export const analyzeDocumentWithAI = async (fileBuffer: Buffer, fileName: string) => {
  if (!genAI) throw new Error("API Key missing");
  try {
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const pdfPart: Part = {
      inlineData: { data: fileBuffer.toString("base64"), mimeType: "application/pdf" }
    };

    const prompt = `Analyze document "${fileName}". Return JSON. 
      Identify specific errors and provide "position" {top, left, width, height} as 0-100 percentages.
      JSON structure: { "score": 0, "summary": "", "issues": [{ "type": "Spelling", "severity": "Critical", "description": "", "suggestion": "", "pageNumber": 1, "position": { "top": 0, "left": 0, "width": 0, "height": 0 } }] }`;

    const result = await generateWithRetry(model, [prompt, pdfPart]);
    const response = await result!.response;
    const parsedData = JSON.parse(response.text());
    
    const issuesWithIds = parsedData.issues.map((issue: any, index: number) => ({
        ...issue,
        id: `issue-${Date.now()}-${index}`
    }));

    return { success: true, ...parsedData, issues: issuesWithIds };
  } catch (error: any) {
    return { success: false, summary: "AI Service Error", issues: [] };
  }
};

export const generateCorrectedPDF = async (originalBuffer: Buffer, issues: Issue[], fixedIssueIds: string[]): Promise<Buffer> => {
  try {
    const pdfDoc = await PDFDocument.load(originalBuffer);
    const pages = pdfDoc.getPages();
    const issuesToApply = issues.filter(issue => fixedIssueIds.includes(issue.id));

    issuesToApply.forEach((issue) => {
      const pageIndex = issue.pageNumber - 1;
      if (pageIndex >= 0 && pageIndex < pages.length && issue.position) {
        const page = pages[pageIndex];
        const { width, height } = page.getSize();
        const rectX = (issue.position.left / 100) * width;
        const rectY = height - ((issue.position.top / 100) * height) - ((issue.position.height / 100) * height);
        page.drawRectangle({
          x: rectX, y: rectY, width: (issue.position.width / 100) * width, height: (issue.position.height / 100) * height,
          color: rgb(1, 1, 0), opacity: 0.4
        });
      }
    });
    return Buffer.from(await pdfDoc.save());
  } catch (error) { return originalBuffer; }
};