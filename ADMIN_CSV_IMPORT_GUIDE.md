# Admin CSV Import Guide - SmartAMS

## Overview

The admin can import data to populate the SmartAMS database using CSV files. This guide shows the correct order and process.

---

## 📋 Import Order (CRITICAL)

⚠️ **Follow this exact order** - some tables depend on others:

### **Phase 1: Setup (SQL - Run Once)**
→ Run `SETUP_CSV_IMPORT.sql` in Supabase SQL Editor

### **Phase 2: Import CSV Files** (in this order)
1. **import_system_config.csv** → system_config table ✅ (no dependencies)
2. **import_students.csv** → users table (students only) ✅
3. **import_face_encodings.csv** → face_encodings table (students from step 2)
4. **import_attendance.csv** → attendance table (optional - requires UUID mapping)

ℹ️ **Courses are already created by SETUP_CSV_IMPORT.sql!**

---

## 🚀 Step-by-Step Process

### **STEP 1: Run Setup SQL**

1. Open **Supabase** → **SQL Editor**
2. Copy entire content from `SETUP_CSV_IMPORT.sql`
3. Paste into SQL Editor
4. Click **Run**

✅ This creates:
- 8 Faculty members
- 9 Courses
- 5 Base students
- System configuration

**Wait for completion** before proceeding to CSV imports.

---

### **STEP 2: Import system_config.csv**

1. In Supabase, go to **Table Editor**
2. Select **system_config** table
3. Click **⋮** (three dots) → **Upload CSV**
4. Select `import_system_config.csv`
5. Click **Import**

✅ System configuration loaded.

---

### **STEP 3: Import Students (import_students.csv)**

1. Go to **Table Editor** → **users** table
2. Click **⋮** → **Upload CSV**
3. Select `import_students.csv`
4. Click **Import**

✅ Additional students added to the system.

---

### **STEP 4: Import Courses (import_courses.csv)**

⚠️ **Important**: The CSV has `faculty_id` column with **faculty usernames**.

**Option A: Auto-match** (Recommended)
1. Go to **Table Editor** → **courses** table
2. Click **⋮** → **Upload CSV**
3. Upload `import_courses.csv`
4. Choose **"Map columns"**
5. For `faculty_id` column, select **Match on username** if available

**Option B: Manual UUID Lookup**
1. Query in SQL Editor:
```sql
SELECT id, username, full_name FROM users WHERE role='faculty';
```
2. Replace faculty usernames in `import_courses.csv` with the UUID values
3. Save and import

---

### **STEP 5: Import Face Encodings (import_face_encodings.csv)**

1. Go to **Table Editor** → **face_encodings** table
2. Click **⋮** → **Upload CSV**
3. Select `import_face_encodings.csv`
4. Click **Import**

ℹ️ Face encodings are linked to students created in Step 3.

---

### **STEP 3: Import Students (import_students.csv)**

1. Go to **Table Editor** → **users** table
2. Click **⋮** → **Upload CSV**
3. Select `import_students.csv`
4. Click **Import**

✅ Additional students added to the system.

---

### **STEP 4: Import Face Encodings (import_face_encodings.csv)**

1. Go to **Table Editor** → **face_encodings** table
2. Click **⋮** → **Upload CSV**
3. Select `import_face_encodings.csv`
4. Click **Import**

ℹ️ Face encodings are linked to students created in Step 3.

---

### **STEP 5 (Optional): Import Attendance (import_attendance.csv)**

⚠️ **This CSV requires UUID matching** for student and course IDs.

**Run this SQL first to prepare:**
```sql
-- Get student UUIDs by roll_no
SELECT roll_no, id FROM users WHERE roll_no LIKE '2026%';

-- Get course UUIDs by code  
SELECT code, id FROM courses;
```

Then one of:
- **Replace identifiers** in `import_attendance.csv` with UUIDs
- Or **Use SQL Insert** instead (see Alternative below)

---

## 🔄 Alternative: Use SQL for Complex Tables

If CSV import gives errors for tables with many foreign keys, use SQL instead:

```sql
-- Import Attendance via SQL (instead of CSV)
INSERT INTO attendance (student_id, roll_no, course_id, date, method, verified)
SELECT 
  u.id,
  u.roll_no,
  c.id,
  '2026-03-01'::DATE,
  'face',
  true
FROM users u
JOIN courses c ON c.code = 'CS101'
WHERE u.roll_no = '20261CSE001'
ON CONFLICT DO NOTHING;
```

---

## 📁 File Reference

| File | Table | Dependencies |
|------|-------|--------------|
| SETUP_CSV_IMPORT.sql | users, courses, system_config | - |
| import_system_config.csv | system_config | None |
| import_students.csv | users | None |
| import_face_encodings.csv | face_encodings | users (students) |
| import_attendance.csv | attendance | users + courses |
| import_courses.csv | courses | (Optional - for adding more courses) |

---

## ✅ Verification Checklist

After all imports, run these SQL queries to verify:

```sql
-- Total users
SELECT role, COUNT(*) FROM users GROUP BY role;

-- Total courses
SELECT COUNT(*) FROM courses;

-- Total attendance records
SELECT COUNT(*) FROM attendance;

-- Faculty with courses
SELECT f.full_name, COUNT(c.id) as course_count
FROM users f
LEFT JOIN courses c ON c.faculty_id = f.id
WHERE f.role = 'faculty'
GROUP BY f.id, f.full_name;
```

---

## 🆘 Troubleshooting

### **Error: "foreign key constraint violation"**
- Ensure parent records exist first (faculty before courses, users before attendance)
- Run Step 1 (SETUP_CSV_IMPORT.sql) before any CSV imports

### **Error: "Identifier X does not exist"**
- UUID mismatch - verify foreign key IDs match actual record IDs
- Use SQL queries to cross-check IDs before importing

### **Error: "Duplicate key value"**
- Record already exists
- Remove duplicates from CSV or use `ON CONFLICT DO NOTHING` in SQL

### **Error: "CSV incompatible with table structure"**
- Column names don't match (check headers in CSV)
- Data types don't match (dates, numbers, booleans)
- Extra/missing columns

**Solution**: Review CSV headers against table schema in Supabase.

---

## 🎯 Quick Reference

**Complete Setup in 2 Minutes:**
1. Run `SETUP_CSV_IMPORT.sql` (1 minute)
2. Import `import_system_config.csv` (30 seconds)
3. Import `import_students.csv` (30 seconds)
4. Done! Courses & base data already created by SQL.

**For Full System (with face & attendance):**
- Follow all 5 steps above (10-15 minutes)
- Verify with SQL queries

---

## 📝 Notes

- All passwords in CSVs are set to `hash123` (for testing - change in production)
- UUIDs are auto-generated during SQL insert
- Faculty created first (setup SQL), then students via CSV
- For real data: update CSV files with your institution's data before importing

---

## 🔐 Security Reminder

- ⚠️ Change all test passwords (`hash123`) before production
- ⚠️ Validate all imported data
- ⚠️ Backup database before bulk imports
- ⚠️ Test in dev environment first

---

**Ready to import? Follow Step 1 above in Supabase!** ✅
