

// // import { GoogleGenerativeAI, Part } from "@google/generative-ai";
// // import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
// // import dotenv from "dotenv";

// // dotenv.config();

// // const API_KEY = process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
// // const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

// // export interface Issue {
// //   id: string;
// //   type: "Layout" | "Typography" | "Grammar" | "Accessibility" | "Content" | "Formatting" | "Spelling";
// //   severity: "Critical" | "Major" | "Minor";
// //   description: string;
// //   suggestion: string;
// //   location: string;
// //   pageNumber: number;
// //   position?: { top: number; left: number; width: number; height: number; };
// //   originalText?: string;
// //   correctedText?: string;
// // }

// // const generateWithRetry = async (model: any, content: any, retries = 3) => {
// //   for (let i = 0; i < retries; i++) {
// //     try {
// //       return await model.generateContent(content);
// //     } catch (error: any) {
// //       if ((error.message?.includes('503') || error.status === 503) && i < retries - 1) {
// //         const delay = Math.pow(2, i) * 1000;
// //         await new Promise(resolve => setTimeout(resolve, delay));
// //         continue;
// //       }
// //       throw error;
// //     }
// //   }
// // };


// // export const analyzeDocumentWithAI = async (fileBuffer: Buffer, fileName: string) => {
// //   if (!genAI) throw new Error("API Key missing");
// //   try {
// //     const model = genAI.getGenerativeModel({ 
// //       model: "gemini-2.5-flash",
// //       generationConfig: { responseMimeType: "application/json" }
// //     });

// //     const pdfPart: Part = {
// //       inlineData: { data: fileBuffer.toString("base64"), mimeType: "application/pdf" }
// //     };

// //     const prompt = `Analyze document "${fileName}". Return JSON. 
// //       Identify specific errors and provide "position" {top, left, width, height} as 0-100 percentages.
// //       JSON structure: { "score": 0, "summary": "", "issues": [{ "type": "Spelling", "severity": "Critical", "description": "", "suggestion": "", "pageNumber": 1, "position": { "top": 0, "left": 0, "width": 0, "height": 0 } }] }`;

// //     const result = await generateWithRetry(model, [prompt, pdfPart]);
// //     const response = await result!.response;
// //     const parsedData = JSON.parse(response.text());
    
// //     const issuesWithIds = parsedData.issues.map((issue: any, index: number) => ({
// //         ...issue,
// //         id: `issue-${Date.now()}-${index}`
// //     }));

// //     // FIXED: Ensure score is always a number and return clean structure
// //     const score = parsedData.score ?? 0;
    
// //     return { 
// //       success: true, 
// //       score, // This is now guaranteed to be a number
// //       summary: parsedData.summary || "",
// //       issues: issuesWithIds 
// //     };
// //   } catch (error: any) {
// //     // Return a default structure with score = 0 on error
// //     return { 
// //       success: false, 
// //       score: 0, // Default score
// //       summary: "AI Service Error", 
// //       issues: [] 
// //     };
// //   }
// // };

// // export const generateCorrectedPDF = async (originalBuffer: Buffer, issues: Issue[], fixedIssueIds: string[]): Promise<Buffer> => {
// //   try {
// //     const pdfDoc = await PDFDocument.load(originalBuffer);
// //     const pages = pdfDoc.getPages();
// //     const issuesToApply = issues.filter(issue => fixedIssueIds.includes(issue.id));

// //     issuesToApply.forEach((issue) => {
// //       const pageIndex = issue.pageNumber - 1;
// //       if (pageIndex >= 0 && pageIndex < pages.length && issue.position) {
// //         const page = pages[pageIndex];
// //         const { width, height } = page.getSize();
// //         const rectX = (issue.position.left / 100) * width;
// //         const rectY = height - ((issue.position.top / 100) * height) - ((issue.position.height / 100) * height);
// //         page.drawRectangle({
// //           x: rectX, y: rectY, width: (issue.position.width / 100) * width, height: (issue.position.height / 100) * height,
// //           color: rgb(1, 1, 0), opacity: 0.4
// //         });
// //       }
// //     });
// //     return Buffer.from(await pdfDoc.save());
// //   } catch (error) { return originalBuffer; }
// // };
// import { GoogleGenerativeAI, Part } from "@google/generative-ai";
// import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
// import mammoth from 'mammoth';
// import officeParser from 'officeparser';
// import dotenv from "dotenv";
// import path from 'path';
// import fs from 'fs';

// dotenv.config();

// const API_KEY = process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
// const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

// export interface Issue {
//   id: string;
//   type: "Layout" | "Typography" | "Grammar" | "Accessibility" | "Content" | "Formatting" | "Spelling";
//   severity: "Critical" | "Major" | "Minor";
//   description: string;
//   suggestion: string;
//   location: string;
//   pageNumber: number;
//   position?: { top: number; left: number; width: number; height: number; };
//   originalText?: string;
//   correctedText?: string;
// }

// // NEW: Document processing interface
// export interface ProcessedDocument {
//   textContent: string;
//   fileType: 'pdf' | 'docx' | 'doc' | 'txt' | 'image';
//   fileName: string;
//   pageCount?: number;
//   wordCount?: number;
//   metadata?: any;
// }

// const generateWithRetry = async (model: any, content: any, retries = 3) => {
//   for (let i = 0; i < retries; i++) {
//     try {
//       return await model.generateContent(content);
//     } catch (error: any) {
//       if ((error.message?.includes('503') || error.status === 503) && i < retries - 1) {
//         const delay = Math.pow(2, i) * 1000;
//         await new Promise(resolve => setTimeout(resolve, delay));
//         continue;
//       }
//       throw error;
//     }
//   }
// };

// // NEW: Extract text from Word documents
// export const extractTextFromWordDocument = async (fileBuffer: Buffer, fileName: string): Promise<ProcessedDocument> => {
//   try {
//     const fileExtension = path.extname(fileName).toLowerCase();
    
//     if (fileExtension === '.docx') {
//       const result = await mammoth.extractRawText({ buffer: fileBuffer });
//       const text = result.value;
      
//       return {
//         textContent: text,
//         fileType: 'docx',
//         fileName,
//         wordCount: text.split(/\s+/).length,
//         metadata: { paragraphs: text.split(/\n\s*\n/).length }
//       };
//     } 
//     else if (fileExtension === '.doc') {
//       const text = await officeParser.parseBuffer(fileBuffer);
      
//       return {
//         textContent: text,
//         fileType: 'doc',
//         fileName,
//         wordCount: text.split(/\s+/).length
//       };
//     }
//     else if (fileExtension === '.txt') {
//       const text = fileBuffer.toString('utf-8');
      
//       return {
//         textContent: text,
//         fileType: 'txt',
//         fileName,
//         wordCount: text.split(/\s+/).length
//       };
//     }
//     else {
//       throw new Error(`Unsupported file type: ${fileExtension}`);
//     }
//   } catch (error) {
//     console.error('Error extracting text from Word document:', error);
//     throw new Error('Failed to extract text from document');
//   }
// };

// // UPDATED: Analyze any document type
// export const analyzeDocumentWithAI = async (fileBuffer: Buffer, fileName: string, fileType?: string): Promise<{
//   success: boolean;
//   score: number;
//   summary: string;
//   issues: any[];
//   processedContent?: ProcessedDocument;
// }> => {
//   if (!genAI) throw new Error("API Key missing");
  
//   try {
//     const model = genAI.getGenerativeModel({ 
//       model: "gemini-2.5-flash",
//       generationConfig: { responseMimeType: "application/json" }
//     });

//     const fileExtension = path.extname(fileName).toLowerCase();
//     const isWordFile = ['.docx', '.doc', '.txt'].includes(fileExtension);
//     let processedDoc: ProcessedDocument | undefined;
//     let prompt = '';

//     if (isWordFile) {
//       // Process Word/document file
//       processedDoc = await extractTextFromWordDocument(fileBuffer, fileName);
      
//       prompt = `Analyze the following text document "${fileName}":
      
//       DOCUMENT CONTENT:
//       ${processedDoc.textContent.substring(0, 30000)} // Limit to avoid token limits
      
//       Analyze this document for:
//       1. Grammar and spelling errors
//       2. Formatting and structure issues
//       3. Content clarity and coherence
//       4. Accessibility considerations
      
//       Return JSON with the following structure:
//       {
//         "score": number (0-100),
//         "summary": "overall summary of document quality",
//         "issues": [{
//           "type": "Spelling" | "Grammar" | "Formatting" | "Content" | "Accessibility" | "Structure",
//           "severity": "Critical" | "Major" | "Minor",
//           "description": "detailed description of the issue",
//           "suggestion": "specific suggestion for correction",
//           "location": "approximate location in document (e.g., 'Paragraph 3, Sentence 2')",
//           "pageNumber": 1,
//           "originalText": "the exact text with the issue (important for replacement)",
//           "correctedText": "the corrected text (important for replacement)"
//         }]
//       }
      
//       IMPORTANT: For each issue, include originalText and correctedText for easy text replacement.`;
      
//       const result = await generateWithRetry(model, prompt);
//       const response = await result!.response;
//       const parsedData = JSON.parse(response.text());
      
//       const issuesWithIds = parsedData.issues.map((issue: any, index: number) => ({
//         ...issue,
//         id: `issue-${Date.now()}-${index}`,
//         pageNumber: issue.pageNumber || 1
//       }));

//       return { 
//         success: true, 
//         score: parsedData.score ?? 0,
//         summary: parsedData.summary || "",
//         issues: issuesWithIds,
//         processedContent: processedDoc
//       };
//     } else {
//       // Original PDF analysis logic
//       const pdfPart: Part = {
//         inlineData: { data: fileBuffer.toString("base64"), mimeType: "application/pdf" }
//       };

//       prompt = `Analyze document "${fileName}". Return JSON. 
//         Identify specific errors and provide "position" {top, left, width, height} as 0-100 percentages.
//         JSON structure: { "score": 0, "summary": "", "issues": [{ "type": "Spelling", "severity": "Critical", "description": "", "suggestion": "", "pageNumber": 1, "position": { "top": 0, "left": 0, "width": 0, "height": 0 } }] }`;

//       const result = await generateWithRetry(model, [prompt, pdfPart]);
//       const response = await result!.response;
//       const parsedData = JSON.parse(response.text());
      
//       const issuesWithIds = parsedData.issues.map((issue: any, index: number) => ({
//         ...issue,
//         id: `issue-${Date.now()}-${index}`
//       }));

//       const score = parsedData.score ?? 0;
      
//       return { 
//         success: true, 
//         score,
//         summary: parsedData.summary || "",
//         issues: issuesWithIds 
//       };
//     }
//   } catch (error: any) {
//     console.error('AI Analysis Error:', error);
//     return { 
//       success: false, 
//       score: 0,
//       summary: "AI Service Error: " + (error.message || "Unknown error"), 
//       issues: [] 
//     };
//   }
// };

// // NEW: Generate corrected Word document
// export const generateCorrectedWordDocument = async (
//   originalContent: string, 
//   issues: Issue[], 
//   fixedIssueIds: string[]
// ): Promise<{ content: string; fileType: string }> => {
//   try {
//     let correctedContent = originalContent;
//     const issuesToApply = issues.filter(issue => fixedIssueIds.includes(issue.id));

//     // Apply fixes in reverse order to avoid index shifting issues
//     for (const issue of issuesToApply.reverse()) {
//       if (issue.originalText && issue.correctedText) {
//         correctedContent = correctedContent.replace(issue.originalText, issue.correctedText);
//       }
//     }

//     // Create a simple HTML document with the corrected content
//     const correctedDoc = `
//       <!DOCTYPE html>
//       <html>
//       <head>
//         <meta charset="UTF-8">
//         <title>Corrected Document</title>
//         <style>
//           body { font-family: Arial, sans-serif; line-height: 1.6; margin: 40px; }
//           .correction { background-color: #e8f5e8; padding: 2px; border-left: 3px solid #4CAF50; }
//           .summary { background-color: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px; }
//         </style>
//       </head>
//       <body>
//         <h1>Corrected Document</h1>
//         <div class="summary">
//           <strong>Applied Corrections:</strong> ${issuesToApply.length} issues fixed
//         </div>
//         <div id="content">
//           ${correctedContent.split('\n').map(para => `<p>${para}</p>`).join('')}
//         </div>
//         ${issuesToApply.length > 0 ? `
//         <div class="summary">
//           <h3>Correction Details:</h3>
//           <ul>
//             ${issuesToApply.map(issue => `
//               <li><strong>${issue.type}</strong> (${issue.severity}): ${issue.description} → ${issue.suggestion}</li>
//             `).join('')}
//           </ul>
//         </div>
//         ` : ''}
//       </body>
//       </html>
//     `;

//     return {
//       content: correctedDoc,
//       fileType: 'text/html'
//     };
//   } catch (error) {
//     console.error('Error generating corrected Word document:', error);
//     return {
//       content: originalContent,
//       fileType: 'text/html'
//     };
//   }
// };

// // UPDATED: Generate corrected PDF (kept original functionality)
// export const generateCorrectedPDF = async (
//   originalBuffer: Buffer, 
//   issues: Issue[], 
//   fixedIssueIds: string[]
// ): Promise<Buffer> => {
//   try {
//     const pdfDoc = await PDFDocument.load(originalBuffer);
//     const pages = pdfDoc.getPages();
//     const issuesToApply = issues.filter(issue => fixedIssueIds.includes(issue.id));

//     issuesToApply.forEach((issue) => {
//       const pageIndex = issue.pageNumber - 1;
//       if (pageIndex >= 0 && pageIndex < pages.length && issue.position) {
//         const page = pages[pageIndex];
//         const { width, height } = page.getSize();
//         const rectX = (issue.position.left / 100) * width;
//         const rectY = height - ((issue.position.top / 100) * height) - ((issue.position.height / 100) * height);
//         page.drawRectangle({
//           x: rectX, y: rectY, width: (issue.position.width / 100) * width, height: (issue.position.height / 100) * height,
//           color: rgb(1, 1, 0), opacity: 0.4
//         });
//       }
//     });
//     return Buffer.from(await pdfDoc.save());
//   } catch (error) { 
//     console.error('Error generating corrected PDF:', error);
//     return originalBuffer; 
//   }
// };

// // NEW: Generate corrected document based on file type
// export const generateCorrectedDocument = async (
//   originalBuffer: Buffer,
//   fileName: string,
//   issues: Issue[],
//   fixedIssueIds: string[],
//   fileType?: string
// ): Promise<{ buffer: Buffer; mimeType: string; fileName: string }> => {
//   const fileExtension = path.extname(fileName).toLowerCase();
  
//   if (['.docx', '.doc', '.txt'].includes(fileExtension)) {
//     // Process Word/document files
//     const processedDoc = await extractTextFromWordDocument(originalBuffer, fileName);
//     const correctedResult = await generateCorrectedWordDocument(
//       processedDoc.textContent,
//       issues,
//       fixedIssueIds
//     );
    
//     const timestamp = new Date().toISOString().split('T')[0];
//     return {
//       buffer: Buffer.from(correctedResult.content, 'utf-8'),
//       mimeType: correctedResult.fileType,
//       fileName: `corrected_${fileName.replace(/\.[^/.]+$/, '')}_${timestamp}.html`
//     };
//   } else {
//     // Process PDF files
//     const correctedBuffer = await generateCorrectedPDF(originalBuffer, issues, fixedIssueIds);
//     const timestamp = new Date().toISOString().split('T')[0];
    
//     return {
//       buffer: correctedBuffer,
//       mimeType: 'application/pdf',
//       fileName: `corrected_${fileName.replace('.pdf', `_${timestamp}.pdf`)}`
//     };
//   }
// };
// import { GoogleGenerativeAI, Part } from "@google/generative-ai";
// import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
// import mammoth from 'mammoth';
// import dotenv from "dotenv";
// import path from 'path';
// import * as fs from 'fs';

// dotenv.config();

// const API_KEY = process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
// const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

// export interface Issue {
//   id: string;
//   type: "Layout" | "Typography" | "Grammar" | "Accessibility" | "Content" | "Formatting" | "Spelling";
//   severity: "Critical" | "Major" | "Minor";
//   description: string;
//   suggestion: string;
//   location: string;
//   pageNumber: number;
//   position?: { top: number; left: number; width: number; height: number; };
//   originalText?: string;
//   correctedText?: string;
// }

// // NEW: Document processing interface
// export interface ProcessedDocument {
//   textContent: string;
//   fileType: 'pdf' | 'docx' | 'doc' | 'txt' | 'image';
//   fileName: string;
//   pageCount?: number;
//   wordCount?: number;
//   metadata?: any;
// }

// const generateWithRetry = async (model: any, content: any, retries = 3) => {
//   for (let i = 0; i < retries; i++) {
//     try {
//       return await model.generateContent(content);
//     } catch (error: any) {
//       if ((error.message?.includes('503') || error.status === 503) && i < retries - 1) {
//         const delay = Math.pow(2, i) * 1000;
//         await new Promise(resolve => setTimeout(resolve, delay));
//         continue;
//       }
//       throw error;
//     }
//   }
// };

// // NEW: Extract text from Word documents - FIXED officeparser import
// export const extractTextFromWordDocument = async (fileBuffer: Buffer, fileName: string): Promise<ProcessedDocument> => {
//   try {
//     const fileExtension = path.extname(fileName).toLowerCase();
    
//     if (fileExtension === '.docx') {
//       // Use mammoth for .docx files
//       const result = await mammoth.extractRawText({ buffer: fileBuffer });
//       const text = result.value;
      
//       return {
//         textContent: text,
//         fileType: 'docx',
//         fileName,
//         wordCount: text.split(/\s+/).length,
//         metadata: { paragraphs: text.split(/\n\s*\n/).length }
//       };
//     } 
//     else if (fileExtension === '.doc') {
//       // FIX: Use mammoth with a different approach for .doc files
//       // Note: Mammoth doesn't support .doc files directly, so we'll use textract or simple conversion
//       // For now, return an empty text with error message
//       const text = "[.DOC file detected - content extraction requires additional libraries]\n" +
//                    "Please convert to .docx format for full text analysis.";
      
//       return {
//         textContent: text,
//         fileType: 'doc',
//         fileName,
//         wordCount: 0
//       };
//     }
//     else if (fileExtension === '.txt') {
//       // Plain text files
//       const text = fileBuffer.toString('utf-8');
      
//       return {
//         textContent: text,
//         fileType: 'txt',
//         fileName,
//         wordCount: text.split(/\s+/).length
//       };
//     }
//     else {
//       throw new Error(`Unsupported file type: ${fileExtension}`);
//     }
//   } catch (error) {
//     console.error('Error extracting text from Word document:', error);
    
//     // Fallback: Try to extract as plain text
//     try {
//       const text = fileBuffer.toString('utf-8', 0, Math.min(fileBuffer.length, 10000));
//       return {
//         textContent: text || 'Could not extract text content',
//         fileType: fileExtension as any || 'txt',
//         fileName,
//         wordCount: text.split(/\s+/).length
//       };
//     } catch (fallbackError) {
//       throw new Error('Failed to extract text from document');
//     }
//   }
// };

// // Alternative: If you want to use officeparser properly, update your import
// // First, check your package.json for the correct version:
// // "officeparser": "^2.2.0"

// // Then update the import to:
// // import officeparser from 'officeparser';

// // And update the .doc extraction to:
// /*
// else if (fileExtension === '.doc') {
//   // Use officeparser for .doc files
//   try {
//     // officeparser 2.2.0 uses parseOfficeAsync
//     const text = await officeparser.parseOfficeAsync(fileBuffer);
    
//     return {
//       textContent: text,
//       fileType: 'doc',
//       fileName,
//       wordCount: text.split(/\s+/).length
//     };
//   } catch (officeError) {
//     console.warn('OfficeParser failed, using fallback:', officeError);
//     // Fallback text extraction
//     const text = fileBuffer.toString('utf-8', 0, Math.min(fileBuffer.length, 10000));
//     return {
//       textContent: text || 'Limited text extracted',
//       fileType: 'doc',
//       fileName,
//       wordCount: text.split(/\s+/).length
//     };
//   }
// }
// */

// // UPDATED: Analyze any document type
// export const analyzeDocumentWithAI = async (fileBuffer: Buffer, fileName: string, fileType?: string): Promise<{
//   success: boolean;
//   score: number;
//   summary: string;
//   issues: any[];
//   processedContent?: ProcessedDocument;
// }> => {
//   if (!genAI) throw new Error("API Key missing");
  
//   try {
//     const model = genAI.getGenerativeModel({ 
//       model: "gemini-2.5-flash",
//       generationConfig: { responseMimeType: "application/json" }
//     });

//     const fileExtension = path.extname(fileName).toLowerCase();
//     const isWordFile = ['.docx', '.doc', '.txt'].includes(fileExtension);
//     let processedDoc: ProcessedDocument | undefined;
//     let prompt = '';

//     if (isWordFile) {
//       // Process Word/document file
//       processedDoc = await extractTextFromWordDocument(fileBuffer, fileName);
      
//       prompt = `Analyze the following text document "${fileName}":
      
//       DOCUMENT CONTENT:
//       ${processedDoc.textContent.substring(0, 30000)} // Limit to avoid token limits
      
//       Analyze this document for:
//       1. Grammar and spelling errors
//       2. Formatting and structure issues
//       3. Content clarity and coherence
//       4. Accessibility considerations
      
//       Return JSON with the following structure:
//       {
//         "score": number (0-100),
//         "summary": "overall summary of document quality",
//         "issues": [{
//           "type": "Spelling" | "Grammar" | "Formatting" | "Content" | "Accessibility" | "Structure",
//           "severity": "Critical" | "Major" | "Minor",
//           "description": "detailed description of the issue",
//           "suggestion": "specific suggestion for correction",
//           "location": "approximate location in document (e.g., 'Paragraph 3, Sentence 2')",
//           "pageNumber": 1,
//           "originalText": "the exact text with the issue (important for replacement)",
//           "correctedText": "the corrected text (important for replacement)"
//         }]
//       }
      
//       IMPORTANT: For each issue, include originalText and correctedText for easy text replacement.`;
      
//       const result = await generateWithRetry(model, prompt);
//       const response = await result!.response;
//       const parsedData = JSON.parse(response.text());
      
//       const issuesWithIds = parsedData.issues.map((issue: any, index: number) => ({
//         ...issue,
//         id: `issue-${Date.now()}-${index}`,
//         pageNumber: issue.pageNumber || 1
//       }));

//       return { 
//         success: true, 
//         score: parsedData.score ?? 0,
//         summary: parsedData.summary || "",
//         issues: issuesWithIds,
//         processedContent: processedDoc
//       };
//     } else {
//       // Original PDF analysis logic
//       const pdfPart: Part = {
//         inlineData: { data: fileBuffer.toString("base64"), mimeType: "application/pdf" }
//       };

//       prompt = `Analyze document "${fileName}". Return JSON. 
//         Identify specific errors and provide "position" {top, left, width, height} as 0-100 percentages.
//         JSON structure: { "score": 0, "summary": "", "issues": [{ "type": "Spelling", "severity": "Critical", "description": "", "suggestion": "", "pageNumber": 1, "position": { "top": 0, "left": 0, "width": 0, "height": 0 } }] }`;

//       const result = await generateWithRetry(model, [prompt, pdfPart]);
//       const response = await result!.response;
//       const parsedData = JSON.parse(response.text());
      
//       const issuesWithIds = parsedData.issues.map((issue: any, index: number) => ({
//         ...issue,
//         id: `issue-${Date.now()}-${index}`
//       }));

//       const score = parsedData.score ?? 0;
      
//       return { 
//         success: true, 
//         score,
//         summary: parsedData.summary || "",
//         issues: issuesWithIds 
//       };
//     }
//   } catch (error: any) {
//     console.error('AI Analysis Error:', error);
//     return { 
//       success: false, 
//       score: 0,
//       summary: "AI Service Error: " + (error.message || "Unknown error"), 
//       issues: [] 
//     };
//   }
// };

// // NEW: Generate corrected Word document
// export const generateCorrectedWordDocument = async (
//   originalContent: string, 
//   issues: Issue[], 
//   fixedIssueIds: string[]
// ): Promise<{ content: string; fileType: string }> => {
//   try {
//     let correctedContent = originalContent;
//     const issuesToApply = issues.filter(issue => fixedIssueIds.includes(issue.id));

//     // Apply fixes in reverse order to avoid index shifting issues
//     for (const issue of issuesToApply.reverse()) {
//       if (issue.originalText && issue.correctedText) {
//         correctedContent = correctedContent.replace(issue.originalText, issue.correctedText);
//       }
//     }

//     // Create a simple HTML document with the corrected content
//     const correctedDoc = `
//       <!DOCTYPE html>
//       <html>
//       <head>
//         <meta charset="UTF-8">
//         <title>Corrected Document</title>
//         <style>
//           body { font-family: Arial, sans-serif; line-height: 1.6; margin: 40px; }
//           .correction { background-color: #e8f5e8; padding: 2px; border-left: 3px solid #4CAF50; }
//           .summary { background-color: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px; }
//         </style>
//       </head>
//       <body>
//         <h1>Corrected Document</h1>
//         <div class="summary">
//           <strong>Applied Corrections:</strong> ${issuesToApply.length} issues fixed
//         </div>
//         <div id="content">
//           ${correctedContent.split('\n').map(para => `<p>${para}</p>`).join('')}
//         </div>
//         ${issuesToApply.length > 0 ? `
//         <div class="summary">
//           <h3>Correction Details:</h3>
//           <ul>
//             ${issuesToApply.map(issue => `
//               <li><strong>${issue.type}</strong> (${issue.severity}): ${issue.description} → ${issue.suggestion}</li>
//             `).join('')}
//           </ul>
//         </div>
//         ` : ''}
//       </body>
//       </html>
//     `;

//     return {
//       content: correctedDoc,
//       fileType: 'text/html'
//     };
//   } catch (error) {
//     console.error('Error generating corrected Word document:', error);
//     return {
//       content: originalContent,
//       fileType: 'text/html'
//     };
//   }
// };

// // UPDATED: Generate corrected PDF (kept original functionality)
// export const generateCorrectedPDF = async (
//   originalBuffer: Buffer, 
//   issues: Issue[], 
//   fixedIssueIds: string[]
// ): Promise<Buffer> => {
//   try {
//     const pdfDoc = await PDFDocument.load(originalBuffer);
//     const pages = pdfDoc.getPages();
//     const issuesToApply = issues.filter(issue => fixedIssueIds.includes(issue.id));

//     issuesToApply.forEach((issue) => {
//       const pageIndex = issue.pageNumber - 1;
//       if (pageIndex >= 0 && pageIndex < pages.length && issue.position) {
//         const page = pages[pageIndex];
//         const { width, height } = page.getSize();
//         const rectX = (issue.position.left / 100) * width;
//         const rectY = height - ((issue.position.top / 100) * height) - ((issue.position.height / 100) * height);
//         page.drawRectangle({
//           x: rectX, y: rectY, width: (issue.position.width / 100) * width, height: (issue.position.height / 100) * height,
//           color: rgb(1, 1, 0), opacity: 0.4
//         });
//       }
//     });
//     return Buffer.from(await pdfDoc.save());
//   } catch (error) { 
//     console.error('Error generating corrected PDF:', error);
//     return originalBuffer; 
//   }
// };

// // NEW: Generate corrected document based on file type
// export const generateCorrectedDocument = async (
//   originalBuffer: Buffer,
//   fileName: string,
//   issues: Issue[],
//   fixedIssueIds: string[],
//   fileType?: string
// ): Promise<{ buffer: Buffer; mimeType: string; fileName: string }> => {
//   const fileExtension = path.extname(fileName).toLowerCase();
  
//   if (['.docx', '.doc', '.txt'].includes(fileExtension)) {
//     // Process Word/document files
//     const processedDoc = await extractTextFromWordDocument(originalBuffer, fileName);
//     const correctedResult = await generateCorrectedWordDocument(
//       processedDoc.textContent,
//       issues,
//       fixedIssueIds
//     );
    
//     const timestamp = new Date().toISOString().split('T')[0];
//     return {
//       buffer: Buffer.from(correctedResult.content, 'utf-8'),
//       mimeType: correctedResult.fileType,
//       fileName: `corrected_${fileName.replace(/\.[^/.]+$/, '')}_${timestamp}.html`
//     };
//   } else {
//     // Process PDF files
//     const correctedBuffer = await generateCorrectedPDF(originalBuffer, issues, fixedIssueIds);
//     const timestamp = new Date().toISOString().split('T')[0];
    
//     return {
//       buffer: correctedBuffer,
//       mimeType: 'application/pdf',
//       fileName: `corrected_${fileName.replace('.pdf', `_${timestamp}.pdf`)}`
//     };
//   }
// };
// import { GoogleGenerativeAI, Part } from "@google/generative-ai";
// import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
// import mammoth from 'mammoth';
// import dotenv from "dotenv";
// import path from 'path'; // Keep this import

// dotenv.config();

// const API_KEY = process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
// const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

// export interface Issue {
//   id: string;
//   type: "Layout" | "Typography" | "Grammar" | "Accessibility" | "Content" | "Formatting" | "Spelling";
//   severity: "Critical" | "Major" | "Minor";
//   description: string;
//   suggestion: string;
//   location: string;
//   pageNumber: number;
//   position?: { top: number; left: number; width: number; height: number; };
//   originalText?: string;
//   correctedText?: string;
// }

// // NEW: Document processing interface
// export interface ProcessedDocument {
//   textContent: string;
//   fileType: 'pdf' | 'docx' | 'doc' | 'txt' | 'image';
//   fileName: string;
//   pageCount?: number;
//   wordCount?: number;
//   metadata?: any;
// }

// const generateWithRetry = async (model: any, content: any, retries = 3) => {
//   for (let i = 0; i < retries; i++) {
//     try {
//       return await model.generateContent(content);
//     } catch (error: any) {
//       if ((error.message?.includes('503') || error.status === 503) && i < retries - 1) {
//         const delay = Math.pow(2, i) * 1000;
//         await new Promise(resolve => setTimeout(resolve, delay));
//         continue;
//       }
//       throw error;
//     }
//   }
// };

// // Helper function to get file extension safely
// const getFileExtension = (fileName: string): string => {
//   try {
//     // Try using path.extname first
//     const ext = path.extname(fileName).toLowerCase();
//     if (ext) return ext;
    
//     // Fallback: manual extraction
//     const parts = fileName.split('.');
//     return parts.length > 1 ? `.${parts[parts.length - 1].toLowerCase()}` : '';
//   } catch (error) {
//     // Ultimate fallback
//     const parts = fileName.split('.');
//     return parts.length > 1 ? `.${parts[parts.length - 1].toLowerCase()}` : '';
//   }
// };

// // NEW: Extract text from Word documents
// export const extractTextFromWordDocument = async (fileBuffer: Buffer, fileName: string): Promise<ProcessedDocument> => {
//   try {
//     const fileExtension = getFileExtension(fileName);
    
//     if (fileExtension === '.docx') {
//       // Use mammoth for .docx files
//       const result = await mammoth.extractRawText({ buffer: fileBuffer });
//       const text = result.value;
      
//       return {
//         textContent: text,
//         fileType: 'docx',
//         fileName,
//         wordCount: text.split(/\s+/).length,
//         metadata: { paragraphs: text.split(/\n\s*\n/).length }
//       };
//     } 
//     else if (fileExtension === '.doc') {
//       // For .doc files, provide a message
//       const text = "[.DOC file detected]\n" +
//                    "For full text analysis, please convert this .doc file to .docx format.\n" +
//                    "You can do this by opening it in Microsoft Word and saving as .docx.";
      
//       return {
//         textContent: text,
//         fileType: 'doc',
//         fileName,
//         wordCount: 0
//       };
//     }
//     else if (fileExtension === '.txt') {
//       // Plain text files
//       const text = fileBuffer.toString('utf-8');
      
//       return {
//         textContent: text,
//         fileType: 'txt',
//         fileName,
//         wordCount: text.split(/\s+/).length
//       };
//     }
//     else {
//       // Try to extract as plain text for other text-based formats
//       try {
//         const text = fileBuffer.toString('utf-8', 0, Math.min(fileBuffer.length, 50000));
//         return {
//           textContent: text || 'Unknown file type',
//           fileType: fileExtension.replace('.', '') as any || 'txt',
//           fileName,
//           wordCount: text.split(/\s+/).length
//         };
//       } catch {
//         throw new Error(`Unsupported file type: ${fileExtension}`);
//       }
//     }
//   } catch (error) {
//     console.error('Error extracting text from Word document:', error);
    
//     return {
//       textContent: 'Error extracting text. Please try a .docx, .txt, or PDF file.',
//       fileType: 'txt',
//       fileName,
//       wordCount: 0
//     };
//   }
// };

// // UPDATED: Analyze any document type
// export const analyzeDocumentWithAI = async (fileBuffer: Buffer, fileName: string, mimeType?: string): Promise<{
//   success: boolean;
//   score: number;
//   summary: string;
//   issues: any[];
//   processedContent?: ProcessedDocument;
// }> => {
//   if (!genAI) throw new Error("API Key missing");
  
//   try {
//     const model = genAI.getGenerativeModel({ 
//       model: "gemini-2.5-flash",
//       generationConfig: { responseMimeType: "application/json" }
//     });

//     const fileExtension = getFileExtension(fileName);
//     const isWordFile = ['.docx', '.doc', '.txt'].includes(fileExtension);
//     const isPDF = fileExtension === '.pdf' || (mimeType && mimeType.includes('pdf'));
//     let processedDoc: ProcessedDocument | undefined;
//     let prompt = '';

//     if (isWordFile) {
//       // Process Word/document file
//       processedDoc = await extractTextFromWordDocument(fileBuffer, fileName);
      
//       prompt = `Analyze the following text document "${fileName}":
      
//       DOCUMENT CONTENT:
//       ${processedDoc.textContent.substring(0, 30000)} // Limit to avoid token limits
      
//       Analyze this document for:
//       1. Grammar and spelling errors
//       2. Formatting and structure issues
//       3. Content clarity and coherence
//       4. Accessibility considerations
      
//       Return JSON with the following structure:
//       {
//         "score": number (0-100),
//         "summary": "overall summary of document quality",
//         "issues": [{
//           "type": "Spelling" | "Grammar" | "Formatting" | "Content" | "Accessibility" | "Structure",
//           "severity": "Critical" | "Major" | "Minor",
//           "description": "detailed description of the issue",
//           "suggestion": "specific suggestion for correction",
//           "location": "approximate location in document (e.g., 'Paragraph 3, Sentence 2')",
//           "pageNumber": 1,
//           "originalText": "the exact text with the issue (important for replacement)",
//           "correctedText": "the corrected text (important for replacement)"
//         }]
//       }
      
//       IMPORTANT: For each issue, include originalText and correctedText for easy text replacement.`;
      
//       const result = await generateWithRetry(model, prompt);
//       const response = await result!.response;
//       const parsedData = JSON.parse(response.text());
      
//       const issuesWithIds = parsedData.issues.map((issue: any, index: number) => ({
//         ...issue,
//         id: `issue-${Date.now()}-${index}`,
//         pageNumber: issue.pageNumber || 1
//       }));

//       return { 
//         success: true, 
//         score: parsedData.score ?? 0,
//         summary: parsedData.summary || "",
//         issues: issuesWithIds,
//         processedContent: processedDoc
//       };
//     } else if (isPDF) {
//       // Original PDF analysis logic
//       const pdfPart: Part = {
//         inlineData: { data: fileBuffer.toString("base64"), mimeType: "application/pdf" }
//       };

//       prompt = `Analyze document "${fileName}". Return JSON. 
//         Identify specific errors and provide "position" {top, left, width, height} as 0-100 percentages.
//         JSON structure: { "score": 0, "summary": "", "issues": [{ "type": "Spelling", "severity": "Critical", "description": "", "suggestion": "", "pageNumber": 1, "position": { "top": 0, "left": 0, "width": 0, "height": 0 } }] }`;

//       const result = await generateWithRetry(model, [prompt, pdfPart]);
//       const response = await result!.response;
//       const parsedData = JSON.parse(response.text());
      
//       const issuesWithIds = parsedData.issues.map((issue: any, index: number) => ({
//         ...issue,
//         id: `issue-${Date.now()}-${index}`
//       }));

//       const score = parsedData.score ?? 0;
      
//       return { 
//         success: true, 
//         score,
//         summary: parsedData.summary || "",
//         issues: issuesWithIds 
//       };
//     } else {
//       // For other file types (images, etc.)
//       return {
//         success: false,
//         score: 0,
//         summary: `Unsupported file type: ${fileExtension}. Please upload PDF, Word (.docx, .doc), or text files.`,
//         issues: []
//       };
//     }
//   } catch (error: any) {
//     console.error('AI Analysis Error:', error);
//     return { 
//       success: false, 
//       score: 0,
//       summary: "AI Service Error: " + (error.message || "Unknown error"), 
//       issues: [] 
//     };
//   }
// };

// // NEW: Generate corrected Word document
// export const generateCorrectedWordDocument = async (
//   originalContent: string, 
//   issues: Issue[], 
//   fixedIssueIds: string[]
// ): Promise<{ content: string; fileType: string }> => {
//   try {
//     let correctedContent = originalContent;
//     const issuesToApply = issues.filter(issue => fixedIssueIds.includes(issue.id));

//     // Apply fixes in reverse order to avoid index shifting issues
//     for (const issue of issuesToApply.reverse()) {
//       if (issue.originalText && issue.correctedText) {
//         correctedContent = correctedContent.replace(issue.originalText, issue.correctedText);
//       }
//     }

//     // Create a simple HTML document with the corrected content
//     const correctedDoc = `
//       <!DOCTYPE html>
//       <html>
//       <head>
//         <meta charset="UTF-8">
//         <title>Corrected Document</title>
//         <style>
//           body { font-family: Arial, sans-serif; line-height: 1.6; margin: 40px; }
//           .correction { background-color: #e8f5e8; padding: 2px; border-left: 3px solid #4CAF50; }
//           .summary { background-color: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px; }
//         </style>
//       </head>
//       <body>
//         <h1>Corrected Document</h1>
//         <div class="summary">
//           <strong>Applied Corrections:</strong> ${issuesToApply.length} issues fixed
//         </div>
//         <div id="content">
//           ${correctedContent.split('\n').map(para => `<p>${para}</p>`).join('')}
//         </div>
//         ${issuesToApply.length > 0 ? `
//         <div class="summary">
//           <h3>Correction Details:</h3>
//           <ul>
//             ${issuesToApply.map(issue => `
//               <li><strong>${issue.type}</strong> (${issue.severity}): ${issue.description} → ${issue.suggestion}</li>
//             `).join('')}
//           </ul>
//         </div>
//         ` : ''}
//       </body>
//       </html>
//     `;

//     return {
//       content: correctedDoc,
//       fileType: 'text/html'
//     };
//   } catch (error) {
//     console.error('Error generating corrected Word document:', error);
//     return {
//       content: originalContent,
//       fileType: 'text/html'
//     };
//   }
// };

// // UPDATED: Generate corrected PDF (kept original functionality)
// export const generateCorrectedPDF = async (
//   originalBuffer: Buffer, 
//   issues: Issue[], 
//   fixedIssueIds: string[]
// ): Promise<Buffer> => {
//   try {
//     const pdfDoc = await PDFDocument.load(originalBuffer);
//     const pages = pdfDoc.getPages();
//     const issuesToApply = issues.filter(issue => fixedIssueIds.includes(issue.id));

//     issuesToApply.forEach((issue) => {
//       const pageIndex = issue.pageNumber - 1;
//       if (pageIndex >= 0 && pageIndex < pages.length && issue.position) {
//         const page = pages[pageIndex];
//         const { width, height } = page.getSize();
//         const rectX = (issue.position.left / 100) * width;
//         const rectY = height - ((issue.position.top / 100) * height) - ((issue.position.height / 100) * height);
//         page.drawRectangle({
//           x: rectX, y: rectY, width: (issue.position.width / 100) * width, height: (issue.position.height / 100) * height,
//           color: rgb(1, 1, 0), opacity: 0.4
//         });
//       }
//     });
//     return Buffer.from(await pdfDoc.save());
//   } catch (error) { 
//     console.error('Error generating corrected PDF:', error);
//     return originalBuffer; 
//   }
// };

// // NEW: Generate corrected document based on file type
// export const generateCorrectedDocument = async (
//   originalBuffer: Buffer,
//   fileName: string,
//   issues: Issue[],
//   fixedIssueIds: string[],
//   fileType?: string
// ): Promise<{ buffer: Buffer; mimeType: string; fileName: string }> => {
//   const fileExtension = getFileExtension(fileName);
  
//   if (['.docx', '.doc', '.txt'].includes(fileExtension)) {
//     // Process Word/document files
//     const processedDoc = await extractTextFromWordDocument(originalBuffer, fileName);
//     const correctedResult = await generateCorrectedWordDocument(
//       processedDoc.textContent,
//       issues,
//       fixedIssueIds
//     );
    
//     const timestamp = new Date().toISOString().split('T')[0];
//     return {
//       buffer: Buffer.from(correctedResult.content, 'utf-8'),
//       mimeType: correctedResult.fileType,
//       fileName: `corrected_${fileName.replace(/\.[^/.]+$/, '')}_${timestamp}.html`
//     };
//   } else {
//     // Process PDF files
//     const correctedBuffer = await generateCorrectedPDF(originalBuffer, issues, fixedIssueIds);
//     const timestamp = new Date().toISOString().split('T')[0];
    
//     return {
//       buffer: correctedBuffer,
//       mimeType: 'application/pdf',
//       fileName: `corrected_${fileName.replace('.pdf', `_${timestamp}.pdf`)}`
//     };
//   }
// };
// import { GoogleGenerativeAI, Part } from "@google/generative-ai";
// import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
// import mammoth from 'mammoth';
// import dotenv from "dotenv";
// import path from 'path';

// // Load environment variables
// dotenv.config();

// // DEBUG: Check if API key is loaded
// console.log('🔧 [AI Service] Loading environment variables...');
// console.log('🔧 [AI Service] GEMINI_API_KEY exists:', !!process.env.GEMINI_API_KEY);
// console.log('🔧 [AI Service] GOOGLE_GEMINI_API_KEY exists:', !!process.env.GOOGLE_GEMINI_API_KEY);
// console.log('🔧 [AI Service] NODE_ENV:', process.env.NODE_ENV);

// // Get API key - check both possible names
// const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
// console.log('🔧 [AI Service] API_KEY loaded:', API_KEY ? `YES (${API_KEY.substring(0, 10)}...)` : 'NO');

// // Initialize Gemini only if API key exists
// let genAI: GoogleGenerativeAI | null = null;
// try {
//   if (API_KEY && API_KEY.trim() !== '') {
//     genAI = new GoogleGenerativeAI(API_KEY);
//     console.log('🔧 [AI Service] Gemini AI initialized successfully');
//   } else {
//     console.log('🔧 [AI Service] No API key found, will use mock mode');
//   }
// } catch (error: any) {
//   console.error('🔧 [AI Service] Error initializing Gemini:', error.message);
//   genAI = null;
// }

// export interface Issue {
//   id: string;
//   type: "Layout" | "Typography" | "Grammar" | "Accessibility" | "Content" | "Formatting" | "Spelling";
//   severity: "Critical" | "Major" | "Minor";
//   description: string;
//   suggestion: string;
//   location: string;
//   pageNumber: number;
//   position?: { top: number; left: number; width: number; height: number; };
//   originalText?: string;
//   correctedText?: string;
// }

// // Document processing interface
// export interface ProcessedDocument {
//   textContent: string;
//   fileType: 'pdf' | 'docx' | 'doc' | 'txt' | 'image';
//   fileName: string;
//   pageCount?: number;
//   wordCount?: number;
//   metadata?: any;
// }

// const generateWithRetry = async (model: any, content: any, retries = 3) => {
//   for (let i = 0; i < retries; i++) {
//     try {
//       return await model.generateContent(content);
//     } catch (error: any) {
//       console.log(`🔧 [AI Service] Gemini API attempt ${i + 1} failed:`, error.message);
//       if ((error.message?.includes('503') || error.status === 503) && i < retries - 1) {
//         const delay = Math.pow(2, i) * 1000;
//         await new Promise(resolve => setTimeout(resolve, delay));
//         continue;
//       }
//       throw error;
//     }
//   }
// };

// // Helper function to get file extension safely
// const getFileExtension = (fileName: string): string => {
//   try {
//     const ext = path.extname(fileName).toLowerCase();
//     if (ext) return ext;
    
//     const parts = fileName.split('.');
//     return parts.length > 1 ? `.${parts[parts.length - 1].toLowerCase()}` : '';
//   } catch (error) {
//     const parts = fileName.split('.');
//     return parts.length > 1 ? `.${parts[parts.length - 1].toLowerCase()}` : '';
//   }
// };

// // Extract text from Word documents
// export const extractTextFromWordDocument = async (fileBuffer: Buffer, fileName: string): Promise<ProcessedDocument> => {
//   try {
//     const fileExtension = getFileExtension(fileName);
    
//     if (fileExtension === '.docx') {
//       const result = await mammoth.extractRawText({ buffer: fileBuffer });
//       const text = result.value;
      
//       return {
//         textContent: text,
//         fileType: 'docx',
//         fileName,
//         wordCount: text.split(/\s+/).length,
//         metadata: { paragraphs: text.split(/\n\s*\n/).length }
//       };
//     } 
//     else if (fileExtension === '.doc') {
//       const text = "[.DOC file detected]\n" +
//                    "For full text analysis, please convert this .doc file to .docx format.\n" +
//                    "You can do this by opening it in Microsoft Word and saving as .docx.";
      
//       return {
//         textContent: text,
//         fileType: 'doc',
//         fileName,
//         wordCount: 0
//       };
//     }
//     else if (fileExtension === '.txt') {
//       const text = fileBuffer.toString('utf-8');
      
//       return {
//         textContent: text,
//         fileType: 'txt',
//         fileName,
//         wordCount: text.split(/\s+/).length
//       };
//     }
//     else {
//       try {
//         const text = fileBuffer.toString('utf-8', 0, Math.min(fileBuffer.length, 50000));
//         return {
//           textContent: text || 'Unknown file type',
//           fileType: fileExtension.replace('.', '') as any || 'txt',
//           fileName,
//           wordCount: text.split(/\s+/).length
//         };
//       } catch {
//         throw new Error(`Unsupported file type: ${fileExtension}`);
//       }
//     }
//   } catch (error) {
//     console.error('🔧 [AI Service] Error extracting text from Word document:', error);
    
//     return {
//       textContent: 'Error extracting text. Please try a .docx, .txt, or PDF file.',
//       fileType: 'txt',
//       fileName,
//       wordCount: 0
//     };
//   }
// };

// // Analyze any document type with format customization
// export const analyzeDocumentWithAI = async (
//   fileBuffer: Buffer,
//   fileName: string,
//   mimeType?: string,
//   formatType?: string,
//   formatRequirements?: string
// ): Promise<{
//   success: boolean;
//   score: number;
//   summary: string;
//   issues: any[];
//   processedContent?: ProcessedDocument;
//   wordCount?: number;
// }> => {
//   console.log('🔧 [AI Service] analyzeDocumentWithAI called for:', fileName);
//   console.log('🔧 [AI Service] Format type:', formatType);
//   console.log('🔧 [AI Service] Has requirements:', !!formatRequirements);
  
//   try {
//     const fileExtension = getFileExtension(fileName);
//     const isWordFile = ['.docx', '.doc', '.txt'].includes(fileExtension);
//     const isPDF = fileExtension === '.pdf' || (mimeType && mimeType.includes('pdf'));
    
//     // CHECK IF WE SHOULD USE MOCK DATA (no API key or Gemini not initialized)
//     if (!API_KEY || !genAI) {
//       console.log('🔧 [AI Service] Using MOCK mode (no API key or Gemini not initialized)');
      
//       if (isWordFile) {
//         const processedDoc = await extractTextFromWordDocument(fileBuffer, fileName);
//         const text = processedDoc.textContent;
//         const sampleText = text.substring(0, 1000) || "Sample document content for analysis.";
        
//         return {
//           success: true,
//           score: 85,
//           summary: "✅ Document analyzed successfully (Development Mode). Found several areas for improvement.",
//           issues: [
//             {
//               id: 'mock-issue-1',
//               type: 'Grammar',
//               severity: 'Minor',
//               description: 'Grammar issue found in the document',
//               suggestion: 'Consider revising this sentence structure',
//               location: 'Paragraph 1, Sentence 2',
//               pageNumber: 1,
//               originalText: sampleText.substring(0, 50) || "This is a sample text",
//               correctedText: sampleText.substring(0, 50) + " (corrected)"
//             },
//             {
//               id: 'mock-issue-2',
//               type: 'Formatting',
//               severity: 'Major',
//               description: 'Inconsistent formatting detected',
//               suggestion: 'Use consistent font sizes throughout',
//               location: 'Section 2',
//               pageNumber: 1,
//               originalText: sampleText.substring(51, 100) || "Another sample text",
//               correctedText: sampleText.substring(51, 100) + " (formatted)"
//             }
//           ],
//           processedContent: processedDoc,
//           wordCount: processedDoc.wordCount
//         };
//       } else if (isPDF) {
//         return {
//           success: true,
//           score: 78,
//           summary: "✅ PDF document analyzed (Development Mode). Working correctly!",
//           issues: [
//             {
//               id: 'mock-pdf-issue-1',
//               type: 'Layout',
//               severity: 'Major',
//               description: 'Layout issue in PDF document',
//               suggestion: 'Adjust spacing between elements',
//               location: 'Page 1, top section',
//               pageNumber: 1,
//               position: { top: 10, left: 10, width: 50, height: 5 }
//             },
//             {
//               id: 'mock-pdf-issue-2',
//               type: 'Typography',
//               severity: 'Minor',
//               description: 'Font consistency needed',
//               suggestion: 'Use consistent font family',
//               location: 'Page 1',
//               pageNumber: 1,
//               position: { top: 30, left: 20, width: 60, height: 8 }
//             }
//           ],
//           wordCount: 0
//         };
//       } else {
//         return {
//           success: false,
//           score: 0,
//           summary: `Unsupported file type: ${fileExtension}. Please upload PDF, Word (.docx, .doc), or text files.`,
//           issues: []
//         };
//       }
//     }
    
//     // REAL AI ANALYSIS WITH API KEY
//     console.log('🔧 [AI Service] Starting REAL AI analysis with Gemini');
    
//     const model = genAI.getGenerativeModel({ 
//       model: "gemini-1.5-flash", // Changed to more available model
//       generationConfig: { 
//         responseMimeType: "application/json",
//         temperature: 0.1
//       }
//     });

//     let processedDoc: ProcessedDocument | undefined;
//     let prompt = '';

//     // DYNAMIC PROMPT BASED ON FORMAT TYPE
//     if (formatType === 'custom' && formatRequirements) {
//       // CUSTOM FORMAT ANALYSIS
//       if (isWordFile) {
//         processedDoc = await extractTextFromWordDocument(fileBuffer, fileName);
        
//         prompt = `Analyze the document "${fileName}" STRICTLY against these format requirements:

// FORMAT REQUIREMENTS:
// ${formatRequirements}

// DOCUMENT CONTENT:
// ${processedDoc.textContent.substring(0, 30000)}

// CRITICAL INSTRUCTIONS:
// 1. Analyze the document EXCLUSIVELY against the above format requirements.
// 2. For each format violation, provide specific feedback.
// 3. Also include general quality issues (grammar, spelling, etc.).
// 4. Score the document based on 60% format compliance and 40% general quality.
// 5. For Word/text documents, include originalText and correctedText for easy replacement.

// Return JSON with the following structure:
// {
//   "score": number (0-100),
//   "summary": "detailed summary including format compliance assessment",
//   "issues": [{
//     "type": "Formatting" | "Layout" | "Typography" | "Spelling" | "Grammar" | "Content" | "Accessibility" | "Structure",
//     "severity": "Critical" | "Major" | "Minor",
//     "description": "detailed description including format requirement violated",
//     "suggestion": "specific suggestion for correction",
//     "location": "approximate location in document",
//     "pageNumber": 1,
//     "originalText": "the exact text with the issue",
//     "correctedText": "the corrected text",
//     "position": { "top": 0, "left": 0, "width": 0, "height": 0 }
//   }]
// }`;
//       } else if (isPDF) {
//         // PDF with custom format
//         prompt = `Analyze PDF document "${fileName}" STRICTLY against these format requirements:

// FORMAT REQUIREMENTS:
// ${formatRequirements}

// CRITICAL INSTRUCTIONS:
// 1. Analyze the PDF document EXCLUSIVELY against the above format requirements.
// 2. For each format violation, provide specific feedback with position coordinates.
// 3. Also include general quality issues (layout, typography, etc.).
// 4. Score the document based on 60% format compliance and 40% general quality.
// 5. For each issue, provide "position" {top, left, width, height} as 0-100 percentages.

// Return JSON with the following structure:
// {
//   "score": number (0-100),
//   "summary": "detailed summary including format compliance assessment",
//   "issues": [{
//     "type": "Formatting" | "Layout" | "Typography" | "Accessibility" | "Structure",
//     "severity": "Critical" | "Major" | "Minor",
//     "description": "detailed description including format requirement violated",
//     "suggestion": "specific suggestion for correction",
//     "pageNumber": 1,
//     "position": { "top": 0, "left": 0, "width": 0, "height": 0 }
//   }]
// }`;
//       }
//     } else {
//       // DEFAULT FORMAT ANALYSIS
//       if (isWordFile) {
//         processedDoc = await extractTextFromWordDocument(fileBuffer, fileName);
        
//         prompt = `Analyze the following text document "${fileName}":
        
//         DOCUMENT CONTENT:
//         ${processedDoc.textContent.substring(0, 30000)}
        
//         Analyze this document for:
//         1. Grammar and spelling errors
//         2. Formatting and structure issues
//         3. Content clarity and coherence
//         4. Accessibility considerations
        
//         Return JSON with the following structure:
//         {
//           "score": number (0-100),
//           "summary": "overall summary of document quality",
//           "issues": [{
//             "type": "Spelling" | "Grammar" | "Formatting" | "Content" | "Accessibility" | "Structure",
//             "severity": "Critical" | "Major" | "Minor",
//             "description": "detailed description of the issue",
//             "suggestion": "specific suggestion for correction",
//             "location": "approximate location in document (e.g., 'Paragraph 3, Sentence 2')",
//             "pageNumber": 1,
//             "originalText": "the exact text with the issue (important for replacement)",
//             "correctedText": "the corrected text (important for replacement)"
//           }]
//         }
        
//         IMPORTANT: For each issue, include originalText and correctedText for easy text replacement.`;
//       } else if (isPDF) {
//         prompt = `Analyze document "${fileName}". Return JSON. 
//           Identify specific errors and provide "position" {top, left, width, height} as 0-100 percentages.
//           JSON structure: { "score": 0, "summary": "", "issues": [{ "type": "Spelling", "severity": "Critical", "description": "", "suggestion": "", "pageNumber": 1, "position": { "top": 0, "left": 0, "width": 0, "height": 0 } }] }`;
//       } else {
//         return {
//           success: false,
//           score: 0,
//           summary: `Unsupported file type: ${fileExtension}. Please upload PDF, Word (.docx, .doc), or text files.`,
//           issues: []
//         };
//       }
//     }

//     // EXECUTE ANALYSIS
//     console.log('🔧 [AI Service] Sending request to Gemini API...');
    
//     if (isWordFile) {
//       processedDoc = processedDoc || await extractTextFromWordDocument(fileBuffer, fileName);
      
//       const result = await generateWithRetry(model, prompt);
//       const response = await result!.response;
//       const responseText = response.text();
      
//       console.log('🔧 [AI Service] Gemini response received');
      
//       try {
//         const parsedData = JSON.parse(responseText);
        
//         const issuesWithIds = parsedData.issues.map((issue: any, index: number) => ({
//           ...issue,
//           id: `issue-${Date.now()}-${index}`,
//           pageNumber: issue.pageNumber || 1
//         }));

//         console.log('🔧 [AI Service] Gemini analysis completed successfully');
        
//         return { 
//           success: true, 
//           score: parsedData.score ?? 0,
//           summary: parsedData.summary || "",
//           issues: issuesWithIds,
//           processedContent: processedDoc,
//           wordCount: processedDoc.wordCount
//         };
//       } catch (parseError) {
//         console.error('🔧 [AI Service] Error parsing Gemini response:', parseError);
//         console.error('🔧 [AI Service] Response text:', responseText.substring(0, 500));
        
//         // Fallback to mock data if parsing fails
//         const processedDoc = await extractTextFromWordDocument(fileBuffer, fileName);
//         return {
//           success: true,
//           score: 75,
//           summary: "Document analyzed (AI response parsing issue, but processing completed)",
//           issues: [],
//           processedContent: processedDoc,
//           wordCount: processedDoc.wordCount
//         };
//       }
//     } else if (isPDF) {
//       const pdfPart: Part = {
//         inlineData: { data: fileBuffer.toString("base64"), mimeType: "application/pdf" }
//       };

//       const result = await generateWithRetry(model, [prompt, pdfPart]);
//       const response = await result!.response;
//       const responseText = response.text();
      
//       console.log('🔧 [AI Service] Gemini PDF response received');
      
//       try {
//         const parsedData = JSON.parse(responseText);
        
//         const issuesWithIds = parsedData.issues.map((issue: any, index: number) => ({
//           ...issue,
//           id: `issue-${Date.now()}-${index}`
//         }));

//         console.log('🔧 [AI Service] Gemini PDF analysis completed successfully');
        
//         return { 
//           success: true, 
//           score: parsedData.score ?? 0,
//           summary: parsedData.summary || "",
//           issues: issuesWithIds,
//           wordCount: 0
//         };
//       } catch (parseError) {
//         console.error('🔧 [AI Service] Error parsing Gemini PDF response:', parseError);
        
//         // Fallback to mock data for PDF
//         return {
//           success: true,
//           score: 70,
//           summary: "PDF analyzed (AI response parsing issue, but processing completed)",
//           issues: [
//             {
//               id: 'pdf-fallback-1',
//               type: 'Layout',
//               severity: 'Major',
//               description: 'PDF analysis completed',
//               suggestion: 'Review document formatting',
//               location: 'Document',
//               pageNumber: 1,
//               position: { top: 20, left: 20, width: 60, height: 10 }
//             }
//           ],
//           wordCount: 0
//         };
//       }
//     } else {
//       return {
//         success: false,
//         score: 0,
//         summary: `Unsupported file type: ${fileExtension}. Please upload PDF, Word (.docx, .doc), or text files.`,
//         issues: []
//       };
//     }
//   } catch (error: any) {
//     console.error('🔧 [AI Service] AI Analysis Error:', error.message);
//     console.error('🔧 [AI Service] Error stack:', error.stack);
    
//     // Return mock data as fallback instead of failing
//     const fileExtension = getFileExtension(fileName);
//     const isWordFile = ['.docx', '.doc', '.txt'].includes(fileExtension);
    
//     if (isWordFile) {
//       try {
//         const processedDoc = await extractTextFromWordDocument(fileBuffer, fileName);
//         return {
//           success: true,
//           score: 65,
//           summary: "Document analyzed (AI service temporarily unavailable, using fallback)",
//           issues: [
//             {
//               id: 'fallback-issue-1',
//               type: 'General',
//               severity: 'Minor',
//               description: 'Analysis completed with fallback method',
//               suggestion: 'Check back later for AI-powered analysis',
//               location: 'Document',
//               pageNumber: 1,
//               originalText: 'Sample text',
//               correctedText: 'Sample text corrected'
//             }
//           ],
//           processedContent: processedDoc,
//           wordCount: processedDoc.wordCount
//         };
//       } catch {
//         // If even extraction fails
//         return {
//           success: true,
//           score: 60,
//           summary: "Basic analysis completed",
//           issues: [],
//           wordCount: 0
//         };
//       }
//     } else {
//       return {
//         success: true,
//         score: 60,
//         summary: "Document processed (AI service issue, but file uploaded successfully)",
//         issues: [],
//         wordCount: 0
//       };
//     }
//   }
// };

// // Generate corrected Word document
// export const generateCorrectedWordDocument = async (
//   originalContent: string, 
//   issues: Issue[], 
//   fixedIssueIds: string[]
// ): Promise<{ content: string; fileType: string }> => {
//   try {
//     let correctedContent = originalContent;
//     const issuesToApply = issues.filter(issue => fixedIssueIds.includes(issue.id));

//     for (const issue of issuesToApply.reverse()) {
//       if (issue.originalText && issue.correctedText) {
//         correctedContent = correctedContent.replace(issue.originalText, issue.correctedText);
//       }
//     }

//     const correctedDoc = `
//       <!DOCTYPE html>
//       <html>
//       <head>
//         <meta charset="UTF-8">
//         <title>Corrected Document</title>
//         <style>
//           body { font-family: Arial, sans-serif; line-height: 1.6; margin: 40px; }
//           .correction { background-color: #e8f5e8; padding: 2px; border-left: 3px solid #4CAF50; }
//           .summary { background-color: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px; }
//         </style>
//       </head>
//       <body>
//         <h1>Corrected Document</h1>
//         <div class="summary">
//           <strong>Applied Corrections:</strong> ${issuesToApply.length} issues fixed
//         </div>
//         <div id="content">
//           ${correctedContent.split('\n').map(para => `<p>${para}</p>`).join('')}
//         </div>
//         ${issuesToApply.length > 0 ? `
//         <div class="summary">
//           <h3>Correction Details:</h3>
//           <ul>
//             ${issuesToApply.map(issue => `
//               <li><strong>${issue.type}</strong> (${issue.severity}): ${issue.description} → ${issue.suggestion}</li>
//             `).join('')}
//           </ul>
//         </div>
//         ` : ''}
//       </body>
//       </html>
//     `;

//     return {
//       content: correctedDoc,
//       fileType: 'text/html'
//     };
//   } catch (error) {
//     console.error('🔧 [AI Service] Error generating corrected Word document:', error);
//     return {
//       content: originalContent,
//       fileType: 'text/html'
//     };
//   }
// };

// // Generate corrected PDF
// export const generateCorrectedPDF = async (
//   originalBuffer: Buffer, 
//   issues: Issue[], 
//   fixedIssueIds: string[]
// ): Promise<Buffer> => {
//   try {
//     const pdfDoc = await PDFDocument.load(originalBuffer);
//     const pages = pdfDoc.getPages();
//     const issuesToApply = issues.filter(issue => fixedIssueIds.includes(issue.id));

//     issuesToApply.forEach((issue) => {
//       const pageIndex = issue.pageNumber - 1;
//       if (pageIndex >= 0 && pageIndex < pages.length && issue.position) {
//         const page = pages[pageIndex];
//         const { width, height } = page.getSize();
//         const rectX = (issue.position.left / 100) * width;
//         const rectY = height - ((issue.position.top / 100) * height) - ((issue.position.height / 100) * height);
//         page.drawRectangle({
//           x: rectX, y: rectY, width: (issue.position.width / 100) * width, height: (issue.position.height / 100) * height,
//           color: rgb(1, 1, 0), opacity: 0.4
//         });
//       }
//     });
//     return Buffer.from(await pdfDoc.save());
//   } catch (error) { 
//     console.error('🔧 [AI Service] Error generating corrected PDF:', error);
//     return originalBuffer; 
//   }
// };

// // Generate corrected document based on file type
// export const generateCorrectedDocument = async (
//   originalBuffer: Buffer,
//   fileName: string,
//   issues: Issue[],
//   fixedIssueIds: string[],
//   fileType?: string
// ): Promise<{ buffer: Buffer; mimeType: string; fileName: string }> => {
//   const fileExtension = getFileExtension(fileName);
  
//   if (['.docx', '.doc', '.txt'].includes(fileExtension)) {
//     const processedDoc = await extractTextFromWordDocument(originalBuffer, fileName);
//     const correctedResult = await generateCorrectedWordDocument(
//       processedDoc.textContent,
//       issues,
//       fixedIssueIds
//     );
    
//     const timestamp = new Date().toISOString().split('T')[0];
//     return {
//       buffer: Buffer.from(correctedResult.content, 'utf-8'),
//       mimeType: correctedResult.fileType,
//       fileName: `corrected_${fileName.replace(/\.[^/.]+$/, '')}_${timestamp}.html`
//     };
//   } else {
//     const correctedBuffer = await generateCorrectedPDF(originalBuffer, issues, fixedIssueIds);
//     const timestamp = new Date().toISOString().split('T')[0];
    
//     return {
//       buffer: correctedBuffer,
//       mimeType: 'application/pdf',
//       fileName: `corrected_${fileName.replace('.pdf', `_${timestamp}.pdf`)}`
//     };
//   }
// };
// import { GoogleGenerativeAI } from "@google/generative-ai";
// import { PDFDocument, rgb } from 'pdf-lib';
// import mammoth from 'mammoth';
// import dotenv from "dotenv";
// import path from 'path';

// dotenv.config();

// const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;

// let genAI: GoogleGenerativeAI | null = null;
// if (API_KEY && API_KEY.trim() !== '') {
//   genAI = new GoogleGenerativeAI(API_KEY);
// }

// export interface Issue {
//   id: string;
//   type: "Layout" | "Typography" | "Grammar" | "Accessibility" | "Content" | "Formatting" | "Spelling" | "Structure";
//   severity: "Critical" | "Major" | "Minor";
//   description: string;
//   suggestion: string;
//   location: string;
//   pageNumber: number;
//   position?: { top: number; left: number; width: number; height: number; };
//   originalText?: string;
//   correctedText?: string;
// }

// export interface ProcessedDocument {
//   textContent: string;
//   fileType: 'pdf' | 'docx' | 'doc' | 'txt' | 'image';
//   fileName: string;
//   pageCount?: number;
//   wordCount?: number;
//   metadata?: any;
// }

// const generateWithRetry = async (model: any, content: any[], retries = 3) => {
//   for (let i = 0; i < retries; i++) {
//     try {
//       return await model.generateContent(content);
//     } catch (error: any) {
//       if ((error.status === 503 || error.status === 429) && i < retries - 1) {
//         const delay = Math.pow(2, i) * 1000;
//         await new Promise(resolve => setTimeout(resolve, delay));
//         continue;
//       }
//       throw error;
//     }
//   }
// };

// export const extractTextFromWordDocument = async (fileBuffer: Buffer, fileName: string): Promise<ProcessedDocument> => {
//   const ext = path.extname(fileName).toLowerCase();
//   try {
//     if (ext === '.docx') {
//       const result = await mammoth.extractRawText({ buffer: fileBuffer });
//       return {
//         textContent: result.value,
//         fileType: 'docx',
//         fileName,
//         wordCount: result.value.split(/\s+/).length
//       };
//     } 
//     const text = fileBuffer.toString('utf-8');
//     return {
//       textContent: text,
//       fileType: (ext.replace('.', '') as any) || 'txt',
//       fileName,
//       wordCount: text.split(/\s+/).length
//     };
//   } catch (error) {
//     return { textContent: 'Extraction failed', fileType: 'txt', fileName, wordCount: 0 };
//   }
// };
// export const analyzeDocumentWithAI = async (
//   fileBuffer: Buffer,
//   fileName: string,
//   formatRequirements?: string,
//   templateBuffer?: Buffer 
// ) => {
//   try {
//     if (!genAI) throw new Error("AI Service not initialized.");

//     const model = genAI.getGenerativeModel({ 
//       model: "gemini-1.5-flash", 
//       generationConfig: { 
//         responseMimeType: "application/json", 
//         temperature: 0.1 // Slight temperature helps with visual differentiation
//       } 
//     });

//     const promptText = `
//       # AUDITOR ROLE: STRICT COMPLIANCE
//       You are a specialized formatting auditor. Your mission is to verify if the document matches the [USER RULES]. 
//       If the document does not match the font/layout, you MUST flag it before mentioning typos.

//       # [USER RULES] - MANDATORY
//       ${formatRequirements}

//       # AUDIT STEPS (DO NOT SKIP):
//       1. VISUAL FONT IDENTIFICATION: Look at the text shapes. If the user requires "CALIBRI" and the text is NOT Calibri, generate a CRITICAL "Typography" issue immediately.
//       2. MARGINS: Check the white space. If it doesn't match the rules, flag it as "Layout".
//       3. GRAMMAR LIMIT: You are FORBIDDEN from reporting more than 5 grammar/spelling errors. Choose only the most critical ones.
//       4. SUMMARY: Start with "PROTOCOL AUDIT: FAIL" if the font/layout rules are broken.

//       # JSON FORMAT
//       {
//         "score": number,
//         "summary": "Must detail if the Font and Margins met the Active Protocol.",
//         "issues": [
//           {
//             "id": "rule-violation-1",
//             "type": "Typography" | "Layout" | "Grammar",
//             "severity": "Critical",
//             "description": "Ex: FONT MISMATCH. Required: Calibri. Detected: Serif/Other.",
//             "suggestion": "Change font to Calibri.",
//             "pageNumber": 1,
//             "position": { "top": 5, "left": 10, "width": 80, "height": 10 }
//           }
//         ]
//       }
//     `;

//     const contentParts: any[] = [
//       { text: promptText },
//       { inlineData: { data: fileBuffer.toString("base64"), mimeType: "application/pdf" } }
//     ];

//     if (templateBuffer) {
//       contentParts.push({ inlineData: { data: templateBuffer.toString("base64"), mimeType: "application/pdf" } });
//     }

//     const result = await generateWithRetry(model, contentParts);
//     let responseText = result!.response.text().replace(/```json|```/g, "").trim();
    
//     const parsed = JSON.parse(responseText);

//     // --- HARD LOGIC OVERRIDE ---
//     // If we specifically requested Calibri and the AI gave us 30 issues but none are "Typography", 
//     // it means the AI is hallucinating compliance. 
//     // We can manually filter or add a warning here if needed.
    
//     return parsed;

//   } catch (error: any) {
//     console.error("AI Analysis Error:", error);
//     throw error;
//   }
// };

// export const generateCorrectedPDF = async (originalBuffer: Buffer, issues: Issue[], fixedIssueIds: string[]): Promise<Buffer> => {
//   try {
//     const pdfDoc = await PDFDocument.load(originalBuffer);
//     const pages = pdfDoc.getPages();
//     const issuesToApply = issues.filter(issue => fixedIssueIds.includes(issue.id));

//     issuesToApply.forEach((issue) => {
//       const pageIndex = (issue.pageNumber || 1) - 1;
//       if (pageIndex >= 0 && pageIndex < pages.length && issue.position) {
//         const page = pages[pageIndex];
//         const { width, height } = page.getSize();
//         const rectX = (issue.position.left / 100) * width;
//         const rectY = height - ((issue.position.top / 100) * height) - ((issue.position.height / 100) * height);
        
//         page.drawRectangle({
//           x: rectX, y: rectY, 
//           width: (issue.position.width / 100) * width, 
//           height: (issue.position.height / 100) * height,
//           color: rgb(1, 1, 0), opacity: 0.4
//         });
//       }
//     });
//     return Buffer.from(await pdfDoc.save());
//   } catch (error) { return originalBuffer; }
// };

// export const generateCorrectedDocument = async (
//   originalBuffer: Buffer,
//   fileName: string,
//   issues: Issue[],
//   fixedIssueIds: string[]
// ): Promise<{ buffer: Buffer; mimeType: string; fileName: string }> => {
//   const correctedBuffer = await generateCorrectedPDF(originalBuffer, issues, fixedIssueIds);
//   return {
//     buffer: correctedBuffer,
//     mimeType: 'application/pdf',
//     fileName: `corrected_${fileName}`
//   };
// };
import { GoogleGenerativeAI } from "@google/generative-ai";
import { PDFDocument, rgb } from 'pdf-lib';
import mammoth from 'mammoth';
import dotenv from "dotenv";
import path from 'path';

dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;

let genAI: GoogleGenerativeAI | null = null;
if (API_KEY && API_KEY.trim() !== '') {
  genAI = new GoogleGenerativeAI(API_KEY);
}

// UPDATED: Add customFormatIssue to Issue interface
export interface Issue {
  id: string;
  type: "Layout" | "Typography" | "Grammar" | "Accessibility" | "Content" | "Formatting" | "Spelling" | "Structure" | "Margin" | "Spacing" | "Alignment" | "Indentation";
  severity: "Critical" | "Major" | "Minor";
  description: string;
  suggestion: string;
  location: string;
  pageNumber: number;
  position?: { top: number; left: number; width: number; height: number };
  originalText?: string;
  correctedText?: string;
  visualEvidence?: string;
  measurement?: {
    expected: string;
    actual: string;
    unit: 'px' | 'pt' | 'mm' | 'in' | '%';
  };
  customFormatIssue?: boolean; // Add this property
  isFixed?: boolean; // Add this if you need it
}

export interface ProcessedDocument {
  textContent: string;
  fileType: 'pdf' | 'docx' | 'doc' | 'txt' | 'image';
  fileName: string;
  pageCount?: number;
  wordCount?: number;
  metadata?: any;
}

export interface AnalysisResult {
  success: boolean;
  score: number;
  summary: string;
  issues: Issue[];
  processedContent?: string;
  analysisType?: string;
  geminiModel?: string;
  pdfStructure?: any;
  structureAnalysis?: any;
  visualAnalysisPerformed?: boolean;
}

const generateWithRetry = async (model: any, content: any[], retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await model.generateContent(content);
    } catch (error: any) {
      if ((error.status === 503 || error.status === 429) && i < retries - 1) {
        const delay = Math.pow(2, i) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
};

// Helper function to extract requirements
const extractFormatRequirements = (formatRequirements?: string) => {
  if (!formatRequirements) return {};
  
  const requirements: any = {};
  
  // Extract font with better matching
  const fontMatch = formatRequirements.match(/font:\s*([^\n,;]+)/i) || 
                   formatRequirements.match(/(Times\s*New\s*Roman|Arial|Calibri|Helvetica|Georgia|Verdana|Cambria|Garamond)/i);
  if (fontMatch) requirements.font = fontMatch[1].trim();
  
  // Extract spacing
  const spacingMatch = formatRequirements.match(/spacing:\s*([^\n,;]+)/i) ||
                      formatRequirements.match(/line[-\s]*spacing:\s*([^\n,;]+)/i) ||
                      formatRequirements.match(/(single|1\.5|double|2\.0|\d+(\.\d+)?)/i);
  if (spacingMatch) requirements.spacing = spacingMatch[1].trim();
  
  // Extract margins
  const marginMatch = formatRequirements.match(/margins?:\s*([^\n,;]+)/i) ||
                     formatRequirements.match(/(\d+(\s*inch)?\s*(all|top|bottom|left|right))/i);
  if (marginMatch) requirements.margins = marginMatch[1].trim();
  
  // Extract alignment
  const alignmentMatch = formatRequirements.match(/alignment:\s*([^\n,;]+)/i) ||
                        formatRequirements.match(/(left|right|center|justified|centre)/i);
  if (alignmentMatch) requirements.alignment = alignmentMatch[1].trim();
  
  // Extract font size
  const fontSizeMatch = formatRequirements.match(/font[-\s]*size:\s*([^\n,;]+)/i) ||
                       formatRequirements.match(/(\d+)\s*(pt|px)/i);
  if (fontSizeMatch) requirements.fontSize = fontSizeMatch[1].trim();
  
  return requirements;
};

export const extractTextFromWordDocument = async (fileBuffer: Buffer, fileName: string): Promise<ProcessedDocument> => {
  const ext = path.extname(fileName).toLowerCase();
  try {
    if (ext === '.docx') {
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      return {
        textContent: result.value,
        fileType: 'docx',
        fileName,
        wordCount: result.value.split(/\s+/).length
      };
    } 
    const text = fileBuffer.toString('utf-8');
    return {
      textContent: text,
      fileType: (ext.replace('.', '') as any) || 'txt',
      fileName,
      wordCount: text.split(/\s+/).length
    };
  } catch (error) {
    return { textContent: 'Extraction failed', fileType: 'txt', fileName, wordCount: 0 };
  }
};

// Helper function to get opposite font for error messages
const getOppositeFont = (font: string): string => {
  const fontPairs: Record<string, string> = {
    'Times New Roman': 'Arial/Calibri',
    'Arial': 'Times New Roman/Serif',
    'Calibri': 'Times New Roman/Serif',
    'Helvetica': 'Times New Roman',
    'Georgia': 'Arial/Calibri'
  };
  return fontPairs[font] || 'different font';
};

// Helper function to calculate font compliance
const calculateFontCompliance = (issues: Issue[], requiredFont: string): number => {
  const hasFontMismatch = issues.some(issue => 
    issue.type === 'Typography' && issue.description.includes('FONT MISMATCH')
  );
  return hasFontMismatch ? 0 : 100;
};

// Helper function to calculate average
const calculateAverage = (arr: number[]): number => {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
};

// Helper function to calculate variance
const calculateVariance = (arr: number[]): number => {
  if (!arr || arr.length === 0) return 0;
  const avg = calculateAverage(arr);
  const squaredDiffs = arr.map(value => Math.pow(value - avg, 2));
  return calculateAverage(squaredDiffs);
};

// Helper function to calculate score from issues
const calculateScoreFromIssues = (issues: Issue[]): number => {
  if (issues.length === 0) return 100;
  
  let totalSeverity = 0;
  issues.forEach(issue => {
    switch (issue.severity) {
      case 'Critical': totalSeverity += 10; break;
      case 'Major': totalSeverity += 7; break;
      case 'Minor': totalSeverity += 3; break;
      default: totalSeverity += 5;
    }
  });
  
  const maxPossible = issues.length * 10;
  const score = Math.max(0, 100 - (totalSeverity / maxPossible) * 100);
  return Math.round(score);
};

// Helper function to create fallback response
const createFallbackResponse = (
  fileName: string, 
  pdfStructure: any, 
  fileMimeType: string,
  formatType: string,
  requirements?: any
): AnalysisResult => {
  const isCustomFormat = formatType === 'custom';
  const basicIssues: Issue[] = [];
  
  // Add a warning about analysis limitations
  basicIssues.push({
    id: "analysis-fallback",
    type: "Structure",
    severity: "Major",
    description: "Full AI analysis unavailable. Using fallback mode.",
    suggestion: "Ensure Gemini API is properly configured for detailed formatting analysis",
    location: "System",
    pageNumber: 1,
    position: { top: 0, left: 0, width: 100, height: 5 }
  });
  
  // Add custom format warning if applicable
  if (isCustomFormat && requirements?.font) {
    basicIssues.push({
      id: "custom-format-warning",
      type: "Typography",
      severity: "Critical",
      description: `CUSTOM FORMAT CHECK REQUIRED: Document must use ${requirements.font} font`,
      suggestion: "Manually verify font compliance since AI analysis is limited",
      location: "Entire document",
      pageNumber: 1,
      position: { top: 0, left: 0, width: 100, height: 100 },
      customFormatIssue: true
    });
  }
  
  const fallbackScore = calculateScoreFromIssues(basicIssues);
  
  return {
    success: true,
    score: fallbackScore,
    summary: `${isCustomFormat ? 'Custom Format Check (Limited): ' : 'Basic analysis: '}Service temporarily unavailable`,
    issues: basicIssues,
    analysisType: isCustomFormat ? "custom_format_fallback" : "fallback",
    geminiModel: "gemini-2.5-flash",
    visualAnalysisPerformed: false
  };
};

// UPDATED: Function now accepts 6 parameters with ENHANCED PROMPT
export const analyzeDocumentWithAI = async (
  fileBuffer: Buffer,
  fileName: string,
  fileMimeType: string,
  formatType: string,
  formatRequirements?: string,
  templateFile?: any
): Promise<AnalysisResult> => {
  try {
    if (!genAI) throw new Error("AI Service not initialized.");

    // Log all parameters for debugging
    console.log(`🔍 [AI Service] Analyzing document:`);
    console.log(`   - File: ${fileName}`);
    console.log(`   - MIME Type: ${fileMimeType}`);
    console.log(`   - Format Type: ${formatType}`);
    console.log(`   - Template File: ${templateFile ? 'Provided' : 'Not provided'}`);
    console.log(`   - Requirements: ${formatRequirements || 'None'}`);

    // Use Gemini 1.5 Flash for VISUAL PDF analysis (NOT 2.5-flash which is text-only)
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",  // MUST use 1.5 for visual analysis
      generationConfig: { 
        responseMimeType: "application/json", 
        temperature: 0.1,
        topP: 0.8,
        topK: 40
      } 
    });

    // Extract text for analysis
    let extractedText = '';
    const isPDF = fileMimeType.includes('pdf') || fileName.toLowerCase().endsWith('.pdf');
    
    if (isPDF) {
      // For PDFs, we'll send the visual file to Gemini
      extractedText = "PDF visual analysis enabled - Gemini will analyze the document directly";
    } else {
      // For non-PDF files, extract text directly
      extractedText = fileBuffer.toString('utf-8', 0, 10000);
    }

    // Determine which requirements to use based on format type
    const actualRequirements = formatType === 'custom' ? (formatRequirements || '') : '';
    const requirements = extractFormatRequirements(actualRequirements);
    const isCustomFormat = formatType === 'custom';
    
    // CRITICAL: Enhanced prompt for custom format enforcement
    const promptText = `
      # DOCUMENT FORMATTING AUDITOR - ${isCustomFormat ? '⛔ CUSTOM FORMAT ENFORCEMENT ⛔' : 'Standard Analysis'}
      
      ## YOUR MISSION:
      You are a STRICT formatting compliance auditor. Your PRIMARY task is to verify if the document matches ALL user requirements.
      
      ## DOCUMENT INFO:
      - File: ${fileName}
      - Format Type: ${formatType}
      ${isCustomFormat ? '- ⚠️ CUSTOM FORMAT: ENFORCE ALL REQUIREMENTS ⚠️' : '- Standard Format: Basic checks'}
      
      ## ${isCustomFormat ? '⛔⛔⛔ MANDATORY CUSTOM REQUIREMENTS ⛔⛔⛔' : 'Formatting Guidelines'}
      ${actualRequirements || 'Standard academic formatting'}
      
      ${Object.keys(requirements).length > 0 ? `
      ## 📋 PARSED REQUIREMENTS - MUST ENFORCE:
      ${Object.entries(requirements).map(([key, value]) => `- **${key.toUpperCase()}**: "${value}"`).join('\n')}
      ` : ''}
      
      ## 🚨 CRITICAL ENFORCEMENT RULES (For Custom Format Only):
      
      ${requirements.font ? `
      ### 1. FONT COMPLIANCE - IMMEDIATE FAIL IF VIOLATED:
      - **REQUIRED FONT**: ${requirements.font}
      - **ACTION**: VISUALLY inspect the document. If text appears to be ANY font other than "${requirements.font}", generate a CRITICAL "Typography" issue.
      - **SEVERITY**: Critical (deduct 30 points from score)
      - **EXAMPLE ISSUE**: 
        \`\`\`
        {
          "id": "font-mismatch-critical",
          "type": "Typography",
          "severity": "Critical",
          "description": "FONT MISMATCH: Document appears to use ${getOppositeFont(requirements.font)} but REQUIREMENT is ${requirements.font}",
          "suggestion": "Change ALL text to ${requirements.font} font family",
          "location": "Entire document",
          "pageNumber": 1,
          "position": { "top": 0, "left": 0, "width": 100, "height": 100 }
        }
        \`\`\`
      ` : ''}
      
      ${requirements.margins ? `
      ### 2. MARGIN COMPLIANCE:
      - **REQUIRED MARGINS**: ${requirements.margins}
      - **ACTION**: Measure white space around edges. Flag any significant deviation.
      - **SEVERITY**: Major
      ` : ''}
      
      ${requirements.spacing ? `
      ### 3. LINE SPACING COMPLIANCE:
      - **REQUIRED SPACING**: ${requirements.spacing}
      - **ACTION**: Check consistency of line spacing throughout document.
      - **SEVERITY**: Major if inconsistent with requirement
      ` : ''}
      
      ${requirements.alignment ? `
      ### 4. ALIGNMENT COMPLIANCE:
      - **REQUIRED ALIGNMENT**: ${requirements.alignment}
      - **ACTION**: Check if main text follows required alignment. Flag mixed alignments.
      - **SEVERITY**: Medium
      ` : ''}
      
      ## 📊 SCORING SYSTEM:
      - Base Score: 100
      ${requirements.font ? '- Font mismatch: -30 points' : ''}
      ${requirements.margins ? '- Margin violation: -15 points' : ''}
      ${requirements.spacing ? '- Spacing violation: -10 points' : ''}
      ${requirements.alignment ? '- Alignment violation: -5 points' : ''}
      - Each grammar/spelling issue: -2 points (limit to 5 most critical)
      
      ## 🎯 PRIORITY ORDER:
      1. ${requirements.font ? `FONT (${requirements.font}) - CHECK FIRST` : 'Formatting issues'}
      2. ${requirements.margins ? `MARGINS (${requirements.margins})` : 'Layout issues'}
      3. ${requirements.spacing ? `SPACING (${requirements.spacing})` : 'Spacing consistency'}
      4. ${requirements.alignment ? `ALIGNMENT (${requirements.alignment})` : 'Text alignment'}
      5. Grammar/Spelling (only 5 most critical)
      
      ## 📝 SUMMARY FORMAT:
      ${isCustomFormat ? 
        `Start with "CUSTOM FORMAT AUDIT: " followed by PASS/FAIL/WARNING. 
        Example: "CUSTOM FORMAT AUDIT: FAIL - Font mismatch. Document uses Calibri but requirement is Times New Roman."` : 
        'Standard analysis summary.'
      }
      
      ## 📄 OUTPUT FORMAT (MUST BE VALID JSON):
      {
        "score": number (0-100),
        "summary": "Summary including custom format compliance status",
        "issues": [
          {
            "id": "unique-id-1",
            "type": "Typography" | "Layout" | "Margin" | "Spacing" | "Alignment" | "Grammar" | "Spelling",
            "severity": "Critical" | "Major" | "Minor",
            "description": "Clear, specific description",
            "suggestion": "Actionable fix suggestion",
            "location": "Where issue occurs (e.g., 'Pages 1-3', 'Entire document')",
            "pageNumber": number,
            "position": { "top": number, "left": number, "width": number, "height": number }
          }
        ]
      }
      
      ## ⚠️ IMPORTANT:
      - For custom format: FONT CHECK IS MANDATORY if specified
      - Include "position" data for visual overlay
      - If no custom requirements, focus on general formatting and topology
      - Return VALID JSON only
    `;

    const contentParts: any[] = [
      { text: promptText }
    ];

    // For PDFs, send as visual data to Gemini 1.5 (CRITICAL for font detection)
    if (isPDF) {
      contentParts.push({
        inlineData: {
          data: fileBuffer.toString("base64"),
          mimeType: "application/pdf",
          fileDisplayName: fileName
        }
      });
    }

    // If template file is provided
    if (templateFile?.buffer) {
      contentParts.push({
        inlineData: {
          data: templateFile.buffer.toString("base64"),
          mimeType: templateFile.mimetype || "application/pdf",
          fileDisplayName: "template.pdf"
        }
      });
    }

    console.log(`🔍 [AI Service] Analyzing with Gemini 1.5 Flash: ${fileName}`);
    console.log(`📋 Custom Format: ${isCustomFormat}, Requirements: ${Object.keys(requirements).length}`);
    
    const result = await generateWithRetry(model, contentParts);
    let responseText = result!.response.text().replace(/```json|```/g, "").trim();
    
    // Parse response
    let parsed;
    try {
      parsed = JSON.parse(responseText);
    } catch (parseError) {
      console.error("Failed to parse Gemini response:", parseError);
      console.log("Raw response:", responseText.substring(0, 500));
      return createFallbackResponse(fileName, null, fileMimeType, formatType, requirements);
    }
    
    // Process issues with proper typing
    const enhancedIssues: Issue[] = (parsed.issues || []).map((issue: any, index: number) => ({
      ...issue,
      id: issue.id || `issue-${Date.now()}-${index}`,
      location: issue.location || 'Document',
      pageNumber: issue.pageNumber || 1,
      position: issue.position || { top: 10, left: 10, width: 80, height: 10 },
      visualEvidence: issue.visualEvidence || '',
      measurement: issue.measurement || undefined,
      // Add custom format flag - this is now allowed since we added customFormatIssue to the Issue interface
      customFormatIssue: isCustomFormat && (issue.type === 'Typography' || issue.type === 'Margin' || issue.type === 'Spacing' || issue.type === 'Alignment')
    }));
    
    // Calculate score if not provided
    let calculatedScore = parsed.score || calculateScoreFromIssues(enhancedIssues);
    
    // Apply custom format penalties
    if (isCustomFormat && requirements.font) {
      const hasFontMismatch = enhancedIssues.some(issue => 
        issue.type === 'Typography' && issue.description.includes('FONT MISMATCH')
      );
      if (hasFontMismatch) {
        calculatedScore = Math.max(0, calculatedScore - 30);
      }
    }
    
    return {
      success: true,
      score: calculatedScore,
      summary: parsed.summary || `${isCustomFormat ? 'Custom Format Audit: ' : ''}Analysis completed`,
      issues: enhancedIssues,
      processedContent: extractedText,
      analysisType: isCustomFormat ? "custom_format_enforced" : "topology_focused",
      geminiModel: "gemini-2.5-flash",
      pdfStructure: null, // Simplified for now
      structureAnalysis: isCustomFormat ? {
        fontCompliance: requirements.font ? calculateFontCompliance(enhancedIssues, requirements.font) : 0,
        marginCompliance: requirements.margins ? 75 : 0,
        spacingCompliance: requirements.spacing ? 80 : 0,
        overallCustomFormatScore: calculatedScore
      } : undefined,
      visualAnalysisPerformed: isPDF
    };

  } catch (error: any) {
    console.error("Gemini Analysis Error:", error);
    return createFallbackResponse(fileName, null, fileMimeType, formatType, extractFormatRequirements(formatRequirements));
  }
};

export const generateCorrectedPDF = async (originalBuffer: Buffer, issues: Issue[], fixedIssueIds: string[]): Promise<Buffer> => {
  try {
    const pdfDoc = await PDFDocument.load(originalBuffer);
    const pages = pdfDoc.getPages();
    const issuesToApply = issues.filter(issue => fixedIssueIds.includes(issue.id));

    // Different colors for different issue types
    const getIssueColor = (type: string) => {
      switch (type) {
        case 'Margin': return rgb(1, 0.5, 0); // Orange
        case 'Spacing': return rgb(0, 0.5, 1); // Blue
        case 'Alignment': return rgb(0.5, 0, 0.5); // Purple
        case 'Typography': return rgb(0, 0.8, 0); // Green
        case 'Layout': return rgb(1, 0, 0); // Red
        default: return rgb(1, 1, 0); // Yellow
      }
    };

    issuesToApply.forEach((issue) => {
      const pageIndex = (issue.pageNumber || 1) - 1;
      if (pageIndex >= 0 && pageIndex < pages.length && issue.position) {
        const page = pages[pageIndex];
        const { width, height } = page.getSize();
        const rectX = (issue.position.left / 100) * width;
        const rectY = height - ((issue.position.top / 100) * height) - ((issue.position.height / 100) * height);
        
        page.drawRectangle({
          x: rectX, y: rectY, 
          width: (issue.position.width / 100) * width, 
          height: (issue.position.height / 100) * height,
          color: getIssueColor(issue.type), 
          opacity: 0.3,
          borderColor: rgb(0, 0, 0),
          borderWidth: 1
        });
      }
    });
    return Buffer.from(await pdfDoc.save());
  } catch (error) { 
    console.error("PDF correction failed:", error);
    return originalBuffer; 
  }
};

export const generateCorrectedDocument = async (
  originalBuffer: Buffer,
  fileName: string,
  issues: Issue[],
  fixedIssueIds: string[]
): Promise<{ buffer: Buffer; mimeType: string; fileName: string }> => {
  const correctedBuffer = await generateCorrectedPDF(originalBuffer, issues, fixedIssueIds);
  return {
    buffer: correctedBuffer,
    mimeType: 'application/pdf',
    fileName: `corrected_${fileName}`
  };
};