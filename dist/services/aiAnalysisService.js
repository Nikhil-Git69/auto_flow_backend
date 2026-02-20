"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCorrectedText = exports.generateCorrectedDocument = exports.generateCorrectedPDF = exports.analyzeDocumentWithAI = exports.extractTextFromPDF = exports.extractTextFromWordDocument = void 0;
const generative_ai_1 = require("@google/generative-ai");
const pdf_lib_1 = require("pdf-lib");
const mammoth_1 = __importDefault(require("mammoth"));
const pdfParse = require('pdf-parse');
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config();
const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
let genAI = null;
if (API_KEY && API_KEY.trim() !== '') {
    genAI = new generative_ai_1.GoogleGenerativeAI(API_KEY);
}
const generateWithRetry = async (model, content, retries = 3) => {
    for (let i = 0; i < retries; i++) {
        try {
            return await model.generateContent(content);
        }
        catch (error) {
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
const extractFormatRequirements = (formatRequirements) => {
    if (!formatRequirements)
        return {};
    const requirements = {};
    // Extract font with better matching
    const fontMatch = formatRequirements.match(/font:\s*([^\n,;]+)/i) ||
        formatRequirements.match(/(Times\s*New\s*Roman|Arial|Calibri|Helvetica|Georgia|Verdana|Cambria|Garamond)/i);
    if (fontMatch)
        requirements.font = fontMatch[1].trim();
    // Extract spacing
    const spacingMatch = formatRequirements.match(/spacing:\s*([^\n,;]+)/i) ||
        formatRequirements.match(/line[-\s]*spacing:\s*([^\n,;]+)/i) ||
        formatRequirements.match(/(single|1\.5|double|2\.0|\d+(\.\d+)?)/i);
    if (spacingMatch)
        requirements.spacing = spacingMatch[1].trim();
    // Extract margins
    const marginMatch = formatRequirements.match(/margins?:\s*([^\n,;]+)/i) ||
        formatRequirements.match(/(\d+(\s*inch)?\s*(all|top|bottom|left|right))/i);
    if (marginMatch)
        requirements.margins = marginMatch[1].trim();
    // Extract alignment
    const alignmentMatch = formatRequirements.match(/alignment:\s*([^\n,;]+)/i) ||
        formatRequirements.match(/(left|right|center|justified|centre)/i);
    if (alignmentMatch)
        requirements.alignment = alignmentMatch[1].trim();
    // Extract font size
    const fontSizeMatch = formatRequirements.match(/font[-\s]*size:\s*([^\n,;]+)/i) ||
        formatRequirements.match(/(\d+)\s*(pt|px)/i);
    if (fontSizeMatch)
        requirements.fontSize = fontSizeMatch[1].trim();
    return requirements;
};
// NEW: Predefined Template Requirements
const getTemplateRequirements = (formatType) => {
    const templates = {
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
const extractTextFromWordDocument = async (fileBuffer, fileName) => {
    const ext = path_1.default.extname(fileName).toLowerCase();
    try {
        if (ext === '.docx') {
            const result = await mammoth_1.default.extractRawText({ buffer: fileBuffer });
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
            fileType: ext.replace('.', '') || 'txt',
            fileName,
            wordCount: text.split(/\s+/).length
        };
    }
    catch (error) {
        return { textContent: 'Extraction failed', fileType: 'txt', fileName, wordCount: 0 };
    }
};
exports.extractTextFromWordDocument = extractTextFromWordDocument;
// NEW: Extract text from PDF using pdf-parse
// NEW: Extract text from PDF using pdf-parse with improved error handling
const extractTextFromPDF = async (fileBuffer, fileName) => {
    try {
        const data = await pdfParse(fileBuffer);
        let text = data.text || '';
        // If text is empty or very short, it might be an image-based PDF. Try Gemini OCR.
        if (text.trim().length < 50) {
            console.log(`⚠️ PDF text extraction yielded low content for ${fileName}. Attempting Gemini OCR...`);
            try {
                if (!genAI)
                    throw new Error("Generative AI not initialized");
                const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
                const result = await model.generateContent([
                    {
                        inlineData: {
                            data: fileBuffer.toString("base64"),
                            mimeType: "application/pdf",
                        },
                    },
                    "Extract all text from this PDF document exactly as it appears. Do not summarize or interpret. If there are tables, preserve the structure as much as possible."
                ]);
                const ocrText = result.response.text();
                if (ocrText && ocrText.length > text.length) {
                    text = ocrText;
                    console.log(`✅ Gemini OCR successful for ${fileName}`);
                }
            }
            catch (ocrError) {
                console.error(`❌ Gemini OCR failed for ${fileName}:`, ocrError);
                // Fallback to original empty text if OCR fails
            }
        }
        return {
            textContent: text,
            fileType: 'pdf',
            fileName,
            pageCount: data.numpages || 1,
            wordCount: text.split(/\s+/).length,
            metadata: data.info || {}
        };
    }
    catch (error) {
        console.error(`❌ PDF text extraction error for ${fileName}:`, error.message);
        // Fallback: If pdf-parse fails completely, try Gemini OCR as a last resort
        try {
            console.log(`⚠️ pdf-parse failed. Attempting Gemini OCR fallback for ${fileName}...`);
            if (!genAI)
                throw new Error("Generative AI not initialized");
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
            const result = await model.generateContent([
                {
                    inlineData: {
                        data: fileBuffer.toString("base64"),
                        mimeType: "application/pdf",
                    },
                },
                "Extract all text from this PDF document exactly as it appears. Do not summarize or interpret."
            ]);
            const ocrText = result.response.text();
            return {
                textContent: ocrText,
                fileType: 'pdf',
                fileName,
                wordCount: ocrText.split(/\s+/).length,
                metadata: { ocr: true }
            };
        }
        catch (ocrError) {
            console.error(`❌ Gemini OCR fallback failed for ${fileName}:`, ocrError);
            return {
                textContent: '',
                fileType: 'pdf',
                fileName,
                wordCount: 0,
                metadata: { error: 'Text extraction failed' }
            };
        }
    }
};
exports.extractTextFromPDF = extractTextFromPDF;
// Helper function to get opposite font for error messages
const getOppositeFont = (font) => {
    const fontPairs = {
        'Times New Roman': 'Arial/Calibri',
        'Arial': 'Times New Roman/Serif',
        'Calibri': 'Times New Roman/Serif',
        'Helvetica': 'Times New Roman',
        'Georgia': 'Arial/Calibri'
    };
    return fontPairs[font] || 'different font';
};
// Helper function to calculate font compliance
const calculateFontCompliance = (issues, requiredFont) => {
    const hasFontMismatch = issues.some(issue => issue.type === 'Typography' && issue.description.includes('FONT MISMATCH'));
    return hasFontMismatch ? 0 : 100;
};
// Helper function to calculate average
const calculateAverage = (arr) => {
    if (!arr || arr.length === 0)
        return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
};
// Helper function to calculate variance
const calculateVariance = (arr) => {
    if (!arr || arr.length === 0)
        return 0;
    const avg = calculateAverage(arr);
    const squaredDiffs = arr.map(value => Math.pow(value - avg, 2));
    return calculateAverage(squaredDiffs);
};
// Helper function to calculate score from issues
const calculateScoreFromIssues = (issues) => {
    if (issues.length === 0)
        return 100;
    let deduction = 0;
    issues.forEach(issue => {
        switch (issue.severity) {
            case 'Critical':
                deduction += 15;
                break; // Increased penalty
            case 'Major':
                deduction += 10;
                break;
            case 'Minor':
                deduction += 5;
                break;
            default: deduction += 5;
        }
    });
    // Ensure score doesn't go below 0
    return Math.max(0, 100 - deduction);
};
// Helper function to create fallback response
const createFallbackResponse = (fileName, pdfStructure, fileMimeType, formatType, requirements, processedContent, errorMessage // Added parameter
) => {
    const isCustomFormat = formatType === 'custom';
    const basicIssues = [];
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
const analyzeDocumentWithAI = async (fileBuffer, fileName, fileMimeType, formatType, formatRequirements, templateFile) => {
    let extractedText = '';
    let pdfTextContent = '';
    let isPDF = false;
    let fileBufferForAnalysis = fileBuffer;
    try {
        if (!genAI)
            throw new Error("AI Service not initialized.");
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
            const pdfData = await (0, exports.extractTextFromPDF)(fileBuffer, fileName);
            pdfTextContent = pdfData.textContent;
            // For visual analysis, we'll send the visual file to Gemini
            extractedText = "PDF visual analysis enabled - Gemini will analyze the document directly";
        }
        else if (isWord) {
            // For Word files, extract text using mammoth
            const processedWord = await (0, exports.extractTextFromWordDocument)(fileBuffer, fileName);
            extractedText = processedWord.textContent;
        }
        else {
            // For non-PDF/non-Word files, extract text directly
            extractedText = fileBuffer.toString('utf-8', 0, 10000);
        }
        // Fallback: If text extraction failed but it's a PDF, we rely 100% on visual analysis
        // Fallback: If text extraction failed but it's a PDF, we rely 100% on visual analysis
        if (isPDF && (!pdfTextContent || pdfTextContent.length < 50)) {
            console.log("⚠️ PDF text extraction yielded little/no text. Relying on visual analysis.");
            // Do NOT overwrite pdfTextContent with an error message, as it confuses the AI.
            // Instead, we leave it as is (empty or short) and let the prompt handle it.
            if (!pdfTextContent)
                pdfTextContent = "";
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
        // CONCEPT ANALYSIS: Special Handling for WBS
        if (formatType === 'concept') {
            const promptText = `
        # CONCEPT ANALYSIS AGENT - WORK BREAKDOWN STRUCTURE (WBS) SPECIALIST

        ## YOUR MISSION:
        Analyze the provided document and generate a structured Work Breakdown Structure (WBS).
        You are purely analytical. Do NOT edit the document. Do NOT correct grammar.
        Your goal is to break down the project/concept into logical phases and tasks,
        following the EXACT structure template below.

        ## MANDATORY WBS STRUCTURE TEMPLATE:
        You MUST organize the WBS into these 8 phases. Map the document's content into these phases.
        For each phase, identify relevant deliverables and sub-tasks from the document.
        If a phase is not applicable to the document, still include it but note "Not applicable to this document" or infer reasonable tasks.

        ### Phase 1: Project Initiation
        1.1 Understand report objectives
        1.2 Review assignment guidelines & marking rubric
        1.3 Select and refine report topic
        1.4 Define scope and limitations
        1.5 Develop project timeline

        ### Phase 2: Research & Data Collection
        2.1 Identify credible sources
            2.1.1 Academic journals
            2.1.2 Books & textbooks
            2.1.3 Reputable websites / databases
        2.2 Collect primary data (if applicable)
            2.2.1 Surveys / questionnaires
            2.2.2 Interviews / observations
        2.3 Collect secondary data
        2.4 Organize and categorize research materials

        ### Phase 3: Report Planning & Structure
        3.1 Develop report outline
        3.2 Define chapter/section objectives
        3.3 Decide on methodology / approach
        3.4 Prepare list of figures, tables, and appendices

        ### Phase 4: Analysis & Interpretation
        4.1 Analyze collected data
        4.2 Apply relevant theories/models
        4.3 Compare findings with literature
        4.4 Interpret results and implications
        4.5 Identify limitations and assumptions

        ### Phase 5: Report Writing
        5.1 Write Introduction
        5.2 Write Literature Review
        5.3 Write Methodology
        5.4 Write Analysis / Discussion
        5.5 Write Conclusion & Recommendations

        ### Phase 6: Review & Editing
        6.1 Content review and refinement
        6.2 Grammar and language editing
        6.3 Formatting according to university guidelines
        6.4 Plagiarism check and citation verification

        ### Phase 7: Finalization & Submission
        7.1 Prepare abstract / executive summary
        7.2 Final formatting (font, spacing, margins)
        7.3 Generate references & bibliography
        7.4 Convert to required file format (PDF/DOCX)
        7.5 Final submission

        ### Phase 8: Presentation (If Required)
        8.1 Prepare presentation slides
        8.2 Design visuals (charts, diagrams)
        8.3 Rehearse presentation
        8.4 Deliver presentation

        ## OUTPUT REQUIREMENTS (JSON):
        1. **summary**: A high-level textual summary of the "Total WBS" describing the project scope and major phases identified from the document.
        2. **processedContent**: A detailed, hierarchical WBS in **HTML format** following the 8-phase structure above.
           - Use '<h3>' for phase titles (e.g., "<h3>Phase 1: Project Initiation</h3>").
           - Use '<strong>' for deliverables.
           - Use numbered items with '<ol>' and '<li>' for tasks.
           - Use nested '<ul>' and '<li>' for sub-tasks.
           - Map the document's actual content/topics into each phase where relevant.
           - Add specific details from the document to make each task contextual.
           - Do NOT use markdown. Use only HTML tags.
        3. **score**: Always 100 (Concept analysis is informational, not graded).
        4. **metadata**: Set 'type' to 'Concept'.
        5. **issues**: Empty array (No correction needed).
        6. **correctedContent**: Null (No editing).

        ## DOCUMENT CONTENT:
        ${isPDF ? pdfTextContent : extractedText}
        `;
            const contentParts = [{ text: promptText }];
            // For PDFs, also send the visual data
            if (isPDF) {
                contentParts.push({
                    inlineData: {
                        data: fileBuffer.toString("base64"),
                        mimeType: "application/pdf"
                    }
                });
            }
            const result = await generateWithRetry(model, contentParts);
            const responseText = result.response.text().replace(/\`\`\`json|\`\`\`/g, "").trim();
            const parsed = JSON.parse(responseText);
            return {
                success: true,
                score: 100, // Concept is always 100
                summary: parsed.summary,
                issues: [],
                processedContent: parsed.processedContent, // detailed WBS HTML
                analysisType: "concept_wbs",
                geminiModel: "gemini-2.5-flash",
                metadata: { type: 'Concept', isLargeDocument },
                correctedContent: "", // No correction
                visualAnalysisPerformed: isPDF
            };
        }
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
      2. **MERGE ISSUES**: Your final "issues" array must contain BOTH Custom Format violations AND standard Grammar/Spelling mistakes. Do not ignore standard errors.
      3. **IMAGE PRESERVATION**: If the document contains images, charts, diagrams, or visual elements:
         - Identify each image and its approximate location
         - In the correctedContent, insert a placeholder marker: [IMAGE: Brief description | Position: top/center/bottom | Page: N]
         - Preserve the logical flow of text around images
         - Do NOT describe images as part of the main text - use only markers
      ${!isLargeDocument ? `4. **FULL CORRECTION**: You must provide the "correctedContent" field. This must be the COMPLETE document text with ALL corrections applied (Grammar + Format + Image markers). Do not include markdown formatting, just the plain text with [IMAGE:...] markers where images appear.` : `4. **SKIP FULL CORRECTION**: Document is too large. Do NOT provide "correctedContent". Return null or empty string for that field.`}
      
      ## 📝 SUMMARY FORMAT:
      ${isCustomFormat ?
            `Start with "CUSTOM FORMAT AUDIT: " followed by PASS/FAIL/WARNING. 
        Example: "CUSTOM FORMAT AUDIT: FAIL - Font mismatch. Document uses Calibri but requirement is Times New Roman."` :
            'Standard analysis summary.'}
      
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
        "images": [
          {
            "id": "img-1",
            "description": "Brief description of what the image shows",
            "page": number,
            "position": { "top": number, "left": number, "width": number, "height": number },
            "beforeText": "Text snippet before image (optional)",
            "afterText": "Text snippet after image (optional)"
          }
        ],
        "metadata": { ... },
        "correctedContent": ${!isLargeDocument ? '"FULL CORRECTED TEXT HERE with [IMAGE:...] markers (Mandatory)"' : 'null'}
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
        const contentParts = [
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
                    const processed = await (0, exports.extractTextFromWordDocument)(templateFile.buffer, templateFile.originalname);
                    templateText = processed.textContent;
                }
                else if (isTemplatePDF) {
                    // For templates, text is usually sufficient and cheaper/safer than visual
                    const processed = await (0, exports.extractTextFromPDF)(templateFile.buffer, templateFile.originalname);
                    templateText = processed.textContent;
                }
                else {
                    // Try plain text
                    templateText = templateFile.buffer.toString('utf-8');
                }
                if (templateText && templateText.length > 0) {
                    contentParts.push({ text: `CUSTOM TEMPLATE CONTENT (Follow this structure/style):\n${templateText}` });
                    console.log("✅ Added custom template text to prompt");
                }
            }
            catch (err) {
                console.error("❌ Failed to extract text from template:", err);
                // Fallback or ignore
            }
        }
        console.log(`🔍 [AI Service] Analyzing with Gemini 2.5 Flash: ${fileName}`);
        console.log(`📋 Custom Format: ${isCustomFormat}, Requirements: ${Object.keys(requirements).length}`);
        const result = await generateWithRetry(model, contentParts);
        let responseText = result.response.text().replace(/```json|```/g, "").trim();
        // Parse response
        let parsed;
        try {
            parsed = JSON.parse(responseText);
        }
        catch (parseError) {
            console.error("Failed to parse Gemini response:", parseError);
            console.log("Raw response:", responseText.substring(0, 500));
            return createFallbackResponse(fileName, null, fileMimeType, formatType, extractFormatRequirements(formatRequirements), isPDF ? pdfTextContent : extractedText, parseError.message);
        }
        // Process issues with proper typing
        const enhancedIssues = (parsed.issues || []).map((issue, index) => ({
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
            const hasFontMismatch = enhancedIssues.some(issue => issue.type === 'Typography' && issue.description.includes('FONT MISMATCH'));
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
            correctedContent: parsed.correctedContent || (isLargeDocument ? null : extractedText), // Return null if large (to trigger UI warning) or original if small but missing
            images: parsed.images || [] // Include detected images from AI response
        };
    }
    catch (error) {
        console.error("Gemini Analysis Error:", error);
        return createFallbackResponse(fileName, null, fileMimeType, formatType, extractFormatRequirements(formatRequirements), isPDF ? pdfTextContent : extractedText, error.message);
    }
};
exports.analyzeDocumentWithAI = analyzeDocumentWithAI;
const generateCorrectedPDF = async (originalBuffer, issues, fixedIssueIds) => {
    try {
        const pdfDoc = await pdf_lib_1.PDFDocument.load(originalBuffer);
        const pages = pdfDoc.getPages();
        const issuesToApply = issues.filter(issue => fixedIssueIds.includes(issue.id));
        // Different colors for different issue types
        const getIssueColor = (type) => {
            switch (type) {
                case 'Margin': return (0, pdf_lib_1.rgb)(1, 0.5, 0); // Orange
                case 'Spacing': return (0, pdf_lib_1.rgb)(0, 0.5, 1); // Blue
                case 'Alignment': return (0, pdf_lib_1.rgb)(0.5, 0, 0.5); // Purple
                case 'Typography': return (0, pdf_lib_1.rgb)(0, 0.8, 0); // Green
                case 'Layout': return (0, pdf_lib_1.rgb)(1, 0, 0); // Red
                default: return (0, pdf_lib_1.rgb)(1, 1, 0); // Yellow
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
                    borderColor: (0, pdf_lib_1.rgb)(0, 0, 0),
                    borderWidth: 1
                });
            }
        });
        return Buffer.from(await pdfDoc.save());
    }
    catch (error) {
        console.error("PDF correction failed:", error);
        return originalBuffer;
    }
};
exports.generateCorrectedPDF = generateCorrectedPDF;
const generateCorrectedDocument = async (originalBuffer, fileName, issues, fixedIssueIds) => {
    const correctedBuffer = await (0, exports.generateCorrectedPDF)(originalBuffer, issues, fixedIssueIds);
    return {
        buffer: correctedBuffer,
        mimeType: 'application/pdf',
        fileName: `corrected_${fileName}`
    };
};
exports.generateCorrectedDocument = generateCorrectedDocument;
const generateCorrectedText = async (content, issues) => {
    try {
        if (!genAI)
            throw new Error("AI Service not initialized");
        // If no issues, return original
        if (!issues || issues.length === 0)
            return content;
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
    }
    catch (error) {
        console.error("Text correction error:", error);
        return content; // Fallback to original
    }
};
exports.generateCorrectedText = generateCorrectedText;
