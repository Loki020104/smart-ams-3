# ⚡ CSV Import - Quick Start for Admins

## 30-Second Setup

### Do This First (1 time only):

**In Supabase SQL Editor:**
```
1. Copy all text from: SETUP_CSV_IMPORT.sql
2. Paste into SQL Editor
3. Click RUN
4. Done! ✅
```

This creates:
- ✅ All faculty
- ✅ All courses  
- ✅ Base student data
- ✅ System config

---

## Then Import CSV Files (3 times):

### Order matters! Do in this sequence:

1. **import_system_config.csv** → Table: system_config
2. **import_students.csv** → Table: users
3. **import_face_encodings.csv** → Table: face_encodings

✅ **Courses are already created by SETUP_CSV_IMPORT.sql** - no import needed!

### How to Import Each CSV:

```
1. Supabase → Table Editor
2. Select table name (from list above)
3. Click [⋮] (three dots) top right
4. Click "Upload CSV"
5. Select the CSV file
6. Click "Import"
7. ✅ Done!
```

---

## Files You Have:

```
SETUP_CSV_IMPORT.sql          ← Run this FIRST in SQL Editor
import_system_config.csv       ← Import to: system_config
import_students.csv            ← Import to: users
import_courses.csv             ← Import to: courses
import_face_encodings.csv      ← Import to: face_encodings
import_attendance.csv          ← Import to: attendance (optional)
ADMIN_CSV_IMPORT_GUIDE.md      ← Full detailed guide
```

---

## ✅ After Import, Verify:

**In Supabase SQL Editor, run:**

```sql
SELECT '✓ Faculty:' as status, COUNT(*) FROM users WHERE role='faculty'
UNION ALL
SELECT '✓ Students:', COUNT(*) FROM users WHERE role='student'
UNION ALL
SELECT '✓ Courses:', COUNT(*) FROM courses
UNION ALL
SELECT '✓ Attendance:', COUNT(*) FROM attendance;
```

Should show:
- Faculty: 9
- Students: 13 (5 from setup + 8 from CSV)
- Courses: 8
- Attendance: 10 (if you import it)

---

## 🆘 Got an Error?

### "Foreign key constraint violation"
→ You skipped SETUP_CSV_IMPORT.sql step!
→ Go back and RUN that SQL first.

### "UUID doesn't match"
→ System config table might need UUID column setup
→ Just skip import_courses.csv if it fails, courses already created by setup SQL!

### "CSV doesn't match table structure"  
→ Make sure column headers match table columns in Supabase
→ If headers wrong, edit CSV headers to match

---

## That's it! 🎉

Entire database populated in < 5 minutes.

For detailed info, see: **ADMIN_CSV_IMPORT_GUIDE.md**
