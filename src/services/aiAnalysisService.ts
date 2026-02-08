import { GoogleGenerativeAI } from "@google/generative-ai";
import { PDFDocument, rgb } from 'pdf-lib';
import mammoth from 'mammoth';
const pdfParse = require('pdf-parse');
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
  metadata?: {
    company?: string;
    date?: string;
    type?: string;
  };
  correctedContent?: string; // OCR or AI-corrected content
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

// NEW: Predefined Template Requirements
const getTemplateRequirements = (formatType: string): string => {
  const templates: Record<string, string> = {
    'professional': `
      FORMAT: Professional Business Report
      FONT: Arial, Helvetica, or Calibri (Clean sans-serif)
      SPACING: 1.15 or 1.5 line spacing
      MARGINS: 1 inch (2.54 cm) all around
      ALIGNMENT: Left aligned or Justified
      TONE: Formal, objective, concise
      STRUCTURE: Executive Summary, Key Findings, Data Analysis, Recommendations
    `,
    'academic': `
      FORMAT: Academic Paper (APA Style)
      FONT: Times New Roman (12pt)
      SPACING: Double spacing (2.0)
      MARGINS: 1 inch all around
      ALIGNMENT: Left aligned (ragged right)
      TONE: Scholarly, neutral, third-person
      STRUCTURE: Abstract, Introduction, Literature Review, Methodology, Results, Discussion, References
      CITATIONS: Strict APA 7th Edition format
    `,
    'legal': `
      FORMAT: Legal Document / Contract
      FONT: Times New Roman or Arial (12pt)
      SPACING: Single or 1.5 spacing
      MARGINS: 1 inch standard, numbered lines if applicable
      ALIGNMENT: Justified
      TONE: Precise, unambiguous, formal legalese
      STRUCTURE: Recitals, Definitions, Clauses, Signatures
    `,
    'creative': `
      FORMAT: Creative Writing / Portfolio
      FONT: Reader-friendly extraction (e.g., Garamond, Open Sans)
      SPACING: 1.5 spacing
      MARGINS: Moderate
      ALIGNMENT: Left aligned
      TONE: Engaging, narrative, expressive
      STRUCTURE: Narrative flow, clearly defined sections
    `,
    'resume': `
      FORMAT: Professional Resume / CV
      FONT: Calibri, Arial, or Helvetica
      SPACING: Single (1.0) with clear section breaks
      MARGINS: 0.5 to 1 inch
      ALIGNMENT: Left aligned
      TONE: Action-oriented, professional, quantified achievements
      STRUCTURE: Contact Info, Summary, Experience, Education, Skills
    `
  };

  return templates[formatType.toLowerCase()] || '';
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

// NEW: Extract text from PDF using pdf-parse
// NEW: Extract text from PDF using pdf-parse with improved error handling
export const extractTextFromPDF = async (fileBuffer: Buffer, fileName: string): Promise<ProcessedDocument> => {
  try {
    const data = await pdfParse(fileBuffer);
    return {
      textContent: data.text || '', // Ensure it's not undefined
      fileType: 'pdf',
      fileName,
      pageCount: data.numpages || 1,
      wordCount: (data.text || '').split(/\s+/).length,
      metadata: data.info || {}
    };
  } catch (error: any) {
    console.error(`❌ PDF text extraction error for ${fileName}:`, error.message);

    // Fallback: If pdf-parse fails, try to return a meaningful error or empty content
    // so the analysis can still proceed with visual analysis (if applicable)
    return {
      textContent: '', // Return empty string instead of error message so AI knows it's empty
      fileType: 'pdf',
      fileName,
      wordCount: 0,
      metadata: { error: 'Text extraction failed' }
    };
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
  requirements?: any,
  processedContent?: string,
  errorMessage?: string // Added parameter
): AnalysisResult => {
  const isCustomFormat = formatType === 'custom';
  const basicIssues: Issue[] = [];

  const isQuotaError = errorMessage?.includes('429') || errorMessage?.includes('Quota') || errorMessage?.includes('Too Many Requests');

  // Add a warning about analysis limitations
  basicIssues.push({
    id: "analysis-fallback",
    type: "Structure",
    severity: "Critical",
    description: isQuotaError
      ? "Analysis Service Busy (Quota Exceeded)"
      : `Analysis Failed: ${errorMessage || "Full AI analysis unavailable. Using fallback mode."}`,
    suggestion: isQuotaError
      ? "The AI service is currently receiving too many requests. Please try again in a few minutes."
      : "Check input file or try again later.",
    location: "System",
    pageNumber: 1,
    position: { top: 0, left: 0, width: 100, height: 5 },
    originalText: "Analysis failed",
    correctedText: "Analysis failed"
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
      customFormatIssue: true,
      originalText: "Font unavailable",
      correctedText: requirements.font
    });
  }

  const fallbackScore = calculateScoreFromIssues(basicIssues);

  return {
    success: true,
    score: fallbackScore,
    summary: isQuotaError
      ? "⚠️ AI Service Busy: We could not process your document at this time due to high traffic. Please try again later."
      : `${isCustomFormat ? 'Custom Format Check (Limited): ' : 'Basic analysis: '}Service temporarily unavailable`,
    issues: basicIssues,
    analysisType: isCustomFormat ? "custom_format_fallback" : "fallback",
    geminiModel: "gemini-2.5-flash",
    processedContent: processedContent || "",
    visualAnalysisPerformed: false,
    correctedContent: processedContent || "Analysis failed. Manual editing required."
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
  let extractedText = '';
  let pdfTextContent = '';
  let isPDF = false;
  let fileBufferForAnalysis = fileBuffer;

  try {
    if (!genAI) throw new Error("AI Service not initialized.");

    // Log all parameters for debugging
    console.log(`🔍 [AI Service] Analyzing document:`);
    console.log(`   - File: ${fileName}`);
    console.log(`   - MIME Type: ${fileMimeType}`);
    console.log(`   - Format Type: ${formatType}`);
    console.log(`   - Template File: ${templateFile ? 'Provided' : 'Not provided'}`);
    console.log(`   - Requirements: ${formatRequirements || 'None'}`);

    // Use Gemini 2.5 Flash for VISUAL PDF analysis
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1,
        topP: 0.8,
        topK: 40
      }
    });

    // Extract text for analysis
    isPDF = fileMimeType.includes('pdf') || fileName.toLowerCase().endsWith('.pdf');
    const isWord = fileMimeType.includes('word') ||
      fileMimeType.includes('officedocument.wordprocessingml.document') ||
      fileName.toLowerCase().endsWith('.docx');

    if (isPDF) {
      // For PDFs, extract text for the Edit Text tab
      const pdfData = await extractTextFromPDF(fileBuffer, fileName);
      pdfTextContent = pdfData.textContent;
      // For visual analysis, we'll send the visual file to Gemini
      extractedText = "PDF visual analysis enabled - Gemini will analyze the document directly";
    } else if (isWord) {
      // For Word files, extract text using mammoth
      const processedWord = await extractTextFromWordDocument(fileBuffer, fileName);
      extractedText = processedWord.textContent;
    } else {
      // For non-PDF/non-Word files, extract text directly
      extractedText = fileBuffer.toString('utf-8', 0, 10000);
    }

    // Fallback: If text extraction failed but it's a PDF, we rely 100% on visual analysis
    if (isPDF && (!pdfTextContent || pdfTextContent.length < 50)) {
      console.log("⚠️ PDF text extraction yielded little/no text. Relying on visual analysis.");
      pdfTextContent = "Text extraction unavailable. Visual analysis required.";
    }

    // Determine which requirements to use based on format type
    const templateReqs = getTemplateRequirements(formatType);
    const actualRequirements = formatType === 'custom'
      ? (formatRequirements || '')
      : (templateReqs || formatRequirements || '');

    const requirements = extractFormatRequirements(actualRequirements);
    const isCustomFormat = formatType === 'custom' || !!templateReqs; // Treat templates as custom enforcement

    // Check for large document to avoid token limits
    const textLength = isPDF ? (pdfTextContent?.length || 0) : (extractedText?.length || 0);
    const isLargeDocument = textLength > 25000; // Approx 5-6k tokens
    console.log(`📏 Document Length: ${textLength} chars. Large Document Mode: ${isLargeDocument}`);

    // CRITICAL: Enhanced prompt for custom format enforcement
    const promptText = `
      # DOCUMENT FORMATTING AUDITOR - ${isCustomFormat ? `⛔ ${formatType.toUpperCase()} FORMAT ENFORCEMENT ⛔` : 'Standard Analysis'}
      
      ## YOUR MISSION:
      You are a STRICT formatting compliance auditor. Your PRIMARY task is to verify if the document matches ALL user requirements.
      
      ## DOCUMENT INFO:
      - File: ${fileName}
      - Format Type: ${formatType}
      ${isCustomFormat ? '- ⚠️ STRICT FORMAT: ENFORCE ALL REQUIREMENTS ⚠️' : '- Standard Format: Basic checks'}
      ${isLargeDocument ? '- ⚠️ LARGE DOCUMENT DETECTED: SKIP FULL TEXT REWRITE ⚠️' : ''}
      
      ## ${isCustomFormat ? '⛔⛔⛔ MANDATORY REQUIREMENTS ⛔⛔⛔' : 'Formatting Guidelines'}
      ${actualRequirements || 'Standard professional formatting'}
      
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
          "position": { "top": 10, "left": 10, "width": 80, "height": 5 } 
        }
        \`\`\`
        (NOTE: Return a tight bounding box around the first instance of the wrong font)
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
      
      ## 📊 SCORING SYSTEM (STRICT):
      - Base Score: 100
      ${requirements.font ? '- Font mismatch: -40 points (CRITICAL)' : ''}
      ${requirements.margins ? '- Margin violation: -20 points (MAJOR)' : ''}
      ${requirements.spacing ? '- Spacing violation: -20 points (MAJOR)' : ''}
      ${requirements.alignment ? '- Alignment violation: -10 points (MINOR)' : ''}
      - Grammar/Spelling/Punctuation: -5 points EACH (NO LIMIT)
      
      ## 🎯 PRIORITY ORDER:
      1. ${requirements.font ? `FONT (${requirements.font}) - CHECK FIRST` : 'Formatting issues'}
      2. ${requirements.margins ? `MARGINS (${requirements.margins})` : 'Layout issues'}
      3. ${requirements.spacing ? `SPACING (${requirements.spacing})` : 'Spacing consistency'}
      4. Grammar/Spelling (MUST BE INCLUDED even if format matches)
      
      ## ⚠️ CRITICAL INSTRUCTIONS:
      1. **LIST EVERY ISSUE**: Do not summarize. If there are 50 grammar errors, list all 50 unique issues.
      3. **MERGE ISSUES**: Your final "issues" array must contain BOTH Custom Format violations AND standard Grammar/Spelling mistakes. Do not ignore standard errors.
      ${!isLargeDocument ? `3. **FULL CORRECTION**: You must provide the "correctedContent" field. This must be the COMPLETE document text with ALL corrections applied (Grammar + Format). Do not include markdown formatting, just the plain text.` : `3. **SKIP FULL CORRECTION**: Document is too large. Do NOT provide "correctedContent". Return null or empty string for that field.`}
      
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
        ],
        "metadata": { ... },
        "correctedContent": ${!isLargeDocument ? '"FULL CORRECTED TEXT HERE (Mandatory)"' : 'null'}
      }
      
      - **ISOLATE THE MISTAKE**: If a word is misspelled, box ONLY that word.
      - For custom format: FONT CHECK IS MANDATORY if specified
      
      ## 🏷️ METADATA EXTRACTION:
      Identify and extract the following if available:
      - **Company/Entity Name**: Who is this document about/from?
      - **Document Date**: Explicit or implied date (YYYY-MM-DD or text)
      - **Document Type**: e.g., "Financial Report", "Contract", "Resume", "Memo"
      
      - Return VALID JSON only.
      ${isPDF ? '"extractedContent": "FULL TEXT OF THE DOCUMENT (If visual analysis was required, transcribe the text here)",' : ''}
    `;

    const contentParts: any[] = [
      { text: promptText }
    ];

    if (!isPDF && extractedText) {
      contentParts.push({ text: `DOCUMENT CONTENT:\n${extractedText}` });
    }

    // For PDFs, send as visual data to Gemini 1.5 (CRITICAL for font detection)
    if (isPDF) {
      contentParts.push({
        inlineData: {
          data: fileBuffer.toString("base64"),
          mimeType: "application/pdf"
        }
      });
    }

    // If template file is provided
    if (templateFile?.buffer) {
      const isTemplateWord = templateFile.mimetype.includes('word') ||
        templateFile.mimetype.includes('officedocument') ||
        templateFile.originalname.toLowerCase().endsWith('.docx');
      const isTemplatePDF = templateFile.mimetype.includes('pdf');

      let templateText = "";

      try {
        if (isTemplateWord) {
          const processed = await extractTextFromWordDocument(templateFile.buffer, templateFile.originalname);
          templateText = processed.textContent;
        } else if (isTemplatePDF) {
          // For templates, text is usually sufficient and cheaper/safer than visual
          const processed = await extractTextFromPDF(templateFile.buffer, templateFile.originalname);
          templateText = processed.textContent;
        } else {
          // Try plain text
          templateText = templateFile.buffer.toString('utf-8');
        }

        if (templateText && templateText.length > 0) {
          contentParts.push({ text: `CUSTOM TEMPLATE CONTENT (Follow this structure/style):\n${templateText}` });
          console.log("✅ Added custom template text to prompt");
        }
      } catch (err) {
        console.error("❌ Failed to extract text from template:", err);
        // Fallback or ignore
      }
    }

    console.log(`🔍 [AI Service] Analyzing with Gemini 2.5 Flash: ${fileName}`);
    console.log(`📋 Custom Format: ${isCustomFormat}, Requirements: ${Object.keys(requirements).length}`);

    const result = await generateWithRetry(model, contentParts);
    let responseText = result!.response.text().replace(/```json|```/g, "").trim();

    // Parse response
    let parsed;
    try {
      parsed = JSON.parse(responseText);
    } catch (parseError: any) {
      console.error("Failed to parse Gemini response:", parseError);
      console.log("Raw response:", responseText.substring(0, 500));
      return createFallbackResponse(fileName, null, fileMimeType, formatType, extractFormatRequirements(formatRequirements), isPDF ? pdfTextContent : extractedText, parseError.message);
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

    // Check if we need to use AI-extracted text (OCR)
    if (isPDF && parsed.extractedContent && (!pdfTextContent || pdfTextContent.length < 100 || pdfTextContent.includes("visual analysis required"))) {
      console.log("📝 PDF OCR Fallback: Using AI-extracted text from Gemini");
      pdfTextContent = parsed.extractedContent;
    }

    return {
      success: true,
      score: calculatedScore,
      summary: parsed.summary || `${isCustomFormat ? 'Custom Format Audit: ' : ''}Analysis completed`,
      issues: enhancedIssues,
      processedContent: isPDF ? pdfTextContent : extractedText,
      analysisType: isCustomFormat ? "custom_format_enforced" : "topology_focused",
      geminiModel: "gemini-2.5-flash",
      pdfStructure: null,
      structureAnalysis: isCustomFormat ? {
        fontCompliance: requirements.font ? calculateFontCompliance(enhancedIssues, requirements.font) : 0,
        marginCompliance: requirements.margins ? 75 : 0,
        spacingCompliance: requirements.spacing ? 80 : 0,
        overallCustomFormatScore: calculatedScore
      } : undefined,
      visualAnalysisPerformed: isPDF,
      metadata: {
        ...(parsed.metadata || {}),
        isLargeDocument: isLargeDocument
      },
      correctedContent: parsed.correctedContent || (isLargeDocument ? null : extractedText) // Return null if large (to trigger UI warning) or original if small but missing
    };

  } catch (error: any) {
    console.error("Gemini Analysis Error:", error);
    return createFallbackResponse(fileName, null, fileMimeType, formatType, extractFormatRequirements(formatRequirements), isPDF ? pdfTextContent : extractedText, error.message);
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

export const generateCorrectedText = async (
  content: string,
  issues: Issue[]
): Promise<string> => {
  try {
    if (!genAI) throw new Error("AI Service not initialized");

    // If no issues, return original
    if (!issues || issues.length === 0) return content;

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
      You are an expert Document Editor.
      
      TASK:
      Rewrite the following document content to fix the identified issues.
      
      ISSUES TO FIX:
      ${issues.map((i, idx) => `${idx + 1}. [${i.type}] ${i.description}: ${i.suggestion}`).join('\n')}
      
      INSTRUCTIONS:
      1. Apply all fixes described above.
      2. Fix any other obvious grammar/spelling errors.
      3. Maintain the original structure and tone as much as possible.
      4. RETURN ONLY THE CORRECTED TEXT. Do not add markdown blocks or comments.
      
      DOCUMENT CONTENT:
      """
      ${content}
      """
    `;

    const result = await model.generateContent(prompt);
    return result.response.text();

  } catch (error) {
    console.error("Text correction error:", error);
    return content; // Fallback to original
  }
};