import twilio from 'twilio';
import { logger } from './logger';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

let client: any = null;

if (accountSid && authToken && !accountSid.includes('xxx')) {
    client = twilio(accountSid, authToken);
    logger.info('Twilio SMS service initialized');
} else {
    logger.warn('Twilio credentials missing or invalid. SMS will be logged to terminal only.');
}

/**
 * Send OTP via SMS
 */
export const sendOTP = async (mobile: string, otp: string) => {
    const message = `Your KRISHI-AI verification code is: ${otp}. Valid for 5 minutes.`;

    // Robust number formatting
    let formattedNumber = mobile.replace(/\D/g, ''); // Strip all non-digits

    // If it's 10 digits (Standard Indian number), prepend +91
    if (formattedNumber.length === 10) {
        formattedNumber = `+91${formattedNumber}`;
    } else if (!formattedNumber.startsWith('+')) {
        // If it has a country code but no +, add one
        formattedNumber = `+${formattedNumber}`;
    }

    // Always log to terminal for visibility during development
    logger.info(`------------------------------------------`);
    logger.info(`Attempting SMS to ${formattedNumber}: ${message}`);
    logger.info(`------------------------------------------`);

    if (client && fromNumber && !fromNumber.includes('1234567890')) {
        try {
            const response = await client.messages.create({
                body: message,
                from: fromNumber,
                to: formattedNumber
            });
            logger.info(`Twilio Success: Message SID ${response.sid}`);
            return true;
        } catch (error: any) {
            // Log full error for debugging (User will see this in their terminal)
            logger.error(`Twilio Error Sending to ${formattedNumber}:`, {
                code: error.code,
                message: error.message,
                moreInfo: error.moreInfo
            });

            if (error.code === 21608) {
                logger.warn('NOTICE: You are using a Twilio Trial Account. You can only send SMS to VERIFIED numbers in your Twilio console.');
            }

            return false;
        }
    } else {
        logger.warn('Twilio not configured or using default placeholders. Falling back to terminal log only.');
    }

    return true; // Return true as "handled" via terminal log fallback
};
