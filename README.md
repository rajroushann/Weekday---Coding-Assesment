# Weekday – Interview Scheduling Automation

## Overview
This project automates the interview scheduling workflow at Weekday using Airtable and MailerSend. The system cleans candidate data, splits interview rounds into individual records, sends automated interview invitation emails, and calculates turnaround time (TAT).

The goal is to reduce manual effort, improve reliability, and enable scalable interview coordination.

---

## Tech Stack
- Airtable (Database, Automations, Run Script)
- MailerSend API (Email delivery)
- JavaScript (Airtable scripting)

---

## Task 1 – Data Splitting & Cleaning

### Problem
Candidate data contains multiple interview rounds in a single row, making automation and tracking difficult.

### Solution
An Airtable Run Script automation splits interview rounds into separate records.

### Key Features
- One record per interview round
- Validation of required fields
- Batch processing to avoid API limits
- Error handling and logging
- Automatic assignment of round-specific Calendly links

### Output
Clean, normalized data stored in the `Interview_Rounds_Clean` table.

---

## Task 2 – Automated Interview Emails

### Problem
Manual interview email communication is time-consuming and error-prone.

### Solution
MailerSend API is integrated with Airtable Automations to send interview invitations automatically.

### Key Features
- Triggered when a new interview round record is created
- Personalized email content
- Input validation and sanitization
- Retry logic and timeout handling
- Email delivery status tracking in Airtable

---

## Task 3 – Turnaround Time (TAT) Calculation

### Problem
There is no visibility into how quickly candidates are contacted.

### Solution
The system records the email sent timestamp and calculates TAT using an Airtable formula.

### Formula

