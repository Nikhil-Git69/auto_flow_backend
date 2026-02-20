"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyDailyDigest = exports.notifyUserSignup = exports.notifyAnalysisCompleted = exports.notifyDocumentUploaded = exports.notifyWorkspaceJoined = void 0;
const axios_1 = __importDefault(require("axios"));
// Load webhook URLs from environment variables
const WEBHOOK_URLS = {
    WORKSPACE_JOINED: process.env.N8N_WEBHOOK_WORKSPACE_JOINED || '',
    DOCUMENT_UPLOADED: process.env.N8N_WEBHOOK_DOCUMENT_UPLOADED || '',
    ANALYSIS_COMPLETED: process.env.N8N_WEBHOOK_ANALYSIS_COMPLETED || '',
    USER_SIGNUP: process.env.N8N_WEBHOOK_USER_SIGNUP || '',
    DAILY_DIGEST: process.env.N8N_WEBHOOK_DAILY_DIGEST || '',
};
// Generic webhook sender
const sendWebhook = async (url, payload) => {
    if (!url) {
        console.warn('⚠️ Webhook URL not configured, skipping webhook call');
        return;
    }
    try {
        console.log(`🔔 Sending webhook to: ${url}`);
        await axios_1.default.post(url, payload, {
            headers: {
                'Content-Type': 'application/json',
            },
            timeout: 5000, // 5 second timeout
        });
        console.log('✅ Webhook sent successfully');
    }
    catch (error) {
        // Don't throw errors - webhooks are non-critical
        // Just log and continue
        console.error('❌ Webhook failed:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        }
        else if (error.request) {
            console.error('No response received. Is n8n running?');
        }
    }
};
// Notify when user joins workspace
const notifyWorkspaceJoined = async (data) => {
    await sendWebhook(WEBHOOK_URLS.WORKSPACE_JOINED, {
        eventType: 'workspace_joined',
        timestamp: new Date().toISOString(),
        workspace: {
            id: data.workspaceId,
            name: data.workspaceName,
        },
        user: {
            id: data.userId,
            name: data.userName,
            email: data.userEmail,
        },
        admin: {
            email: data.adminEmail,
        },
        joinedAt: data.joinedAt,
    });
};
exports.notifyWorkspaceJoined = notifyWorkspaceJoined;
// Notify when document uploaded to workspace
const notifyDocumentUploaded = async (data) => {
    await sendWebhook(WEBHOOK_URLS.DOCUMENT_UPLOADED, {
        eventType: 'document_uploaded',
        timestamp: new Date().toISOString(),
        workspace: {
            id: data.workspaceId,
            name: data.workspaceName,
        },
        user: {
            id: data.userId,
            name: data.userName,
            email: data.userEmail,
        },
        admin: {
            email: data.adminEmail,
        },
        document: {
            fileName: data.fileName,
            fileType: data.fileType,
            analysisId: data.analysisId,
            score: data.score,
            issues: data.issues,
        },
        uploadedAt: data.uploadedAt,
    });
};
exports.notifyDocumentUploaded = notifyDocumentUploaded;
// Notify when analysis completes
const notifyAnalysisCompleted = async (data) => {
    await sendWebhook(WEBHOOK_URLS.ANALYSIS_COMPLETED, {
        eventType: 'analysis_completed',
        timestamp: new Date().toISOString(),
        user: {
            id: data.userId,
            name: data.userName,
            email: data.userEmail,
        },
        analysis: {
            id: data.analysisId,
            fileName: data.fileName,
            fileType: data.fileType,
            score: data.score,
            issues: data.issues,
            summary: data.summary,
        },
        analyzedAt: data.analyzedAt,
    });
};
exports.notifyAnalysisCompleted = notifyAnalysisCompleted;
// Notify when new user signs up
const notifyUserSignup = async (data) => {
    await sendWebhook(WEBHOOK_URLS.USER_SIGNUP, {
        eventType: 'user_signup',
        timestamp: new Date().toISOString(),
        user: {
            id: data.userId,
            name: data.userName,
            email: data.userEmail,
        },
        signupAt: data.signupAt,
    });
};
exports.notifyUserSignup = notifyUserSignup;
// For daily digest (can be triggered by cron job)
const notifyDailyDigest = async (data) => {
    await sendWebhook(WEBHOOK_URLS.DAILY_DIGEST, {
        eventType: 'daily_digest',
        timestamp: new Date().toISOString(),
        stats: {
            totalUsers: data.totalUsers,
            totalAnalyses: data.totalAnalyses,
            totalWorkspaces: data.totalWorkspaces,
        },
        topAnalyses: data.topAnalyses || [],
        date: data.date,
    });
};
exports.notifyDailyDigest = notifyDailyDigest;
