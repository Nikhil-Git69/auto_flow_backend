"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
const AnalysisSchema = new mongoose_1.Schema({
    analysisId: {
        type: String,
        required: true,
        unique: true
    },
    userId: {
        type: String,
        required: [false, "User ID is required"],
        index: true
    },
    fileName: {
        type: String,
        required: [true, "File name is required"],
        trim: true
    },
    fileSize: {
        type: Number
    },
    fileType: {
        type: String,
        required: [true, "File type is required"]
    },
    fileData: {
        type: Buffer,
        select: false
    },
    // NEW: Format customization fields
    formatType: {
        type: String,
        enum: ['default', 'custom', 'professional', 'academic', 'legal', 'creative', 'resume', 'concept', 'report'],
        default: 'default'
    },
    formatRequirements: {
        type: String,
        default: ''
    },
    uploadDate: {
        type: Date,
        default: Date.now
    },
    score: {
        type: Number,
        required: [true, "Score is required"],
        min: 0,
        max: 100
    },
    issues: [{
            id: { type: String, required: true },
            type: { type: String, required: true },
            severity: { type: String, default: "Medium" },
            description: { type: String, required: true },
            suggestion: { type: String, required: true },
            context: { type: String, default: "" },
            originalText: { type: String, default: "" },
            correctedText: { type: String, default: "" },
            pageNumber: { type: Number, default: 1 },
            position: {
                top: { type: Number, default: 0 },
                left: { type: Number, default: 0 },
                width: { type: Number, default: 0 },
                height: { type: Number, default: 0 }
            },
            isFixed: { type: Boolean, default: false }
        }],
    summary: {
        type: String,
        default: ""
    },
    processedContent: {
        type: String,
        default: ""
    },
    correctedContent: {
        type: String,
        default: ""
    },
    metadata: {
        company: { type: String },
        date: { type: String },
        type: { type: String }
    },
    images: [{
            page: { type: Number },
            category: { type: String },
            title: { type: String },
            filename: { type: String },
            path: { type: String }
        }],
    status: {
        type: String,
        enum: ["pending", "completed", "failed"],
        default: "pending"
    },
    analyzedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});
exports.default = mongoose_1.default.model("Analysis", AnalysisSchema);
