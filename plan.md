# AI Agent Coder - Property Lead Automation System

## Objective

Automate the property sourcing workflow to reduce or eliminate repetitive admin work while keeping human involvement only for relationship-building tasks.

---

# Current Workflow

## 1. Find Property Leads

Sources:

- Facebook Marketplace
- DDProperty
- LivingInsider
- Agent Websites
- Developer Websites
- Google Search

Target:

- Warehouses
- Factories
- Land
- Industrial Property

Admin currently:

- Browses websites manually
- Takes screenshots
- Copies property information
- Records into LINE Notes
- Records into Google Sheets
- Assigns salesperson

---

## 2. Roof Hunting

Admin manually uses Google Satellite to locate warehouse/factory roofs.

Then records:

- GPS
- Screenshot
- Estimated address
- Google Maps Link

---

## 3. Contact Landlord

Admin

- Calls landlord
- Introduces company
- Confirms availability
- Requests LINE / WhatsApp / WeChat
- Creates communication group with salesperson

Sometimes admin also calls owners periodically to check availability.

---

# Proposed Architecture

```
Multiple Property Sources
        │
        ▼
Web Scraper / Browser Automation
        │
        ▼
AI Extraction
        │
        ▼
Duplicate Detection
        │
        ▼
Master Database (Supabase)
        │
        ├────────► Google Sheets (Reporting)
        │
        ├────────► CRM
        │
        └────────► LINE Notification
```

---

# Important Design Decision

## LINE Notes should NOT be the master database.

Instead:

Supabase (or CRM) becomes the source of truth.

LINE is only used for communication.

---

# Screenshot Requirement

The company still requires screenshots because salespeople need visual references from:

- Facebook
- DDProperty
- Developer websites
- Agent websites

Therefore:

Each property record must store:

- Original URL
- Multiple screenshots
- Listing images
- AI summary
- Source platform

Screenshots should be uploaded into cloud storage.

Example:

```
Property
 ├── Details
 ├── Screenshots
 ├── Images
 ├── Google Maps
 ├── Contact
 ├── Source URL
```

---

# Recommended Workflow

```
Website
     │
     ▼
Take Screenshot
     │
     ▼
Upload to Storage
     │
     ▼
AI Extract Information
     │
     ▼
Save Property + Screenshot Links
     │
     ▼
Notify LINE Group
```

Salespeople can immediately view:

- Summary
- Screenshots
- Original listing
- Contact
- Google Maps

---

# Instead of LINE Notes

Create an internal "Lead Card".

Each Lead Card contains:

- Property ID
- Property Type
- Rent / Sale
- Area
- Province
- District
- Coordinates
- Google Maps
- Original Listing URL
- Source Website
- Contact Number
- LINE
- WhatsApp
- WeChat
- Screenshots
- Property Photos
- AI Summary
- Assignment
- Follow-up Status
- Call History
- Appointment History

This becomes the permanent record.

---

# LINE Integration

Instead of storing information in LINE Notes forever:

When a new lead is created:

```
New Lead
    │
    ▼
LINE Group

🏭 Warehouse
📍 Bang Phli
💰 Rent 250,000

📸 Screenshots Attached

🔗 Open Lead Card
```

Salespeople discuss inside LINE.

The CRM stores the permanent history.

---

# Automation Opportunities

## Fully Automatable

- Website scraping
- Screenshot capture
- AI information extraction
- Duplicate detection
- Database recording
- Google Sheets synchronization
- Lead assignment
- LINE notifications
- Monthly reminder messages

Estimated automation:

90-100%

---

## Partially Automatable

- Detect warehouse roofs from satellite images
- AI phone calls for availability confirmation
- AI conversation summaries

Requires human verification.

Estimated automation:

60-80%

---

## Human Required

Relationship building

Examples:

- Introduce company
- Build trust
- Negotiate listing
- Schedule appointments
- Persuade landlord

These activities should remain with salespeople.

---

# Final Recommendation

Keep LINE as the team's communication platform, but **do not use LINE Notes as the primary database**.

Instead:

- Store every property in Supabase/CRM.
- Upload all screenshots and images to cloud storage.
- Associate screenshots with each property record.
- Send a LINE notification containing the screenshots and a link to the Lead Card.
- Let salespeople discuss the lead in LINE while the CRM maintains the permanent, searchable record.

This architecture scales efficiently to tens of thousands of property leads while preserving the team's existing workflow and minimizing manual administration.