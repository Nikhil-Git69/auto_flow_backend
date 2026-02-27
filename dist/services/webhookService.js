"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyPasswordReset = exports.notifyWelcome = exports.notifyEmailVerification = exports.notifyActivityAdded = exports.notifyTaskProgressUpdated = exports.notifyReportRejected = exports.notifyReportAccepted = exports.notifyDailyDigest = exports.notifyReferenceUploaded = exports.notifyAnalysisCompleted = exports.notifyDocumentUploaded = exports.notifyWorkspaceJoined = void 0;
const axios_1 = __importDefault(require("axios"));
const getWebhookUrl = (key) => {
    return process.env[key] || '';
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
    }
};
// Notify when user joins workspace
const notifyWorkspaceJoined = async (data) => {
    await sendWebhook(getWebhookUrl('N8N_WEBHOOK_WORKSPACE_JOINED'), {
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
    await sendWebhook(getWebhookUrl('N8N_WEBHOOK_DOCUMENT_UPLOADED'), {
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
    await sendWebhook(getWebhookUrl('N8N_WEBHOOK_ANALYSIS_COMPLETED'), {
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
// export const notifyUserSignup = async (data: {
//     userId: string;
//     userName: string;
//     userEmail: string;
//     signupAt: Date;
// }) => {
//     await sendWebhook(getWebhookUrl('N8N_WEBHOOK_USER_SIGNUP'), {
//         eventType: 'user_signup',
//         timestamp: new Date().toISOString(),
//         user: {
//             id: data.userId,
//             name: data.userName,
//             email: data.userEmail,
//         },
//         signupAt: data.signupAt,
//     });
// };
// Notify when reference material is uploaded
const notifyReferenceUploaded = async (data) => {
    await sendWebhook(getWebhookUrl('N8N_WEBHOOK_REFERENCE_UPLOADED'), {
        eventType: 'reference_uploaded',
        timestamp: new Date().toISOString(),
        workspace: {
            id: data.workspaceId,
            name: data.workspaceName,
            memberEmails: data.memberEmails,
        },
        user: {
            id: data.userId,
            name: data.userName,
            email: data.userEmail,
        },
        reference: {
            fileName: data.fileName,
            fileSize: data.fileSize,
            fileType: data.fileType,
        },
        uploadedAt: data.uploadedAt,
    });
};
exports.notifyReferenceUploaded = notifyReferenceUploaded;
// For daily digest (can be triggered by cron job)
const notifyDailyDigest = async (data) => {
    await sendWebhook(getWebhookUrl('N8N_WEBHOOK_DAILY_DIGEST'), {
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
// Notify when admin accepts a report
const notifyReportAccepted = async (data) => {
    await sendWebhook(getWebhookUrl('N8N_WEBHOOK_REPORT_ACCEPTED'), {
        eventType: 'report_accepted',
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
            analysisId: data.analysisId,
        },
        acceptedAt: data.acceptedAt,
    });
};
exports.notifyReportAccepted = notifyReportAccepted;
// Notify when admin rejects a report
const notifyReportRejected = async (data) => {
    await sendWebhook(getWebhookUrl('N8N_WEBHOOK_REPORT_REJECTED'), {
        eventType: 'report_rejected',
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
            analysisId: data.analysisId,
        },
        rejectedAt: data.rejectedAt,
    });
};
exports.notifyReportRejected = notifyReportRejected;
// Notify when activity/task progress is updated by a member or admin/co-admin
const notifyTaskProgressUpdated = async (data) => {
    await sendWebhook(getWebhookUrl('N8N_WEBHOOK_ACTIVITY_COMPLETED'), {
        eventType: 'task_progress_updated',
        timestamp: new Date().toISOString(),
        workspace: {
            id: data.workspaceId,
            name: data.workspaceName,
            memberEmails: data.memberEmails,
        },
        user: {
            id: data.userId,
            name: data.userName,
            email: data.userEmail,
        },
        admin: {
            email: data.adminEmail,
        },
        task: {
            id: data.taskId,
            title: data.taskTitle,
            oldStatus: data.oldStatus,
            newStatus: data.newStatus,
        },
        updatedAt: data.updatedAt,
    });
};
exports.notifyTaskProgressUpdated = notifyTaskProgressUpdated;
// Notify when a new activity/task is added to a workspace
const notifyActivityAdded = async (data) => {
    await sendWebhook(getWebhookUrl('N8N_WEBHOOK_ACTIVITY_ADDED'), {
        eventType: 'activity_added',
        timestamp: new Date().toISOString(),
        workspace: {
            id: data.workspaceId,
            name: data.workspaceName,
            memberEmails: data.memberEmails,
        },
        admin: {
            id: data.adminId,
            name: data.adminName,
            email: data.adminEmail,
        },
        task: {
            id: data.taskId,
            title: data.taskTitle,
            description: data.taskDescription,
            priority: data.taskPriority,
            deadline: data.taskDeadline,
        },
        addedAt: data.addedAt,
    });
};
exports.notifyActivityAdded = notifyActivityAdded;
// Notify user with OTP for email verification
const notifyEmailVerification = async (data) => {
    await sendWebhook(getWebhookUrl('N8N_WEBHOOK_EMAIL_VERIFICATION'), {
        eventType: 'email_verification',
        timestamp: new Date().toISOString(),
        user: {
            id: data.userId,
            name: data.userName,
            email: data.userEmail,
        },
        verification: {
            otp: data.otp,
            expiresInMinutes: data.expiresInMinutes,
        },
    });
};
exports.notifyEmailVerification = notifyEmailVerification;
// Notify user with welcome email after email is verified
const notifyWelcome = async (data) => {
    await sendWebhook(getWebhookUrl('N8N_WEBHOOK_WELCOME_EMAIL'), {
        eventType: 'welcome',
        timestamp: new Date().toISOString(),
        user: {
            id: data.userId,
            name: data.userName,
            email: data.userEmail,
        },
        signupAt: data.signupAt,
    });
};
exports.notifyWelcome = notifyWelcome;
// Notify user with OTP for password reset
const notifyPasswordReset = async (data) => {
    await sendWebhook(getWebhookUrl('N8N_WEBHOOK_EMAIL_VERIFICATION'), {
        eventType: 'password_reset_request',
        timestamp: new Date().toISOString(),
        user: {
            id: data.userId,
            name: data.userName,
            email: data.userEmail,
        },
        verification: {
            otp: data.otp,
            expiresInMinutes: data.expiresInMinutes,
        },
    });
};
exports.notifyPasswordReset = notifyPasswordReset;
