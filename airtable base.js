// TASK 1 - DATA SPLITTING
// Splits Raw_Candidates into individual interview round records

// CONFIGURATION (settings for the script)
const CONFIG = {
    batchSize: 10, // Process 10 records at a time
    maxRetries: 3, //if fails, try 3 times
    requiredFields: ["Candidate Name", "Email", "Interview Rounds"],
    calendlyMap: {
        "HR": "https://calendly.com/weekday/hr-round",
        "Tech": "https://calendly.com/weekday/tech-round",
        "Manager": "https://calendly.com/weekday/manager-round"
    }
};

// UTILITY FUNCTIONS(for debugging)
function log(message, type = "info") {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${type.toUpperCase()}]`;
    console.log(`${prefix} ${message}`);
}
//checking if required field exixts or not
function validateRecord(record, requiredFields) {
    const missing = [];
    for (const field of requiredFields) {
        if (!record.getCellValue(field)) {
            missing.push(field);
        }
    }
    return missing;
}
//makes data clean and consistent
function sanitizeRoundName(round) {
    return round.trim().replace(/\s+/g, ' ');
}
//retry logic to tackle failures
async function createRecordWithRetry(table, recordData, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await table.createRecordAsync(recordData);
        } catch (error) {
            if (attempt === maxRetries) {
                throw error;
            }
            log(`Retry ${attempt}/${maxRetries} for record creation: ${error.message}`, "warning");
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
        }
    }
}

// MAIN PROCESSING FUNCTION
async function processInterviewRounds() {
    let processedCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    const errors = [];

    try {
        // TABLE VALIDATION
        log("Starting interview rounds processing...");
        
        let rawTable, cleanTable;
        try {
            rawTable = base.getTable("Raw_Candidates");
            cleanTable = base.getTable("Interview_Rounds_Clean");
            log("Tables accessed successfully");
        } catch (error) {
            throw new Error(`Failed to access tables: ${error.message}`);
        }

        // Fetch records
        let records;
        try {
            records = await rawTable.selectRecordsAsync();
            log(`Fetched ${records.records.length} records from Raw_Candidates`);
        } catch (error) {
            throw new Error(`Failed to fetch records: ${error.message}`);
        }

        if (records.records.length === 0) {
            log("No records found to process", "warning");
            return { success: true, processed: 0, errors: 0, skipped: 0 };
        }

        // BATCH PROCESSING
        for (let i = 0; i < records.records.length; i += CONFIG.batchSize) {
            const batch = records.records.slice(i, i + CONFIG.batchSize);
            log(`Processing batch ${Math.floor(i/CONFIG.batchSize) + 1}/${Math.ceil(records.records.length/CONFIG.batchSize)}`);
            
            for (const record of batch) {
                try {
                    // Validate required fields
                    const missingFields = validateRecord(record, CONFIG.requiredFields);
                    if (missingFields.length > 0) {
                        const errorMsg = `Record ${record.id} missing required fields: ${missingFields.join(", ")}`;
                        errors.push(errorMsg);
                        skippedCount++;
                        log(errorMsg, "warning");
                        continue;
                    }

                    // Get and validate interview rounds
                    const roundsValue = record.getCellValue("Interview Rounds");
                    if (!roundsValue || typeof roundsValue !== 'string') {
                        const errorMsg = `Record ${record.id} has invalid Interview Rounds value`;
                        errors.push(errorMsg);
                        skippedCount++;
                        log(errorMsg, "warning");
                        continue;
                    }

                    // Split and clean rounds
                    const rounds = roundsValue.split(",")
                        .map(r => sanitizeRoundName(r))
                        .filter(r => r.length > 0);

                    if (rounds.length === 0) {
                        const errorMsg = `Record ${record.id} has no valid interview rounds`;
                        errors.push(errorMsg);
                        skippedCount++;
                        log(errorMsg, "warning");
                        continue;
                    }

                    // Creating record for each round
                    for (const round of rounds) {
                        try {
                            const recordData = {
                                "Candidate Name": record.getCellValue("Candidate Name"),
                                "Email": record.getCellValue("Email"),
                                "Interview Round": round,
                                "Calendly Link": CONFIG.calendlyMap[round] || "",
                                "Added On": record.getCellValue("Added On")
                            };

                            await createRecordWithRetry(cleanTable, recordData, CONFIG.maxRetries);
                            processedCount++;
                            
                        } catch (createError) {
                            const errorMsg = `Failed to create record for ${record.getCellValue("Candidate Name")} - ${round}: ${createError.message}`;
                            errors.push(errorMsg);
                            errorCount++;
                            log(errorMsg, "error");
                        }
                    }

                } catch (recordError) {
                    const errorMsg = `Error processing record ${record.id}: ${recordError.message}`;
                    errors.push(errorMsg);
                    errorCount++;
                    log(errorMsg, "error");
                }
            }
        }

        // defining a class object summary
        const summary = {
            success: true,
            processed: processedCount,
            errors: errorCount,
            skipped: skippedCount,
            total: records.records.length
        };

        log(`Processing completed: ${processedCount} records created, ${errorCount} errors, ${skippedCount} skipped`);
        
        if (errors.length > 0) {
            log("Errors encountered:", "warning");
            errors.slice(0, 5).forEach(error => log(`  - ${error}`, "warning"));
            if (errors.length > 5) {
                log(`  ... and ${errors.length - 5} more errors`, "warning");
            }
        }

        return summary;

    } catch (error) {
        log(`Fatal error in processing: ${error.message}`, "error");
        return {
            success: false,
            processed: processedCount,
            errors: errorCount + 1,
            skipped: skippedCount,
            error: error.message
        };
    }
}

// Execute main function
const result = await processInterviewRounds();

// FINAL OUTPUT
if (result.success) {
    output.text(`✅ Successfully processed ${result.processed} interview round records. ` +
                `(Errors: ${result.errors}, Skipped: ${result.skipped})`);
} else {
    output.text(`❌ Processing failed: ${result.error}. ` +
                `Partial results: ${result.processed} processed, ${result.errors} errors.`);
}