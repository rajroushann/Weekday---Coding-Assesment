// TASK 2- MAILERSEND API SCRIPT 
// Sends interview invitation emails with to candidates

// CONFIGURATION
const CONFIG = {
    maxRetries: 3,
    retryDelay: 1000, // wait for 1 sec before reply
    timeoutMs: 30000, // Request timeout
    rateLimitDelay: 500, // Delay between requests to avoid spam limits
    emailRegex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, //pattern used to check if an email looks valid
    maxNameLength: 100,
    maxRoundLength: 50
};

// SECURITY: Store API key in Airtable script settings, not hardcoded
// API key should be secret
const getApiKey = () => {
    
    return "YOUR_MAILERSEND_API_KEY"; 
};

// UTILITY FUNCTIONS(helps in debugging and print message)
function log(message, type = "info", data = null) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${type.toUpperCase()}]`;
    const logMessage = data ? `${prefix} ${message} | Data: ${JSON.stringify(data)}` : `${prefix} ${message}`;
    console.log(logMessage);
}

function sanitizeInput(str, maxLength = 1000) {
    if (typeof str !== 'string') return '';
    return str.trim()
        .replace(/[<>]/g, '') // Remove potential HTML tags
        .substring(0, maxLength);
}

function validateEmail(email) {
    if (!email || typeof email !== 'string') return false;
    const sanitized = sanitizeInput(email, 254);
    return CONFIG.emailRegex.test(sanitized);
}

function validateName(name) {
    if (!name || typeof name !== 'string') return false;
    const sanitized = sanitizeInput(name, CONFIG.maxNameLength);
    return sanitized.length > 0 && /^[a-zA-Z\s\-'.]+$/.test(sanitized);
}

function validateRound(round) {
    if (!round || typeof round !== 'string') return false;
    const sanitized = sanitizeInput(round, CONFIG.maxRoundLength);
    const validRounds = ['HR', 'Tech', 'Manager', 'Technical', 'Technical Round', 'HR Round', 'Manager Round'];
    return validRounds.includes(sanitized) || /^[a-zA-Z\s]+$/.test(sanitized);
}

function validateCalendlyUrl(url) {
    if (!url || typeof url !== 'string') return false;
    const sanitized = sanitizeInput(url, 500);
    try {
        const urlObj = new URL(sanitized);
        return urlObj.hostname.includes('calendly.com') && urlObj.protocol === 'https:';
    } catch {
        return false;
    }
}

function generateEmailContent(name, round, calendlyUrl) {
    const sanitizedName = sanitizeInput(name, CONFIG.maxNameLength);
    const sanitizedRound = sanitizeInput(round, CONFIG.maxRoundLength);
    const sanitizedUrl = sanitizeInput(calendlyUrl, 500);
    
    return {
        subject: `Interview Invitation – ${sanitizedRound} Round`,
        text: `Hi ${sanitizedName},

You are invited for the ${sanitizedRound} interview round.

Please book your slot using the link below:
${sanitizedUrl}

Best regards,
Weekday Team

---
This is an automated message. Please do not reply to this email.`,
        html: `
            <p>Hi ${sanitizedName},</p>
            <p>You are invited for the <strong>${sanitizedRound}</strong> interview round.</p>
            <p>Please book your slot using the link below:</p>
            <p><a href="${sanitizedUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Book Interview Slot</a></p>
            <p>Best regards,<br>Weekday Team</p>
            <hr>
            <p><small>This is an automated message. Please do not reply to this email.</small></p>
        `
    };
}

async function sendEmailWithRetry(emailData, maxRetries = CONFIG.maxRetries) {
    const apiKey = getApiKey();
    
    if (!apiKey || apiKey === "YOUR_MAILERSEND_API_KEY") {
        throw new Error("MailerSend API key not configured properly");
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            log(`Sending email attempt ${attempt}/${maxRetries} to ${emailData.to[0].email}`);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), CONFIG.timeoutMs);
            
            const response = await fetch("https://api.mailersend.com/v1/email", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                    "User-Agent": "Weekday-Interview-System/1.0"
                },
                body: JSON.stringify(emailData),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`HTTP ${response.status}: ${errorData.message || response.statusText}`);
            }
            
            const responseData = await response.json();
            log(`Email sent successfully`, "success", { messageId: responseData.messageId });
            return responseData;
            
        } catch (error) {
            log(`Email send attempt ${attempt} failed: ${error.message}`, "warning");
            
            if (attempt === maxRetries) {
                throw new Error(`Failed to send email after ${maxRetries} attempts: ${error.message}`);
            }
            
            // Exponential backoff with jitter
            const delay = CONFIG.retryDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

// MAIN EMAIL SENDING FUNCTION
async function sendInterviewEmail() {
    let inputConfig;
    
    try {
        // INPUT VALIDATION
        log("Starting interview email sending process");
        
        try {
            inputConfig = input.config();
            log("Input configuration loaded", "info", { 
                hasEmail: !!inputConfig.email, 
                hasName: !!inputConfig.name,
                hasRound: !!inputConfig.round,
                hasCalendly: !!inputConfig.calendly,
                hasRecordId: !!inputConfig.recordId
            });
        } catch (error) {
            throw new Error(`Failed to load input configuration: ${error.message}`);
        }

        const { email, name, round, calendly, recordId } = inputConfig;

        // COMPREHENSIVE VALIDATION
        const validationErrors = [];
        
        if (!validateEmail(email)) {
            validationErrors.push(`Invalid email format: ${email}`);
        }
        
        if (!validateName(name)) {
            validationErrors.push(`Invalid name format: ${name}`);
        }
        
        if (!validateRound(round)) {
            validationErrors.push(`Invalid round format: ${round}`);
        }
        
        if (!validateCalendlyUrl(calendly)) {
            validationErrors.push(`Invalid Calendly URL: ${calendly}`);
        }
        
        if (!recordId || typeof recordId !== 'string') {
            validationErrors.push(`Invalid record ID: ${recordId}`);
        }

        if (validationErrors.length > 0) {
            throw new Error(`Validation failed: ${validationErrors.join('; ')}`);
        }

        // GENERATE EMAIL CONTENT
        const emailContent = generateEmailContent(name, round, calendly);
        
        const emailData = {
            from: {
                email: "noreply@weekday.com",
                name: "Weekday Interviews"
            },
            to: [{
                email: sanitizeInput(email, 254),
                name: sanitizeInput(name, CONFIG.maxNameLength)
            }],
            subject: emailContent.subject,
            text: emailContent.text,
            html: emailContent.html
        };

        // SEND EMAIL
        const emailResult = await sendEmailWithRetry(emailData);
        
        // UPDATE RECORD WITH SUCCESS
        try {
            const table = base.getTable("Interview_Rounds_Clean");
            await table.updateRecordAsync(recordId, {
                "Mail Sent At": new Date().toISOString(),
                "Email Status": "Sent",
                "Email Message ID": emailResult.messageId || ""
            });
            log("Record updated successfully with email status");
        } catch (updateError) {
            log(`Warning: Email sent but failed to update record: ${updateError.message}`, "warning");
        }

        
        await new Promise(resolve => setTimeout(resolve, CONFIG.rateLimitDelay));
        
        return {
            success: true,
            message: "Interview invitation email sent successfully",
            messageId: emailResult.messageId
        };

    } catch (error) {
        log(`Email sending failed: ${error.message}`, "error");
        
        // UPDATE RECORD WITH ERROR
        if (inputConfig?.recordId) {
            try {
                const table = base.getTable("Interview_Rounds_Clean");
                await table.updateRecordAsync(inputConfig.recordId, {
                    "Email Status": "Failed",
                    "Email Error": sanitizeInput(error.message, 500)
                });
                log("Record updated with error status");
            } catch (updateError) {
                log(`Failed to update record with error: ${updateError.message}`, "error");
            }
        }
        
        return {
            success: false,
            error: error.message
        };
    }
}

// Esecute main function
const result = await sendInterviewEmail();

// FINAL OUTPUT
if (result.success) {
    output.text(`✅ ${result.message}${result.messageId ? ` (ID: ${result.messageId})` : ''}`);
} else {
    output.text(`❌ Failed to send email: ${result.error}`);
}