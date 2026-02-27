"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalysisController = void 0;
const tsoa_1 = require("tsoa");
const Analysis_1 = __importDefault(require("../models/Analysis"));
const aiAnalysisService_1 = require("../services/aiAnalysisService");
let AnalysisController = class AnalysisController {
    /**
     * Main Analysis Endpoint: Triggers AI and saves to DB
     */
    async analyzeDocument(body) {
        try {
            const buffer = Buffer.from(body.fileBuffer, 'base64');
            const templateBuffer = body.templateBuffer ? Buffer.from(body.templateBuffer, 'base64') : undefined;
            // Convert templateBuffer to Multer.File-like object if exists
            let templateFile = undefined;
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
            const aiResponse = await (0, aiAnalysisService_1.analyzeDocumentWithAI)(buffer, // fileBuffer
            body.fileName, // fileName
            fileMimeType, // fileMimeType
            formatType, // formatType
            body.requirements, // formatRequirements
            templateFile // templateFile (Multer.File-like object)
            );
            // 2. Map response to Database Schema
            const newAnalysis = {
                userId: body.userId,
                fileName: body.fileName,
                analysisId: `ANL-${Date.now()}`,
                score: aiResponse.score || 0,
                summary: aiResponse.summary,
                issues: aiResponse.issues.map((iss, idx) => ({
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
            const saved = await Analysis_1.default.create(newAnalysis);
            return { success: true, data: saved };
        }
        catch (error) {
            console.error("❌ Analysis Error:", error.message);
            return { success: false, error: error.message };
        }
    }
    async getAnalyses(page = 1, limit = 10, userId) {
        const filter = userId ? { userId } : {};
        const total = await Analysis_1.default.countDocuments(filter);
        const data = await Analysis_1.default.find(filter)
            .skip((page - 1) * limit)
            .limit(limit)
            .sort({ analyzedAt: -1 });
        return { data, total };
    }
    async exportCorrected(body) {
        try {
            const { analysisId, originalBase64, issues, fixedIssueIds, fileName } = body;
            let originalBuffer;
            if (analysisId) {
                const analysis = await Analysis_1.default.findOne({ analysisId }).select('+fileData');
                if (!analysis || !analysis.fileData)
                    throw new Error("Original file not found.");
                originalBuffer = analysis.fileData;
                const correctedDoc = await (0, aiAnalysisService_1.generateCorrectedDocument)(originalBuffer, analysis.fileName, issues, fixedIssueIds);
                return {
                    success: true,
                    data: {
                        correctedFile: correctedDoc.buffer.toString('base64'),
                        fileName: correctedDoc.fileName,
                        mimeType: correctedDoc.mimeType
                    }
                };
            }
            else {
                throw new Error("Missing analysisId.");
            }
        }
        catch (error) {
            return { success: false, data: { error: error.message } };
        }
    }
    async extractText(body) {
        try {
            const buffer = Buffer.from(body.fileBuffer, 'base64');
            const extractedDoc = await (0, aiAnalysisService_1.extractTextFromWordDocument)(buffer, body.fileName);
            return { success: true, data: extractedDoc };
        }
        catch (error) {
            return { success: false, data: { error: error.message } };
        }
    }
};
exports.AnalysisController = AnalysisController;
__decorate([
    (0, tsoa_1.Post)('/analyze'),
    __param(0, (0, tsoa_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AnalysisController.prototype, "analyzeDocument", null);
__decorate([
    (0, tsoa_1.Get)('/'),
    __param(0, (0, tsoa_1.Query)()),
    __param(1, (0, tsoa_1.Query)()),
    __param(2, (0, tsoa_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, String]),
    __metadata("design:returntype", Promise)
], AnalysisController.prototype, "getAnalyses", null);
__decorate([
    (0, tsoa_1.Post)('/export'),
    __param(0, (0, tsoa_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AnalysisController.prototype, "exportCorrected", null);
__decorate([
    (0, tsoa_1.Post)('/extract-text'),
    __param(0, (0, tsoa_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AnalysisController.prototype, "extractText", null);
exports.AnalysisController = AnalysisController = __decorate([
    (0, tsoa_1.Route)('analysis'),
    (0, tsoa_1.Tags)('Analysis')
], AnalysisController);
// Helper function to guess MIME type from filename
function getMimeTypeFromFileName(fileName) {
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
