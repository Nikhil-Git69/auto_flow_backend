import axios from 'axios';

const getWebhookUrl = (key: string): string => {
    return process.env[key] || '';
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
export const notifyReferenceUploaded = async (data: {
    workspaceId: string;
    workspaceName: string;
    userId: string;
    userName: string;
    userEmail: string;
    memberEmails: string[]; // Emails of users in workspace
    fileName: string;
    fileSize: number;
    fileType: string;
    uploadedAt: Date;
}) => {
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

// For daily digest (can be triggered by cron job)
export const notifyDailyDigest = async (data: {
    totalUsers: number;
    totalAnalyses: number;
    totalWorkspaces: number;
    date: Date;
    topAnalyses?: any[];
}) => {
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

// Notify when admin accepts a report
export const notifyReportAccepted = async (data: {
    workspaceId: string;
    workspaceName: string;
    userId: string;
    userName: string;
    userEmail: string;
    adminEmail: string;
    fileName: string;
    analysisId: string;
    acceptedAt: Date;
}) => {
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

// Notify when admin rejects a report
export const notifyReportRejected = async (data: {
    workspaceId: string;
    workspaceName: string;
    userId: string;
    userName: string;
    userEmail: string;
    adminEmail: string;
    fileName: string;
    analysisId: string;
    rejectedAt: Date;
}) => {
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

// Notify when activity/task progress is updated by a member or admin/co-admin
export const notifyTaskProgressUpdated = async (data: {
    workspaceId: string;
    workspaceName: string;
    userId: string;
    userName: string;
    userEmail: string;
    adminEmail: string;
    memberEmails: string[]; // All workspace member emails including owner
    taskId: string;
    taskTitle: string;
    oldStatus: string;
    newStatus: string;
    updatedAt: Date;
}) => {
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

// Notify when a new activity/task is added to a workspace
export const notifyActivityAdded = async (data: {
    workspaceId: string;
    workspaceName: string;
    adminId: string;
    adminName: string;
    adminEmail: string;
    memberEmails: string[];
    taskId: string;
    taskTitle: string;
    taskDescription: string;
    taskPriority: string;
    taskDeadline?: Date;
    addedAt: Date;
}) => {
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

// Notify user with OTP for email verification
export const notifyEmailVerification = async (data: {
    userId: string;
    userName: string;
    userEmail: string;
    otp: string;
    expiresInMinutes: number;
}) => {
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

// Notify user with welcome email after email is verified
export const notifyWelcome = async (data: {
    userId: string;
    userName: string;
    userEmail: string;
    signupAt: Date;
}) => {
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
// Notify user with OTP for password reset
export const notifyPasswordReset = async (data: {
    userId: string;
    userName: string;
    userEmail: string;
    otp: string;
    expiresInMinutes: number;
}) => {
    await sendWebhook(getWebhookUrl('N8N_WEBHOOK_EMAIL_VERIFICATION'), {
        eventType: 'password_reset_request',
        timestamp: new Date().toISOString(),
        user: {
            id: data.userId,
            name: data.userName,
            email: data.userEmail,
        },
        verification: { // Changed from 'reset' to 'verification' to reuse n8n nodes
            otp: data.otp,
            expiresInMinutes: data.expiresInMinutes,
        },
    });
};
