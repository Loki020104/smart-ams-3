# SmartAMS Dynamic Buttons Implementation Guide

## Overview

All buttons across SmartAMS have been integrated with a **global state management system** and **universal modal system**. Changes are persisted in-memory during the session and all interactions are fully functional.

---

## 🎯 Quick Start: Testing All Features

### 1. **Global State System**
- Location: `app.js` lines 410-890
- Data structure: `const STATE = { ... }`
- All data stored in memory (session-based)
- No Supabase dependency for testing

### 2. **Universal Modal System**
- Location: `app.js` lines 892-920
- Functions:
  - `showModal(title, content, buttons)` - Show any modal
  - `closeModal()` - Close active modal
  - `showConfirmDialog(message, onConfirm)` - Confirmation dialogs

### 3. **Modal Style**
- CSS added to `index.html`
- Modal appears centered with overlay
- Close button and footer with action buttons

---

## 📋 **ADMIN MODULE BUTTONS**

### User Management (`a-users`)
**Location:** `app.js` lines 933-1073

**All Buttons:**
1. **Edit** - Opens modal with name, email, role, department
2. **Delete** - Shows confirmation, removes from table
3. **Search** - Filters users live as you type

**Functions:**
```javascript
editUser(userId)           // Opens edit modal
deleteUser(userId)         // Confirms and deletes
searchUsers(query)         // Filters by name/email
refreshUserTable(users)    // Redraws table
```

**How to Test:**
1. Go to Admin → User Management
2. Click Edit on any user
3. Change name/email → Click Save
4. Changes appear instantly in table
5. Click Delete → Confirm → User removed

---

### ISO Rules Management (`a-isorules`)
**Location:** `app.js` lines 1076-1150

**All Buttons:**
1. **Edit** - Opens textarea with rule text
2. **Delete** - Confirms and removes rule
3. **Toggle Active** - Checkbox immediately updates status

**Functions:**
```javascript
editRule(ruleId)           // Open edit modal
deleteRule(ruleId)         // Confirm delete
toggleRuleStatus(ruleId)   // Toggle active/inactive
refreshRulesList()         // Redraw list
```

**How to Test:**
1. Go to Admin → ISO Rules
2. Check/uncheck the Active checkbox
3. Status changes instantly
4. Click Edit → Modify text → Save
5. Click Delete → Confirm → Rule removed

---

### Committee Management (`a-committee`)
**Location:** `app.js` lines 1153-1260

**All Buttons:**
1. **Members** - Modal to add/remove committee members
2. **Minutes** - Modal to view/edit meeting notes
3. **Delete** - Confirms and removes committee

**Functions:**
```javascript
manageMembers(committeeId)    // Show members modal
addMember(committeeId)        // Add member to list
removeMember(committeeId, name) // Remove member
viewMinutes(committeeId)      // Show minutes modal
deleteCommittee(committeeId)  // Delete committee
refreshCommitteesList()       // Redraw list
```

**How to Test:**
1. Go to Admin → Committee Management
2. Click **Members** → Add committee member → Click Add
3. New member appears instantly
4. Click **Minutes** → Edit text → Save
5. Changes persist in memory
6. Click **Delete** → Confirm → Committee removed

---

### Exam Module (`a-exam`)
**Location:** `app.js` lines 1263-1339

**All Buttons:**
1. **Create Exam** - Opens form to add new exam
2. **Assign Halls** - Modal to assign exam halls
3. **Assign Staff** - Modal to assign invigilators

**Functions:**
```javascript
createExam()                   // Open create modal
assignHalls(examId)           // Open halls assignment
assignStaff(examId)           // Open staff assignment
addInvigilator()              // Add staff member
refreshExamsList()            // Redraw list
```

**How to Test:**
1. Go to Admin → Exam Module
2. Click **Create Exam** → Fill form → Create
3. New exam appears in list
4. Click **Assign Halls** → Enter hall numbers → Assign
5. Click **Assign Staff** → Select faculty → Done
6. Status updates in list

---

### Timetable Management (`a-timetable`)
**Location:** `app.js` lines 1342-1383

**All Buttons:**
1. **Edit** - Opens modal to change subject, faculty, room
2. **View** - Shows full timetable entry details

**Functions:**
```javascript
editTimetableEntry(entryId)     // Open edit modal
viewTimetableDetails(entryId)   // Show details modal
refreshTimetable()               // Redraw table
```

**How to Test:**
1. Go to Admin → College Timetable
2. Click **Edit** → Change subject/faculty/room → Save
3. Table updates instantly
4. Click **View** → Modal shows all details

---

### Audit Logs (`a-logs`)
**Location:** `app.js` lines 1386-1392

**All Buttons:**
1. **Export** - Downloads log as CSV file

**Functions:**
```javascript
exportAuditLogs()    // Generate and download CSV
```

**How to Test:**
1. Go to Admin → Audit Logs
2. Click **Export CSV**
3. File downloads automatically
4. Open in Excel/Sheets

---

## 👨‍🏫 **FACULTY MODULE BUTTONS**

### Timetable (`f-timetable`)
**Location:** `app.js` lines 1397-1440

**All Buttons:**
1. **Lock/Unlock** - Toggles padlock icon and status instantly
2. **Mark** - Opens attendance marking section

**Functions:**
```javascript
lockUnlockTimetable(entryId)   // Toggle locked state
markAttendance(entryId)         // Open attendance form
refreshFacultyTimetable()       // Redraw table
```

**How to Test:**
1. Go to Faculty → My Timetable
2. Click **Lock** → Icon changes to 🔒
3. Click **Unlock** → Icon changes to 🔓
4. Click **Mark** → Modal opens for attendance notes

---

### Lesson Planner (`f-lesson`)
**Location:** `app.js` lines 1443-1516

**All Buttons:**
1. **Add Topic** - Form modal to create new topic
2. **Edit** - Modal to update topic details
3. **Delete** - Confirms and removes topic

**Functions:**
```javascript
addTopic()            // Show create modal
editTopic(topicId)    // Show edit modal
deleteTopic(topicId)  // Confirm and delete
refreshLessonPlanner()// Redraw list
```

**How to Test:**
1. Go to Faculty → Lesson Planner
2. Click **Add Topic** → Fill form → Add
3. Topic appears in list instantly
4. Click **Edit** → Modify → Save
5. Click **Delete** → Confirm → Removed

---

### Course Materials (`f-materials`)
**Location:** `app.js` lines 1519-1575

**All Buttons:**
1. **Lock/Unlock** - Toggles padlock and student access
2. **Edit** - Modal to change name/topic
3. **Delete** - Removes material from course

**Functions:**
```javascript
lockUnlockMaterial(materialId)  // Toggle access
editMaterial(materialId)        // Edit details
deleteMaterial(materialId)      // Delete
refreshCourseMaterials()        // Redraw list
```

**How to Test:**
1. Go to Faculty → Course Materials
2. Click **Lock** → Material becomes 🔒 (students can't see)
3. Click **Unlock** → Material becomes 📂 (students can see)
4. Click **Edit** → Update name/topic → Save
5. Click **Delete** → Confirm → Material removed

---

### Student Leave (`f-studentleave`)
**Location:** `app.js` lines 1578-1610

**All Buttons:**
1. **Forward** - Changes status from Pending to Forwarded
2. **Reject** - Changes status from Pending to Rejected

**Functions:**
```javascript
forwardLeave(leaveId)    // Update status to Forwarded
rejectLeave(leaveId)     // Update status to Rejected
refreshStudentLeaves()   // Redraw table
```

**How to Test:**
1. Go to Faculty → Student Leave Management
2. Click **Forward** → Status badge changes to "Forwarded"
3. Click **Reject** → Status badge changes to "Rejected"
4. Updates appear instantly

---

### Work Log (`f-worklog`)
**Location:** `app.js` lines 1613-1650

**All Buttons:**
1. **Submit** - Saves daily activities to log

**Functions:**
```javascript
submitWorkLog()     // Show submit modal
refreshWorkLogs()   // Display submitted logs
```

**How to Test:**
1. Go to Faculty → Daily Work Log
2. Click **Submit** → Enter activities → Submit
3. Log appears in "Previous Submissions"
4. Shows date and "Submitted" status

---

### Appraisal (`f-appraisal`)
**Location:** `app.js` lines 1653-1691

**All Buttons:**
1. **Add Achievement** - Modal to add achievement

**Functions:**
```javascript
addAchievement()    // Show add modal
refreshAppraisals() // Display achievements
```

**How to Test:**
1. Go to Faculty → Staff Appraisal
2. Click **Add Achievement** → Enter text → Save
3. Achievement appears with "Pending" status
4. Admin can approve later

---

### My Ratings (`f-ratings`)
**Location:** `app.js` lines 1694-1715

**All Buttons:**
1. **View Details** - Shows rating breakdown modal
2. **Export** - Downloads ratings as CSV

**Functions:**
```javascript
showRatingDetails()   // Show breakdown modal
exportData('ratings') // Download CSV
```

**How to Test:**
1. Go to Faculty → My Ratings
2. Click **View Detailed Breakdown** → Modal with rating stats
3. Click **Export Ratings** → CSV downloads

---

## 👨‍🎓 **STUDENT MODULE BUTTONS**

### Fees (`s-fees`)
**Location:** `app.js` lines 1722-1769

**All Buttons:**
1. **Pay Now** - Opens payment modal with amount
2. **Receipt** - Shows printable receipt modal

**Functions:**
```javascript
payNow(feeId)        // Show payment modal
showReceipt(feeId)   // Show receipt modal
refreshFees()        // Redraw fee list
```

**How to Test:**
1. Go to Student → Fee Management
2. Click **Pay Now** → Modal shows amount → Click **Pay Now**
3. Balance becomes 0, status shows "Paid"
4. Click **Receipt** → Modal shows receipt
5. Click **Print** → Print dialog opens

---

### Leave Management (`s-leave`)
**Location:** `app.js` lines 1772-1809

**All Buttons:**
1. **Apply** - Submits leave application

**Functions:**
```javascript
applyLeave()         // Show apply modal
refreshMyLeaves()    // Display applications
```

**How to Test:**
1. Go to Student → Leave Management
2. Click **Apply for Leave** → Fill form → Submit
3. Application appears in "My Applications"
4. Status shows "Pending"

---

### Placement (`s-placement`)
**Location:** `app.js` lines 1812-1830

**All Buttons:**
1. **Apply** - Apply for company (disables after click)

**Functions:**
```javascript
applyForPlacement(placementId)  // Submit application
refreshPlacements()             // Redraw list
```

**How to Test:**
1. Go to Student → Placement & Training
2. Click **Apply** button
3. Status changes to "Applied" (green badge)
4. Button becomes disabled (can't reapply)

---

### Grievance (`s-grievance`)
**Location:** `app.js` lines 1833-1874

**All Buttons:**
1. **Submit** - Submits grievance, generates ticket ID

**Functions:**
```javascript
submitGrievance()    // Show submit modal
refreshGrievances()  // Display grievances
```

**How to Test:**
1. Go to Student → Grievance Redressal
2. Click **Submit** → Fill form → Submit
3. Grievance appears with ticket ID (GRV-1234)
4. Status shows "Pending"

---

### Surveys (`s-survey`)
**Location:** `app.js` lines 1877-1904

**All Buttons:**
1. **Take Survey** - Opens survey modal (disables after submit)

**Functions:**
```javascript
submitSurvey()   // Show survey modal
refreshSurveys() // Update UI
```

**How to Test:**
1. Go to Student → Interim Course Survey
2. Click **Take Survey** → Select responses → Submit
3. Button becomes disabled showing "Submitted ✓"

---

### Messages (`s-messages`)
**Location:** `app.js` lines 1907-1937

**All Buttons:**
1. **Compose** - Opens message composition modal

**Functions:**
```javascript
composeMail()    // Show compose modal
refreshMessages()// Display messages
```

**How to Test:**
1. Go to Student → Message Box
2. Click **Compose Message** → Fill form → Send
3. Message appears in list with "Sent" folder

---

### Subject Communities (`s-communities`)
**Location:** `app.js` lines 1940-1967

**All Buttons:**
1. **Click Community Card** - Opens community with posts
2. **Post** - Adds new message to community

**Functions:**
```javascript
viewCommunity(communityName)  // Show community modal
postMessage(communityName)    // Add post
```

**How to Test:**
1. Go to Student → Subject Communities
2. Click any **community card**
3. Modal shows posts and text field
4. Type message → Click **Post**
5. Message appears immediately

---

## 🌐 **GLOBAL UTILITY BUTTONS**

### Export Buttons
**Location:** `app.js` lines 1970-1994

**Function:**
```javascript
exportData(dataType)  // Export any data as CSV
```

**Supports:**
- `'audit_logs'` - Audit logs CSV
- `'users'` - User list CSV
- `'timetable'` - Timetable CSV

---

### Cancel Buttons
**Location:** `app.js` lines 2000-2003

**Function:**
```javascript
cancelAction()  // Close modal and show toast
```

---

### Retry Buttons
**Location:** `app.js` lines 1997-2000

**Function:**
```javascript
retryAttendance()  // Restart camera for attendance
```

---

## 🔧 **Module Event Binding**

**Location:** `app.js` lines 2006-2080

The `bindModuleEvents(moduleId)` function automatically:
1. Initializes data tables
2. Binds button click handlers
3. Sets up search/filter functionality
4. Called automatically when module loads

---

## 📱 **HTML Integration**

### Button Classes
```html
<!-- Primary Button -->
<button class="btn btn-primary">Action</button>

<!-- Danger Button -->
<button class="btn btn-danger">Delete</button>

<!-- Small Button -->
<button class="btn btn-sm">Edit</button>

<!-- In Modal -->
<button class="btn" onclick="functionName()">Action</button>
```

### Form Groups
```html
<div class="form-group">
  <label>Field Name:</label>
  <input type="text" id="fieldId" placeholder="...">
</div>
```

### List Items
```html
<div class="lesson-item">
  <h4>Topic Name</h4>
  <p>Description</p>
  <div class="btn-group">
    <button onclick="editTopic(id)">Edit</button>
    <button onclick="deleteTopic(id)">Delete</button>
  </div>
</div>
```

---

## 💾 **Data Persistence Strategy**

### Current (Session-Based)
- All data stored in `STATE` object
- Persists for duration of login session
- Resets on page reload or logout
- Perfect for testing and demonstrations

### Future (With Supabase)
Simply replace:
```javascript
// FROM: STATE.table.push(newItem)
// TO: await sb.table('table_name').insert(newItem).execute()
```

---

## 🎨 **CSS Classes for Components**

### List Items
```css
.rule-item           /* Rule items */
.lesson-item         /* Lesson topics */
.appraisal-item      /* Achievements */
.fee-item           /* Fee entries */
.leave-item         /* Leave applications */
.grievance-item     /* Grievances */
.worklog-item       /* Work log entries */
.message-item       /* Messages */
.placement-item     /* Placements */
.survey-item        /* Surveys */
.post-item          /* Community posts */
.community-card     /* Community cards */
```

### Status Badges
```css
.badge-pending      /* Pending (yellow) */
.badge-active       /* Active (green) */
.badge-inactive     /* Inactive (gray) */
.badge-submitted    /* Submitted (blue) */
.badge-forwarded    /* Forwarded (teal) */
.badge-rejected     /* Rejected (red) */
.badge-applied      /* Applied (blue) */
```

---

## ✅ **Complete Feature Checklist**

- [x] Global in-memory database (STATE)
- [x] Universal modal system
- [x] Admin user management (Edit, Delete, Search)
- [x] ISO rules (Edit, Delete, Toggle status)
- [x] Committee management (Members, Minutes, Delete)
- [x] Exam module (Create, Assign halls, Assign staff)
- [x] Timetable management (Edit, View)
- [x] Audit logs export (CSV)
- [x] Faculty timetable (Lock/Unlock, Mark attendance)
- [x] Lesson planner (Add, Edit, Delete)
- [x] Course materials (Lock/Unlock, Edit, Delete)
- [x] Student leave approval (Forward, Reject)
- [x] Work log (Submit)
- [x] Appraisal (Add achievement)
- [x] My ratings (View details, Export)
- [x] Fee payment (Pay, Receipt)
- [x] Student leave application (Apply)
- [x] Placement application (Apply)
- [x] Grievance submission (Submit with ticket ID)
- [x] Surveys (Submit)
- [x] Messages (Compose)
- [x] Subject communities (Post)
- [x] Export/Download buttons
- [x] Cancel buttons
- [x] Retry buttons

---

## 🚀 **Next Steps**

### To Enable Supabase Integration:
1. Uncomment RLS policies in PHASE1_SCHEMA_UPDATES.sql
2. Replace STATE operations with Supabase calls
3. Add authentication checks
4. Test with real database

### To Add More Modules:
1. Add data to STATE object
2. Create render function with table/list
3. Add button handler functions
4. Update bindModuleEvents() for hooks
5. Add CSS classes for styling

### To Deploy:
1. Backend: `python backend.py`
2. Frontend: Already integrated in app.js
3. Database: Run PHASE1_SCHEMA_UPDATES.sql in Supabase
4. Test all buttons in each module

---

## 📧 **Support**

All button functions are fully documented in `app.js` lines 410-2080.

For questions or customizations:
- Check the STATE object structure (lines 410-890)
- Review modal functions (lines 892-920)
- Examine specific button handlers (lines 923-1967)
- Update bindModuleEvents() for new modules (lines 2006-2080)

---

**SmartAMS Button System v1.0**
*All buttons working dynamically with in-memory state management*
