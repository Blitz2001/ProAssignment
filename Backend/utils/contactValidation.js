/**
 * Validates if a message contains contact information (phone, email, website)
 * @param {string} text - The message text to validate
 * @returns {Object} Object with isValid boolean and errorMessage if invalid
 */
const validateNoContactInfo = (text) => {
    if (!text || text.trim() === '') {
        return { isValid: true };
    }

    // Phone number patterns (various formats) - More aggressive detection
    const phonePatterns = [
        // Simple catch-all: Any sequence of 10+ consecutive digits (most common phone format)
        /\d{10,}/g,                                             // Catches: 0712025476, 1234567890, etc.
        // US/Canada formats
        /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,                    // 123-456-7890, 123.456.7890, 1234567890
        /\b\d{3}\s\d{3}\s\d{4}\b/g,                          // 123 456 7890
        /\b\(\d{3}\)\s?\d{3}[-.]?\d{4}\b/g,                  // (123) 456-7890
        // International formats (including numbers starting with 0)
        /\b0\d{9,14}\b/g,                                      // 0712025476, 0123456789 (international format starting with 0)
        /\b\d{10,15}\b/g,                                     // Any 10-15 digit number (phone numbers)
        /\b\+\d{1,4}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}\b/g,  // +1-234-567-8900, +447123456789
        // With context words
        /call\s+(me\s+)?(at\s+)?(\+?\d{1,4}[-.\s]?)?\(?\d{0,4}\)?[-.\s]?\d{1,15}/gi,
        /phone\s+(number\s+)?(is\s+)?(\+?\d{1,4}[-.\s]?)?\(?\d{0,4}\)?[-.\s]?\d{1,15}/gi,
        /(contact|reach|text|call|message|dial)\s+(me\s+)?(on\s+)?(at\s+)?(\+?\d{1,4}[-.\s]?)?\(?\d{0,4}\)?[-.\s]?\d{1,15}/gi,
        /(my\s+)?(number|phone|mobile|cell|tel)\s+(is\s+)?(\+?\d{1,4}[-.\s]?)?\(?\d{0,4}\)?[-.\s]?\d{1,15}/gi,
    ];

    // Email pattern - More comprehensive
    const emailPattern = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}/g;
    
    // Website/URL patterns - More comprehensive
    const websitePatterns = [
        /https?:\/\/[^\s]+/gi,                                // http:// or https://
        /www\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]*\.[a-zA-Z]{2,}[^\s]*/gi,  // www.website.com
        /\b[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]*\.(com|net|org|io|co|uk|edu|gov|info|biz|me|tv|xyz|website|online|site|web|tech|app|dev|online|store|shop)[^\s]*/gi,  // domain.com formats
        /[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]*\.(com|net|org|io|co|uk|edu|gov|info|biz|me|tv|xyz|website|online|site|web|tech|app|dev|online|store|shop)/gi,  // example.com (without www)
        /(website|site|url|link|webpage|page|web)\s+(is\s+)?(https?:\/\/)?(www\.)?[^\s]+/gi,
        /(visit|go\s+to|check|see|look\s+at|view)\s+(https?:\/\/)?(www\.)?[a-zA-Z0-9][^\s]+/gi,
        /(my\s+)?(website|site|url|link|page|blog)\s+(is\s+)?(https?:\/\/)?(www\.)?[^\s]+/gi,
    ];

    // Check for phone numbers (create new regex instances to avoid state issues)
    for (const patternStr of phonePatterns) {
        const pattern = new RegExp(patternStr.source, patternStr.flags);
        if (pattern.test(text)) {
            return {
                isValid: false,
                errorMessage: "Sharing phone numbers is not allowed. Please communicate through this platform only."
            };
        }
    }

    // Check for email addresses
    const emailRegex = new RegExp(emailPattern.source, emailPattern.flags);
    if (emailRegex.test(text)) {
        return {
            isValid: false,
            errorMessage: "Sharing email addresses is not allowed. Please communicate through this platform only."
        };
    }

    // Check for websites/URLs
    for (const patternStr of websitePatterns) {
        const pattern = new RegExp(patternStr.source, patternStr.flags);
        if (pattern.test(text)) {
            return {
                isValid: false,
                errorMessage: "Sharing websites or links is not allowed. Please communicate through this platform only."
            };
        }
    }

    return { isValid: true };
};

export default validateNoContactInfo;

