# How to Import Courses to Supabase (With Valid Faculty IDs)

## Problem
The courses.csv import failed because the `faculty_id` values don't match any users in your `users` table.

**Error:**
```
Key (faculty_id)=(650e8400-e29b-400-a7d6-44665544d101) is not present in table "users"
```

---

## Solution: 3 Simple Steps

### Step 1: Create Faculty Users in Supabase

1. Go to your **Supabase Project** → **SQL Editor**
2. Paste the SQL from `INSERT_FACULTY_AND_COURSES.sql`
3. Click **Run**

This will create 8 faculty members:
- Dr. Mohammad Khan (CSE)
- Prof. Sharma (ECE)
- Ms. Priya Gupta (CSE)
- Dr. Rajesh Patel (ECE)
- Prof. Deepak Verma (CSE)
- Dr. Arun Nair (ECE)
- Prof. Suresh Roy (ME)
- Ms. Meera Desai (CE)

**The SQL also automatically inserts 10 courses with valid faculty links!**

---

### Step 2: Verify Faculty Were Created

Run this query in Supabase SQL Editor:

```sql
SELECT id, full_name, username FROM users WHERE role = 'faculty';
```

**Note the UUIDs** — you'll need these for Step 3.

---

### Step 3: (Optional) If You Want to Import CSV Instead

If you prefer to import via CSV instead of SQL:

1. Open `courses_template.csv` in your text editor
2. Replace all placeholder UUIDs:
   - `<FACULTY_ID_1>` → Dr. Khan's UUID (from Step 2)
   - `<FACULTY_ID_2>` → Prof. Sharma's UUID
   - And so on...
3. Save as `courses.csv`
4. In Supabase: **Table Editor** → `courses` table → **Upload CSV** → Select `courses.csv`

---

## Recommended Approach ✅

**Just run the SQL** — it's faster and handles everything automatically. The SQL file creates:
- ✅ 8 faculty members
- ✅ 10 courses with valid faculty references
- ✅ No foreign key errors!

---

## Files Created

1. **INSERT_FACULTY_AND_COURSES.sql** — Run this in Supabase to add faculty + courses
2. **courses_template.csv** — Template if you want to import CSV instead (requires UUID replacement)
3. **courses.csv** — (Will be generated after you get faculty UUIDs)

---

## Next Steps

1. ✅ Open Supabase SQL Editor
2. ✅ Copy-paste content from `INSERT_FACULTY_AND_COURSES.sql`
3. ✅ Click Run
4. ✅ Done! Faculty and courses should now be in your database

Let me know if you hit any issues!
