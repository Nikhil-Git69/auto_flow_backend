import axios from 'axios';

// Load webhook URLs from environment variables
const WEBHOOK_URLS = {
    WORKSPACE_JOINED: process.env.N8N_WEBHOOK_WORKSPACE_JOINED || '',
    DOCUMENT_UPLOADED: process.env.N8N_WEBHOOK_DOCUMENT_UPLOADED || '',
    ANALYSIS_COMPLETED: process.env.N8N_WEBHOOK_ANALYSIS_COMPLETED || '',
    USER_SIGNUP: process.env.N8N_WEBHOOK_USER_SIGNUP || '',
    DAILY_DIGEST: process.env.N8N_WEBHOOK_DAILY_DIGEST || '',
};

// Generic webhook sender
const sendWebhook = async (url: string, payload: any): Promise<void> => {
    if (!url) {
        console.warn('⚠️ Webhook URL not configured, skipping webhook call');
        return;
    }

    try {
        console.log(`🔔 Sending webhook to: ${url}`);
        await axios.post(url, payload, {
            headers: {
                'Content-Type': 'application/json',
            },
            timeout: 5000, // 5 second timeout
        });
        console.log('✅ Webhook sent successfully');
    } catch (error: any) {
        // Don't throw errors - webhooks are non-critical
        // Just log and continue
        console.error('❌ Webhook failed:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        } else if (error.request) {
            console.error('No response received. Is n8n running?');
        }
    }
};

// Notify when user joins workspace
export const notifyWorkspaceJoined = async (data: {
    workspaceId: string;
    workspaceName: string;
    userId: string;
    userName: string;
    userEmail: string;
    adminEmail: string;
    joinedAt: Date;
}) => {
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

// Notify when document uploaded to workspace
export const notifyDocumentUploaded = async (data: {
    workspaceId: string;
    workspaceName: string;
    userId: string;
    userName: string;
    userEmail: string;
    adminEmail: string;
    fileName: string;
    fileType: string;
    analysisId: string;
    score: number;
    issues: number;
    uploadedAt: Date;
}) => {
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

// Notify when analysis completes
export const notifyAnalysisCompleted = async (data: {
    userId: string;
    userName?: string;
    userEmail?: string;
    analysisId: string;
    fileName: string;
    fileType: string;
    score: number;
    issues: number;
    summary: string;
    analyzedAt: Date;
}) => {
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

// Notify when new user signs up
export const notifyUserSignup = async (data: {
    userId: string;
    userName: string;
    userEmail: string;
    signupAt: Date;
}) => {
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

// For daily digest (can be triggered by cron job)
export const notifyDailyDigest = async (data: {
    totalUsers: number;
    totalAnalyses: number;
    totalWorkspaces: number;
    date: Date;
    topAnalyses?: any[];
}) => {
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
