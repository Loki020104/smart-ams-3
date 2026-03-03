# SmartAMS Dynamic Buttons — Testing Guide

## Quick Test Checklist

### Setup
- [ ] Open SmartAMS in browser
- [ ] Log in as Admin / Faculty / Student
- [ ] Verify sidebar loads with role-appropriate modules

---

## 🧪 Admin Tests (10-15 minutes)

### 1. User Management
```
Module: Admin → User Management
Expected: Table with users, search bar, Add button

Test Steps:
1. [ ] Search for "Raj" - table filters in real-time
2. [ ] Click Edit on first user
   - [ ] Name field appears pre-filled
   - [ ] Change name to "John Doe"
   - [ ] Click Save
   - [ ] Table updates instantly with new name
3. [ ] Delete any user
   - [ ] Confirmation dialog appears
   - [ ] Click Confirm
   - [ ] User removed from table

✅ PASS if all changes happen instantly without page reload
```

### 2. ISO Rules
```
Module: Admin → ISO Rules / Faculty Rules
Expected: List of rules with checkboxes, Edit/Delete buttons

Test Steps:
1. [ ] Click checkbox next to first rule
   - [ ] Badge changes from "active" to "inactive"
2. [ ] Click Edit button
   - [ ] Modal opens with rule text in textarea
   - [ ] Change text to "New rule text"
   - [ ] Click Save
   - [ ] List updates instantly
3. [ ] Click Delete button
   - [ ] Confirmation appears
   - [ ] Click Confirm
   - [ ] Rule removed from list

✅ PASS if all updates happen instantly
```

### 3. Committee Management
```
Module: Admin → Committee Management
Expected: List of committees with Members, Minutes, Delete buttons

Test Steps:
1. [ ] Click "Members" button on committee
   - [ ] Modal shows current members list
   - [ ] Type "Dr. New Person" in text field
   - [ ] Click "Add" button
   - [ ] New member appears in list
   - [ ] Click × next to member to remove
   - [ ] Member disappears
2. [ ] Click "Minutes" button
   - [ ] Modal opens with text area
   - [ ] Edit text → Click Save
   - [ ] Modal closes, changes saved
3. [ ] Click "Delete" button
   - [ ] Confirmation appears
   - [ ] Committee removed from list

✅ PASS if members update instantly and minutes are saved
```

### 4. Exam Module
```
Module: Admin → Exam Module
Expected: List of exams with Create, Assign Halls, Assign Staff buttons

Test Steps:
1. [ ] Click "Create Exam"
   - [ ] Form modal opens
   - [ ] Fill: Name="Final Exam", Course="DSA", Date="2025-04-15"
   - [ ] Click Create
   - [ ] New exam appears in list
2. [ ] Click "Assign Halls"
   - [ ] Modal opens for hall assignment
   - [ ] Click Assign
   - [ ] Status updates
3. [ ] Click "Assign Staff"
   - [ ] Modal shows faculty dropdown
   - [ ] Select faculty → Click Done
   - [ ] Status updates

✅ PASS if new exam persists and all updates are instant
```

### 5. Timetable Management
```
Module: Admin → College Timetable Mgmt
Expected: Table with Edit and View buttons

Test Steps:
1. [ ] Click "Edit" on any row
   - [ ] Modal opens with subject, faculty, room fields
   - [ ] Change subject to "Advanced DSA"
   - [ ] Click Save
   - [ ] Table updates instantly
2. [ ] Click "View" on any row
   - [ ] Modal shows all timetable details
   - [ ] Click Close

✅ PASS if edits appear immediately in table
```

### 6. Audit Logs Export
```
Module: Admin → Audit Logs
Expected: Table with "Export CSV" button

Test Steps:
1. [ ] Click "Export CSV"
   - [ ] Browser download starts
   - [ ] File saves: audit_logs.csv
   - [ ] Open file - contains headers and data rows

✅ PASS if CSV downloads successfully and has valid data
```

---

## 👨‍🏫 Faculty Tests (15-20 minutes)

### 1. My Timetable
```
Module: Faculty → My Timetable
Expected: Table with Lock/Unlock and Mark buttons

Test Steps:
1. [ ] Click "Lock" on first row
   - [ ] Icon changes from 🔓 to 🔒
   - [ ] Button text changes to "Unlock"
2. [ ] Click "Unlock"
   - [ ] Icon changes back to 🔓
   - [ ] Button text changes to "Lock"
3. [ ] Click "Mark"
   - [ ] Attendance modal opens for that subject
   - [ ] Type attendance notes
   - [ ] Click Submit
   - [ ] Toast shows "✅ Attendance marked"

✅ PASS if lock/unlock toggles instantly
```

### 2. Lesson Planner
```
Module: Faculty → Lesson Planner
Expected: List of topics with Add Topic button, Edit/Delete on each

Test Steps:
1. [ ] Click "Add Topic"
   - [ ] Modal opens with form
   - [ ] Fill: Topic="Functions", Hours=3, Status="In Progress"
   - [ ] Click Add
   - [ ] Topic appears in list instantly
2. [ ] Click "Edit" on new topic
   - [ ] Modal shows pre-filled values
   - [ ] Change status to "Completed"
   - [ ] Click Save
   - [ ] List updates
3. [ ] Click "Delete"
   - [ ] Confirmation appears
   - [ ] Click Confirm
   - [ ] Topic removed from list

✅ PASS if all changes happen without page reload
```

### 3. Course Materials
```
Module: Faculty → Course Materials
Expected: List with Lock/Unlock, Edit, Delete buttons

Test Steps:
1. [ ] Click "Lock" on first material
   - [ ] Icon changes to 🔒 (locked)
   - [ ] Button changes to "Unlock"
2. [ ] Click "Edit"
   - [ ] Modal opens with form
   - [ ] Change name/topic
   - [ ] Click Save
   - [ ] List updates
3. [ ] Click "Delete"
   - [ ] Confirmation with message about student access
   - [ ] Click Confirm
   - [ ] Material removed

✅ PASS if lock status and edits are instant
```

### 4. Student Leave Management
```
Module: Faculty → Student Leave Mgmt
Expected: Table with Forward and Reject buttons

Test Steps:
1. [ ] Click "Forward" on first row
   - [ ] Status badge changes to "FORWARDED" (teal)
   - [ ] Toast shows "✅ Leave forwarded"
2. [ ] On another row, click "Reject"
   - [ ] Status badge changes to "REJECTED" (red)
   - [ ] Toast shows "⚠️ Leave rejected"

✅ PASS if status changes instantly without reload
```

### 5. Work Log
```
Module: Faculty → Daily Work Log
Expected: Submit button and Previous Submissions section

Test Steps:
1. [ ] Click "Submit"
   - [ ] Modal opens with textarea for activities
   - [ ] Type "Taught classes, created assignments"
   - [ ] Click Submit
2. [ ] Toast shows "✅ Work log submitted"
3. [ ] Log appears in "Previous Submissions"
   - [ ] Shows today's date
   - [ ] Shows your text
   - [ ] Status shows "Submitted"

✅ PASS if submitted logs appear immediately
```

### 6. Staff Appraisal
```
Module: Faculty → Staff Appraisal
Expected: List with "Add Achievement" button

Test Steps:
1. [ ] Click "Add Achievement"
   - [ ] Modal opens with textarea
   - [ ] Type achievement like "Published research paper"
   - [ ] Click Save
2. [ ] Achievement appears in list with "Pending" status
3. [ ] Add another achievement
   - [ ] Both appear in list

✅ PASS if achievements persist and show pending status
```

### 7. My Ratings
```
Module: Faculty → My Ratings
Expected: "View Details" and "Export" buttons

Test Steps:
1. [ ] Click "View Detailed Breakdown"
   - [ ] Modal shows rating questions and averages
   - [ ] Click Close
2. [ ] Click "Export Ratings"
   - [ ] CSV downloads: my_ratings.csv

✅ PASS if both modals open and CSV downloads
```

---

## 👨‍🎓 Student Tests (15-20 minutes)

### 1. Fee Payment
```
Module: Student → Fee Management
Expected: List of fees with Pay Now and Receipt buttons

Test Steps:
1. [ ] Click "Pay Now" on first fee
   - [ ] Modal shows amount pre-filled (e.g., ₹50,000)
   - [ ] Payment method dropdown shows options
   - [ ] Click "Pay Now" button
   - [ ] Status changes to "Paid"
   - [ ] Balance becomes ₹0
2. [ ] Click "Receipt"
   - [ ] Receipt modal shows payment details
   - [ ] Click "Print"
   - [ ] Print dialog opens

✅ PASS if payment updates instantly and receipt shows correct info
```

### 2. Leave Application
```
Module: Student → Leave Management
Expected: "Apply for Leave" button and My Applications section

Test Steps:
1. [ ] Click "Apply for Leave"
   - [ ] Modal opens with form
   - [ ] Fill: Reason="Personal work", From="2025-03-15", To="2025-03-17"
   - [ ] Click Submit
2. [ ] Application appears in "My Applications"
   - [ ] Shows dates and reason
   - [ ] Status shows "Pending"
3. [ ] Apply for another leave - both persist

✅ PASS if applications appear instantly with correct info
```

### 3. Placement Application
```
Module: Student → Placement & Training
Expected: List with Apply button per placement

Test Steps:
1. [ ] Click "Apply" on first placement
   - [ ] Status changes to "Applied" (green badge)
   - [ ] Button becomes disabled (grayed out)
2. [ ] Cannot click Apply again (button disabled)

✅ PASS if button disables and status shows applied
```

### 4. Grievance Submission
```
Module: Student → Grievance Redressal
Expected: "Submit" button and My Grievances list

Test Steps:
1. [ ] Click "Submit"
   - [ ] Form modal opens
   - [ ] Fill: Title="Grade Issue", Description="Marks calculation error"
   - [ ] Click Submit
2. [ ] Grievance appears in "My Grievances"
   - [ ] Shows ticket ID like "GRV-1001"
   - [ ] Shows title and status "Pending"

✅ PASS if grievance gets auto-generated ticket ID and appears instantly
```

### 5. Course Surveys
```
Module: Student → Interim Course Survey
Expected: Survey cards with "Take Survey" button

Test Steps:
1. [ ] Click "Take Survey"
   - [ ] Survey modal opens with questions and radio buttons
   - [ ] Select responses
   - [ ] Click Submit
2. [ ] Button becomes disabled showing "Submitted ✓"
3. [ ] Can see submission confirmed in list

✅ PASS if survey disables after submission
```

### 6. Message Box
```
Module: Student → Message Box
Expected: "Compose Message" button and messages list

Test Steps:
1. [ ] Click "Compose Message"
   - [ ] Modal opens with To, Subject, Message fields
   - [ ] Fill all fields
   - [ ] Click Send
2. [ ] Message appears in list
   - [ ] Shows sender name, subject, date
3. [ ] Compose another message - both appear

✅ PASS if messages appear instantly in list
```

### 7. Subject Communities
```
Module: Student → Subject Communities
Expected: Community cards that open modals when clicked

Test Steps:
1. [ ] Click on "Mathematics" community card
   - [ ] Modal opens showing community posts
   - [ ] Text area appears for new post
   - [ ] Type a question
   - [ ] Click "Post"
2. [ ] Post appears instantly in modal
3. [ ] Click another community
   - [ ] Different posts show
   - [ ] Can post there too

✅ PASS if posts appear instantly after submit
```

---

## 🔧 Global Button Tests (5-10 minutes)

### Export Buttons
```
Test for any module with Export/Download:

1. [ ] Click "Export CSV" or "Download"
   - [ ] Browser download starts
   - [ ] CSV file appears in Downloads
   - [ ] File has headers and data rows
   - [ ] Can open in Excel/Sheets

✅ PASS if CSV is valid and downloadable
```

### Cancel Buttons
```
Test for any modal:

1. [ ] Open any modal
2. [ ] Click "Cancel" button
   - [ ] Modal closes
   - [ ] No data changes
   - [ ] Toast shows "❌ Action cancelled"

✅ PASS if modal closes without saving
```

### Retry Buttons
```
Test in Attendance module:

1. [ ] Click "Retry" button
   - [ ] Camera restarts
   - [ ] Can capture again

✅ PASS if camera restarts successfully
```

---

## 📊 Test Summary Sheet

Print or copy this template:

```
╔═══════════════════════════════════════════════════════════╗
║           SmartAMS Dynamic Buttons Test Report            ║
╠═══════════════════════════════════════════════════════════╣
║ Date: ____________  Tester: __________________________    ║
║ Browser: _______________  OS: _________________________   ║
╠═══════════════════════════════════════════════════════════╣
║ ADMIN TESTS                                 PASS / FAIL   ║
║ ☐ User Management                           ____         ║
║ ☐ ISO Rules                                 ____         ║
║ ☐ Committee Management                      ____         ║
║ ☐ Exam Module                               ____         ║
║ ☐ Timetable Management                      ____         ║
║ ☐ Audit Logs Export                         ____         ║
╠═══════════════════════════════════════════════════════════╣
║ FACULTY TESTS                                             ║
║ ☐ My Timetable (Lock/Unlock)                ____         ║
║ ☐ Lesson Planner                            ____         ║
║ ☐ Course Materials                          ____         ║
║ ☐ Student Leave Management                  ____         ║
║ ☐ Daily Work Log                            ____         ║
║ ☐ Staff Appraisal                           ____         ║
║ ☐ My Ratings                                ____         ║
╠═══════════════════════════════════════════════════════════╣
║ STUDENT TESTS                                             ║
║ ☐ Fee Payment                               ____         ║
║ ☐ Leave Application                         ____         ║
║ ☐ Placement Application                     ____         ║
║ ☐ Grievance Submission                      ____         ║
║ ☐ Course Surveys                            ____         ║
║ ☐ Message Box                               ____         ║
║ ☐ Subject Communities                       ____         ║
╠═══════════════════════════════════════════════════════════╣
║ GLOBAL TESTS                                              ║
║ ☐ Export/Download Buttons                   ____         ║
║ ☐ Cancel Buttons                            ____         ║
║ ☐ Retry Buttons                             ____         ║
╠═══════════════════════════════════════════════════════════╣
║ OVERALL RESULT                              [ PASS/FAIL ] ║
║ Notes: _______________________________________________   ║
║ ___________________________________________________        ║
╚═══════════════════════════════════════════════════════════╝
```

---

## 🎯 Expected Behavior

### General Rules (All Buttons Should Follow These)
- ✅ Modal appears centered with overlay
- ✅ Form fields pre-filled with existing data (on edit)
- ✅ Cancel button closes modal without saving
- ✅ Toast notification shows success/error
- ✅ Data updates appear instantly (no page reload)
- ✅ Tables/lists refresh after actions
- ✅ Confirmation dialogs require explicit confirmation
- ✅ Badges show correct status color
- ✅ Disabled buttons are grayed out

### Error Scenarios to Test
- [ ] Empty form fields - error toast should show
- [ ] Double-click button - should not create duplicates
- [ ] Close modal during save - should handle gracefully
- [ ] Navigate away and back - state should persist
- [ ] Rapid modal opens - should not stack

---

## 🚨 Troubleshooting

### Common Issues and Solutions

**Issue:** Button click does nothing
- Solution: Check browser console for errors
- Check if `bindModuleEvents()` was called for that module

**Issue:** Modal doesn't appear
- Solution: Verify `showModal()` function exists
- Check CSS: `.modal { display: none; }` might need `!important` override

**Issue:** Data doesn't save
- Solution: Check console for STATE object updates
- Verify `refreshXXX()` function is called after save

**Issue:** Search doesn't filter
- Solution: Check if input has `id="userSearch"` or similar
- Verify `searchUsers()` function is assigned to oninput

**Issue:** Download doesn't work
- Solution: Check if browser allows downloads
- Try incognito mode, check download folder

---

## ✨ Success Criteria

All tests PASS when:
1. ✅ Every button click triggers appropriate action
2. ✅ Modals open with correct content
3. ✅ Form data changes reflect instantly
4. ✅ Confirmations work as expected
5. ✅ Exports/downloads generate valid files
6. ✅ No page reloads occur during normal operations
7. ✅ State persists during session
8. ✅ Toasts show appropriate messages
9. ✅ All role-specific buttons work for each role
10. ✅ No JavaScript errors in console

---

**Testing Duration:** ~60-90 minutes for comprehensive coverage
**Recommendation:** Test one module completely, then move to next
**Browser:** Chrome/Firefox recommended for best experience

---

*Happy Testing! 🚀*
