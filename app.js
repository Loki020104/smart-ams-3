/* =========================================================
   SmartAMS — app.js
   Full implementation: all Student & Faculty modules,
   Face Recognition Attendance, QR Attendance, Location Check,
   Manual Attendance, Admin super-access
   ========================================================= */

'use strict';

// capture any qr deep‑link before user logs in
window.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const qrParam = params.get('qr');
  if (qrParam) {
    sessionStorage.setItem('pending_qr', qrParam);
  }
});

// Ensure mobile devices can reach the backend when code references localhost
// If fetch calls use 'http://localhost:6001', rewrite them to the current host
;(function(){
  try {
    window.API_BASE = window.API_BASE || `http://${location.hostname}:6001`;
    const __origFetch = window.fetch.bind(window);
    window.fetch = function(input, init){
      try {
        if (typeof input === 'string' && input.startsWith('http://localhost:6001')) {
          input = input.replace('http://localhost:6001', window.API_BASE);
        } else if (input && input.url && typeof input.url === 'string' && input.url.startsWith('http://localhost:6001')) {
          // handle Request objects
          const newUrl = input.url.replace('http://localhost:6001', window.API_BASE);
          input = new Request(newUrl, input);
        }
      } catch(e){ console.warn('fetch rewrite error', e); }
      return __origFetch(input, init);
    };
  } catch(e){ console.warn('API_BASE shim failed', e); }
})();

// ── Global State ──────────────────────────────────────────
const AMS = {
  role: 'student',
  user: { name: '', id: '' },
  activeModule: '',
  cameraStream: null,
  faceRecEnabled: false,
  supabase: null,
  college: { lat:13.145615, lng: 77.574597, radiusKm: 0.2 },
  qrSession: null,
  notifications: [],
  lastCapturedImage: null
};

const COLLEGE_LAT  = 13.145615;
const COLLEGE_LNG  = 77.574597;
const COLLEGE_KM   = 0.2;

// ── Navigation config ─────────────────────────────────────
const NAV_CONFIG = {
  student: [
    { section: 'Overview', items: [
      { id:'s-dashboard',  icon:'📊', label:'Dashboard' },
      { id:'s-calendar',   icon:'📅', label:'Student Calendar' },
      { id:'s-timetable',  icon:'🕐', label:'Regular Timetable' },
    ]},
    { section: 'Academic', items: [
      { id:'s-communities',icon:'💬', label:'Subject Communities' },
      { id:'s-cbcs',       icon:'🎯', label:'Choice Based Credit' },
      { id:'s-online',     icon:'💻', label:'Online Class' },
      { id:'s-library',    icon:'📚', label:'Digital Library' },
      { id:'s-performance',icon:'📈', label:'Student Performance' },
    ]},
    { section: 'Attendance', items: [
      { id:'s-attendance', icon:'✅', label:'Attendance' },
    ]},
    { section: 'Fees & Finance', items: [
      { id:'s-fees',       icon:'💳', label:'Fee Management' },
    ]},
    { section: 'Examinations', items: [
      { id:'s-exam-reg',   icon:'📝', label:'Sem Exam Registration' },
      { id:'s-sem-reg',    icon:'🗓️', label:'Sem-Term Registration' },
      { id:'s-supple',     icon:'🔄', label:'Supplementary Exam' },
      { id:'s-reval',      icon:'🔍', label:'Exam Revaluation' },
      { id:'s-grace',      icon:'🌟', label:'Grace Mark Request' },
    ]},
    { section: 'Feedback', items: [
      { id:'s-survey',     icon:'📋', label:'Interim Course Survey' },
      { id:'s-exit',       icon:'🚪', label:'Course Exit Survey' },
      { id:'s-grievance',  icon:'⚖️', label:'Grievance Redressal' },
      { id:'s-evaluation', icon:'⭐', label:'Staff / College Eval' },
    ]},
    { section: 'Services', items: [
      { id:'s-leave',      icon:'🏖️', label:'Leave Management' },
      { id:'s-placement',  icon:'💼', label:'Placement & Training' },
      { id:'s-messages',   icon:'✉️', label:'Message Box' },
      { id:'s-notices',    icon:'📢', label:'Notice Board' },
      { id:'s-push',       icon:'🔔', label:'Notifications' },
    ]},
  ],
  faculty: [
    { section: 'Overview', items: [
      { id:'f-dashboard',  icon:'📊', label:'Dashboard' },
      { id:'f-timetable',  icon:'📅', label:'My Timetable' },
      { id:'f-workhours',  icon:'⏱️', label:'My Working Hours' },
      { id:'f-courses',    icon:'📚', label:'Course & Batch Details' },
      { id:'f-prevdetails',icon:'📋', label:'My Previous Details' },
    ]},
    { section: 'Teaching', items: [
      { id:'f-obe',        icon:'🎯', label:'OBE Configuration' },
      { id:'f-lesson',     icon:'📝', label:'Lesson Planner' },
      { id:'f-online',     icon:'💻', label:'Online Class Mgmt' },
      { id:'f-materials',  icon:'📂', label:'Course Materials' },
      { id:'f-collegetimetable', icon:'🗓️', label:'College Timetable' },
    ]},
    { section: 'Attendance', items: [
      { id:'f-attendance', icon:'✅', label:'Attendance Marking' },
    ]},
    { section: 'Assessments', items: [
      { id:'f-assessments',icon:'📋', label:'Assessments' },
      { id:'f-assignments',icon:'📄', label:'Assignments' },
      { id:'f-internal',   icon:'🏫', label:'Internal Examination' },
      { id:'f-qpaper',     icon:'📃', label:'Question Paper Gen' },
    ]},
    { section: 'Reports', items: [
      { id:'f-coursefile', icon:'🗂️', label:'Course File / Diary' },
      { id:'f-marks',      icon:'🔢', label:'Mark Computation' },
      { id:'f-reports',    icon:'📊', label:'Custom Reports' },
      { id:'f-onlineexam', icon:'🖥️', label:'Online Examination' },
      { id:'f-staffrpt',   icon:'👤', label:'Staff Active Report' },
    ]},
    { section: 'Student Management', items: [
      { id:'f-studentleave',icon:'🏖️', label:'Student Leave Mgmt' },
      { id:'f-transport',  icon:'🚌', label:'Transport' },
      { id:'f-messages',   icon:'✉️', label:'Message Box' },
    ]},
    { section: 'Institution', items: [
      { id:'f-rules',      icon:'📜', label:'Rules & Regulations' },
      { id:'f-committee',  icon:'🏛️', label:'Committee' },
      { id:'f-examduty',   icon:'📋', label:'Exam / Invigilation' },
      { id:'f-ratings',    icon:'⭐', label:'My Ratings' },
    ]},
    { section: 'Self', items: [
      { id:'f-worklog',    icon:'📋', label:'Daily Work Log' },
      { id:'f-appraisal',  icon:'🌟', label:'Staff Appraisal' },
    ]},
  ],
  admin: [
    { section: 'System', items: [
      { id:'a-dashboard',  icon:'📊', label:'Dashboard' },
      { id:'a-users',      icon:'👥', label:'User Management' },
      { id:'a-register',   icon:'👤', label:'Face Registration' },
      { id:'a-config',     icon:'⚙️', label:'System Config' },
      { id:'a-logs',       icon:'📋', label:'Audit Logs' },
    ]},
    { section: 'Institution Management', items: [
      { id:'a-isorules',   icon:'📜', label:'ISO Rules / Faculty Rules' },
      { id:'a-timetable',  icon:'🗓️', label:'College Timetable Mgmt' },
      { id:'a-committee',  icon:'🏛️', label:'Committee Management' },
      { id:'a-exam',       icon:'📝', label:'Exam Module' },
    ]},
    { section: 'Student Modules (Admin)', items: [
      { id:'a-s-attendance',icon:'✅', label:'Student Attendance' },
      { id:'a-s-fees',      icon:'💳', label:'Student Fees' },
      { id:'a-s-performance',icon:'📈',label:'Student Performance' },
      { id:'a-s-leave',     icon:'🏖️', label:'Leave Management' },
      { id:'a-s-placement', icon:'💼', label:'Placement Data' },
      { id:'a-s-grievance', icon:'⚖️', label:'Grievances' },
    ]},
    { section: 'Reports', items: [
      { id:'a-reports',    icon:'📊', label:'Global Reports' },
    ]},
  ]
};

// ── Utility helpers ───────────────────────────────────────
function toast(msg, type='info', dur=3500){
  const el=document.createElement('div');
  el.className=`notif notif-${type}`;
  const icons={success:'✅',error:'❌',info:'ℹ️',warning:'⚠️'};
  el.innerHTML=`<span>${icons[type]||'•'}</span><span>${msg}</span>`;
  document.getElementById('notifContainer').appendChild(el);
  setTimeout(()=>el.remove(), dur);
}
function haversineKm(lat1,lng1,lat2,lng2){
  const R=6371,dLat=(lat2-lat1)*Math.PI/180,dLng=(lng2-lng1)*Math.PI/180;
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
function isInCollege(lat,lng){
  // Use dynamic college coordinates from AMS.college when available
  const clat = (AMS.college && AMS.college.lat) ? AMS.college.lat : COLLEGE_LAT;
  const clng = (AMS.college && AMS.college.lng) ? AMS.college.lng : COLLEGE_LNG;
  const crad = (AMS.college && typeof AMS.college.radiusKm === 'number') ? AMS.college.radiusKm : COLLEGE_KM;
  return haversineKm(lat,lng,clat,clng) <= crad;
}
function getLocation(){
  return new Promise((res,rej)=>{
    // Default location: Bangalore, India (13.1718° N, 77.5362° E)
    const defaultLocation = {lat:13.1718,lng:77.5362};
    
    if(!navigator.geolocation) {
      res(defaultLocation);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      p=>res({lat:p.coords.latitude,lng:p.coords.longitude}),
      e=>res(defaultLocation),
      {timeout:10000,enableHighAccuracy:true}
    );
  });
}
function fmtDate(d=new Date()){
  return d.toLocaleDateString('en-IN',{weekday:'short',year:'numeric',month:'short',day:'numeric'});
}
function fmtTime(d=new Date()){return d.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}
function randomId(){return Math.random().toString(36).slice(2,9).toUpperCase()}
function stopCamera(){if(AMS.cameraStream){AMS.cameraStream.getTracks().forEach(t=>t.stop());AMS.cameraStream=null}}

// ── Camera helpers ────────────────────────────────────────
async function startCamera(videoEl){
  stopCamera();
  if(!videoEl) throw new Error('Video element not found');
  console.log('🎥 Starting camera...');
  try{
    let stream;
    try{
      stream=await navigator.mediaDevices.getUserMedia({
        video:{width:{ideal:640},height:{ideal:480},facingMode:'user'},audio:false
      });
    }catch(e1){
      console.warn('First attempt failed, trying basic video...',e1);
      stream=await navigator.mediaDevices.getUserMedia({video:true});
    }
    AMS.cameraStream=stream;
    videoEl.srcObject=stream;
    
    // Ensure video element is visible and has proper dimensions
    videoEl.style.display = 'block';
    videoEl.style.width = '100%';
    videoEl.style.height = '100%';
    
    // Wait for metadata and play
    let metadataLoaded=false;
    const metadataHandler = () => {metadataLoaded=true;};
    videoEl.addEventListener('loadedmetadata', metadataHandler, {once:true});
    
    try{
      const playPromise=videoEl.play();
      if(playPromise!==undefined) await playPromise;
    }catch(e){console.error('⚠️ Play error:',e)}
    
    // More generous wait for video to actually render (up to 5 seconds)
    let waited=0;
    const maxWait = 100; // 100 * 50ms = 5 seconds
    while((!metadataLoaded || videoEl.videoWidth===0 || videoEl.videoHeight===0) && waited<maxWait){
      await new Promise(r=>setTimeout(r,50));
      waited++;
    }
    
    // Final check with additional delay
    if(videoEl.videoWidth===0 || videoEl.videoHeight===0){
      console.warn(`⚠️ Video dimensions still 0: ${videoEl.videoWidth}x${videoEl.videoHeight}, waiting more...`);
      await new Promise(r=>setTimeout(r,1000));
    }
    
    // Force re-check of dimensions
    if(videoEl.videoWidth > 0 && videoEl.videoHeight > 0) {
      console.log(`✅ Camera ready: ${videoEl.videoWidth}x${videoEl.videoHeight}`);
    } else {
      console.warn(`⚠️ Video element still shows 0x0 dimensions, but proceeding anyway`);
    }
    
    return stream;
  }catch(err){
    console.error('❌ Camera startup failed:', err);
    toast(`Camera error: ${err.message}`,'error');
    throw err;
  }
}
function captureFrame(videoEl){
  console.log(`Capture attempt: video ${videoEl.videoWidth}x${videoEl.videoHeight}, readyState=${videoEl.readyState}`);
  if(videoEl.videoWidth===0||videoEl.videoHeight===0){
    throw new Error(`Video stream not ready (${videoEl.videoWidth}x${videoEl.videoHeight}). Try waiting a moment and retrying.`);
  }
  const c=document.createElement('canvas');
  c.width=videoEl.videoWidth; c.height=videoEl.videoHeight;
  c.getContext('2d').drawImage(videoEl,0,0);
  console.log(`✅ Frame captured: ${c.width}x${c.height}`);
  return c.toDataURL('image/jpeg',0.9);
}

// ── Face verification ─────────────────────────────────────
async function verifyFace(imageData){
  try {
    // imageData may be a base64 string already or the special marker 'captured'
    let b64Image = '';
    if(imageData === 'captured') {
      // legacy path: try canvas then lastCapturedImage
      const canvas = document.getElementById('faceCanvas');
      if(canvas) {
        b64Image = canvas.toDataURL('image/jpeg', 0.9);
      } else if(AMS.lastCapturedImage) {
        b64Image = AMS.lastCapturedImage;
      } else {
        return { verified: false, error: 'No image captured' };
      }
    } else {
      b64Image = imageData;
    }
    
    // Get logged-in student's roll number from session
    const student_info = JSON.parse(sessionStorage.getItem('student_info') || '{}');
    const logged_in_roll_no = student_info.roll_no;
    
    if(!logged_in_roll_no) {
      return { verified: false, error: 'Student not logged in' };
    }
    
    // Generate/get attendance session ID (unique per attendance session)
    let session_id = sessionStorage.getItem('face_attendance_session_id');
    if(!session_id) {
      session_id = 'face_' + Date.now() + '_' + logged_in_roll_no;
      sessionStorage.setItem('face_attendance_session_id', session_id);
    }
    
    // Get geolocation
    let latitude, longitude;
    if(navigator.geolocation) {
      try {
        const pos = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {timeout: 5000});
        });
        latitude = pos.coords.latitude;
        longitude = pos.coords.longitude;
      } catch(e) {
        console.warn('Geolocation failed:', e);
      }
    }
    
    // Call backend verify endpoint with student identity
    const resp = await fetch('http://localhost:6001/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        image: b64Image,
        roll_no: logged_in_roll_no,
        session_id: session_id,
        latitude: latitude,
        longitude: longitude
      })
    }).catch(e => {
      console.error('Fetch error:', e);
      return null;
    });
    
    if(!resp) {
      return { verified: false, error: 'Backend connection failed' };
    }
    
    const data = await resp.json().catch(e => {
      console.error('JSON parse error:', e);
      return { verified: false, error: 'Invalid server response' };
    });
    
    return data;
  } catch(e) {
    console.error('Verify error:', e);
    return { verified: false, error: e.message };
  }
}

// ── Login / Logout ────────────────────────────────────────
function selectRole(el){
  document.querySelectorAll('.role-tab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  AMS.role=el.dataset.role;
}
async function doLogin(){
  const u=document.getElementById('loginUser').value.trim();
  const p=document.getElementById('loginPass').value;
  if(!u||!p){toast('Enter credentials','warning');return}
  try{
    const resp=await fetch('http://localhost:6001/api/users/login',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({username:u,password:p})
    }).catch(()=>null);
    if(resp && resp.ok){
      const data=await resp.json();
      if(data.success){
        const displayId = data.user.role === 'student' 
  ? (data.user.roll_no || data.user.id)
  : (data.user.employee_id || data.user.id);
AMS.user={name:data.user.full_name||data.user.username, id:displayId, username:data.user.username, email:data.user.email};
        AMS.role=data.user.role;
        localStorage.setItem('ams_session', JSON.stringify({user: AMS.user, role: AMS.role}));
        
        // Store student info in sessionStorage for face verification
        if(data.user.role === 'student') {
          sessionStorage.setItem('student_info', JSON.stringify({
            full_name: data.user.full_name || data.user.username,
            roll_no: data.user.roll_no,
            id: data.user.id
          }));
        }
        
        initDashboard();
        // if a QR deeplink was saved while unauthenticated, process it now
        const pending = sessionStorage.getItem('pending_qr');
        if(pending){
          sessionStorage.removeItem('pending_qr');
          // ensure dashboard shows attendance module
          loadModule('s-attendance','Attendance');
          setTimeout(()=>{QRModule.processScannedQR(pending);},200);
        }
        return;
      }else{toast(data.error||'Login failed','error');return;}
    }else{
      const data=await resp.json().catch(()=>({}));
      toast(data.error||'Login failed','error');
    }
  }catch(e){
    toast('Backend connection error','error');
  }
}
function doLogout(){
  stopCamera();
  localStorage.removeItem('ams_session');
  sessionStorage.removeItem('student_info');
  sessionStorage.removeItem('face_attendance_session_id');
  AMS.user={name:'',id:''};AMS.role='student';
  document.getElementById('dashboard').style.display='none';
  document.getElementById('loginPage').style.display='flex';
  document.getElementById('loginUser').value='';
  document.getElementById('loginPass').value='';
}

// ════════════════════════════════════════════════════════════════════════
// GLOBAL STATE MANAGEMENT & MODAL SYSTEM FOR DYNAMIC BUTTONS
// ════════════════════════════════════════════════════════════════════════

// In-memory database (replaces Supabase for session data)
const STATE = {
  users: [
    { id: 1, name: 'Raj Kumar', email: 'raj@example.com', role: 'student', department: 'CSE', status: 'active' },
    { id: 2, name: 'Priya Singh', email: 'priya@example.com', role: 'faculty', department: 'ECE', status: 'active' },
  ],
  isoRules: [
    { id: 1, text: 'Attendance must be maintained at 75%', status: 'active', lastUpdated: '2025-03-01' },
    { id: 2, text: 'No mobile phones in classroom', status: 'active', lastUpdated: '2025-02-28' },
  ],
  committees: [
    { id: 1, name: 'Academic Committee', members: ['Dr. Mohammad', 'Prof. Sharma', 'Ms. Gupta'], minutes: 'Last meeting discussed curriculum updates' },
  ],
  exams: [
    { id: 1, name: 'Mid-term Exam', course: 'DSA', date: '2025-03-15', hallsAssigned: false, staffAssigned: false },
  ],
  timetable: [
    { id: 1, subject: 'Data Structures', faculty: 'Dr. Khan', room: '101', day: 'Monday', time: '10:00', locked: false },
  ],
  auditLogs: [
    { id: 1, action: 'User Login', user: 'admin1', timestamp: '2025-03-03 09:30', details: 'IP: 192.168.1.1' },
  ],
  lessonTopics: [
    { id: 1, courseId: 'CS101', topicName: 'Arrays', hours: 2, status: 'completed', createdAt: '2025-02-20' },
  ],
  courseMaterials: [
    { id: 1, courseId: 'CS101', name: 'Lecture Slides 1', topic: 'Arrays', locked: false },
  ],
  studentLeaves: [
    { id: 1, studentId: 'STU001', reason: 'Medical', status: 'Pending', appliedDate: '2025-03-01' },
  ],
  workLogs: [
    { id: 1, facultyId: 'FAC001', logDate: '2025-03-03', activities: 'Taught DSA class, Created quiz', status: 'Submitted' },
  ],
  appraisals: [
    { id: 1, facultyId: 'FAC001', achievement: 'Completed course curriculum ahead of schedule', status: 'Pending', createdAt: '2025-03-02' },
  ],
  fees: [
    { id: 1, studentId: 'STU001', amount: 50000, paid: 0, balance: 50000, status: 'Pending' },
  ],
  leaveApplications: [
    { id: 1, studentId: 'STU001', reason: 'Medical', fromDate: '2025-03-05', toDate: '2025-03-07', status: 'Pending' },
  ],
  placements: [
    { id: 1, studentId: 'STU001', companyName: 'TCS', status: 'Not Applied', appliedDate: null },
  ],
  grievances: [
    { id: 1, studentId: 'STU001', title: 'Grade Discrepancy', description: 'Marks not updated correctly', status: 'Pending', ticketId: 'GRV-1001' },
  ],
  surveys: [
    { id: 1, courseId: 'CS101', title: 'Course Feedback', questions: ['Was content clear?', 'Pace of class?'], submitted: false },
  ],
  messages: [
    { id: 1, from: 'Prof. Khan', subject: 'Assignment Details', body: 'Submit by Friday', folder: 'Inbox', date: '2025-03-02' },
  ],
  communityPosts: {
    'Mathematics': [
      { id: 1, author: 'Student A', content: 'How to solve limits?', date: '2025-03-02', replies: [] },
    ],
    'Physics': [
      { id: 1, author: 'Student B', content: 'Electromagnetic theory doubts', date: '2025-03-01', replies: [] },
    ],
  },
};

// Universal Modal System
function showModal(title, content, buttons = []) {
  let modal = document.getElementById('universalModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'universalModal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3 id="modalTitle"></h3>
          <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        <div id="modalBody"></div>
        <div id="modalFooter" class="modal-footer"></div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = content;
  
  const footer = document.getElementById('modalFooter');
  footer.innerHTML = '';
  buttons.forEach(btn => {
    const btnEl = document.createElement('button');
    btnEl.className = `btn ${btn.class || 'btn-primary'}`;
    btnEl.textContent = btn.text;
    btnEl.onclick = () => {
      btn.onClick();
      if (btn.closeAfter !== false) closeModal();
    };
    footer.appendChild(btnEl);
  });
  
  modal.style.display = 'flex';
}

function closeModal() {
  const modal = document.getElementById('universalModal');
  if (modal) modal.style.display = 'none';
}

function showConfirmDialog(message, onConfirm) {
  showModal('Confirm Action', `<p>${message}</p>`, [
    { text: 'Cancel', class: 'btn-secondary', onClick: () => {} },
    { text: 'Confirm', class: 'btn-danger', onClick: onConfirm },
  ]);
}

// CSV Export Utility
function exportToCSV(filename, data, columns) {
  const headers = columns.map(c => c.label).join(',');
  const rows = data.map(row => columns.map(c => row[c.key] || '').join(','));
  const csv = [headers, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
  toast(`✅ Exported ${filename}`, 'success');
}

// Print Utility
function printContent(title, content) {
  const printWin = window.open('', '', 'height=600,width=800');
  printWin.document.write(`<html><head><title>${title}</title></head><body>`);
  printWin.document.write(content);
  printWin.document.write('</body></html>');
  printWin.document.close();
  printWin.print();
}

// ════════════════════════════════════════════════════════════════════════
// ADMIN MODULE BUTTONS
// ════════════════════════════════════════════════════════════════════════

// User Management
function editUser(userId) {
  const user = STATE.users.find(u => u.id === userId);
  const content = `
    <div class="form-group">
      <label>Name:</label>
      <input type="text" id="editUserName" value="${user.name}">
    </div>
    <div class="form-group">
      <label>Email:</label>
      <input type="email" id="editUserEmail" value="${user.email}">
    </div>
    <div class="form-group">
      <label>Role:</label>
      <select id="editUserRole">
        <option value="student" ${user.role === 'student' ? 'selected' : ''}>Student</option>
        <option value="faculty" ${user.role === 'faculty' ? 'selected' : ''}>Faculty</option>
        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
      </select>
    </div>
    <div class="form-group">
      <label>Department:</label>
      <input type="text" id="editUserDept" value="${user.department}">
    </div>
  `;
  
  showModal('Edit User', content, [
    { text: 'Cancel', class: 'btn-secondary', onClick: () => {} },
    { text: 'Save', class: 'btn-primary', onClick: () => {
      user.name = document.getElementById('editUserName').value;
      user.email = document.getElementById('editUserEmail').value;
      user.role = document.getElementById('editUserRole').value;
      user.department = document.getElementById('editUserDept').value;
      toast(`✅ User ${user.name} updated`, 'success');
      refreshUserTable();
    }},
  ]);
}

function deleteUser(userId) {
  const user = STATE.users.find(u => u.id === userId);
  showConfirmDialog(`Delete user "${user.name}"? This cannot be undone.`, () => {
    STATE.users = STATE.users.filter(u => u.id !== userId);
    toast(`✅ User deleted`, 'success');
    refreshUserTable();
  });
}

function searchUsers(query) {
  const results = STATE.users.filter(u => 
    u.name.toLowerCase().includes(query) || 
    u.email.toLowerCase().includes(query)
  );
  refreshUserTable(results);
}

function refreshUserTable(users = STATE.users) {
  const table = document.getElementById('userTable');
  if (table) {
    table.innerHTML = users.map(u => `
      <tr>
        <td>${u.name}</td>
        <td>${u.email}</td>
        <td>${u.role}</td>
        <td>${u.department}</td>
        <td><button class="btn-sm" onclick="editUser(${u.id})">Edit</button></td>
        <td><button class="btn-sm btn-danger" onclick="deleteUser(${u.id})">Delete</button></td>
      </tr>
    `).join('');
  }
}

// ISO Rules
function editRule(ruleId) {
  const rule = STATE.isoRules.find(r => r.id === ruleId);
  const content = `
    <div class="form-group">
      <label>Rule Text:</label>
      <textarea id="editRuleText" style="width:100%;min-height:150px">${rule.text}</textarea>
    </div>
  `;
  
  showModal('Edit ISO Rule', content, [
    { text: 'Cancel', class: 'btn-secondary', onClick: () => {} },
    { text: 'Save', class: 'btn-primary', onClick: () => {
      rule.text = document.getElementById('editRuleText').value;
      rule.lastUpdated = new Date().toISOString().split('T')[0];
      toast(`✅ Rule updated`, 'success');
      refreshRulesList();
    }},
  ]);
}

function deleteRule(ruleId) {
  const rule = STATE.isoRules.find(r => r.id === ruleId);
  showConfirmDialog(`Delete this rule? This cannot be undone.`, () => {
    STATE.isoRules = STATE.isoRules.filter(r => r.id !== ruleId);
    toast(`✅ Rule deleted`, 'success');
    refreshRulesList();
  });
}

function toggleRuleStatus(ruleId) {
  const rule = STATE.isoRules.find(r => r.id === ruleId);
  rule.status = rule.status === 'active' ? 'inactive' : 'active';
  toast(`✅ Rule status changed to ${rule.status}`, 'success');
  refreshRulesList();
}

function refreshRulesList() {
  const list = document.getElementById('rulesList');
  if (list) {
    list.innerHTML = STATE.isoRules.map(r => `
      <div class="rule-item">
        <div>${r.text}</div>
        <div class="rule-controls">
          <label><input type="checkbox" ${r.status === 'active' ? 'checked' : ''} onclick="toggleRuleStatus(${r.id})"> Active</label>
          <button class="btn-sm" onclick="editRule(${r.id})">Edit</button>
          <button class="btn-sm btn-danger" onclick="deleteRule(${r.id})">Delete</button>
        </div>
      </div>
    `).join('');
  }
}

// Committee Management
function manageMembers(committeeId) {
  const committee = STATE.committees.find(c => c.id === committeeId);
  const membersList = committee.members.map(m => `<div class="member-item">${m} <button class="btn-sm btn-danger" onclick="removeMember('${committee.id}', '${m}')">×</button></div>`).join('');
  
  const content = `
    <div>
      <h4>Current Members:</h4>
      <div id="membersList">${membersList}</div>
      <div class="form-group" style="margin-top: 15px;">
        <input type="text" id="newMemberName" placeholder="Add new member name">
        <button class="btn-sm" onclick="addMember(${committeeId})">Add</button>
      </div>
    </div>
  `;
  
  showModal(`Members - ${committee.name}`, content, [
    { text: 'Close', class: 'btn-secondary', onClick: () => {} },
  ]);
}

function addMember(committeeId) {
  const committee = STATE.committees.find(c => c.id === committeeId);
  const name = document.getElementById('newMemberName').value.trim();
  if (name) {
    committee.members.push(name);
    document.getElementById('newMemberName').value = '';
    manageMembers(committeeId); // Refresh modal
    toast(`✅ Member added`, 'success');
  }
}

function removeMember(committeeId, memberName) {
  const committee = STATE.committees.find(c => c.id === committeeId);
  committee.members = committee.members.filter(m => m !== memberName);
  manageMembers(committeeId); // Refresh modal
}

function viewMinutes(committeeId) {
  const committee = STATE.committees.find(c => c.id === committeeId);
  const content = `
    <div class="form-group">
      <label>Meeting Minutes:</label>
      <textarea id="minutesText" style="width:100%;min-height:200px">${committee.minutes}</textarea>
    </div>
  `;
  
  showModal('Meeting Minutes', content, [
    { text: 'Cancel', class: 'btn-secondary', onClick: () => {} },
    { text: 'Save', class: 'btn-primary', onClick: () => {
      STATE.committees.find(c => c.id === committeeId).minutes = document.getElementById('minutesText').value;
      toast(`✅ Minutes saved`, 'success');
    }},
  ]);
}

function deleteCommittee(committeeId) {
  showConfirmDialog('Delete this committee? This cannot be undone.', () => {
    STATE.committees = STATE.committees.filter(c => c.id !== committeeId);
    toast(`✅ Committee deleted`, 'success');
    refreshCommitteesList();
  });
}

function refreshCommitteesList() {
  const list = document.getElementById('committeesList');
  if (list) {
    list.innerHTML = STATE.committees.map(c => `
      <div class="committee-item">
        <h4>${c.name}</h4>
        <p>Members: ${c.members.join(', ')}</p>
        <div class="btn-group">
          <button class="btn-sm" onclick="manageMembers(${c.id})">Members</button>
          <button class="btn-sm" onclick="viewMinutes(${c.id})">Minutes</button>
          <button class="btn-sm btn-danger" onclick="deleteCommittee(${c.id})">Delete</button>
        </div>
      </div>
    `).join('');
  }
}

// Exam Module
function createExam() {
  const content = `
    <div class="form-group">
      <label>Exam Name:</label>
      <input type="text" id="newExamName" placeholder="e.g., Mid-term Exam">
    </div>
    <div class="form-group">
      <label>Course:</label>
      <input type="text" id="newExamCourse" placeholder="e.g., DSA">
    </div>
    <div class="form-group">
      <label>Date:</label>
      <input type="date" id="newExamDate">
    </div>
  `;
  
  showModal('Create New Exam', content, [
    { text: 'Cancel', class: 'btn-secondary', onClick: () => {} },
    { text: 'Create', class: 'btn-primary', onClick: () => {
      const name = document.getElementById('newExamName').value;
      const course = document.getElementById('newExamCourse').value;
      const date = document.getElementById('newExamDate').value;
      if (name && course && date) {
        STATE.exams.push({
          id: Math.max(...STATE.exams.map(e => e.id || 0)) + 1,
          name, course, date, hallsAssigned: false, staffAssigned: false
        });
        toast(`✅ Exam "${name}" created`, 'success');
        refreshExamsList();
      }
    }},
  ]);
}

function assignHalls(examId) {
  const exam = STATE.exams.find(e => e.id === examId);
  const content = `<p>Assign halls for ${exam.name}:</p><input type="text" id="hallsInput" placeholder="Comma-separated hall numbers">`;
  showModal('Assign Exam Halls', content, [
    { text: 'Cancel', class: 'btn-secondary', onClick: () => {} },
    { text: 'Assign', class: 'btn-primary', onClick: () => {
      exam.hallsAssigned = true;
      toast(`✅ Halls assigned for ${exam.name}`, 'success');
      refreshExamsList();
    }},
  ]);
}

function assignStaff(examId) {
  const exam = STATE.exams.find(e => e.id === examId);
  const content = `<p>Assign invigilators for ${exam.name}:</p><select id="staffSelect"><option>Dr. Khan</option><option>Prof. Sharma</option><option>Ms. Gupta</option></select><button class="btn-sm" onclick="addInvigilator()">Add</button><div id="staffList"></div>`;
  showModal('Assign Invigilators', content, [
    { text: 'Done', class: 'btn-primary', onClick: () => {
      exam.staffAssigned = true;
      toast(`✅ Staff assigned for ${exam.name}`, 'success');
      refreshExamsList();
    }},
  ]);
}

function refreshExamsList() {
  const list = document.getElementById('examsList');
  if (list) {
    list.innerHTML = STATE.exams.map(e => `
      <div class="exam-item">
        <h4>${e.name} - ${e.course} (${e.date})</h4>
        <div class="btn-group">
          <button class="btn-sm" onclick="assignHalls(${e.id})">Assign Halls</button>
          <button class="btn-sm" onclick="assignStaff(${e.id})">Assign Staff</button>
        </div>
      </div>
    `).join('');
  }
}

// Timetable Management
function editTimetableEntry(entryId) {
  const entry = STATE.timetable.find(t => t.id === entryId);
  const content = `
    <div class="form-group">
      <label>Subject:</label>
      <input type="text" id="editSubject" value="${entry.subject}">
    </div>
    <div class="form-group">
      <label>Faculty:</label>
      <input type="text" id="editFaculty" value="${entry.faculty}">
    </div>
    <div class="form-group">
      <label>Room:</label>
      <input type="text" id="editRoom" value="${entry.room}">
    </div>
  `;
  
  showModal('Edit Timetable Entry', content, [
    { text: 'Cancel', class: 'btn-secondary', onClick: () => {} },
    { text: 'Save', class: 'btn-primary', onClick: () => {
      entry.subject = document.getElementById('editSubject').value;
      entry.faculty = document.getElementById('editFaculty').value;
      entry.room = document.getElementById('editRoom').value;
      toast(`✅ Timetable entry updated`, 'success');
      refreshTimetable();
    }},
  ]);
}

function viewTimetableDetails(entryId) {
  const entry = STATE.timetable.find(t => t.id === entryId);
  const content = `
    <p><strong>Subject:</strong> ${entry.subject}</p>
    <p><strong>Faculty:</strong> ${entry.faculty}</p>
    <p><strong>Room:</strong> ${entry.room}</p>
    <p><strong>Day:</strong> ${entry.day}</p>
    <p><strong>Time:</strong> ${entry.time}</p>
  `;
  
  showModal('Timetable Details', content, [
    { text: 'Close', class: 'btn-secondary', onClick: () => {} },
  ]);
}

function refreshTimetable() {
  const table = document.getElementById('timetableTable');
  if (table) {
    table.innerHTML = STATE.timetable.map(t => `
      <tr>
        <td>${t.day}</td>
        <td>${t.time}</td>
        <td>${t.subject}</td>
        <td>${t.faculty}</td>
        <td>${t.room}</td>
        <td><button class="btn-sm" onclick="editTimetableEntry(${t.id})">Edit</button></td>
        <td><button class="btn-sm" onclick="viewTimetableDetails(${t.id})">View</button></td>
      </tr>
    `).join('');
  }
}

// Audit Logs Export
function exportAuditLogs() {
  exportToCSV('audit_logs.csv', STATE.auditLogs, [
    { key: 'action', label: 'Action' },
    { key: 'user', label: 'User' },
    { key: 'timestamp', label: 'Timestamp' },
    { key: 'details', label: 'Details' },
  ]);
}

// ════════════════════════════════════════════════════════════════════════
// FACULTY MODULE BUTTONS
// ════════════════════════════════════════════════════════════════════════

// Timetable Lock/Unlock
function lockUnlockTimetable(entryId) {
  const entry = STATE.timetable.find(t => t.id === entryId);
  entry.locked = !entry.locked;
  toast(`✅ Timetable ${entry.locked ? 'locked' : 'unlocked'}`, 'success');
  refreshFacultyTimetable();
}

function markAttendance(entryId) {
  const entry = STATE.timetable.find(t => t.id === entryId);
  showModal('Mark Attendance', `<p>Manual attendance for ${entry.subject}</p><textarea id="attendanceNotes" placeholder="Attendance notes..."></textarea>`, [
    { text: 'Cancel', class: 'btn-secondary', onClick: () => {} },
    { text: 'Submit', class: 'btn-primary', onClick: () => {
      toast(`✅ Attendance marked for ${entry.subject}`, 'success');
    }},
  ]);
}

function refreshFacultyTimetable() {
  const table = document.getElementById('facultyTimetableTable');
  if (table) {
    table.innerHTML = STATE.timetable.map(t => `
      <tr>
        <td>${t.day}</td>
        <td>${t.time}</td>
        <td>${t.subject}</td>
        <td><span class="lock-icon">${t.locked ? '🔒' : '🔓'}</span></td>
        <td>
          <button class="btn-sm" onclick="lockUnlockTimetable(${t.id})">${t.locked ? 'Unlock' : 'Lock'}</button>
          <button class="btn-sm" onclick="markAttendance(${t.id})">Mark</button>
        </td>
      </tr>
    `).join('');
  }
}

// Lesson Planner
function addTopic() {
  const content = `
    <div class="form-group">
      <label>Topic Name:</label>
      <input type="text" id="topicName" placeholder="e.g., Arrays and Linked Lists">
    </div>
    <div class="form-group">
      <label>Hours:</label>
      <input type="number" id="topicHours" value="2" min="1">
    </div>
    <div class="form-group">
      <label>Status:</label>
      <select id="topicStatus">
        <option>Planned</option>
        <option>In Progress</option>
        <option>Completed</option>
      </select>
    </div>
  `;
  
  showModal('Add New Topic', content, [
    { text: 'Cancel', class: 'btn-secondary', onClick: () => {} },
    { text: 'Add', class: 'btn-primary', onClick: () => {
      const name = document.getElementById('topicName').value;
      if (name) {
        STATE.lessonTopics.push({
          id: Math.max(...STATE.lessonTopics.map(t => t.id || 0)) + 1,
          courseId: 'CS101',
          topicName: name,
          hours: document.getElementById('topicHours').value,
          status: document.getElementById('topicStatus').value.toLowerCase().replace(' ', '-'),
          createdAt: new Date().toISOString().split('T')[0]
        });
        toast(`✅ Topic added`, 'success');
        refreshLessonPlanner();
      }
    }},
  ]);
}

function editTopic(topicId) {
  const topic = STATE.lessonTopics.find(t => t.id === topicId);
  const content = `
    <div class="form-group">
      <label>Topic Name:</label>
      <input type="text" id="editTopicName" value="${topic.topicName}">
    </div>
    <div class="form-group">
      <label>Hours:</label>
      <input type="number" id="editTopicHours" value="${topic.hours}">
    </div>
    <div class="form-group">
      <label>Status:</label>
      <select id="editTopicStatus">
        <option ${topic.status === 'planned' ? 'selected' : ''}>Planned</option>
        <option ${topic.status === 'in-progress' ? 'selected' : ''}>In Progress</option>
        <option ${topic.status === 'completed' ? 'selected' : ''}>Completed</option>
      </select>
    </div>
  `;
  
  showModal('Edit Topic', content, [
    { text: 'Cancel', class: 'btn-secondary', onClick: () => {} },
    { text: 'Save', class: 'btn-primary', onClick: () => {
      topic.topicName = document.getElementById('editTopicName').value;
      topic.hours = document.getElementById('editTopicHours').value;
      topic.status = document.getElementById('editTopicStatus').value.toLowerCase().replace(' ', '-');
      toast(`✅ Topic updated`, 'success');
      refreshLessonPlanner();
    }},
  ]);
}

function deleteTopic(topicId) {
  showConfirmDialog('Delete this topic? This cannot be undone.', () => {
    STATE.lessonTopics = STATE.lessonTopics.filter(t => t.id !== topicId);
    toast(`✅ Topic deleted`, 'success');
    refreshLessonPlanner();
  });
}

function refreshLessonPlanner() {
  const list = document.getElementById('lessonTopicsList');
  if (list) {
    list.innerHTML = STATE.lessonTopics.map(t => `
      <div class="lesson-item">
        <h4>${t.topicName}</h4>
        <p>Hours: ${t.hours} | Status: ${t.status}</p>
        <div class="btn-group">
          <button class="btn-sm" onclick="editTopic(${t.id})">Edit</button>
          <button class="btn-sm btn-danger" onclick="deleteTopic(${t.id})">Delete</button>
        </div>
      </div>
    `).join('');
  }
}

// Course Materials
function lockUnlockMaterial(materialId) {
  const material = STATE.courseMaterials.find(m => m.id === materialId);
  material.locked = !material.locked;
  toast(`✅ Material ${material.locked ? 'locked' : 'unlocked'}`, 'success');
  refreshCourseMaterials();
}

function editMaterial(materialId) {
  const material = STATE.courseMaterials.find(m => m.id === materialId);
  const content = `
    <div class="form-group">
      <label>Name:</label>
      <input type="text" id="editMatName" value="${material.name}">
    </div>
    <div class="form-group">
      <label>Topic:</label>
      <input type="text" id="editMatTopic" value="${material.topic}">
    </div>
  `;
  
  showModal('Edit Material', content, [
    { text: 'Cancel', class: 'btn-secondary', onClick: () => {} },
    { text: 'Save', class: 'btn-primary', onClick: () => {
      material.name = document.getElementById('editMatName').value;
      material.topic = document.getElementById('editMatTopic').value;
      toast(`✅ Material updated`, 'success');
      refreshCourseMaterials();
    }},
  ]);
}

function deleteMaterial(materialId) {
  showConfirmDialog('Delete this material? Students will lose access.', () => {
    STATE.courseMaterials = STATE.courseMaterials.filter(m => m.id !== materialId);
    toast(`✅ Material deleted`, 'success');
    refreshCourseMaterials();
  });
}

function refreshCourseMaterials() {
  const list = document.getElementById('materialsListFaculty');
  if (list) {
    list.innerHTML = STATE.courseMaterials.map(m => `
      <div class="material-item">
        <h4>${m.name}</h4>
        <p>Topic: ${m.topic} | ${m.locked ? '🔒' : '📂'}</p>
        <div class="btn-group">
          <button class="btn-sm" onclick="lockUnlockMaterial(${m.id})">${m.locked ? 'Unlock' : 'Lock'}</button>
          <button class="btn-sm" onclick="editMaterial(${m.id})">Edit</button>
          <button class="btn-sm btn-danger" onclick="deleteMaterial(${m.id})">Delete</button>
        </div>
      </div>
    `).join('');
  }
}

// Student Leave Management
function forwardLeave(leaveId) {
  const leave = STATE.studentLeaves.find(l => l.id === leaveId);
  leave.status = 'Forwarded';
  toast(`✅ Leave forwarded`, 'success');
  refreshStudentLeaves();
}

function rejectLeave(leaveId) {
  const leave = STATE.studentLeaves.find(l => l.id === leaveId);
  leave.status = 'Rejected';
  toast(`⚠️ Leave rejected`, 'warning');
  refreshStudentLeaves();
}

function refreshStudentLeaves() {
  const table = document.getElementById('studentLeavesTable');
  if (table) {
    table.innerHTML = STATE.studentLeaves.map(l => `
      <tr>
        <td>${l.studentId}</td>
        <td>${l.reason}</td>
        <td><span class="badge badge-${l.status.toLowerCase()}">${l.status}</span></td>
        <td>
          <button class="btn-sm" onclick="forwardLeave(${l.id})">Forward</button>
          <button class="btn-sm btn-danger" onclick="rejectLeave(${l.id})">Reject</button>
        </td>
      </tr>
    `).join('');
  }
}

// Work Log
function submitWorkLog() {
  const content = `
    <div class="form-group">
      <label>Today's Activities:</label>
      <textarea id="workLogText" placeholder="Describe your work..." style="width:100%;min-height:150px"></textarea>
    </div>
  `;
  
  showModal('Submit Daily Work Log', content, [
    { text: 'Cancel', class: 'btn-secondary', onClick: () => {} },
    { text: 'Submit', class: 'btn-primary', onClick: () => {
      const activities = document.getElementById('workLogText').value;
      if (activities) {
        STATE.workLogs.push({
          id: Math.max(...STATE.workLogs.map(l => l.id || 0)) + 1,
          facultyId: AMS.user.id,
          logDate: new Date().toISOString().split('T')[0],
          activities,
          status: 'Submitted'
        });
        toast(`✅ Work log submitted`, 'success');
        refreshWorkLogs();
      }
    }},
  ]);
}

function refreshWorkLogs() {
  const list = document.getElementById('workLogsList');
  if (list) {
    list.innerHTML = STATE.workLogs.map(l => `
      <div class="worklog-item">
        <p><strong>${l.logDate}</strong> - Status: ${l.status}</p>
        <p>${l.activities}</p>
      </div>
    `).join('');
  }
}

// Appraisal
function addAchievement() {
  const content = `
    <div class="form-group">
      <label>Achievement:</label>
      <textarea id="achievementText" placeholder="Describe your achievement..." style="width:100%;min-height:150px"></textarea>
    </div>
  `;
  
  showModal('Add Achievement', content, [
    { text: 'Cancel', class: 'btn-secondary', onClick: () => {} },
    { text: 'Save', class: 'btn-primary', onClick: () => {
      const achievement = document.getElementById('achievementText').value;
      if (achievement) {
        STATE.appraisals.push({
          id: Math.max(...STATE.appraisals.map(a => a.id || 0)) + 1,
          facultyId: AMS.user.id,
          achievement,
          status: 'Pending',
          createdAt: new Date().toISOString().split('T')[0]
        });
        toast(`✅ Achievement added`, 'success');
        refreshAppraisals();
      }
    }},
  ]);
}

function refreshAppraisals() {
  const list = document.getElementById('appraisalsList');
  if (list) {
    list.innerHTML = STATE.appraisals.map(a => `
      <div class="appraisal-item">
        <p>${a.achievement}</p>
        <p><strong>Status:</strong> <span class="badge badge-${a.status.toLowerCase()}">${a.status}</span></p>
      </div>
    `).join('');
  }
}

// My Ratings
function showRatingDetails() {
  const content = `
    <h4>Course Feedback Summary</h4>
    <div class="rating-breakdown">
      <p><strong>Question 1:</strong> Content clarity - Average: 4.2/5</p>
      <p><strong>Question 2:</strong> Pace of class - Average: 3.8/5</p>
      <p><strong>Question 3:</strong> Faculty interaction - Average: 4.5/5</p>
    </div>
  `;
  
  showModal('Rating Details', content, [
    { text: 'Export', class: 'btn-secondary', onClick: () => {
      exportToCSV('my_ratings.csv', STATE.appraisals, [
        { key: 'achievement', label: 'Feedback' },
        { key: 'status', label: 'Status' },
      ]);
    }},
    { text: 'Close', class: 'btn-primary', onClick: () => {} },
  ]);
}

// ════════════════════════════════════════════════════════════════════════
// STUDENT MODULE BUTTONS
// ════════════════════════════════════════════════════════════════════════

// Fees Payment
function payNow(feeId) {
  const fee = STATE.fees.find(f => f.id === feeId);
  const content = `
    <div class="form-group">
      <label>Amount:</label>
      <input type="number" id="payAmount" value="${fee.balance}" readonly>
    </div>
    <div class="form-group">
      <label>Payment Method:</label>
      <select id="paymentMethod">
        <option>Credit Card</option>
        <option>Debit Card</option>
        <option>Net Banking</option>
        <option>UPI</option>
      </select>
    </div>
  `;
  
  showModal('Confirm Payment', content, [
    { text: 'Cancel', class: 'btn-secondary', onClick: () => {} },
    { text: 'Pay Now', class: 'btn-success', onClick: () => {
      fee.paid = fee.amount;
      fee.balance = 0;
      fee.status = 'Paid';
      toast(`✅ Payment of ₹${fee.amount} successful!`, 'success');
      refreshFees();
    }},
  ]);
}

function showReceipt(feeId) {
  const fee = STATE.fees.find(f => f.id === feeId);
  const receiptContent = `
    <div style="text-align: center; font-family: monospace;">
      <h3>PAYMENT RECEIPT</h3>
      <hr>
      <p>Student ID: ${AMS.user.id}</p>
      <p>Amount: ₹${fee.amount}</p>
      <p>Status: ${fee.status}</p>
      <p>Date: ${new Date().toLocaleDateString()}</p>
      <hr>
      <p><strong>Thank You!</strong></p>
    </div>
  `;
  
  showModal('Payment Receipt', receiptContent, [
    { text: 'Print', class: 'btn-primary', onClick: () => {
      printContent('Receipt', receiptContent);
    }},
    { text: 'Close', class: 'btn-secondary', onClick: () => {} },
  ]);
}

function refreshFees() {
  const list = document.getElementById('feesList');
  if (list) {
    list.innerHTML = STATE.fees.map(f => `
      <div class="fee-item">
        <p><strong>₹${f.amount}</strong> | Balance: <span class="badge badge-${f.status.toLowerCase()}">₹${f.balance}</span></p>
        <button class="btn-sm" ${f.status === 'Paid' ? 'disabled' : ''} onclick="payNow(${f.id})">Pay Now</button>
        <button class="btn-sm" onclick="showReceipt(${f.id})">Receipt</button>
      </div>
    `).join('');
  }
}

// Leave Management
function applyLeave() {
  const content = `
    <div class="form-group">
      <label>Reason:</label>
      <textarea id="leaveReason" placeholder="Reason for leave..."></textarea>
    </div>
    <div class="form-group">
      <label>From Date:</label>
      <input type="date" id="leaveFromDate">
    </div>
    <div class="form-group">
      <label>To Date:</label>
      <input type="date" id="leaveToDate">
    </div>
  `;
  
  showModal('Apply for Leave', content, [
    { text: 'Cancel', class: 'btn-secondary', onClick: () => {} },
    { text: 'Submit', class: 'btn-primary', onClick: () => {
      const reason = document.getElementById('leaveReason').value;
      const fromDate = document.getElementById('leaveFromDate').value;
      const toDate = document.getElementById('leaveToDate').value;
      
      if (reason && fromDate && toDate) {
        STATE.leaveApplications.push({
          id: Math.max(...STATE.leaveApplications.map(l => l.id || 0)) + 1,
          studentId: AMS.user.id,
          reason, fromDate, toDate,
          status: 'Pending'
        });
        toast(`✅ Leave application submitted`, 'success');
        refreshMyLeaves();
      }
    }},
  ]);
}

function refreshMyLeaves() {
  const list = document.getElementById('myLeavesList');
  if (list) {
    list.innerHTML = `
      <h4>My Applications</h4>
      ${STATE.leaveApplications.map(l => `
        <div class="leave-item">
          <p>${l.fromDate} to ${l.toDate} - ${l.reason}</p>
          <span class="badge badge-${l.status.toLowerCase()}">${l.status}</span>
        </div>
      `).join('')}
    `;
  }
}

// Placement
function applyForPlacement(placementId) {
  const placement = STATE.placements.find(p => p.id === placementId);
  placement.status = 'Applied';
  placement.appliedDate = new Date().toISOString().split('T')[0];
  toast(`✅ Application submitted for ${placement.companyName}`, 'success');
  refreshPlacements();
}

function refreshPlacements() {
  const list = document.getElementById('placementsList');
  if (list) {
    list.innerHTML = STATE.placements.map(p => `
      <div class="placement-item">
        <h4>${p.companyName}</h4>
        <p>Status: <span class="badge badge-${p.status.toLowerCase()}">${p.status}</span></p>
        <button class="btn-sm" ${p.status === 'Applied' ? 'disabled' : ''} onclick="applyForPlacement(${p.id})">Apply</button>
      </div>
    `).join('');
  }
}

// Grievance
function submitGrievance() {
  const content = `
    <div class="form-group">
      <label>Title:</label>
      <input type="text" id="grievanceTitle" placeholder="Brief title">
    </div>
    <div class="form-group">
      <label>Description:</label>
      <textarea id="grievanceDesc" placeholder="Describe your grievance..." style="width:100%;min-height:150px"></textarea>
    </div>
  `;
  
  showModal('Submit Grievance', content, [
    { text: 'Cancel', class: 'btn-secondary', onClick: () => {} },
    { text: 'Submit', class: 'btn-primary', onClick: () => {
      const title = document.getElementById('grievanceTitle').value;
      const desc = document.getElementById('grievanceDesc').value;
      
      if (title && desc) {
        const ticketId = 'GRV-' + (Math.max(...STATE.grievances.map(g => parseInt(g.ticketId.split('-')[1]) || 0)) + 1);
        STATE.grievances.push({
          id: Math.max(...STATE.grievances.map(g => g.id || 0)) + 1,
          studentId: AMS.user.id,
          title, description: desc,
          status: 'Pending',
          ticketId
        });
        toast(`✅ Grievance ${ticketId} submitted`, 'success');
        refreshGrievances();
      }
    }},
  ]);
}

function refreshGrievances() {
  const list = document.getElementById('myGrievancesList');
  if (list) {
    list.innerHTML = `
      <h4>My Grievances</h4>
      ${STATE.grievances.map(g => `
        <div class="grievance-item">
          <p><strong>${g.ticketId}:</strong> ${g.title}</p>
          <span class="badge badge-${g.status.toLowerCase()}">${g.status}</span>
        </div>
      `).join('')}
    `;
  }
}

// Surveys
function submitSurvey() {
  const content = `
    <h4>Course Feedback Survey</h4>
    <div class="form-group">
      <label><input type="radio" name="q1"> Strongly Disagree</label>
      <label><input type="radio" name="q1"> Disagree</label>
      <label><input type="radio" name="q1"> Neutral</label>
      <label><input type="radio" name="q1"> Agree</label>
      <label><input type="radio" name="q1"> Strongly Agree</label>
      <p>Q1: The course content was clear and well-organized</p>
    </div>
  `;
  
  showModal('Course Survey', content, [
    { text: 'Cancel', class: 'btn-secondary', onClick: () => {} },
    { text: 'Submit', class: 'btn-primary', onClick: () => {
      const survey = STATE.surveys[0];
      survey.submitted = true;
      toast(`✅ Thank you for your feedback!`, 'success');
      refreshSurveys();
    }},
  ]);
}

function refreshSurveys() {
  const list = document.getElementById('surveysList');
  if (list) {
    list.innerHTML = STATE.surveys.map(s => `
      <div class="survey-item">
        <h4>${s.title}</h4>
        <button class="btn-sm" ${s.submitted ? 'disabled' : ''} onclick="submitSurvey()">
          ${s.submitted ? 'Submitted ✓' : 'Take Survey'}
        </button>
      </div>
    `).join('');
  }
}

// Messages
function composeMail() {
  const content = `
    <div class="form-group">
      <label>To:</label>
      <input type="email" id="mailTo" placeholder="recipient@example.com">
    </div>
    <div class="form-group">
      <label>Subject:</label>
      <input type="text" id="mailSubject" placeholder="Subject">
    </div>
    <div class="form-group">
      <label>Message:</label>
      <textarea id="mailBody" placeholder="Your message..." style="width:100%;min-height:200px"></textarea>
    </div>
  `;
  
  showModal('Compose Message', content, [
    { text: 'Cancel', class: 'btn-secondary', onClick: () => {} },
    { text: 'Send', class: 'btn-primary', onClick: () => {
      const to = document.getElementById('mailTo').value;
      const subject = document.getElementById('mailSubject').value;
      const body = document.getElementById('mailBody').value;
      
      if (to && subject && body) {
        STATE.messages.push({
          id: Math.max(...STATE.messages.map(m => m.id || 0)) + 1,
          from: AMS.user.name,
          subject, body,
          folder: 'Sent',
          date: new Date().toISOString().split('T')[0]
        });
        toast(`✅ Message sent`, 'success');
        refreshMessages();
      }
    }},
  ]);
}

function refreshMessages() {
  const list = document.getElementById('messagesList');
  if (list) {
    list.innerHTML = STATE.messages.map(m => `
      <div class="message-item">
        <p><strong>${m.from}</strong></p>
        <p>${m.subject}</p>
        <small>${m.date}</small>
      </div>
    `).join('');
  }
}

// Subject Communities
function viewCommunity(communityName) {
  const posts = STATE.communityPosts[communityName] || [];
  const postsList = posts.map(p => `
    <div class="post-item">
      <p><strong>${p.author}:</strong> ${p.content}</p>
      <small>${p.date}</small>
    </div>
  `).join('');
  
  const content = `
    <div id="postsList">${postsList}</div>
    <div class="form-group" style="margin-top: 20px;">
      <textarea id="newPostText" placeholder="Write your response..." style="width:100%"></textarea>
      <button class="btn-sm" style="margin-top: 10px;" onclick="postMessage('${communityName}')">Post</button>
    </div>
  `;
  
  showModal(`${communityName} Community`, content, [
    { text: 'Close', class: 'btn-secondary', onClick: () => {} },
  ]);
}

function postMessage(communityName) {
  const text = document.getElementById('newPostText').value;
  if (text) {
    if (!STATE.communityPosts[communityName]) {
      STATE.communityPosts[communityName] = [];
    }
    STATE.communityPosts[communityName].push({
      id: Math.max(...(STATE.communityPosts[communityName].map(p => p.id) || [0])) + 1,
      author: AMS.user.name,
      content: text,
      date: new Date().toISOString().split('T')[0],
      replies: []
    });
    toast(`✅ Message posted`, 'success');
    viewCommunity(communityName); // Refresh
  }
}

// ════════════════════════════════════════════════════════════════════════
// GLOBAL UTILITY BUTTONS
// ════════════════════════════════════════════════════════════════════════

// Export button handler (for different contexts)
function exportData(dataType) {
  const exports = {
    'audit_logs': () => exportToCSV('audit_logs.csv', STATE.auditLogs, [
      { key: 'action', label: 'Action' },
      { key: 'user', label: 'User' },
      { key: 'timestamp', label: 'Timestamp' },
    ]),
    'users': () => exportToCSV('users.csv', STATE.users, [
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'role', label: 'Role' },
    ]),
    'timetable': () => exportToCSV('timetable.csv', STATE.timetable, [
      { key: 'day', label: 'Day' },
      { key: 'time', label: 'Time' },
      { key: 'subject', label: 'Subject' },
      { key: 'faculty', label: 'Faculty' },
    ]),
  };
  
  if (exports[dataType]) exports[dataType]();
}

// Retry button for camera/attendance
function retryAttendance() {
  toast('🔄 Retrying attendance...', 'info');
  // Restart the camera flow
  if (AMS.activeModule === 's-attendance') {
    const videoEl = document.getElementById('cameraFeed');
    if (videoEl) startCamera(videoEl).catch(e => toast(`Camera error: ${e.message}`, 'error'));
  }
}

// Cancel button handler (generic)
function cancelAction() {
  closeModal();
  toast('❌ Action cancelled', 'info');
}

// ════════════════════════════════════════════════════════════════════════
// MODULE EVENT BINDING
// ════════════════════════════════════════════════════════════════════════

function bindModuleEvents(moduleId) {
  // This function is called after each module renders
  // It automatically binds button events specific to that module
  
  // Admin Module bindings
  if (moduleId === 'a-users') {
    refreshUserTable();
    const searchInput = document.getElementById('userSearch');
    if (searchInput) {
      searchInput.oninput = (e) => searchUsers(e.target.value);
    }
  }
  
  if (moduleId === 'a-isorules') {
    refreshRulesList();
  }
  
  if (moduleId === 'a-committee') {
    refreshCommitteesList();
  }
  
  if (moduleId === 'a-exam') {
    refreshExamsList();
  }
  
  if (moduleId === 'a-timetable') {
    refreshTimetable();
  }
  
  // Faculty Module bindings
  if (moduleId === 'f-timetable') {
    refreshFacultyTimetable();
  }
  
  if (moduleId === 'f-lesson') {
    refreshLessonPlanner();
  }
  
  if (moduleId === 'f-materials') {
    refreshCourseMaterials();
  }
  
  if (moduleId === 'f-studentleave') {
    refreshStudentLeaves();
  }
  
  if (moduleId === 'f-worklog') {
    refreshWorkLogs();
  }
  
  if (moduleId === 'f-appraisal') {
    refreshAppraisals();
  }
  
  if (moduleId === 'f-ratings') {
    // Show sample ratings
    document.getElementById('mainContent').innerHTML += `
      <div style="margin-top: 20px;">
        <button class="btn" onclick="showRatingDetails()">View Detailed Breakdown</button>
        <button class="btn" onclick="exportData('ratings')">Export Ratings</button>
      </div>
    `;
  }
  
  // Student Module bindings
  if (moduleId === 's-fees') {
    refreshFees();
  }
  
  if (moduleId === 's-leave') {
    const form = document.getElementById('leaveForm');
    if (form) {
      form.onsubmit = (e) => {
        e.preventDefault();
        applyLeave();
      };
    }
    refreshMyLeaves();
  }
  
  if (moduleId === 's-placement') {
    refreshPlacements();
  }
  
  if (moduleId === 's-grievance') {
    const form = document.getElementById('grievanceForm');
    if (form) {
      form.onsubmit = (e) => {
        e.preventDefault();
        submitGrievance();
      };
    }
    refreshGrievances();
  }
  
  if (moduleId === 's-survey') {
    refreshSurveys();
  }
  
  if (moduleId === 's-messages') {
    refreshMessages();
  }
  
  if (moduleId === 's-communities') {
    // Initialize communities view
    const communitiesHTML = Object.keys(STATE.communityPosts).map(name => `
      <div class="community-card" onclick="viewCommunity('${name}')">
        <h4>${name}</h4>
        <p>${STATE.communityPosts[name].length} posts</p>
      </div>
    `).join('');
    
    if (document.getElementById('mainContent')) {
      document.getElementById('mainContent').innerHTML += communitiesHTML;
    }
  }

  // Additional initializations for newer modules
  if (moduleId === 's-attendance') {
    initStudentAttendance();
  }
  if (moduleId === 'f-attendance') {
    initFacultyAttendance();
  }
  if (moduleId === 'a-register') {
    initFaceRegistration();
  }
  // a-users already has its own bindings above; ensure user list loads
  if (moduleId === 'a-users') {
    loadUserList();
  }
}

// ────────────────────────────────────────────────────────────────────────

// ── Dashboard init ────────────────────────────────────────
function initDashboard(){
  const pageLoader=document.getElementById('pageLoader');
  if(pageLoader) pageLoader.style.display='none';
  document.getElementById('loginPage').style.display='none';
  document.getElementById('dashboard').style.display='flex';
  const roleLabels={student:'Student Portal',faculty:'Faculty Portal',admin:'Admin Portal'};
  document.getElementById('sbRoleBadge').textContent=roleLabels[AMS.role];
  document.getElementById('sbAvatar').textContent=AMS.user.name[0].toUpperCase();
  document.getElementById('sbName').textContent=AMS.user.name;
  document.getElementById('sbId').textContent='ID: '+AMS.user.id;
  document.getElementById('topbarRole').textContent=AMS.role.charAt(0).toUpperCase()+AMS.role.slice(1);
  document.getElementById('topbarDate').textContent=fmtDate();
  buildNav();
  // Load system configuration (college coords, toggles) from backend
  loadSystemConfig().catch(()=>{});
  // Initialize QR Module for attendance features
  if (typeof QRModule !== 'undefined' && QRModule.init) {
    QRModule.init();
  }
  const firstItem=NAV_CONFIG[AMS.role][0].items[0];
  loadModule(firstItem.id,firstItem.label);

  // check url for incoming qr data (deep link from native scanner)
  const params = new URLSearchParams(window.location.search);
  const qrParam = params.get('qr');
  if (qrParam) {
    // ensure student is directed to attendance module and then process
    if (AMS.role !== 'student') {
      // keep qrParam for after login
      sessionStorage.setItem('pending_qr', qrParam);
    } else {
      loadModule('s-attendance','Attendance');
      // small timeout to allow module to render
      setTimeout(()=>{QRModule.processScannedQR(qrParam)},200);
    }
  }
}

function buildNav(){
  const nav=document.getElementById('sidebarNav');
  nav.innerHTML='';
  NAV_CONFIG[AMS.role].forEach(section=>{
    const sec=document.createElement('div');
    sec.className='nav-section';
    sec.innerHTML=`<div class="nav-section-label">${section.section}</div>`;
    section.items.forEach(item=>{
      const el=document.createElement('div');
      el.className='nav-item';
      el.id='nav-'+item.id;
      el.innerHTML=`<span class="nav-icon">${item.icon}</span><span class="nav-label">${item.label}</span>`;
      el.onclick=()=>{loadModule(item.id,item.label);if(window.innerWidth<=768)closeSidebar()};
      sec.appendChild(el);
    });
    nav.appendChild(sec);
  });
}

function loadModule(id,label){
  stopCamera();
  AMS.activeModule=id;
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  const navEl=document.getElementById('nav-'+id);
  if(navEl){navEl.classList.add('active');navEl.scrollIntoView({block:'nearest'})}
  document.getElementById('pageTitle').textContent=label;
  const content=document.getElementById('mainContent');
  content.innerHTML='<div class="page-loader" style="position:static;background:transparent;height:200px"><div class="loader-ring"></div></div>';
  setTimeout(()=>{content.innerHTML=renderModule(id);bindModuleEvents(id)},150);
}

function toggleSidebar(){
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('show');
}
function closeSidebar(){
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('show');
}

// ── Module Router ─────────────────────────────────────────
function renderModule(id){
  const map={
    's-dashboard':renderStudentDashboard,'s-calendar':renderStudentCalendar,'s-timetable':renderStudentTimetable,
    's-communities':renderSubjectCommunities,'s-cbcs':renderCBCS,'s-online':renderStudentOnlineClass,
    's-library':renderDigitalLibrary,'s-performance':renderStudentPerformance,'s-attendance':renderStudentAttendance,
    's-fees':renderStudentFees,'s-exam-reg':renderExamReg,'s-sem-reg':renderSemReg,'s-supple':renderSuppleReg,
    's-reval':renderRevaluation,'s-grace':renderGraceMark,'s-survey':renderInterimSurvey,
    's-exit':renderExitSurvey,'s-grievance':renderGrievance,'s-evaluation':renderStaffEval,
    's-leave':renderLeaveManagement,'s-placement':renderPlacement,'s-messages':renderMessages,
    's-notices':renderNoticeBoard,'s-push':renderPushNotif,
    'f-dashboard':renderFacultyDashboard,'f-timetable':renderFacultyTimetable,'f-courses':renderCourseDetails,
    'f-workhours':renderFacultyWorkingHours,'f-prevdetails':renderFacultyPrevDetails,
    'f-ratings':renderFacultyRatings,'f-studentleave':renderFacultyStudentLeave,
    'f-transport':renderFacultyTransport,'f-messages':renderFacultyMessages,
    'f-rules':renderFacultyRules,'f-committee':renderFacultyCommittee,
    'f-examduty':renderFacultyExamDuty,'f-collegetimetable':renderCollegeTimetable,
    'f-obe':renderOBE,'f-lesson':renderLessonPlanner,'f-online':renderFacultyOnlineClass,
    'f-materials':renderCourseMaterials,'f-attendance':renderFacultyAttendance,
    'f-assessments':renderAssessments,'f-assignments':renderAssignments,'f-internal':renderInternalExam,
    'f-qpaper':renderQuestionPaper,'f-coursefile':renderCourseFile,'f-marks':renderMarkComputation,
    'f-reports':renderCustomReports,'f-onlineexam':renderOnlineExam,'f-staffrpt':renderStaffReport,
    'f-worklog':renderWorkLog,'f-appraisal':renderAppraisal,
    'a-dashboard':renderAdminDashboard,'a-users':renderUserManagement,'a-register':renderFaceRegistration,
    'a-config':renderSystemConfig,'a-logs':renderAuditLogs,'a-reports':renderGlobalReports,
    'a-isorules':renderAdminISORules,'a-timetable':renderAdminTimetableMgmt,
    'a-committee':renderAdminCommittee,'a-exam':renderAdminExamModule,
    'a-s-attendance':renderAdminAttendance,'a-s-fees':renderAdminFees,'a-s-performance':renderAdminPerformance,
    'a-s-leave':renderAdminLeave,'a-s-placement':renderAdminPlacement,'a-s-grievance':renderAdminGrievances,
  };
  return (map[id]||renderComingSoon)(id);
}

function renderComingSoon(id){
  return `<div class="card"><div class="empty">
    <div class="empty-icon">🚧</div>
    <h3 style="margin-bottom:.5rem">Module: ${id}</h3>
    <div class="empty-text">This section is under active development.</div>
  </div></div>`;
}


// ==========================================================
//  STUDENT MODULES
// ==========================================================
function renderStudentDashboard(){
  setTimeout(loadStudentDashboardData,0);
  return `
  <div class="stats-grid" id="studentStats">Loading statistics...</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.25rem">
    <div class="card">
      <div class="card-header"><div class="card-title">📅 Upcoming Events</div></div>
      <div class="timeline" id="studentEvents">
        <p style="color:var(--text2);text-align:center">Loading events…</p>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><div class="card-title">📊 Attendance by Subject</div></div>
      <div class="bar-chart mt-md" id="studentAttendanceChart">
        <!-- chart populated dynamically -->
      </div>
    </div>
  </div>
  <div class="card">
    <div class="card-header"><div class="card-title">📢 Announcements</div></div>
    ${[
      {type:'urgent',title:'Internal Exam Schedule Released',msg:'Internal Exam 1 dates have been announced. Check your timetable.',time:'2h ago'},
      {type:'info',title:'New Study Materials Uploaded',msg:'DS Unit-3 notes uploaded by Dr. Smith.',time:'5h ago'},
      {type:'warning',title:'Fee Payment Reminder',msg:'Last date for fee payment: March 31. Avoid late fees.',time:'1d ago'},
    ].map(a=>`<div class="announcement ${a.type}">
      <div class="ann-title">${a.title}</div>
      <div class="text-sm text-muted">${a.msg}</div>
      <div class="ann-meta mt-sm">${a.time}</div>
    </div>`).join('')}
  </div>`;
}

async function loadStudentDashboardData(){
  try{
    // attendance rate for the current user
    let attRate = 0;
    if(AMS.user.roll_no){
      const attResp = await fetch(`/api/attendance?roll_no=${AMS.user.roll_no}`);
      const attJson = await attResp.json();
      const recs = attJson.records || [];
      const total = recs.length;
      const present = recs.filter(r=>r.verified).length;
      attRate = total? Math.round(present*10000/total)/100 : 0;
    }

    // CGPA
    let cgpa = '-';
    const gradesResp = await fetch(`/api/grades?student_id=${AMS.user.id}`);
    const gradesJson = await gradesResp.json();
    if(gradesJson.success && gradesJson.gpa!==undefined){
      cgpa = gradesJson.gpa;
    }

    // pending tasks (rudimentary: count of assignments submitted)
    let pending = 0;
    const assigResp = await fetch(`/api/assignments?student_id=${AMS.user.id}`);
    const assigJson = await assigResp.json();
    if(assigJson.success && assigJson.assignments){
      pending = assigJson.assignments.length;
    }

    document.getElementById('studentStats').innerHTML = `
      <div class="stat-card blue"><div class="s-icon">✅</div><div class="s-val">${attRate}%</div><div class="s-lbl">Attendance Rate</div></div>
      <div class="stat-card teal"><div class="s-icon">🎓</div><div class="s-val">${cgpa}</div><div class="s-lbl">CGPA</div></div>
      <div class="stat-card green"><div class="s-icon">📝</div><div class="s-val">${pending}</div><div class="s-lbl">Submitted Tasks</div></div>
      <div class="stat-card orange"><div class="s-icon">💳</div><div class="s-val">—</div><div class="s-lbl">Fees Due</div></div>
    `;

    document.getElementById('studentEvents').innerHTML = '<p style="text-align:center;color:var(--text2)">No events available</p>';
    document.getElementById('studentAttendanceChart').innerHTML = '<p style="text-align:center;color:var(--text2)">Attendance data coming soon</p>';
  }catch(e){console.error('[Student Dashboard]',e);}  
}

function renderStudentCalendar(){
  const events=[
    {date:'2024-02-20',title:'Internal Exam 1 – Data Structures',type:'exam',color:'red'},
    {date:'2024-02-22',title:'Assignment Submission – CS302',type:'assignment',color:'orange'},
    {date:'2024-02-25',title:'Guest Lecture – AI & ML',type:'event',color:'blue'},
    {date:'2024-03-01',title:'Semester Registration Opens',type:'registration',color:'green'},
    {date:'2024-03-15',title:'Mid-Semester Break Begins',type:'holiday',color:'teal'},
    {date:'2024-04-10',title:'End Semester Exam Registration',type:'registration',color:'purple'},
    {date:'2024-04-25',title:'End Semester Exams Start',type:'exam',color:'red'},
  ];
  return `<div class="card">
    <div class="card-header"><div class="card-title">📅 Academic Calendar</div></div>
    ${events.map(e=>`<div class="announcement info" style="border-color:var(--${e.color||'blue'});margin-bottom:.6rem">
      <div class="d-flex justify-between align-center">
        <div>
          <div class="ann-title">${e.title}</div>
          <div class="ann-meta">${new Date(e.date).toLocaleDateString('en-IN',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div>
        </div>
        <span class="badge badge-blue">${e.type}</span>
      </div>
    </div>`).join('')}
  </div>`;
}

function renderStudentTimetable(){
  const tt=[
    {day:'Monday',slots:[{time:'9–10',sub:'Data Structures',fac:'Dr. Smith',room:'B-301'},{time:'10–11',sub:'Algorithms',fac:'Dr. Johnson',room:'B-302'},{time:'2–4',sub:'Database Lab',fac:'Prof. Williams',room:'Lab-1'}]},
    {day:'Tuesday',slots:[{time:'9–10',sub:'Web Development',fac:'Dr. Brown',room:'B-303'},{time:'11–12',sub:'Data Structures',fac:'Dr. Smith',room:'B-301'},{time:'2–3',sub:'OS',fac:'Dr. Patel',room:'B-304'}]},
    {day:'Wednesday',slots:[{time:'10–12',sub:'Algorithms Lab',fac:'Dr. Johnson',room:'Lab-2'},{time:'2–4',sub:'Project Work',fac:'Multiple',room:'Lab-3'}]},
    {day:'Thursday',slots:[{time:'9–10',sub:'Data Structures',fac:'Dr. Smith',room:'B-301'},{time:'11–12',sub:'Web Development',fac:'Dr. Brown',room:'B-303'}]},
    {day:'Friday',slots:[{time:'9–10',sub:'Database',fac:'Prof. Williams',room:'B-302'},{time:'10–11',sub:'OS',fac:'Dr. Patel',room:'B-304'},{time:'2–3',sub:'Tutorial',fac:'All Faculty',room:'Seminar'}]},
  ];
  return `<div class="card">
    <div class="card-header"><div class="card-title">🕐 Regular Timetable — Sem 5</div><button class="btn btn-outline btn-sm">📥 Download PDF</button></div>
    <div class="tbl-wrap"><table>
      <thead><tr><th>Day</th><th>Time</th><th>Subject</th><th>Faculty</th><th>Room</th></tr></thead>
      <tbody>${tt.map(day=>day.slots.map((s,i)=>`<tr>
        ${i===0?`<td rowspan="${day.slots.length}" class="fw-semibold" style="background:rgba(137,87,229,.06)">${day.day}</td>`:''}
        <td><span class="badge badge-gray">${s.time}</span></td>
        <td class="fw-semibold">${s.sub}</td><td class="text-muted">${s.fac}</td><td>${s.room}</td>
      </tr>`).join('')).join('')}</tbody>
    </table></div>
  </div>`;
}

function renderSubjectCommunities(){
  const comms=[
    {code:'CS301',name:'Data Structures',members:45,posts:128,unread:3},
    {code:'CS302',name:'Algorithms',members:42,posts:96,unread:0},
    {code:'CS401',name:'Database Systems',members:45,posts:74,unread:5},
    {code:'CS403',name:'Web Development',members:44,posts:52,unread:1},
    {code:'CS402',name:'Operating Systems',members:43,posts:61,unread:2},
  ];
  return `<div class="stats-grid" style="grid-template-columns:repeat(3,1fr)">
    ${comms.map(c=>`<div class="stat-card blue" style="cursor:pointer" onclick="toast('Opening ${c.name} community…','info')">
      <div class="d-flex justify-between align-center mb-md">
        <span class="badge badge-blue">${c.code}</span>
        ${c.unread?`<span class="badge badge-red">${c.unread} new</span>`:''}
      </div>
      <div class="s-val" style="font-size:1.1rem">${c.name}</div>
      <div class="d-flex gap-md mt-md">
        <span class="text-xs text-muted">👥 ${c.members} members</span>
        <span class="text-xs text-muted">💬 ${c.posts} posts</span>
      </div>
    </div>`).join('')}
  </div>`;
}

function renderCBCS(){
  const courses=[
    {code:'CS301',name:'Data Structures',credits:4,type:'Core',grade:'A+',points:10},
    {code:'CS302',name:'Algorithms',credits:3,type:'Core',grade:'A',points:9},
    {code:'CS401',name:'Database Systems',credits:4,type:'Core',grade:'B+',points:8},
    {code:'HS301',name:'Professional Ethics',credits:2,type:'Mandatory',grade:'O',points:10},
    {code:'EL301',name:'Machine Learning',credits:3,type:'Elective',grade:'A',points:9},
  ];
  const totalCredits=courses.reduce((s,c)=>s+c.credits,0);
  const wgpa=courses.reduce((s,c)=>s+c.credits*c.points,0)/totalCredits;
  return `<div class="stats-grid" style="grid-template-columns:repeat(3,1fr)">
    <div class="stat-card blue"><div class="s-icon">📚</div><div class="s-val">${totalCredits}</div><div class="s-lbl">Total Credits Earned</div></div>
    <div class="stat-card green"><div class="s-icon">🎯</div><div class="s-val">${wgpa.toFixed(2)}</div><div class="s-lbl">SGPA (Current Sem)</div></div>
    <div class="stat-card teal"><div class="s-icon">⭐</div><div class="s-val">8.4</div><div class="s-lbl">CGPA (Cumulative)</div></div>
  </div>
  <div class="card">
    <div class="card-header"><div class="card-title">🎯 Credit Details — Semester 5</div></div>
    <div class="tbl-wrap"><table>
      <thead><tr><th>Code</th><th>Course</th><th>Type</th><th>Credits</th><th>Grade</th><th>Grade Points</th><th>Weighted</th></tr></thead>
      <tbody>${courses.map(c=>`<tr>
        <td class="fw-semibold">${c.code}</td><td>${c.name}</td>
        <td><span class="badge badge-${c.type==='Core'?'blue':c.type==='Elective'?'purple':'teal'}">${c.type}</span></td>
        <td>${c.credits}</td>
        <td><span class="badge badge-${c.points>=9?'green':c.points>=7?'blue':'orange'}">${c.grade}</span></td>
        <td>${c.points}</td><td>${(c.credits*c.points).toFixed(0)}</td>
      </tr>`).join('')}</tbody>
      <tfoot><tr style="background:rgba(137,87,229,.06)">
        <td colspan="3"><strong>Total / SGPA</strong></td>
        <td><strong>${totalCredits}</strong></td><td>—</td><td>—</td>
        <td><strong>${wgpa.toFixed(2)}</strong></td>
      </tr></tfoot>
    </table></div>
  </div>`;
}

function renderStudentOnlineClass(){
  const classes=[
    {date:'2024-02-20',time:'10:00 AM',sub:'Data Structures',fac:'Dr. Smith',link:'meet.ams.edu/ds-cs301',status:'scheduled'},
    {date:'2024-02-18',time:'2:00 PM',sub:'Algorithms',fac:'Dr. Johnson',link:'meet.ams.edu/algo-cs302',status:'completed'},
    {date:'2024-02-15',time:'11:00 AM',sub:'Database',fac:'Prof. Williams',link:'meet.ams.edu/db-cs401',status:'completed'},
  ];
  return `<div class="card">
    <div class="card-header"><div class="card-title">💻 Online Classes</div></div>
    <div class="tbl-wrap"><table>
      <thead><tr><th>Date</th><th>Time</th><th>Subject</th><th>Faculty</th><th>Status</th><th>Action</th></tr></thead>
      <tbody>${classes.map(c=>`<tr>
        <td>${c.date}</td><td>${c.time}</td><td class="fw-semibold">${c.sub}</td>
        <td class="text-muted">${c.fac}</td>
        <td><span class="badge badge-${c.status==='scheduled'?'orange':'green'}">${c.status}</span></td>
        <td>${c.status==='scheduled'?`<button class="btn btn-primary btn-sm" onclick="toast('Joining class…','info')">Join Now</button>`:`<button class="btn btn-outline btn-sm">View Recording</button>`}</td>
      </tr>`).join('')}</tbody>
    </table></div>
  </div>`;
}

function renderDigitalLibrary(){
  const books=[
    {title:'Introduction to Algorithms (CLRS)',author:'Cormen et al.',type:'E-Book',cat:'CS'},
    {title:'Database System Concepts',author:'Silberschatz',type:'E-Book',cat:'CS'},
    {title:'Design Patterns',author:'Gang of Four',type:'E-Book',cat:'CS'},
    {title:'IEEE Software Engineering Journal',author:'IEEE',type:'Journal',cat:'Research'},
    {title:'ACM Computing Surveys',author:'ACM',type:'Journal',cat:'Research'},
  ];
  return `<div class="card">
    <div class="card-header"><div class="card-title">📚 Digital Library</div></div>
    <div class="tbl-wrap"><table>
      <thead><tr><th>Title</th><th>Author</th><th>Type</th><th>Category</th><th>Action</th></tr></thead>
      <tbody>${books.map(b=>`<tr>
        <td class="fw-semibold">${b.title}</td><td class="text-muted">${b.author}</td>
        <td><span class="badge badge-${b.type==='E-Book'?'blue':'purple'}">${b.type}</span></td>
        <td><span class="badge badge-gray">${b.cat}</span></td>
        <td><button class="btn btn-outline btn-sm" onclick="toast('Downloading…','info')">📥 Access</button></td>
      </tr>`).join('')}</tbody>
    </table></div>
  </div>`;
}

function renderStudentPerformance(){
  return `<div class="stats-grid">
    <div class="stat-card blue"><div class="s-icon">🎓</div><div class="s-val">8.4</div><div class="s-lbl">CGPA</div><div class="s-badge up">Top 15%</div></div>
    <div class="stat-card green"><div class="s-icon">📊</div><div class="s-val">88.5%</div><div class="s-lbl">Attendance</div></div>
    <div class="stat-card teal"><div class="s-icon">✅</div><div class="s-val">42/50</div><div class="s-lbl">Avg Internal Marks</div></div>
    <div class="stat-card orange"><div class="s-icon">🏆</div><div class="s-val">#12</div><div class="s-lbl">Class Rank</div></div>
  </div>
  <div class="card">
    <div class="card-header"><div class="card-title">📈 Semester-wise CGPA</div></div>
    <div class="bar-chart mt-md">${[
      {lbl:'Sem 1',val:7.8},{lbl:'Sem 2',val:8.1},{lbl:'Sem 3',val:8.3},{lbl:'Sem 4',val:8.2},{lbl:'Sem 5',val:8.4}
    ].map(s=>`<div class="bar-row">
      <div class="bar-label text-xs">${s.lbl}</div>
      <div class="bar-fill"><div class="bar-inner" style="width:${s.val*10}%"></div></div>
      <div class="bar-val text-xs fw-semibold text-blue">${s.val}</div>
    </div>`).join('')}</div>
  </div>
  <div class="card">
    <div class="card-header"><div class="card-title">📋 Subject-wise Performance</div></div>
    <div class="tbl-wrap"><table>
      <thead><tr><th>Subject</th><th>Internal (50)</th><th>External (100)</th><th>Total</th><th>Grade</th></tr></thead>
      <tbody>${[
        {sub:'Data Structures',int:44,ext:82,grade:'A+'},
        {sub:'Algorithms',int:38,ext:74,grade:'A'},
        {sub:'Database Systems',int:42,ext:79,grade:'A+'},
        {sub:'Web Development',int:36,ext:68,grade:'B+'},
        {sub:'OS',int:40,ext:76,grade:'A'},
      ].map(s=>`<tr>
        <td class="fw-semibold">${s.sub}</td><td>${s.int}</td><td>${s.ext}</td>
        <td class="fw-semibold">${s.int+s.ext}</td>
        <td><span class="badge badge-${s.int+s.ext>=130?'green':'blue'}">${s.grade}</span></td>
      </tr>`).join('')}</tbody>
    </table></div>
  </div>`;
}

// ── STUDENT ATTENDANCE ────────────────────────────────────
function renderStudentAttendance(){
  return `
  <div class="card">
    <div class="card-header"><div class="card-title">✅ Mark Attendance</div></div>
    <div id="attPanel">
      <p class="text-muted mb-md">Choose your preferred method to mark attendance.</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1rem">
        <div class="stat-card blue" style="cursor:pointer;text-align:center" onclick="startFaceAtt()">
          <div class="s-icon" style="font-size:2rem">📷</div>
          <div class="s-val" style="font-size:1rem;margin-top:.5rem">Face Recognition</div>
          <div class="s-lbl">Live camera + location check</div>
        </div>
        <div class="stat-card teal" style="cursor:pointer;text-align:center" onclick="startQRScan()">
          <div class="s-icon" style="font-size:2rem">📱</div>
          <div class="s-val" style="font-size:1rem;margin-top:.5rem">QR Code Scan</div>
          <div class="s-lbl">Scan faculty QR + face + location</div>
        </div>
      </div>
    </div>
  </div>
  <div id="faceAttSection" style="display:none">
    <div class="card">
      <div class="card-header"><div class="card-title">📷 Face Recognition Attendance</div>
        <button class="btn btn-outline btn-sm" onclick="resetAtt()">✖ Cancel</button>
      </div>
      <div id="faceAttBody"><div class="att-status"><div class="att-icon-wrap loading">🔄</div><p>Checking location…</p></div></div>
    </div>
  </div>
  <div id="qrScanSection" style="display:none">
    <div class="card">
      <div class="card-header"><div class="card-title">📱 QR Code Attendance</div>
        <button class="btn btn-outline btn-sm" onclick="resetAtt()">✖ Cancel</button>
      </div>
      <div id="qrScanBody">
        <div class="camera-wrap" id="qrCameraWrap">
          <video id="qrVideo" autoplay playsinline style="width:100%;height:100%;object-fit:cover"></video>
          <canvas id="qrCanvas" style="display:none"></canvas>
          <div class="camera-status">Point camera at faculty QR code</div>
        </div>
      </div>
    </div>
  </div>
  <div class="card">
    <div class="card-header"><div class="card-title">📋 Attendance History</div></div>
    <div class="tbl-wrap"><table>
      <thead><tr><th>Date</th><th>Subject</th><th>Time</th><th>Method</th><th>Status</th></tr></thead>
      <tbody>
        <tr><td>Feb 14</td><td>Data Structures</td><td>9:12 AM</td><td><span class="badge badge-blue">Face</span></td><td><span class="badge badge-green">Present</span></td></tr>
        <tr><td>Feb 14</td><td>Algorithms</td><td>10:08 AM</td><td><span class="badge badge-teal">QR</span></td><td><span class="badge badge-green">Present</span></td></tr>
        <tr><td>Feb 13</td><td>Database</td><td>—</td><td>—</td><td><span class="badge badge-red">Absent</span></td></tr>
      </tbody>
    </table></div>
  </div>`;
}

function initStudentAttendance(){}

async function startFaceAtt(){
  // Only students may start face attendance; also require faculty to enable it
  if(AMS.role !== 'student'){
    toast('Only students can use Face Recognition attendance.','info');
    return;
  }
  if(!AMS.faceRecEnabled){
    document.getElementById('faceAttSection').style.display='block';
    const body=document.getElementById('faceAttBody');
    body.innerHTML=`<div class="att-status"><div class="att-icon-wrap error">⚠️</div><h3 class="text-red">Face Recognition Disabled</h3><p class="text-muted">Faculty has not enabled face recognition for this session.</p><button class="btn btn-primary mt-md" onclick="resetAtt()">OK</button></div>`;
    return;
  }
  document.getElementById('faceAttSection').style.display='block';
  document.getElementById('attPanel').style.display='none';
  const body=document.getElementById('faceAttBody');
  body.innerHTML=`<div class="att-status"><div class="att-icon-wrap loading" style="animation:spin 1.2s linear infinite">📍</div><p class="fw-semibold">Verifying location…</p></div>`;
  try{
    const loc=await getLocation();
    const inCampus=isInCollege(loc.lat,loc.lng);
    if(!inCampus){
      body.innerHTML=`<div class="att-status"><div class="att-icon-wrap error">📍</div><h3 class="text-red">Not in Campus</h3><p class="text-muted">You must be within college premises.</p><button class="btn btn-outline mt-md" onclick="resetAtt()">Go Back</button></div>`;
      return;
    }
    body.innerHTML=`<div class="camera-wrap" id="attCameraWrap">
      <video id="attVideo" autoplay playsinline></video>
      <div class="camera-ring"></div>
      <div class="camera-status">✅ On campus — position face in circle</div>
    </div>
    <div class="d-flex gap-md" style="justify-content:center;margin-top:1rem">
      <button class="btn btn-outline" onclick="resetAtt()">Cancel</button>
      <button class="btn btn-primary" onclick="captureFaceAtt()">📷 Capture & Verify</button>
    </div>`;
    await startCamera(document.getElementById('attVideo'));
  }catch(e){
    body.innerHTML=`<div class="att-status"><div class="att-icon-wrap error">❌</div><h3 class="text-red">Location Error</h3><p class="text-muted">${e.message}</p><button class="btn btn-outline mt-md" onclick="resetAtt()">Go Back</button></div>`;
  }
}

async function captureFaceAtt(){
  const body=document.getElementById('faceAttBody');
  const videoEl = document.getElementById('attVideo');
  
  // Check video element exists BEFORE doing anything
  if(!videoEl) {
    body.innerHTML=`<div class="att-status"><div class="att-icon-wrap error">📷</div><h3 class="text-red">Capture Failed</h3><p class="text-muted">Video element not found. Please go back and try again.</p><button class="btn btn-primary mt-md" onclick="startFaceAtt()">Retry</button></div>`;
    return;
  }
  
  // Show loading overlay without removing video element
  const cameraWrap = document.getElementById('attCameraWrap');
  const loadingOverlay = document.createElement('div');
  loadingOverlay.id = 'captureLoadingOverlay';
  loadingOverlay.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:100;border-radius:inherit';
  loadingOverlay.innerHTML = `<div style="text-align:center;color:white"><div style="font-size:24px;animation:spin 1.2s linear infinite">🔍</div><p style="margin-top:0.5rem">Capturing face…</p></div>`;
  cameraWrap.appendChild(loadingOverlay);
  
  // Wait longer for video to fully settle and render (1.5 seconds)
  await new Promise(r=>setTimeout(r,1500));
  
  // NOW try to grab an image from the video element (which is still in DOM)
  let imageData=null;
  try {
    console.log(`Capture attempt: Video ${videoEl.videoWidth}x${videoEl.videoHeight}, readyState=${videoEl.readyState}, networkState=${videoEl.networkState}`);
    
    // If video dimensions still 0, wait a bit more
    if(videoEl.videoWidth === 0 || videoEl.videoHeight === 0) {
      console.warn('Video dimensions still 0, waiting additional time...');
      for(let i=0; i<10; i++) {
        await new Promise(r=>setTimeout(r,200));
        if(videoEl.videoWidth > 0 && videoEl.videoHeight > 0) {
          console.log(`✅ Video dimensions now: ${videoEl.videoWidth}x${videoEl.videoHeight}`);
          break;
        }
      }
    }
    
    // always attempt captureFrame; if video not ready this will throw
    imageData = captureFrame(videoEl);
  } catch(e) {
    console.error('Image capture error:', e);
  }
  
  // Remove loading overlay
  const overlay = document.getElementById('captureLoadingOverlay');
  if(overlay) overlay.remove();
  
  // fallback to lastCapturedImage if present
  if(!imageData && AMS.lastCapturedImage){
    console.log('Using previously captured image');
    imageData = AMS.lastCapturedImage;
  }

  stopCamera();

  if(!imageData){
    // failed to capture anything
    body.innerHTML=`<div class="att-status"><div class="att-icon-wrap error">📷</div><h3 class="text-red">Capture Failed</h3><p class="text-muted">Unable to capture face. Ensure camera is enabled, wait for the video to appear, and click again.</p><button class="btn btn-primary mt-md" onclick="startFaceAtt()">Retry</button></div>`;
    return;
  }

  // store for potential reuse
  AMS.lastCapturedImage = imageData;
  
  // Now verify the captured face against stored encodings
  body.innerHTML=`<div class="att-status"><div class="att-icon-wrap loading" style="animation:spin 1.2s linear infinite">🔍</div><p class="fw-semibold">Verifying face…</p></div>`;
  const result=await verifyFace(imageData);

  if(result.verified){
    // Face verified - attendance marked as PRESENT
    const attemptText = result.max_attempts ? ` (Attempt ${result.current_attempt}/${result.max_attempts})` : '';
    body.innerHTML=`<div class="att-status">
      <div class="att-icon-wrap success">✅</div>
      <h3 class="text-green">✅ Face Verified</h3>
      <p class="text-success fw-semibold" style="font-size:1.1rem">Attendance: <span style="color:#4caf50">PRESENT</span></p>
      <p>Name: <strong>${result.name}</strong></p>
      <p>Roll No: <strong>${result.roll_no}</strong></p>
      <p class="text-muted text-sm">Confidence: ${(result.confidence*100).toFixed(0)}%${attemptText} • ${fmtTime()}</p>
      <button class="btn btn-outline mt-md" onclick="resetAtt()">Done</button>
    </div>`;
    toast('✅ Face Verified - Attendance Marked PRESENT','success');
  } else {
    // Face not verified - handle different scenarios and mark attendance as ABSENT
    let errorMsg = result.error || 'Face verification failed';
    let errorIcon = '❌';
    let errorTitle = 'Face Not Verified';
    let attendanceStatus = 'ABSENT';
    let showRetry = true;
    
    if(errorMsg.includes('No face detected') || errorMsg.includes('not visible')) {
      errorMsg = '📷 Face is not visible in the image. Please position your face clearly in the camera.';
      errorTitle = 'Face Not Visible';
      errorIcon = '📷';
      attendanceStatus = 'ABSENT (No Face Detected)';
    } else if(errorMsg.includes('More than one person') || errorMsg.includes('multiple')) {
      errorMsg = '👥 Multiple people detected. Please ensure only one person is in the frame.';
      errorTitle = 'Multiple People Detected';
      errorIcon = '👥';
      attendanceStatus = 'ABSENT (Multiple Faces)';
    } else if(errorMsg.includes('No registered users')) {
      errorMsg = '🔍 Your face is not registered in the system. Please contact your admin to register your face first.';
      errorTitle = 'Face Not Registered';
      errorIcon = '🔍';
      attendanceStatus = 'ABSENT (Not Registered)';
    } else if(errorMsg.includes('Liveness check failed') || errorMsg.includes('fake')) {
      errorMsg = '⚠️ Liveness detection failed. Please ensure you are a real person (no photos/masks). Blink your eyes while capturing.';
      errorTitle = 'Not a Live Face';
      errorIcon = '⚠️';
      attendanceStatus = 'ABSENT (Failed Liveness Check)';
    } else {
      attendanceStatus = 'ABSENT (Face Does Not Match)';
    }
    
    // Check if attempts are exhausted
    const attemptText = result.max_attempts ? ` (Attempt ${result.current_attempt}/${result.max_attempts})` : '';
    const attemptsExhausted = result.attempts_exhausted || (result.current_attempt >= result.max_attempts);
    
    // Build attempt info message
    let attemptInfo = '';
    if(attemptsExhausted) {
      attemptInfo = `<p class="text-danger fw-bold" style="margin-top:1rem;color:#f44336">⚠️ Maximum verification attempts (${result.max_attempts}) completed. Please contact <strong>SmartAMS Admin</strong> for attendance.</p>`;
      showRetry = false;
    } else if(result.attempts_remaining !== undefined) {
      attemptInfo = `<p class="text-orange fw-semibold" style="margin-top:0.5rem">Remaining attempts: <strong>${result.attempts_remaining}</strong></p>`;
    }
    
    body.innerHTML=`<div class="att-status">
      <div class="att-icon-wrap error">${errorIcon}</div>
      <h3 class="text-red">❌ ${errorTitle}</h3>
      <p class="text-danger fw-semibold" style="font-size:1.1rem">Attendance: <span style="color:#f44336">${attendanceStatus}</span></p>
      <p class="text-muted">${errorMsg}</p>
      ${attemptInfo}
      <div style="margin-top:1rem">
        ${showRetry && !attemptsExhausted ? '<button class="btn btn-primary" onclick="startFaceAtt()">🔄 Retry</button>' : ''}
        <button class="btn btn-outline" onclick="resetAtt()" style="${showRetry && !attemptsExhausted ? 'margin-left:0.5rem' : ''}">Done</button>
      </div>
    </div>`;
    
    const toastMsg = attemptsExhausted ? `❌ Attempts exhausted - Contact Admin` : `❌ Face Not Verified - Attempt ${result.current_attempt}/${result.max_attempts}`;
    toast(toastMsg, 'error');
  }
}

async function startQRScan(){
  document.getElementById('qrScanSection').style.display='block';
  document.getElementById('attPanel').style.display='none';
  const video=document.getElementById('qrVideo');
  try{
    const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});
    AMS.cameraStream=stream;
    video.srcObject=stream;
    await video.play();
    scanQRLoop(video);
  }catch(e){
    document.getElementById('qrScanBody').innerHTML=`<div class="att-status"><div class="att-icon-wrap error">❌</div><p class="text-red">Camera access denied</p><button class="btn btn-outline mt-md" onclick="resetAtt()">Go Back</button></div>`;
  }
}

function scanQRLoop(video){
  if(!AMS.cameraStream) return;
  const canvas=document.getElementById('qrCanvas');
  const ctx=canvas.getContext('2d');
  const scan=()=>{
    if(!AMS.cameraStream) return;
    if(video.readyState===video.HAVE_ENOUGH_DATA){
      canvas.height=video.videoHeight;canvas.width=video.videoWidth;
      ctx.drawImage(video,0,0);
      const img=ctx.getImageData(0,0,canvas.width,canvas.height);
      const code=jsQR(img.data,img.width,img.height);
      if(code && code.data.startsWith('AMSQR:')){stopCamera();processQRAttendance(code.data);return;}
    }
    requestAnimationFrame(scan);
  };
  requestAnimationFrame(scan);
}

async function processQRAttendance(qrData){
  const parts=qrData.split(':');
  const sessionId=parts[1]||'SES001';
  const subject=parts[2]||'Unknown';
  const body=document.getElementById('qrScanBody');
  body.innerHTML=`<div class="att-status"><div class="att-icon-wrap loading" style="animation:spin 1.2s linear infinite">📍</div><p>Verifying location…</p></div>`;
  try{
    const loc=await getLocation();
    if(!isInCollege(loc.lat,loc.lng)){
      body.innerHTML=`<div class="att-status"><div class="att-icon-wrap error">📍</div><h3 class="text-red">Not in Campus</h3><button class="btn btn-outline mt-md" onclick="resetAtt()">Go Back</button></div>`;
      return;
    }
    body.innerHTML=`<div class="camera-wrap"><video id="qrFaceVideo" autoplay playsinline></video><div class="camera-ring"></div><div class="camera-status">✅ QR valid (${subject}) — verify face</div></div>
    <div style="text-align:center;margin-top:1rem"><button class="btn btn-primary" onclick="captureQRFace('${sessionId}','${subject}')">📷 Capture Face</button></div>`;
    await startCamera(document.getElementById('qrFaceVideo'));
  }catch(e){
    body.innerHTML=`<div class="att-status"><div class="att-icon-wrap error">❌</div><p>${e.message}</p><button class="btn btn-outline mt-md" onclick="resetAtt()">Go Back</button></div>`;
  }
}

async function captureQRFace(sessionId,subject){
  // Only students may capture face for QR attendance and faculty must enable face-rec
  if(AMS.role !== 'student'){
    toast('Only students can use Face Recognition attendance.','info');
    return;
  }
  if(!AMS.faceRecEnabled){
    document.getElementById('qrScanSection').style.display='block';
    const body=document.getElementById('qrScanBody');
    body.innerHTML=`<div class="att-status"><div class="att-icon-wrap error">⚠️</div><h3 class="text-red">Face Recognition Disabled</h3><p class="text-muted">Faculty has not enabled face recognition for this session.</p><button class="btn btn-primary mt-md" onclick="resetAtt()">OK</button></div>`;
    return;
  }
  const body=document.getElementById('qrScanBody');
  body.innerHTML=`<div class="att-status"><div class="att-icon-wrap loading" style="animation:spin 1.2s linear infinite">🔍</div><p>Capturing face…</p></div>`;
  
  // Wait longer for video to fully settle and render (1.5 seconds)
  await new Promise(r=>setTimeout(r,1500));
  
  // Capture image from qrFaceVideo before stopping camera
  let imageData = null;
  try {
    const videoEl = document.getElementById('qrFaceVideo');
    if(!videoEl) {
      throw new Error('Video element not found');
    }
    console.log(`QR video element: ${videoEl.videoWidth}x${videoEl.videoHeight}, readyState=${videoEl.readyState}`);
    
    // If video dimensions still 0, wait a bit more
    if(videoEl.videoWidth === 0 || videoEl.videoHeight === 0) {
      console.warn('QR Video dimensions 0, waiting additional time...');
      for(let i=0; i<10; i++) {
        await new Promise(r=>setTimeout(r,200));
        if(videoEl.videoWidth > 0 && videoEl.videoHeight > 0) {
          console.log(`✅ QR Video dimensions now: ${videoEl.videoWidth}x${videoEl.videoHeight}`);
          break;
        }
      }
    }
    
    imageData = captureFrame(videoEl);
  } catch(e) {
    console.error('Image capture error:', e);
  }
  
  // fallback to lastCapturedImage
  if(!imageData && AMS.lastCapturedImage){
    console.log('Using previously captured image');
    imageData = AMS.lastCapturedImage;
  }
  
  stopCamera();
  
  if(!imageData){
    body.innerHTML=`<div class="att-status"><div class="att-icon-wrap error">📷</div><h3 class="text-red">Capture Failed</h3><p class="text-muted">Unable to capture face. Ensure camera is enabled and try again.</p><button class="btn btn-outline mt-md" onclick="resetAtt()">Retry</button></div>`;
    return;
  }
  
  body.innerHTML=`<div class="att-status"><div class="att-icon-wrap loading" style="animation:spin 1.2s linear infinite">🔍</div><p>Verifying identity…</p></div>`;
  const result=await verifyFace(imageData);
  if(result.verified){
    // Face verified for QR attendance - marked as PRESENT
    body.innerHTML=`<div class="att-status">
      <div class="att-icon-wrap success">✅</div>
      <h3 class="text-green">✅ Face Verified</h3>
      <p class="text-success fw-semibold" style="font-size:1rem">Attendance: <span style="color:#4caf50">PRESENT</span></p>
      <p>Subject: <strong>${subject}</strong></p>
      <p>Student: <strong>${result.name}</strong></p>
      <button class="btn btn-outline mt-md" onclick="resetAtt()">Done</button>
    </div>`;
    toast('✅ Face Verified - QR Attendance Marked PRESENT','success');
  }else{
    // Face not verified - mark as ABSENT
    let errorMsg = result.error || 'Face verification failed';
    let errorIcon = '❌';
    let errorTitle = 'Face Not Verified';
    let attendanceStatus = 'ABSENT';
    
    if(errorMsg.includes('No face detected') || errorMsg.includes('not visible')) {
      errorMsg = '📷 Face is not visible in the image.';
      errorTitle = 'Face Not Visible';
      errorIcon = '📷';
      attendanceStatus = 'ABSENT (No Face)';
    } else if(errorMsg.includes('More than one person') || errorMsg.includes('multiple')) {
      errorMsg = '👥 Multiple people detected. Only one person allowed.';
      errorTitle = 'Multiple People Detected';
      errorIcon = '👥';
      attendanceStatus = 'ABSENT (Multiple Faces)';
    } else if(errorMsg.includes('No registered users')) {
      errorMsg = '🔍 Face not registered in the system.';
      errorTitle = 'Face Not Registered';
      errorIcon = '🔍';
      attendanceStatus = 'ABSENT (Not Registered)';
    } else if(errorMsg.includes('Liveness check failed') || errorMsg.includes('fake')) {
      errorMsg = '⚠️ Liveness detection failed. Please be a real person.';
      errorTitle = 'Not a Live Face';
      errorIcon = '⚠️';
      attendanceStatus = 'ABSENT (Failed Liveness)';
    } else {
      attendanceStatus = 'ABSENT (Face Does Not Match)';
    }
    
    body.innerHTML=`<div class="att-status">
      <div class="att-icon-wrap error">${errorIcon}</div>
      <h3 class="text-red">❌ ${errorTitle}</h3>
      <p class="text-danger fw-semibold" style="font-size:1rem">Attendance: <span style="color:#f44336">${attendanceStatus}</span></p>
      <p class="text-muted">${errorMsg}</p>
      <button class="btn btn-primary mt-md" onclick="processQRAttendance('AMSQR:${sessionId}:${subject}:0')">Retry</button>
      <button class="btn btn-outline mt-md" onclick="resetAtt()" style="margin-left:0.5rem">Cancel</button>
    </div>`;
    toast(`❌ Face Not Verified - Attendance Marked ${attendanceStatus}`,'error');
  }
}

function resetAtt(){
  stopCamera();
  document.getElementById('faceAttSection').style.display='none';
  document.getElementById('qrScanSection').style.display='none';
  document.getElementById('attPanel').style.display='block';
}

function renderStudentFees(){
  const fees=[
    {type:'Tuition Fee',amount:45000,due:'Mar 31',paid:45000,status:'paid'},
    {type:'Exam Fee',amount:2400,due:'Mar 31',paid:0,status:'pending'},
    {type:'Library Fee',amount:800,due:'Mar 31',paid:800,status:'paid'},
    {type:'Lab Fee',amount:1200,due:'Mar 31',paid:0,status:'pending'},
  ];
  return `<div class="stats-grid" style="grid-template-columns:repeat(3,1fr)">
    <div class="stat-card green"><div class="s-icon">✅</div><div class="s-val">₹46,600</div><div class="s-lbl">Total Paid</div></div>
    <div class="stat-card red"><div class="s-icon">⏰</div><div class="s-val">₹3,600</div><div class="s-lbl">Total Due</div></div>
    <div class="stat-card blue"><div class="s-icon">📅</div><div class="s-val">Mar 31</div><div class="s-lbl">Next Due Date</div></div>
  </div>
  <div class="card">
    <div class="card-header"><div class="card-title">💳 Fee Details</div></div>
    <div class="tbl-wrap"><table>
      <thead><tr><th>Fee Type</th><th>Amount</th><th>Due Date</th><th>Paid</th><th>Balance</th><th>Status</th><th>Action</th></tr></thead>
      <tbody>${fees.map(f=>`<tr>
        <td class="fw-semibold">${f.type}</td><td>₹${f.amount.toLocaleString()}</td><td>${f.due}</td>
        <td>₹${f.paid.toLocaleString()}</td>
        <td class="${f.amount-f.paid>0?'text-red':'text-green'}">₹${(f.amount-f.paid).toLocaleString()}</td>
        <td><span class="badge badge-${f.status==='paid'?'green':'red'}">${f.status}</span></td>
        <td>${f.status==='pending'?`<button class="btn btn-primary btn-sm" onclick="toast('Redirecting to payment…','info')">Pay Now</button>`:`<button class="btn btn-outline btn-sm">Receipt</button>`}</td>
      </tr>`).join('')}</tbody>
    </table></div>
  </div>`;
}

function renderExamReg(){
  return `<div class="card">
    <div class="card-header"><div class="card-title">📝 End Semester Exam Registration</div></div>
    <div class="announcement warning"><div class="ann-title">Registration Window: Feb 15 – Mar 10, 2024</div></div>
    <div class="tbl-wrap"><table>
      <thead><tr><th>Code</th><th>Subject</th><th>Type</th><th>Credits</th><th>Register</th></tr></thead>
      <tbody>${[
        {code:'CS301',name:'Data Structures',type:'Theory',cr:4},
        {code:'CS302',name:'Algorithms',type:'Theory',cr:3},
        {code:'CS401',name:'Database Systems',type:'Theory',cr:4},
        {code:'CS301L',name:'DS Lab',type:'Practical',cr:2},
      ].map(s=>`<tr>
        <td class="fw-semibold">${s.code}</td><td>${s.name}</td>
        <td><span class="badge badge-blue">${s.type}</span></td><td>${s.cr}</td>
        <td><input type="checkbox" checked style="width:18px;height:18px;cursor:pointer"/></td>
      </tr>`).join('')}</tbody>
    </table></div>
    <button class="btn btn-primary mt-lg" onclick="toast('Registration submitted!','success')">Submit Registration</button>
  </div>`;
}

function renderSemReg(){
  return `<div class="card">
    <div class="card-header"><div class="card-title">🗓️ Semester / Term Registration</div></div>
    <div class="form-row">
      <div class="form-group"><label>Academic Year</label><select><option>2024-25</option></select></div>
      <div class="form-group"><label>Semester</label><select><option>Semester 5</option><option>Semester 6</option></select></div>
    </div>
    <button class="btn btn-primary" onclick="toast('Semester registration submitted!','success')">Register for Semester</button>
  </div>`;
}

function renderSuppleReg(){
  return `<div class="card">
    <div class="card-header"><div class="card-title">🔄 Supplementary Exam</div></div>
    <div class="tbl-wrap"><table>
      <thead><tr><th>Subject</th><th>Semester</th><th>Result</th><th>Eligible</th><th>Register</th></tr></thead>
      <tbody>
        <tr><td>Engineering Maths</td><td>Sem 3</td><td><span class="badge badge-orange">47</span></td><td>✅ Yes</td><td><button class="btn btn-primary btn-sm" onclick="toast('Registered!','success')">Register</button></td></tr>
      </tbody>
    </table></div>
  </div>`;
}

function renderRevaluation(){
  return `<div class="card">
    <div class="card-header"><div class="card-title">🔍 Exam Revaluation</div></div>
    <div class="form-row">
      <div class="form-group"><label>Semester</label><select><option>Semester 4</option></select></div>
      <div class="form-group"><label>Subject</label><select><option>Algorithms</option></select></div>
    </div>
    <div class="form-group"><label>Reason</label><textarea placeholder="State your reason…"></textarea></div>
    <button class="btn btn-primary mt-md" onclick="toast('Revaluation submitted!','success')">Apply</button>
  </div>`;
}

function renderGraceMark(){
  return `<div class="card">
    <div class="card-header"><div class="card-title">🌟 Grace Mark Request</div></div>
    <div class="form-row">
      <div class="form-group"><label>Subject</label><select><option>Web Development</option></select></div>
      <div class="form-group"><label>Current Marks</label><input type="number" value="68"/></div>
    </div>
    <div class="form-group"><label>Justification</label><textarea placeholder="Provide justification…"></textarea></div>
    <button class="btn btn-primary" onclick="toast('Grace mark request submitted!','success')">Submit</button>
  </div>`;
}

function renderInterimSurvey(){
  const items=['Syllabus coverage is on track','Teaching methodology is clear','Study materials are adequate','Doubts are addressed promptly','Pace of teaching is appropriate'];
  return `<div class="card">
    <div class="card-header"><div class="card-title">📋 Interim Course Survey</div></div>
    ${items.map((q,i)=>`<div class="form-group"><label>Q${i+1}. ${q}</label>
      <div class="d-flex gap-md" style="margin-top:.5rem">
        ${['Strongly Disagree','Disagree','Neutral','Agree','Strongly Agree'].map((l,j)=>`<label style="display:flex;align-items:center;gap:.3rem;cursor:pointer;font-size:.8rem;color:var(--text2)"><input type="radio" name="q${i}" value="${j+1}"/> ${l}</label>`).join('')}
      </div>
    </div>`).join('')}
    <button class="btn btn-primary" onclick="toast('Survey submitted!','success')">Submit Survey</button>
  </div>`;
}

function renderExitSurvey(){
  return `<div class="card">
    <div class="card-header"><div class="card-title">🚪 Course Exit Survey</div></div>
    <div class="form-group"><label>Overall Rating</label>
      <div class="d-flex gap-md mt-sm">${[1,2,3,4,5].map(n=>`<button class="btn btn-outline btn-sm">⭐ ${n}</button>`).join('')}</div>
    </div>
    <div class="form-group"><label>Most Valuable Topics</label><textarea placeholder="Which topics were most useful?"></textarea></div>
    <div class="form-group"><label>Areas for Improvement</label><textarea placeholder="What could be improved?"></textarea></div>
    <button class="btn btn-primary" onclick="toast('Exit survey submitted!','success')">Submit</button>
  </div>`;
}

function renderGrievance(){
  return `<div class="card">
    <div class="card-header"><div class="card-title">⚖️ Grievance Redressal</div></div>
    <div class="form-group"><label>Category</label><select><option>Academic</option><option>Administrative</option><option>Hostel</option><option>Other</option></select></div>
    <div class="form-group"><label>Subject</label><input placeholder="Brief subject of grievance"/></div>
    <div class="form-group"><label>Description</label><textarea placeholder="Describe your grievance…"></textarea></div>
    <button class="btn btn-primary" onclick="toast('Grievance submitted. Ticket ID: GRV-'+Math.floor(Math.random()*9000+1000),'success')">Submit Grievance</button>
  </div>`;
}

function renderStaffEval(){
  const faculty=[{name:'Dr. Smith',sub:'Data Structures'},{name:'Dr. Johnson',sub:'Algorithms'}];
  return `<div class="card">
    <div class="card-header"><div class="card-title">⭐ Staff Evaluation</div></div>
    ${faculty.map(f=>`<div class="card" style="background:var(--ink3);border-color:var(--border)">
      <h4 class="mb-md">${f.name} — <span class="text-muted">${f.sub}</span></h4>
      ${['Teaching Clarity','Subject Knowledge','Overall'].map((q,j)=>`<div class="form-group"><label>${q}</label>
        <div class="d-flex gap-sm mt-sm">${[1,2,3,4,5].map(n=>`<button class="btn btn-outline btn-sm">${n}⭐</button>`).join('')}</div>
      </div>`).join('')}
    </div>`).join('')}
    <button class="btn btn-primary" onclick="toast('Evaluation submitted!','success')">Submit</button>
  </div>`;
}

function renderLeaveManagement(){
  return `<div class="card">
    <div class="card-header"><div class="card-title">🏖️ Apply for Leave</div></div>
    <div class="form-row">
      <div class="form-group"><label>Leave Type</label><select><option>Sick Leave</option><option>Personal Leave</option><option>Emergency</option></select></div>
      <div class="form-group"><label>From Date</label><input type="date"/></div>
      <div class="form-group"><label>To Date</label><input type="date"/></div>
    </div>
    <div class="form-group"><label>Reason</label><textarea placeholder="Reason for leave…"></textarea></div>
    <button class="btn btn-primary" onclick="toast('Leave application submitted!','success')">Apply for Leave</button>
  </div>`;
}

function renderPlacement(){
  const companies=[
    {name:'Google',role:'SWE Intern',deadline:'Feb 28',pkg:'₹25 LPA',eligible:true},
    {name:'Amazon',role:'SDE',deadline:'Mar 10',pkg:'₹18 LPA',eligible:true},
    {name:'Microsoft',role:'SDE-1',deadline:'Mar 5',pkg:'₹20 LPA',eligible:false},
  ];
  return `<div class="card">
    <div class="card-header"><div class="card-title">💼 Placement Notifications</div></div>
    <div class="tbl-wrap"><table>
      <thead><tr><th>Company</th><th>Role</th><th>Package</th><th>Deadline</th><th>Eligible</th><th>Action</th></tr></thead>
      <tbody>${companies.map(c=>`<tr>
        <td class="fw-semibold">${c.name}</td><td>${c.role}</td>
        <td class="text-green fw-semibold">${c.pkg}</td><td>${c.deadline}</td>
        <td>${c.eligible?'✅ Yes':'❌ No'}</td>
        <td>${c.eligible?`<button class="btn btn-primary btn-sm" onclick="toast('Applied to ${c.name}!','success')">Apply</button>`:`<button class="btn btn-outline btn-sm" disabled>Not Eligible</button>`}</td>
      </tr>`).join('')}</tbody>
    </table></div>
  </div>`;
}

function renderMessages(){
  return `<div class="card">
    <div class="card-header"><div class="card-title">✉️ Message Box</div><button class="btn btn-primary btn-sm">+ Compose</button></div>
    ${[
      {from:'Dr. Smith',sub:'Assignment 2 Feedback',time:'2h ago',read:false},
      {from:'HOD Office',sub:'Timetable Change',time:'5h ago',read:true},
    ].map(m=>`<div class="announcement ${m.read?'info':'warning'}" style="cursor:pointer">
      <div class="d-flex justify-between align-center">
        <div><div class="ann-title">${m.from}</div><div class="text-sm text-muted">${m.sub}</div></div>
        <div class="text-xs text-dim">${m.time}</div>
      </div>
    </div>`).join('')}
  </div>`;
}

function renderNoticeBoard(){
  return `<div class="card">
    <div class="card-header"><div class="card-title">📢 Announcements & Notice Board</div>
      <button class="btn btn-outline btn-sm" onclick="loadAnnouncements()">🔄 Refresh</button>
    </div>
    <div id="announcementsList" style="display:grid;gap:.75rem">
      <div style="text-align:center;padding:2rem;color:var(--text2)">Loading announcements...</div>
    </div>
  </div>`;
}

async function loadAnnouncements(){
  try{
    const res=await fetch(`/api/announcements?role=${AMS.role}&department=${AMS.user.department||''}`);
    const data=await res.json();
    
    if(data.success && data.announcements){
      const list=document.getElementById('announcementsList');
      list.innerHTML=data.announcements.map(a=>{
        const typeClass={urgent:'error',warning:'warning',info:'info',news:'green'}[a.announcement_type]||'info';
        return `<div class="announcement ${typeClass}">
          <div class="d-flex justify-between"><div class="ann-title">${a.title}</div><div class="ann-meta">${new Date(a.published_at).toLocaleDateString()}</div></div>
          <div class="text-sm text-muted mt-sm">${a.message.substring(0,150)}...</div>
        </div>`;
      }).join('') || '<div style="text-align:center;padding:2rem">No announcements</div>';
    }
  }catch(e){console.log(e);}
}

function renderPushNotif(){
  return `<div class="card">
    <div class="card-header"><div class="card-title">🔔 Notifications & Alerts</div>
      <button class="btn btn-outline btn-sm" onclick="loadUserNotifications()">🔄 Refresh</button>
    </div>
    
    <div style="margin-bottom:2rem">
      <div style="display:flex;gap:1rem;margin-bottom:1rem">
        <button class="btn btn-outline" id="notifTabAll" style="opacity:1" onclick="filterNotifications('all')">All</button>
        <button class="btn btn-outline" id="notifTabUnread" onclick="filterNotifications('unread')">Unread</button>
        <button class="btn btn-outline" id="notifTabAssignments" onclick="filterNotifications('assignment')">📝 Assignments</button>
        <button class="btn btn-outline" id="notifTabGrades" onclick="filterNotifications('grade')">📊 Grades</button>
      </div>
    </div>
    
    <div id="notificationsList" style="display:grid;gap:.75rem;max-height:600px;overflow-y:auto">
      <div style="text-align:center;padding:2rem;color:var(--text2)">Loading notifications...</div>
    </div>
    
    <div style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--border)">
      <label style="display:flex;gap:.5rem;align-items:center;cursor:pointer">
        <input type="checkbox" onchange="toast('Preference updated','info')"/>
        <span>Enable desktop notifications</span>
      </label>
    </div>
  </div>`;
}

async function loadUserNotifications(){
  try{
    const res=await fetch(`/api/notifications?user_id=${AMS.user.id}`);
    const data=await res.json();
    
    if(data.success && data.notifications){
      displayNotifications(data.notifications);
      AMS.notifications=data.notifications;
    }
  }catch(e){console.log(e);toast('Error loading notifications','error');}
}

function displayNotifications(notifications){
  const list=document.getElementById('notificationsList');
  if(!notifications || notifications.length===0){
    list.innerHTML='<div style="text-align:center;padding:2rem;color:var(--text2)">No notifications</div>';
    return;
  }
  
  list.innerHTML=notifications.map(n=>{
    const icon={announcement:'📢',alert:'⚠️',message:'💬',timetable:'📅',assignment:'📝',grade:'📊',attendance:'✅',event:'🎯'}[n.notification_type]||'🔔';
    return `<div class="notification-item" style="padding:1rem;background:var(--card);border-radius:8px;border-left:4px solid ${n.is_read?'var(--border)':'var(--blue)'};cursor:pointer" onclick="markNotificationRead('${n.id}')">
      <div style="display:flex;justify-content:space-between;align-items:start">
        <div style="flex:1">
          <div style="font-weight:600;margin-bottom:0.5rem">${icon} ${n.title}</div>
          <div style="font-size:0.9rem;color:var(--text2);margin-bottom:0.5rem">${n.message}</div>
          <div style="font-size:0.8rem;color:var(--text3)">${new Date(n.created_at).toLocaleString()}</div>
        </div>
        <div style="flex-shrink:0;margin-left:1rem">
          <span class="badge badge-${n.priority==='urgent'?'red':n.priority==='high'?'orange':'gray'}">${n.priority}</span>
        </div>
      </div>
    </div>`;
  }).join('');
}

function filterNotifications(type){
  // Update active tab
  document.querySelectorAll('[id^="notifTab"]').forEach(b=>b.style.opacity='0.5');
  document.getElementById('notifTab'+type.charAt(0).toUpperCase()+type.slice(1)).style.opacity='1';
  
  // Filter and display
  let filtered=AMS.notifications||[];
  if(type==='unread') filtered=filtered.filter(n=>!n.is_read);
  else if(type!=='all') filtered=filtered.filter(n=>n.notification_type===type);
  
  displayNotifications(filtered);
}

async function markNotificationRead(notificationId){
  try{
    await fetch(`/api/notifications/${notificationId}/read`, {method:'PUT'});
    loadUserNotifications();
  }catch(e){console.log(e);}
}

function showNotifications(){
  const modal=document.createElement('div');
  modal.className='modal-overlay';
  modal.innerHTML=`<div class="modal-content" style="width:600px;max-height:80vh;overflow-y:auto">
    <div class="modal-header">
      <h3>📬 Notifications</h3>
      <button class="btn-close" onclick="this.closest('.modal-overlay').remove()">×</button>
    </div>
    <div class="modal-body" id="notificationModalBody">
      Loading...
    </div>
  </div>`;
  document.body.appendChild(modal);
  
  // Load and display
  fetch(`/api/notifications?user_id=${AMS.user.id}`)
    .then(r=>r.json())
    .then(d=>{
      const body=document.getElementById('notificationModalBody');
      if(d.success&&d.notifications){
        body.innerHTML=d.notifications.map(n=>`<div style="padding:1rem;border-bottom:1px solid var(--border)">
          <strong>${n.title}</strong><br>
          <small style="color:var(--text2)">${n.message}</small><br>
          <tiny style="color:var(--text3)">${new Date(n.created_at).toLocaleString()}</tiny>
        </div>`).join('');
      }else{
        body.innerHTML='<p style="text-align:center;color:var(--text2)">No notifications</p>';
      }
    })
    .catch(e=>console.log(e));
}

// ==========================================================
//  FACULTY MODULES
// ==========================================================
function renderFacultyDashboard(){
  // fire off data load after the markup is inserted
  setTimeout(loadFacultyDashboardData,0);
  return `
  <div class="stats-grid" id="facultyStats">Loading statistics...</div>
  <div style="display:grid;grid-template-columns:2fr 1fr;gap:1.25rem">
    <div class="card">
      <div class="card-header"><div class="card-title">📋 Today's Schedule</div></div>
      <div id="facultySchedule" style="padding:1rem;color:var(--text2)">Loading schedule...</div>
    </div>
    <div class="card">
      <div class="card-header"><div class="card-title">⚡ Quick Actions</div></div>
      <div style="display:flex;flex-direction:column;gap:.5rem">
        <button class="btn btn-primary w-full" onclick="loadModule('f-attendance','Attendance Marking')">✅ Mark Attendance</button>
        <button class="btn btn-teal w-full" onclick="loadModule('f-materials','Course Materials')">📂 Upload Material</button>
        <button class="btn btn-outline w-full" onclick="loadModule('f-worklog','Daily Work Log')">📋 Submit Work Log</button>
        <button class="btn btn-outline w-full" onclick="loadModule('f-studentleave','Student Leave Mgmt')">🏖️ Student Leaves</button>
      </div>
    </div>
  </div>
  `;
}

async function loadFacultyDashboardData(){
  try{
    // courses
    const coursesResp = await fetch(`/api/courses?faculty_id=${AMS.user.id}`);
    const coursesJson = await coursesResp.json();
    const courses = coursesJson.success && coursesJson.courses ? coursesJson.courses : [];
    const activeCourses = courses.length;

    // total students (simple count)
    const studentsResp = await fetch('/api/users/list?role=student');
    const studentsJson = await studentsResp.json();
    const totalStudents = studentsJson.success && studentsJson.users ? studentsJson.users.length : 0;

    // attendance records
    const attResp = await fetch('/api/attendance');
    const attJson = await attResp.json();
    const records = attJson.records || [];
    const facultyCourseIds = courses.map(c=>c.id);
    const relevant = records.filter(r=> facultyCourseIds.includes(r.course_id));
    const presentCount = relevant.filter(r=> r.verified).length;
    const avgAttendance = relevant.length ? Math.round(presentCount*10000/relevant.length)/100 : 0;

    // pending tasks (assignments)
    const assignResp = await fetch(`/api/assignments?faculty_id=${AMS.user.id}`);
    const assignJson = await assignResp.json();
    let pendingTasks = 0;
    if(assignJson.success && assignJson.assignments){
      pendingTasks = assignJson.assignments.filter(a=>!a.status || a.status==='published').length;
    }

    // render stats grid
    document.getElementById('facultyStats').innerHTML = `
      <div class="stat-card blue"><div class="s-icon">📚</div><div class="s-val">${activeCourses}</div><div class="s-lbl">Active Courses</div></div>
      <div class="stat-card green"><div class="s-icon">👥</div><div class="s-val">${totalStudents}</div><div class="s-lbl">Total Students</div></div>
      <div class="stat-card teal"><div class="s-icon">📊</div><div class="s-val">${avgAttendance}%</div><div class="s-lbl">Avg Attendance</div></div>
      <div class="stat-card orange"><div class="s-icon">⏰</div><div class="s-val">${pendingTasks}</div><div class="s-lbl">Pending Tasks</div></div>
    `;

    // build schedule for today
    const todayDate = new Date().toISOString().slice(0,10);
    let todaysCourseIds = [...new Set(relevant.filter(r=>r.date===todayDate).map(r=>r.course_id))];
    let scheduleHtml='';
    if(todaysCourseIds.length===0){
      scheduleHtml = '<p style="text-align:center;color:var(--text2)">No classes scheduled for today</p>';
    } else {
      todaysCourseIds.forEach(cid=>{
        const course = courses.find(c=>c.id===cid);
        scheduleHtml += `<div class="announcement info d-flex justify-between align-center mb-sm">
          <div>
            <div class="ann-title">${course?course.name:cid}</div>
            <div class="text-sm text-muted">${course?course.code:''}</div>
          </div>
          <div class="badge badge-purple">Today</div>
        </div>`;
      });
    }
    document.getElementById('facultySchedule').innerHTML = scheduleHtml;
  }catch(e){
    console.error('[Dashboard]',e);
  }
}

function renderFacultyTimetable(){
  const tt=[
    {day:'Monday',slots:[{t:'9–10',s:'Data Structures',c:'CS-A',r:'B-301',locked:false},{t:'10–11',s:'Algorithms',c:'CS-B',r:'B-302',locked:true}]},
    {day:'Tuesday',slots:[{t:'9–10',s:'Database',c:'CS-A',r:'B-301',locked:false},{t:'11–12',s:'Data Structures',c:'CS-B',r:'B-302',locked:false}]},
    {day:'Wednesday',slots:[{t:'10–12',s:'Algorithms Lab',c:'CS-A',r:'Lab-1',locked:false}]},
    {day:'Thursday',slots:[{t:'9–10',s:'Data Structures',c:'CS-A',r:'B-301',locked:false}]},
    {day:'Friday',slots:[{t:'9–10',s:'Database',c:'CS-A',r:'B-301',locked:false},{t:'10–11',s:'Tutorial',c:'CS-A',r:'Seminar',locked:false}]},
  ];
  return `<div class="card">
    <div class="card-header">
      <div class="card-title">📅 My Timetable</div>
      <div class="d-flex gap-md align-center">
        <input type="date" value="${new Date().toISOString().split('T')[0]}" style="padding:.4rem .7rem;border-radius:6px;border:1px solid var(--border);background:var(--ink3);color:var(--text);font-size:.85rem"/>
        <button class="btn btn-outline btn-sm">📥 Download PDF</button>
      </div>
    </div>
    <div class="d-flex gap-md mb-md text-sm" style="flex-wrap:wrap">
      <span style="display:flex;align-items:center;gap:.4rem"><span style="width:14px;height:14px;border-radius:3px;background:var(--green);display:inline-block"></span> Attendance Confirmed</span>
      <span style="display:flex;align-items:center;gap:.4rem"><span style="width:14px;height:14px;border-radius:3px;background:var(--red);display:inline-block"></span> Not Marked</span>
      <span style="display:flex;align-items:center;gap:.4rem"><span style="width:14px;height:14px;border-radius:3px;background:var(--orange);display:inline-block"></span> Unlocked to All</span>
    </div>
    <div class="tbl-wrap"><table>
      <thead><tr><th>Day</th><th>Time</th><th>Subject</th><th>Class</th><th>Room</th><th>Lock</th><th>Action</th></tr></thead>
      <tbody>${tt.map(d=>d.slots.map((s,i)=>`<tr>
        ${i===0?`<td rowspan="${d.slots.length}" class="fw-semibold">${d.day}</td>`:''}
        <td><span class="badge badge-gray">${s.t}</span></td>
        <td class="fw-semibold">${s.s}</td>
        <td><span class="badge badge-blue">${s.c}</span></td>
        <td>${s.r}</td>
        <td>
          <button class="btn btn-outline btn-sm" onclick="toast('Period ${s.locked?'unlocked':'locked'}','info')" title="${s.locked?'Unlock period':'Lock period'}">
            ${s.locked?'🔒':'🔓'}
          </button>
        </td>
        <td><button class="btn btn-primary btn-sm" onclick="toast('Opening attendance for ${s.s}…','info')">✅ Mark</button></td>
      </tr>`).join('')).join('')}</tbody>
    </table></div>
  </div>`;
}

// ── NEW: My Working Hours ─────────────────────────────────
function renderFacultyWorkingHours(){
  const batches=[
    {batch:'CS2016A',subject:'ASD LAB',hours:3},
    {batch:'M.Tech-CSE18',subject:'CLOUD',hours:3},
    {batch:'CS2015A1',subject:'CS401',hours:32},
    {batch:'AR2018',subject:'ARSUB04',hours:2},
  ];
  const total=batches.reduce((s,b)=>s+b.hours,0);
  return `<div class="card">
    <div class="card-header"><div class="card-title">⏱️ My Working Hours</div></div>
    <div class="form-row" style="align-items:flex-end">
      <div class="form-group"><label>From Date</label><input type="date" id="whFrom" value="2024-01-09"/></div>
      <div class="form-group"><label>To Date</label><input type="date" id="whTo" value="2024-03-25"/></div>
      <div class="form-group" style="margin-top:auto"><button class="btn btn-primary" onclick="toast('Working hours loaded','success')">Submit</button></div>
    </div>
    <div class="tbl-wrap"><table>
      <thead><tr><th>Batch Name</th><th>Subject Name</th><th>Hours</th><th>Hour Report</th><th>Planner Report</th><th>Attendance Report</th></tr></thead>
      <tbody>
        ${batches.map(b=>`<tr>
          <td class="fw-semibold">${b.batch}</td>
          <td>${b.subject}</td>
          <td>${b.hours}</td>
          <td><button class="btn btn-outline btn-sm" onclick="toast('Opening Hour Report…','info')">View</button></td>
          <td><button class="btn btn-outline btn-sm" onclick="toast('Opening Planner Report…','info')">View</button></td>
          <td><button class="btn btn-outline btn-sm" onclick="toast('Opening Attendance Report…','info')">View</button></td>
        </tr>`).join('')}
        <tr style="background:rgba(137,87,229,.06)">
          <td colspan="2" class="fw-semibold">TOTAL HOURS</td>
          <td class="fw-semibold">${total}</td>
          <td colspan="2"><button class="btn btn-teal btn-sm" onclick="toast('Total Working Hours downloaded','success')">Total Working Hour Details</button></td>
          <td><button class="btn btn-outline btn-sm" onclick="toast('Daily Work Log opened','info')">Daily Work Log</button></td>
        </tr>
      </tbody>
    </table></div>
  </div>`;
}

// ── NEW: My Previous Details ──────────────────────────────
function renderFacultyPrevDetails(){
  const prev=[
    {code:'CS 110',batch:'CS2017A',sem:'S1'},{code:'U SLOT',batch:'CS2017A',sem:'S1'},
    {code:'U SLOT',batch:'CS2017A',sem:'S2'},{code:'U SLOT',batch:'CS2017A',sem:'S3'},
    {code:'CS 110',batch:'CS2017B',sem:'S1'},{code:'BE 103',batch:'CS2016A',sem:'S1'},
    {code:'BE 103',batch:'CS2016B',sem:'S1'},{code:'BE 103',batch:'CS2015A1',sem:'S1'},
  ];
  return `<div class="card">
    <div class="card-header"><div class="card-title">📋 My Previous Details</div></div>
    <p class="text-muted mb-md">Details of batches handled by you in previous semesters.</p>
    <div class="form-row" style="align-items:flex-end">
      <div class="form-group"><label>Select Department</label>
        <select><option>All</option><option>Computer Science</option><option>Architecture</option></select>
      </div>
      <div class="form-group"><label>Select Batch</label>
        <select><option>All</option><option>CS2017A</option><option>CS2016A</option></select>
      </div>
      <div class="form-group"><label>Select Semester</label>
        <select><option>All</option><option>S1</option><option>S2</option><option>S3</option></select>
      </div>
      <div class="form-group"><label>Subject Code</label>
        <input placeholder="Subject Code"/>
      </div>
      <div class="form-group" style="margin-top:auto">
        <button class="btn btn-primary" onclick="toast('Records loaded','success')">Search</button>
        <button class="btn btn-outline" style="margin-left:.5rem" onclick="toast('Filters cleared','info')">Reset</button>
      </div>
    </div>
    <div class="tbl-wrap"><table>
      <thead><tr><th>Sl. No.</th><th>Subject Code</th><th>Batch</th><th>Sem</th><th>View</th></tr></thead>
      <tbody>${prev.map((p,i)=>`<tr>
        <td>${i+1}</td>
        <td class="fw-semibold">${p.code}</td>
        <td>${p.batch}</td>
        <td><span class="badge badge-blue">${p.sem}</span></td>
        <td><button class="btn btn-outline btn-sm" onclick="toast('Viewing details for ${p.code} – ${p.batch}','info')">↗ View</button></td>
      </tr>`).join('')}</tbody>
    </table></div>
  </div>`;
}

// ── NEW: My Ratings (Faculty Evaluation Results) ──────────
function renderFacultyRatings(){
  const evals=[
    {name:'Evaluation ECA',batch:'ECA2016',hasDetails:true},
    {name:'Faculty evaluation trial',batch:'ECA2016',hasDetails:true},
    {name:'Test evaluation II',batch:'ECA2016',hasDetails:true},
    {name:'TEST EVALUATION',batch:'ECA2016',hasDetails:false},
    {name:'TEST EVALUATION 2',batch:'ECA2016',hasDetails:true},
  ];
  const qdetails=[
    {q:'The teacher is available for any doubt',strongly_disagree:0,disagree:0,neutral:100,agree:0,strongly_agree:0,points:'3/1 = 3.00'},
    {q:'The teacher is supportive and committed for teaching',strongly_disagree:0,disagree:0,neutral:0,agree:0,strongly_agree:100,points:'5/1 = 5.00'},
  ];
  return `<div class="card">
    <div class="card-header">
      <div class="card-title">⭐ My Ratings — Faculty Evaluation Results</div>
      <div class="d-flex gap-md">
        <button class="btn btn-outline btn-sm" onclick="toast('Exporting ratings…','info')">📥 Export</button>
        <button class="btn btn-outline btn-sm" onclick="toast('Printing ratings…','info')">🖨️ Print</button>
      </div>
    </div>
    <div class="tbl-wrap"><table>
      <thead><tr><th>Sl. No.</th><th>Evaluation Name</th><th>Batch Name</th><th>Details</th></tr></thead>
      <tbody>${evals.map((e,i)=>`<tr>
        <td>${i+1}</td>
        <td class="fw-semibold">${e.name}</td>
        <td>${e.batch}</td>
        <td>${e.hasDetails?`<button class="btn btn-outline btn-sm" onclick="showRatingDetails()">↗ Details</button>`:''}</td>
      </tr>`).join('')}</tbody>
    </table></div>
  </div>

  <div id="ratingDetailsCard" style="display:none">
    <div class="card">
      <div class="card-header">
        <div class="card-title">Faculty Evaluation Results — Detail</div>
        <div class="d-flex gap-md">
          <button class="btn btn-outline btn-sm" onclick="toast('Showing student feedback…','info')">Show Feedback</button>
          <button class="btn btn-outline btn-sm" onclick="toast('Exporting…','info')">📥 Export</button>
          <button class="btn btn-outline btn-sm" onclick="document.getElementById('ratingDetailsCard').style.display='none'">◀ Back</button>
        </div>
      </div>
      <div class="mb-md">
        <p><strong>Evaluation Name:</strong> Evaluation ECA</p>
        <p><strong>Staff Name:</strong> ${AMS.user.name}</p>
        <p><strong>Batch Name:</strong> ECA2016</p>
        <p><strong>Subject Name:</strong> subject2</p>
      </div>
      <div class="tbl-wrap"><table>
        <thead><tr><th>Sl. No</th><th>Question</th><th>Quality</th><th>Point (P)</th><th>Votes (V)</th></tr></thead>
        <tbody>
          ${qdetails.map((q,qi)=>[
            {quality:'Strongly disagree',p:1,v:'0.00%'},
            {quality:'Disagree',p:2,v:'0.00%'},
            {quality:'Neutral',p:3,v:qi===0?'100.00%':'0.00%'},
            {quality:'Agree',p:4,v:'0.00%'},
            {quality:'Strongly agree',p:5,v:qi===1?'100.00%':'0.00%'},
          ].map((row,ri)=>`<tr>
            ${ri===0?`<td rowspan="5">${qi+1}</td><td rowspan="5">${q.q}</td>`:''}
            <td>${row.quality}</td><td>${row.p}</td><td>${row.v}</td>
          </tr>`).join('')+'<tr style="background:rgba(137,87,229,.08)"><td colspan="2" class="fw-semibold">Points Gained:</td><td colspan="2" class="fw-semibold">${q.points}</td></tr>').join('')}
        </tbody>
        <tfoot>
          <tr style="background:rgba(137,87,229,.12)">
            <td colspan="3" class="fw-semibold text-blue">Teaching Effectiveness Index</td>
            <td colspan="2" class="fw-semibold text-blue">8.00</td>
          </tr>
          <tr style="background:rgba(137,87,229,.08)">
            <td colspan="3" class="fw-semibold">Total Percentage</td>
            <td colspan="2" class="fw-semibold">80%</td>
          </tr>
        </tfoot>
      </table></div>
      <div class="d-flex gap-md mt-md">
        <button class="btn btn-outline btn-sm" onclick="toast('Showing student suggestions…','info')">Student Suggestions</button>
        <button class="btn btn-outline btn-sm" onclick="toast('Showing feedbacks…','info')">Feedbacks</button>
      </div>
    </div>
  </div>`;
}


// ── NEW: Student Leave Management (Faculty) ───────────────
function renderFacultyStudentLeave(){
  const leaves=[
    {sl:1,roll:'CS001',student:'Alice Johnson',type:'Medical',from:'Feb 12',to:'Feb 13',session:'FN',status:'Pending',applied:'Feb 11'},
    {sl:2,roll:'CS002',student:'Bob Smith',type:'Personal',from:'Feb 15',to:'Feb 15',session:'AN',status:'Forwarded',applied:'Feb 14'},
    {sl:3,roll:'CS003',student:'Carol Davis',type:'Emergency',from:'Feb 10',to:'Feb 12',session:'FD',status:'Rejected',applied:'Feb 09'},
  ];
  return `<div class="card">
    <div class="card-header"><div class="card-title">🏖️ Student Leave Management</div></div>

    <div class="d-flex gap-md mb-md" style="flex-wrap:wrap">
      <label style="display:flex;align-items:center;gap:.4rem;cursor:pointer">
        <input type="radio" name="leaveFilter" value="leaveDate" checked/> Filter by Leave Date
      </label>
      <label style="display:flex;align-items:center;gap:.4rem;cursor:pointer">
        <input type="radio" name="leaveFilter" value="appliedDate"/> Filter by Applied Date
      </label>
    </div>

    <div class="form-row" style="align-items:flex-end">
      <div class="form-group"><label>Department</label>
        <select><option>All</option><option>Computer Science</option><option>Electronics</option></select>
      </div>
      <div class="form-group"><label>Batch</label>
        <select><option>All</option><option>CS2024A</option><option>CS2024B</option></select>
      </div>
      <div class="form-group"><label>Leave Type</label>
        <select><option>--All--</option><option>Medical</option><option>Personal</option><option>Emergency</option><option>Duty Leave</option></select>
      </div>
      <div class="form-group"><label>Leave From</label><input type="date"/></div>
      <div class="form-group"><label>Leave To</label><input type="date"/></div>
      <div class="form-group"><label>Student Name</label><input placeholder="Student name"/></div>
      <div class="form-group"><label>Roll No</label><input placeholder="Roll number"/></div>
      <div class="form-group" style="margin-top:auto">
        <button class="btn btn-primary" onclick="toast('Leaves loaded','success')">Search</button>
        <button class="btn btn-outline" style="margin-left:.5rem" onclick="toast('Filters reset','info')">Reset</button>
      </div>
    </div>

    <div class="d-flex gap-md mb-md">
      <button class="btn btn-primary btn-sm" onclick="switchLeaveTab('pending')" id="leavePendingBtn">Pending</button>
      <button class="btn btn-outline btn-sm" onclick="switchLeaveTab('forwarded')" id="leaveForwardedBtn">Forwarded</button>
      <button class="btn btn-outline btn-sm" onclick="switchLeaveTab('rejected')" id="leaveRejectedBtn">Rejected</button>
      <button class="btn btn-outline btn-sm" onclick="switchLeaveTab('report')" id="leaveReportBtn">Report</button>
    </div>

    <div class="tbl-wrap"><table>
      <thead><tr><th>Sl. No.</th><th>Roll No</th><th>Student</th><th>Leave Type</th><th>Leave Date (From–To)</th><th>Session</th><th>Status</th><th>Details</th><th>Action</th><th>Reject</th><th>Application</th></tr></thead>
      <tbody id="leaveTableBody">
        ${leaves.map(l=>`<tr>
          <td>${l.sl}</td>
          <td class="fw-semibold">${l.roll}</td>
          <td>${l.student}</td>
          <td><span class="badge badge-blue">${l.type}</span></td>
          <td>${l.from} – ${l.to}</td>
          <td>${l.session}</td>
          <td><span class="badge badge-${l.status==='Forwarded'?'green':l.status==='Rejected'?'red':'orange'}">${l.status}</span></td>
          <td><button class="btn btn-outline btn-sm" onclick="toast('Viewing leave details…','info')">Details</button></td>
          <td>${l.status==='Pending'?`<button class="btn btn-success btn-sm" onclick="toast('Leave forwarded for ${l.student}','success')">Forward</button>`:''}</td>
          <td>${l.status==='Pending'?`<button class="btn btn-danger btn-sm" onclick="toast('Leave rejected for ${l.student}','warning')">Reject</button>`:''}</td>
          <td><button class="btn btn-outline btn-sm" onclick="toast('Application details…','info')">View</button></td>
        </tr>`).join('')}
      </tbody>
    </table></div>
  </div>

  <div class="card">
    <div class="card-header"><div class="card-title">📊 Leave Report</div></div>
    <div class="stats-grid" style="grid-template-columns:repeat(4,1fr)">
      <div class="stat-card orange"><div class="s-icon">⏳</div><div class="s-val">1</div><div class="s-lbl">Pending</div></div>
      <div class="stat-card green"><div class="s-icon">✅</div><div class="s-val">1</div><div class="s-lbl">Forwarded</div></div>
      <div class="stat-card red"><div class="s-icon">❌</div><div class="s-val">1</div><div class="s-lbl">Rejected</div></div>
      <div class="stat-card blue"><div class="s-icon">📋</div><div class="s-val">3</div><div class="s-lbl">Total</div></div>
    </div>
  </div>`;
}

function switchLeaveTab(tab){
  ['pending','forwarded','rejected','report'].forEach(t=>{
    const btn=document.getElementById(`leave${t.charAt(0).toUpperCase()+t.slice(1)}Btn`);
    if(btn) btn.className=t===tab?'btn btn-primary btn-sm':'btn btn-outline btn-sm';
  });
  toast(`Showing ${tab} leaves`,'info');
}

// ── NEW: Transport (Faculty) ──────────────────────────────
function renderFacultyTransport(){
  return `<div class="card">
    <div class="card-header">
      <div class="card-title">🚌 Transport</div>
      <button class="btn btn-primary btn-sm" onclick="document.getElementById('transportModal').style.display='flex'">+ New Request</button>
    </div>
    <div id="transportList">
      <div class="announcement info">
        <div class="ann-title">No transport records found.</div>
        <div class="text-sm text-muted">Click "New Request" to apply for transportation.</div>
      </div>
    </div>
  </div>

  <div id="transportModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:1000;align-items:center;justify-content:center">
    <div class="card" style="width:90%;max-width:480px">
      <div class="card-header">
        <div class="card-title">🚌 New Transport Request</div>
        <button class="btn btn-outline btn-sm" onclick="document.getElementById('transportModal').style.display='none'">✕</button>
      </div>
      <div style="padding:1.5rem">
        <div class="form-group"><label>Select Bus and Route *</label>
          <select><option>Select</option><option>Route 1 – Whitefield to College</option><option>Route 2 – Jayanagar to College</option><option>Route 3 – Electronic City to College</option></select>
        </div>
        <div class="form-group"><label>Select Boarding Point *</label>
          <select><option>Select</option><option>Stop 1</option><option>Stop 2</option><option>Stop 3</option></select>
        </div>
        <div class="form-group"><label>Travel Period *</label>
          <div class="form-row">
            <div class="form-group"><label>From</label><input type="date"/></div>
            <div class="form-group"><label>To</label><input type="date"/></div>
          </div>
        </div>
        <div class="form-group"><label>Bus Fee *</label>
          <div class="d-flex gap-md align-center">
            <input type="text" placeholder="Amount" style="flex:1"/>
            <button class="btn btn-teal btn-sm" onclick="toast('Bus fee calculated: ₹1,200','info')">Calculate</button>
          </div>
        </div>
        <div class="form-group"><label>Remarks</label><textarea placeholder="Any remarks…" style="min-height:80px"></textarea></div>
        <div class="d-flex gap-md mt-md">
          <button class="btn btn-outline" style="flex:1" onclick="document.getElementById('transportModal').style.display='none'">Cancel</button>
          <button class="btn btn-primary" style="flex:1" onclick="submitTransportRequest()">Submit</button>
        </div>
      </div>
    </div>
  </div>`;
}

function submitTransportRequest(){
  document.getElementById('transportModal').style.display='none';
  toast('Transport request submitted! Awaiting management approval.','success');
}

// ── NEW: Faculty Message Box (send to students & staff) ───
function renderFacultyMessages(){
  return `<div class="card">
    <div class="card-header">
      <div class="card-title">✉️ Message Box</div>
      <button class="btn btn-primary btn-sm" onclick="toggleComposePanel()">✏️ Compose</button>
    </div>

    <div id="composePanelFac" style="display:none;background:var(--ink3);border:1px solid var(--border);border-radius:var(--radius);padding:1.5rem;margin-bottom:1rem">
      <h4 class="mb-md">Compose Mail</h4>
      <div class="form-row">
        <div class="form-group"><label>To</label>
          <select><option>All Students</option><option>Selected Students</option><option>All Staff</option></select>
        </div>
        <div class="form-group"><label>Departments</label>
          <select><option>CS</option><option>EC</option><option>ME</option><option>All</option></select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Batch</label>
          <select><option>All</option><option>CS2024A</option><option>CS2024B</option></select>
        </div>
        <div class="form-group"><label>Sub-Batch</label>
          <select><option>All</option><option>Sub-A</option></select>
        </div>
      </div>
      <div class="form-group"><label>Mail To</label>
        <input value="All Students" readonly style="background:var(--ink2);"/>
      </div>
      <div class="form-group"><label>Subject *</label><input placeholder="Enter mail subject"/></div>
      <div class="form-group"><label>Message *</label><textarea placeholder="Type your message here…" style="min-height:100px"></textarea></div>
      <div class="d-flex gap-md mt-md">
        <button class="btn btn-outline" onclick="toggleComposePanel()">Cancel</button>
        <button class="btn btn-primary" onclick="toast('Message sent successfully!','success');toggleComposePanel()">Send</button>
      </div>
    </div>

    <div class="d-flex gap-md mb-md">
      <button class="btn btn-primary btn-sm" onclick="setMsgTab('inbox')">📥 Inbox <span class="badge badge-red" style="margin-left:.3rem">2</span></button>
      <button class="btn btn-outline btn-sm" onclick="setMsgTab('sent')">📤 Sent Messages</button>
    </div>

    ${[
      {from:'Dr. Johnson',sub:'Timetable Update for Monday',time:'2h ago',read:false},
      {from:'HOD – CS',sub:'Meeting at 3PM Today',time:'5h ago',read:true},
      {from:'Admin Office',sub:'Circular: Holiday on Feb 26',time:'1d ago',read:true},
    ].map(m=>`<div class="announcement ${m.read?'info':'warning'}" style="cursor:pointer;margin-bottom:.5rem">
      <div class="d-flex justify-between align-center">
        <div>
          <div class="ann-title">${m.from}</div>
          <div class="text-sm text-muted">${m.sub}</div>
        </div>
        <div class="d-flex gap-sm align-center">
          <div class="text-xs text-dim">${m.time}</div>
          ${!m.read?'<span class="badge badge-blue">New</span>':''}
        </div>
      </div>
    </div>`).join('')}
  </div>`;
}

function toggleComposePanel(){
  const p=document.getElementById('composePanelFac');
  if(p) p.style.display=p.style.display==='none'?'block':'none';
}
function setMsgTab(tab){ toast(`Showing ${tab}`,'info'); }

// ── NEW: Rules and Regulations (Faculty) ──────────────────
function renderFacultyRules(){
  const rules=[
    {no:1,rule:'All faculty must submit attendance within 30 minutes of class end.'},
    {no:2,rule:'Daily Work Log must be submitted by 6:00 PM each working day.'},
    {no:3,rule:'Course materials must be uploaded at least one week before class.'},
    {no:4,rule:'Internal marks must be submitted within 48 hours of exam completion.'},
    {no:5,rule:'Faculty must be present in campus during working hours (9 AM – 5 PM).'},
    {no:6,rule:'Leave applications must be submitted at least 2 days in advance.'},
    {no:7,rule:'All academic communications must be routed through the official message system.'},
  ];
  return `<div class="card">
    <div class="card-header"><div class="card-title">📜 Rules and Regulations</div></div>
    <div class="announcement info mb-md">
      <div class="ann-title">ISO Rules — Faculty Rules</div>
      <div class="text-sm text-muted">Rules set by Administration. Contact admin to request changes.</div>
    </div>
    <div class="tbl-wrap"><table>
      <thead><tr><th>Sl. No.</th><th>Rule</th></tr></thead>
      <tbody>${rules.map(r=>`<tr>
        <td class="fw-semibold">${r.no}</td>
        <td>${r.rule}</td>
      </tr>`).join('')}</tbody>
    </table></div>
  </div>`;
}

// ── NEW: Committee (Faculty) ──────────────────────────────
function renderFacultyCommittee(){
  const committees=[
    {name:'IQAC Committee',role:'Member',meetings:3,lastMeeting:'Feb 10'},
    {name:'Grievance Cell',role:'Coordinator',meetings:5,lastMeeting:'Jan 28'},
    {name:'Anti-Ragging Committee',role:'Member',meetings:2,lastMeeting:'Feb 02'},
  ];
  return `<div class="card">
    <div class="card-header"><div class="card-title">🏛️ Committee</div></div>
    <p class="text-muted mb-md">Committees you are a member of. You can view or edit minutes.</p>
    ${committees.map(c=>`<div class="announcement info mb-sm">
      <div class="d-flex justify-between align-center">
        <div>
          <div class="ann-title">${c.name}</div>
          <div class="d-flex gap-md mt-sm">
            <span class="badge badge-blue">${c.role}</span>
            <span class="text-sm text-muted">📅 Last meeting: ${c.lastMeeting}</span>
            <span class="text-sm text-muted">📋 ${c.meetings} meetings held</span>
          </div>
        </div>
        <div class="d-flex gap-sm">
          <button class="btn btn-outline btn-sm" onclick="toast('Viewing minutes for ${c.name}…','info')">📋 View Minutes</button>
          <button class="btn btn-primary btn-sm" onclick="toast('Editing minutes for ${c.name}…','info')">✏️ Edit</button>
        </div>
      </div>
    </div>`).join('')}
  </div>`;
}

// ── NEW: Exam / Invigilation Duty (Faculty) ───────────────
function renderFacultyExamDuty(){
  const duties=[
    {date:'05-02-2024',exam:'Evaluation I',hall:'H302',start:'9:00 AM',end:'12:00 PM',session:'FN'},
    {date:'06-02-2024',exam:'Evaluation I',hall:'H304',start:'2:00 PM',end:'5:00 PM',session:'AN'},
  ];
  const allStaff=[
    {sl:1,name:'Staff Name 95',hall:'H302'},
    {sl:2,name:'Staff Name 92',hall:'H304'},
    {sl:3,name:'Staff Name 89',hall:'H305'},
  ];
  return `<div class="card">
    <div class="card-header"><div class="card-title">📋 Exam / Invigilation Duty</div></div>

    <div class="d-flex gap-md mb-md">
      <button class="btn btn-primary btn-sm" onclick="switchExamTab('duty')">Exam Duty</button>
      <button class="btn btn-outline btn-sm" onclick="switchExamTab('halls')">Staff & Allotted Halls</button>
    </div>

    <div id="examDutyTab">
      <div class="form-group" style="max-width:200px">
        <label>From Date</label>
        <input type="date" value="2024-02-05"/>
      </div>
      <div class="tbl-wrap"><table>
        <thead><tr><th>Date</th><th>Exam</th><th>Hall</th><th>Start Time</th><th>End Time</th><th>Session</th></tr></thead>
        <tbody>${duties.map(d=>`<tr>
          <td>${d.date}</td>
          <td class="fw-semibold">${d.exam}</td>
          <td><span class="badge badge-blue">${d.hall}</span></td>
          <td>${d.start}</td>
          <td>${d.end}</td>
          <td><span class="badge badge-gray">${d.session}</span></td>
        </tr>`).join('')}</tbody>
      </table></div>
    </div>

    <div id="examHallsTab" style="display:none">
      <div class="form-row" style="align-items:flex-end">
        <div class="form-group"><label>Date</label><input type="date" value="2024-02-05"/></div>
        <div class="form-group"><label>Exam Type</label>
          <select><option>Evaluation I</option><option>Evaluation II</option></select>
        </div>
        <div class="form-group"><label>Group</label>
          <select><option>05/02/2024FN</option><option>05/02/2024AN</option></select>
        </div>
        <div class="form-group" style="margin-top:auto">
          <button class="btn btn-primary" onclick="toast('Staff halls loaded','success')">Submit</button>
        </div>
      </div>
      <div class="tbl-wrap"><table>
        <thead><tr><th>Sl. No.</th><th>Staff Name</th><th>Hall Allotted</th></tr></thead>
        <tbody>${allStaff.map(s=>`<tr>
          <td>${s.sl}</td><td>${s.name}</td>
          <td><span class="badge badge-teal">${s.hall}</span></td>
        </tr>`).join('')}</tbody>
      </table></div>
    </div>
  </div>`;
}

function switchExamTab(tab){
  const duty=document.getElementById('examDutyTab');
  const halls=document.getElementById('examHallsTab');
  if(tab==='duty'){duty.style.display='block';halls.style.display='none';}
  else{duty.style.display='none';halls.style.display='block';}
}

// ── NEW: College Timetable (Faculty view any batch) ───────
function renderCollegeTimetable(){
  const days=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const batchTT={
    'AR2017':{
      'Monday':[{s:'BC 201 (25B)',r:'AR2017'},{s:'U SLOT (4GE)',r:'AR2017'}],
      'Tuesday':[{s:'AS 202 (2TM)',r:'AR2017'}],
      'Wednesday':[{s:'AS 203 (3MM)',r:'AR2017'}],
      'Thursday':[{s:'KS 200 (3MM)',r:'AR2017'}],
      'Friday':[{s:'EH 201 (2MM)',r:'AR2017'},{s:'U SLOT (4GE)',r:'AR2017'}],
      'Saturday':[{s:'ES 201 (2SK)',r:'AR2017'}],
    }
  };
  return `<div class="card">
    <div class="card-header"><div class="card-title">🗓️ College Timetable</div></div>
    <div class="form-row" style="align-items:flex-end">
      <div class="form-group"><label>Department</label>
        <select id="ctDept"><option value="AR">AR</option><option value="CS">CS</option><option value="EC">EC</option></select>
      </div>
      <div class="form-group"><label>Batch</label>
        <select id="ctBatch"><option value="AR2017">AR2017</option><option value="CS2024A">CS2024A</option></select>
      </div>
      <div class="form-group" style="margin-top:auto">
        <button class="btn btn-primary" onclick="toast('Timetable loaded','success')">Submit</button>
      </div>
    </div>
    <div class="form-group">
      <label>Select Date</label>
      <div class="d-flex gap-md align-center">
        <button class="btn btn-outline btn-sm">◀</button>
        <input type="date" value="2024-03-25" style="flex:1;max-width:180px"/>
        <span class="text-sm text-muted">Timetable from 25-03-2024 to 30-03-2024</span>
        <button class="btn btn-outline btn-sm">▶</button>
      </div>
    </div>
    <div class="tbl-wrap"><table>
      <thead><tr><th>Days / Hours</th><th>Day Order</th><th>Hour 1</th><th>Hour 2</th><th>Hour 3</th><th>Hour 4</th><th>Hour 5</th><th>Hour 6</th><th>Hour 7</th></tr></thead>
      <tbody>${days.map((day,di)=>`<tr>
        <td class="fw-semibold">${day}</td>
        <td><span class="badge badge-gray">Day ${6-di}</span></td>
        ${[1,2,3,4,5,6,7].map(h=>`<td style="min-width:90px">
          ${(batchTT['AR2017'][day]||[])[h-1]?`<div style="background:rgba(239,172,55,.15);border:1px solid rgba(239,172,55,.4);border-radius:4px;padding:.3rem .5rem;font-size:.75rem">${batchTT['AR2017'][day][h-1].s}</div>`:''}
        </td>`).join('')}
      </tr>`).join('')}</tbody>
    </table></div>
  </div>`;
}

function renderCourseDetails(){
  return `<div class="card">
    <div class="card-header"><div class="card-title">📚 Course & Batch Details</div></div>
    <p class="text-muted mb-md">Click on a batch to view student details and perform academic activities.</p>
    <div class="stats-grid" style="grid-template-columns:repeat(4,1fr)">
      ${[
        {batch:'CS2024A',sub:'Data Structures',code:'CS301',students:45},
        {batch:'CS2024B',sub:'Algorithms',code:'CS302',students:42},
        {batch:'EC2024A',sub:'Basics of EEE',code:'EE100',students:38},
      ].map(b=>`<div class="stat-card blue" style="cursor:pointer" onclick="toast('Opening batch ${b.batch}…','info')">
        <div class="s-val" style="font-size:.9rem">${b.batch}</div>
        <div class="s-lbl">${b.sub}</div>
        <div class="d-flex justify-between mt-md">
          <span class="badge badge-teal">${b.code}</span>
          <span class="text-xs text-muted">👥 ${b.students}</span>
        </div>
      </div>`).join('')}
    </div>
    <div class="card" style="margin-top:1rem">
      <div class="card-header"><div class="card-title">📋 Batch List</div></div>
      <div class="tbl-wrap"><table>
        <thead><tr><th>Code</th><th>Course</th><th>Credits</th><th>Batch</th><th>Students</th></tr></thead>
        <tbody>${[
          {code:'CS301',name:'Data Structures',cr:4,batch:'CS-A',students:45},
          {code:'CS302',name:'Algorithms',cr:3,batch:'CS-B',students:42},
        ].map(c=>`<tr><td class="fw-semibold">${c.code}</td><td>${c.name}</td><td>${c.cr}</td><td>${c.batch}</td><td>${c.students}</td></tr>`).join('')}</tbody>
      </table></div>
    </div>
  </div>`;
}

function renderOBE(){
  return `<div class="card">
    <div class="card-header"><div class="card-title">🎯 OBE Configuration</div></div>
    <div class="form-group"><label>Select Course</label><select><option>CS301 – Data Structures</option></select></div>
    ${[1,2,3,4].map(n=>`<div class="form-group"><label>CO${n}</label><input placeholder="Define Course Outcome ${n}…"/></div>`).join('')}
    <button class="btn btn-primary" onclick="toast('OBE configuration saved!','success')">Save</button>
  </div>`;
}

function renderLessonPlanner(){
  let html=`<div class="card">
    <div class="card-header"><div class="card-title">📝 Lesson Planner & Course Progress</div>
      <div class="d-flex gap-md">
        <select id="lessonCourseSelect" class="form-control" style="width:200px" onchange="loadLessonPlannerData()">
          <option value="">Select Course...</option>
        </select>
        <button class="btn btn-primary btn-sm" onclick="showLessonModal()">+ Add Lesson</button>
        <button class="btn btn-outline btn-sm" onclick="loadCourseProgress()">🔄 Refresh Progress</button>
      </div>
    </div>
    <div id="lessonProgress" style="margin-bottom:2rem">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
        <span>Course Progress</span>
        <span id="progressPercent">0%</span>
      </div>
      <div style="width:100%;height:8px;background:var(--border);border-radius:4px;overflow:hidden">
        <div id="progressBar" style="width:0%;height:100%;background:var(--green);transition:width 0.3s"></div>
      </div>
    </div>
    <div class="tbl-wrap"><table>
      <thead><tr><th>Lesson #</th><th>Topic</th><th>Learning Outcomes</th><th>Status</th><th>Completion</th><th>Actions</th></tr></thead>
      <tbody id="lessonTableBody">
        <tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text2)">Select a course to view lessons</td></tr>
      </tbody>
    </table></div>
  </div>`;
  
  // Load courses for dropdown
  setTimeout(()=>{
    loadCoursesForLessonPlanner();
  }, 100);
  
  return html;
}

async function loadCoursesForLessonPlanner(){
  try{
    if(!AMS.user.id) return;
    
    const response=await fetch(`/api/courses?faculty_id=${AMS.user.id}`);
    const data=await response.json();
    
    if(data.success && data.courses){
      const select=document.getElementById('lessonCourseSelect');
      data.courses.forEach(course=>{
        select.innerHTML+=`<option value="${course.id}">${course.code} - ${course.name}</option>`;
      });
    }
  }catch(e){console.log('[LESSON COURSES]',e);}
}

async function loadLessonPlannerData(){
  const courseId=document.getElementById('lessonCourseSelect')?.value;
  if(!courseId) return;
  
  try{
    const [lessonsRes, progressRes]=await Promise.all([
      fetch(`/api/courses/${courseId}/lessons`),
      fetch(`/api/courses/${courseId}/progress`)
    ]);
    
    const lessonsData=await lessonsRes.json();
    const progressData=await progressRes.json();
    
    if(lessonsData.success){
      const tbody=document.getElementById('lessonTableBody');
      tbody.innerHTML=lessonsData.lessons.map(l=>`<tr>
        <td class="fw-semibold">${l.lesson_number}</td>
        <td>${l.topic_name}</td>
        <td style="font-size:0.85rem;color:var(--text2)">${l.learning_outcomes || '-'}</td>
        <td><span class="badge badge-${l.status==='completed'?'green':l.status==='in-progress'?'orange':l.status==='delayed'?'red':'gray'}">${l.status}</span></td>
        <td>
          <div style="width:100px;height:6px;background:var(--border);border-radius:3px;overflow:hidden">
            <div style="width:${l.completion_percentage||0}%;height:100%;background:var(--blue);"></div>
          </div>
        </td>
        <td><button class="btn btn-outline btn-xs" onclick="editLesson('${l.id}')">✏️</button></td>
      </tr>`).join('');
    }
    
    if(progressData.success){
      document.getElementById('progressPercent').textContent=progressData.completion_percentage+'%';
      document.getElementById('progressBar').style.width=progressData.completion_percentage+'%';
    }
  }catch(e){console.log('[LOAD LESSONS]',e); toast('Error loading lessons','error');}
}

function showLessonModal(){
  const courseId=document.getElementById('lessonCourseSelect')?.value;
  if(!courseId) {toast('Please select a course first','warning');return;}
  
  const modal=document.createElement('div');
  modal.className='modal-overlay';
  modal.innerHTML=`<div class="modal-content" style="width:600px">
    <div class="modal-header">
      <h3>Add New Lesson Topic</h3>
      <button class="btn-close" onclick="this.closest('.modal-overlay').remove()">×</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label>Lesson Number</label>
        <input type="number" id="lessonNum" class="form-control" min="1">
      </div>
      <div class="form-group">
        <label>Topic Name</label>
        <input type="text" id="lessonTopic" class="form-control" placeholder="e.g., Introduction to Arrays">
      </div>
      <div class="form-group">
        <label>Learning Outcomes</label>
        <textarea id="lessonOutcomes" class="form-control" rows="3" placeholder="What students will learn..."></textarea>
      </div>
      <div class="form-group">
        <label>Planned Date</label>
        <input type="date" id="lessonDate" class="form-control">
      </div>
      <div class="form-group">
        <label>Estimated Hours</label>
        <input type="number" id="lessonHours" class="form-control" min="0.5" step="0.5" value="2">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
      <button class="btn btn-primary" onclick="createLesson('${courseId}')">Create Lesson</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
}

async function createLesson(courseId){
  const data={
    course_id: courseId,
    lesson_number: parseInt(document.getElementById('lessonNum').value),
    topic_name: document.getElementById('lessonTopic').value,
    learning_outcomes: document.getElementById('lessonOutcomes').value,
    planned_date: document.getElementById('lessonDate').value,
    estimated_hours: parseFloat(document.getElementById('lessonHours').value),
    faculty_id: AMS.user.id
  };
  
  try{
    const res=await fetch(`/api/courses/${courseId}/lessons`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data)});
    const result=await res.json();
    if(result.success){
      document.querySelector('.modal-overlay')?.remove();
      toast('Lesson created successfully','success');
      loadLessonPlannerData();
    }else{
      toast(result.error || 'Failed to create lesson','error');
    }
  }catch(e){console.log(e);toast('Error creating lesson','error');}
}

async function editLesson(lessonId){
  // Placeholder for edit functionality
  toast('Edit, mark as complete, and update progress','info');
}

async function loadCourseProgress(){
  loadLessonPlannerData();
}

function renderFacultyOnlineClass(){
  return `<div class="card">
    <div class="card-header"><div class="card-title">💻 Online Class Management</div><button class="btn btn-primary btn-sm" onclick="toast('Scheduling new class…','info')">+ Schedule</button></div>
    <p class="text-muted mb-md">Create online classes via the batch timetable video button, or schedule directly below.</p>
    <div class="tbl-wrap"><table>
      <thead><tr><th>Date</th><th>Time</th><th>Subject</th><th>Batch</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>
        <tr><td>Feb 20</td><td>10:00 AM</td><td class="fw-semibold">Data Structures</td><td>CS-A</td><td><span class="badge badge-orange">Scheduled</span></td>
          <td class="d-flex gap-sm">
            <button class="btn btn-primary btn-sm" onclick="toast('Starting class…','info')">▶ Start</button>
            <button class="btn btn-outline btn-sm" onclick="toast('Class deleted','warning')">Delete</button>
          </td>
        </tr>
        <tr><td>Feb 18</td><td>2:00 PM</td><td class="fw-semibold">Algorithms</td><td>CS-B</td><td><span class="badge badge-green">Completed</span></td>
          <td><button class="btn btn-outline btn-sm" onclick="toast('Viewing recording…','info')">🎬 Recording</button></td>
        </tr>
      </tbody>
    </table></div>
  </div>`;
}

function renderCourseMaterials(){
  return `<div class="card">
    <div class="card-header"><div class="card-title">📂 Course Materials</div><button class="btn btn-primary btn-sm" onclick="toast('Opening upload dialog…','info')">📤 Upload</button></div>
    <div class="tbl-wrap"><table>
      <thead><tr><th>Name</th><th>Topic</th><th>Uploaded On</th><th>Private</th><th>Readers</th><th>Action</th></tr></thead>
      <tbody>
        <tr>
          <td class="fw-semibold">Data Structures – Unit 1 Notes</td>
          <td>Basics of DS</td><td>Feb 10, 2024</td>
          <td><button class="btn btn-outline btn-sm" onclick="toast('Document unlocked for students','success')" title="Click to lock/unlock">🔒</button></td>
          <td>45</td>
          <td class="d-flex gap-sm">
            <button class="btn btn-outline btn-sm" onclick="toast('Editing…','info')">✏️</button>
            <button class="btn btn-danger btn-sm" onclick="toast('Deleted','warning')">🗑️</button>
          </td>
        </tr>
        <tr>
          <td class="fw-semibold">Algorithms – Lecture Slides</td>
          <td>Sorting Algorithms</td><td>Feb 08, 2024</td>
          <td><button class="btn btn-outline btn-sm" onclick="toast('Document locked','info')" title="Click to lock/unlock">🔓</button></td>
          <td>42</td>
          <td class="d-flex gap-sm">
            <button class="btn btn-outline btn-sm" onclick="toast('Editing…','info')">✏️</button>
            <button class="btn btn-danger btn-sm" onclick="toast('Deleted','warning')">🗑️</button>
          </td>
        </tr>
      </tbody>
    </table></div>
  </div>`;
}

// ── Faculty Attendance ────────────────────────────────────
function renderFacultyAttendance(){
  // Initialize empty attendance and load data
  setTimeout(() => loadTodayAttendance(), 100);
  
  return `
  <div class="card">
    <div class="card-header"><div class="card-title">✅ Attendance Control Panel</div></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1rem;margin-bottom:1.5rem">
      <div class="form-group" style="margin:0"><label>SELECT COURSE</label>
        <select id="faCourse"><option value="CS301">CS301 – Data Structures</option><option value="CS302">CS302 – Algorithms</option><option value="CS401">CS401 – Database</option></select>
      </div>
      <div class="form-group" style="margin:0"><label>SUBJECT HOUR</label>
        <select id="faHour"><option value="1">Hour 1 (9:00-10:00)</option><option value="2">Hour 2 (10:00-11:00)</option><option value="3">Hour 3 (11:00-12:00)</option><option value="4">Hour 4 (2:00-3:00)</option><option value="5">Hour 5 (3:00-4:00)</option></select>
      </div>
      <div class="form-group" style="margin:0"><label>DATE</label><input type="date" id="faDate" value="${new Date().toISOString().split('T')[0]}"/></div>
    </div>
    <div style="background:var(--ink3);border:1px solid var(--border);border-radius:var(--radius);padding:1rem;margin-bottom:1.5rem;font-size:0.9rem;color:var(--text2)">
      ℹ️ <strong>Note:</strong> Once attendance is marked via Face Recognition, faculty cannot edit those records. Only admin can modify face-marked attendance.
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem">
    <button id="btnEnableFaceRec" class="btn btn-success" onclick="openFaceRecModal()">🟢 Enable Face Recognition</button>
    <button id="btnDisableFaceRec" class="btn btn-danger" onclick="disableFaceRec()" style="display:none">🔴 Disable Face Recognition</button>
      <button class="btn btn-orange" onclick="generateQR()">📲 Generate QR Code</button>
      <button class="btn btn-primary" onclick="showManualAtt()">✍️ Manual Marking</button>
      <button class="btn btn-outline" onclick="toast('Report downloaded','success')">📥 Download Report</button>
      <button class="btn btn-teal" onclick="loadTodayAttendance()">🔄 Refresh Attendance</button>
    </div>
  </div>

  <div id="qrSection" style="display:none">
    <div id="f-qr-panel">
      <!-- QR code will be rendered here by QRModule -->
    </div>
  </div>

  <div id="manualAttSection" style="display:none">
    <div class="card">
      <div class="card-header"><div class="card-title">✍️ Manual Attendance</div><button class="btn btn-outline btn-sm" onclick="document.getElementById('manualAttSection').style.display='none'">Close</button></div>
      <div class="d-flex gap-md mb-md">
        <button class="btn btn-success btn-sm" onclick="markAllPresent()">Mark All Present</button>
        <button class="btn btn-danger btn-sm" onclick="markAllAbsent()">Mark All Absent</button>
        <button class="btn btn-outline btn-sm" onclick="loadRegisteredStudents()">🔄 Refresh Students</button>
      </div>
      <div class="tbl-wrap"><table>
        <thead><tr><th>Roll No</th><th>Name</th><th>Status</th><th>Manual Override</th><th>Notes</th></tr></thead>
        <tbody id="manualAttBody"><tr><td colspan="5" style="text-align:center;color:var(--text2)">Loading students...</td></tr></tbody>
      </table></div>
      <div style="background:var(--ink3);border:1px solid var(--border);border-radius:var(--radius);padding:0.8rem;margin-bottom:1rem;font-size:0.85rem;color:var(--text2)">
        ℹ️ <strong>Note:</strong> You cannot manually edit attendance records that were marked via Face Recognition. Only admin can modify those.
      </div>
      <button class="btn btn-primary mt-lg" onclick="saveManualAtt()">💾 Save Attendance</button>
    </div>
  </div>

  <div class="card">
    <div class="card-header"><div class="card-title">📊 Today's Summary</div></div>
    <div class="stats-grid" style="grid-template-columns:repeat(4,1fr)">
      <div class="stat-card green"><div class="s-icon">✅</div><div class="s-val" id="attPresent">0</div><div class="s-lbl">Present</div></div>
      <div class="stat-card red"><div class="s-icon">❌</div><div class="s-val" id="attAbsent">0</div><div class="s-lbl">Absent</div></div>
      <div class="stat-card blue"><div class="s-icon">📊</div><div class="s-val" id="attPercent">0%</div><div class="s-lbl">Rate</div></div>
      <div class="stat-card orange"><div class="s-icon">⚠️</div><div class="s-val" id="attBelow">0</div><div class="s-lbl">Below 75%</div></div>
    </div>
  </div>

  <div class="card">
    <div class="card-header"><div class="card-title">👥 Registered Students</div><button class="btn btn-outline btn-sm" onclick="refreshRegisteredStudentsPanel()">🔄 Refresh</button></div>
    <div id="registeredStudentsPanel" style="overflow-y:auto;max-height:400px">Loading registered students...</div>
  </div>`;
}

// Load today's attendance from backend
async function loadTodayAttendance(){
  try {
    const today = new Date().toISOString().split('T')[0];
    const res = await fetch(`http://localhost:6001/api/attendance?date=${today}`).catch(() => null);
    
    if(!res || !res.ok) {
      console.warn('Failed to load attendance');
      return;
    }
    
    const data = await res.json();
    const records = data.records || [];
    
    // Count by status
    let present = 0;
    let absent = 0;
    
    // Simple logic: if marked in attendance, present; otherwise absent
    records.forEach(r => {
      if(r.verified === true || r.verified === 'true') {
        present++;
      } else {
        absent++;
      }
    });
    
    const total = present + absent;
    const percent = total > 0 ? Math.round((present / total) * 100) : 0;
    
    // Update display
    document.getElementById('attPresent').textContent = present;
    document.getElementById('attAbsent').textContent = absent;
    document.getElementById('attPercent').textContent = percent + '%';
    document.getElementById('attBelow').textContent = Math.max(0, Math.ceil(total * 0.25)); // Students below 75%
    
    console.log(`[ATTENDANCE] Loaded: ${present} present, ${absent} absent`);
  } catch(e) {
    console.error('[ATTENDANCE] Error:', e);
  }
}

async function refreshRegisteredStudentsPanel(){
  try{
    const res=await fetch('http://localhost:6001/api/registered-students').catch(()=>null);
    if(!res||!res.ok) throw new Error(`HTTP ${res?.status||'no response'}`);
    const data=await res.json();
    const students=data.students||[];
    if(!students.length){
      document.getElementById('registeredStudentsPanel').innerHTML='<p style="text-align:center;color:var(--text2);padding:2rem">📭 No registered students yet</p>';
      return;
    }
    document.getElementById('registeredStudentsPanel').innerHTML=`<div class="tbl-wrap"><table style="width:100%">
      <thead><tr><th>Roll No</th><th>Name</th><th>Section</th><th>Registered</th></tr></thead>
      <tbody>${students.map(s=>`<tr>
        <td class="fw-semibold">${s.roll_no||'—'}</td><td>${s.name||'Unknown'}</td>
        <td>${s.section||'—'}</td>
        <td><small>${s.created_at?new Date(s.created_at).toLocaleDateString('en-IN'):'—'}</small></td>
      </tr>`).join('')}</tbody>
    </table></div>`;
  }catch(e){
    document.getElementById('registeredStudentsPanel').innerHTML=`<p style="text-align:center;color:var(--red);padding:2rem">⚠ Error: ${e.message}</p>`;
  }
}

let qrInterval=null;

// Enhanced QR Generation with Security Features
async function generateQR(){
  try {
    document.getElementById('qrSection').style.display='block';
    const course=document.getElementById('faCourse').value;
    const subject=document.getElementById('faCourse').options[document.getElementById('faCourse').selectedIndex].text || course;
    
    // Get location for GPS requirement
    const location = await QRModule.getLocation();
    
    // Generate enhanced QR with security
    const qrData = await QRModule.generateEnhancedQR({
      courseId: course,
      subject: subject,
      validityMinutes: 5,
      requireFace: true,
      requireLocation: true,
      latitude: location?.latitude,
      longitude: location?.longitude,
      gpsRadius: 100
    });
    
    if (!qrData) throw new Error('Failed to generate QR');
    
    toast('🔐 Encrypted QR code generated with security features','success');
  } catch(e){
    toast('Failed to generate QR code: '+e.message,'error');
    console.error('QR Error:',e);
    document.getElementById('qrSection').style.display='none';
  }
}

function stopQR(){
  clearInterval(qrInterval);
  document.getElementById('qrSection').style.display='none';
  QRModule.stopSession();
  toast('QR session ended','info');
}

// Enhanced Student QR Scanning (QRModule)
function stopQRScan(){
  QRModule.stopQRScan();
  document.getElementById('s-attendance-panel').style.display='none';
  resetAtt();
}

// Student: Create Personal QR Profile
async function createStudentQRProfile(){
  try {
    toast('Creating your QR profile...','info');
    await QRModule.createQRProfile();
  } catch(e){
    toast('Error creating profile: '+e.message,'error');
  }
}

// View Attendance History
async function viewAttendanceHistory(){
  try {
    const roll=AMS.user.rollNo || AMS.user.id;
    const res = await fetch(`http://localhost:6001/api/qr/attendance-history?roll_no=${roll}&limit=20`);
    const data = await res.json();
    
    if(data.success) {
      const html = `
        <div class="card card-info">
          <div class="card-header">
            <div class="card-title">📅 Your Attendance History</div>
          </div>
          <div class="card-body">
            <table class="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Course</th>
                  <th>Time</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                ${(data.attendance_records || []).map(r => `
                  <tr>
                    <td>${new Date(r.date).toLocaleDateString()}</td>
                    <td>${r.course_id}</td>
                    <td>${new Date(r.timestamp).toLocaleTimeString()}</td>
                    <td><span class="badge ${r.method === 'qr' ? 'badge-teal' : 'badge-blue'}">${r.method.toUpperCase()}</span></td>
                    <td><span class="badge ${r.verified ? 'badge-green' : 'badge-orange'}">${r.verified ? 'Verified' : 'Manual'}</span></td>
                    <td><small>${r.in_campus ? '📍 Campus' : '🏠 Remote'}</small></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
      document.getElementById('s-attendance-panel').innerHTML = html;
    }
  } catch(e){
    toast('Error loading attendance history','error');
    console.error(e);
  }
}

function toggleFaceRec(){
  AMS.faceRecEnabled = !AMS.faceRecEnabled;
  toast('Face Recognition '+(AMS.faceRecEnabled?'Enabled':'Disabled'), AMS.faceRecEnabled?'success':'info');
  updateFaceRecButtons();
}

function openFaceRecModal(){
  const course = document.getElementById('faCourse')?.value || 'CS301';
  const hour = document.getElementById('faHour')?.value || '1';
  const date = document.getElementById('faDate')?.value || new Date().toISOString().split('T')[0];
  
  const modalHTML = `
    <div id="faceRecModal" style="position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:2000;display:flex;align-items:center;justify-content:center">
      <div class="card" style="width:90%;max-width:400px">
        <div class="card-header">
          <div class="card-title">🎯 Enable Face Recognition</div>
          <button class="btn btn-outline btn-sm" onclick="document.getElementById('faceRecModal').remove()">✕</button>
        </div>
        <div style="padding:1.5rem">
          <div style="background:var(--ink3);border-left:3px solid var(--blue);padding:1rem;border-radius:4px;margin-bottom:1rem;font-size:0.9rem">
            <strong>📋 Session Details:</strong>
            <div style="margin-top:0.5rem;color:var(--text2)">
              <div>Course: <strong>${course}</strong></div>
              <div>Hour: <strong>${hour}</strong></div>
              <div>Date: <strong>${new Date(date).toLocaleDateString('en-IN')}</strong></div>
            </div>
          </div>
          <p style="font-size:0.95rem;color:var(--text2);margin-bottom:1rem">
            ✅ <strong>Face Recognition will be ENABLED for this session.</strong>
          </p>
          <p style="font-size:0.85rem;color:var(--text3);margin-bottom:1.5rem;line-height:1.6">
            All students who pass face verification will be marked <span style="color:var(--green);font-weight:bold">PRESENT</span>, and those who fail will be marked <span style="color:var(--red);font-weight:bold">ABSENT</span>. These records cannot be edited by you (faculty).
          </p>
          <div style="display:flex;gap:1rem">
            <button class="btn btn-outline" style="flex:1" onclick="document.getElementById('faceRecModal').remove()">Cancel</button>
            <button class="btn btn-success" style="flex:1" onclick="confirmEnableFaceRec('${course}','${hour}','${date}')">Enable Now</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function confirmEnableFaceRec(course, hour, date){
  document.getElementById('faceRecModal').remove();
  AMS.faceRecEnabled = true;
  AMS.faceRecSession = { course, hour, date };
  
  // Update backend to enable face recognition in system_config
  fetch('http://localhost:6001/api/config/face-recognition', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled: true })
  }).then(r => r.json())
    .then(d => console.log('[Face Rec] Backend enabled:', d))
    .catch(e => console.error('[Face Rec] Error:', e));
  
  toast('Face Recognition Enabled for this session','success');
  updateFaceRecButtons();
  // Store session info for later validation
  sessionStorage.setItem('faceRecSession', JSON.stringify(AMS.faceRecSession));
}

function disableFaceRec(){
  AMS.faceRecEnabled = false;
  AMS.faceRecSession = null;
  
  // Update backend to disable face recognition
  fetch('http://localhost:6001/api/config/face-recognition', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled: false })
  }).then(r => r.json())
    .then(d => console.log('[Face Rec] Backend disabled:', d))
    .catch(e => console.error('[Face Rec] Error:', e));
  
  toast('Face Recognition Disabled','info');
  updateFaceRecButtons();
  sessionStorage.removeItem('faceRecSession');
}

function updateFaceRecButtons(){
  try{
    const en = document.getElementById('btnEnableFaceRec');
    const dis = document.getElementById('btnDisableFaceRec');
    if(en) {
      en.disabled = !!AMS.faceRecEnabled;
      en.style.display = AMS.faceRecEnabled ? 'none' : 'inline-block';
    }
    if(dis) {
      dis.disabled = !AMS.faceRecEnabled;
      dis.style.display = AMS.faceRecEnabled ? 'inline-block' : 'none';
    }
  }catch(e){console.warn('updateFaceRecButtons:',e)}
}
function showManualAtt(){document.getElementById('manualAttSection').style.display='block';loadRegisteredStudents()}
function markAllPresent(){document.querySelectorAll('[name^="att_"]').forEach(r=>{if(r.value==='P')r.checked=true})}
function markAllAbsent(){document.querySelectorAll('[name^="att_"]').forEach(r=>{if(r.value==='A')r.checked=true})}
function saveManualAtt(){toast('Attendance saved successfully!','success');document.getElementById('manualAttSection').style.display='none'}


async function loadRegisteredStudents(){
  const bodyEl=document.getElementById('manualAttBody');
  try{
    if(!bodyEl) return;
    bodyEl.innerHTML=`<tr><td colspan="5" style="text-align:center;color:var(--text2)">⏳ Loading...</td></tr>`;
    
    // Fetch both students and today's attendance
    const studRes=await fetch('http://localhost:6001/api/registered-students').catch(()=>null);
    if(!studRes) throw new Error('Backend not responding');
    if(!studRes.ok) throw new Error(`HTTP ${studRes.status}`);
    const studData=await studRes.json();
    const students=studData.students||[];
    
    // Fetch today's attendance to check for face-marked records
    const today = new Date().toISOString().split('T')[0];
    const attRes = await fetch(`http://localhost:6001/api/attendance?date=${today}`).catch(()=>null);
    const attData = attRes?.ok ? await attRes.json() : {};
    const attendanceRecords = attData.records || [];
    
    if(!students.length){
      bodyEl.innerHTML=`<tr><td colspan="5" style="text-align:center;color:var(--text2);padding:2rem">📭 No registered students yet.</td></tr>`;
      return;
    }
    bodyEl.innerHTML=students.map(s=>{
      // Check if this student's attendance was marked via face
      const faceRecord = attendanceRecords.find(r => r.roll_no === s.roll_no && r.method === 'face');
      const isLockedByFace = !!faceRecord;
      
      return `<tr style="${isLockedByFace ? 'background:var(--ink3);opacity:0.8' : ''}">
        <td class="fw-semibold">${s.roll_no||'—'}</td>
        <td>${s.name||'Unknown'}</td>
        <td>
          ${isLockedByFace 
            ? '<span class="badge badge-blue">📷 Face Marked</span>' 
            : '<span class="badge badge-gray">Pending</span>'}
        </td>
        <td>
          ${isLockedByFace 
            ? `<span style="color:var(--text2);font-size:0.85rem">✅ ${faceRecord.verified ? 'Present' : 'Absent'}</span>`
            : `<label style="margin-right:.75rem;cursor:pointer"><input type="radio" name="att_${s.roll_no}" value="P"/> Present</label>
               <label style="cursor:pointer"><input type="radio" name="att_${s.roll_no}" value="A" checked/> Absent</label>`
          }
        </td>
        <td>
          ${isLockedByFace 
            ? '<small style="color:var(--orange)">🔒 Face-marked (read-only)</small>'
            : ''}
        </td>
      </tr>`;
    }).join('');
  }catch(e){
    if(bodyEl) bodyEl.innerHTML=`<tr><td colspan="5" style="text-align:center;color:var(--red);padding:2rem">⚠ Error loading students.</td></tr>`;
    toast('Failed to load students','error');
  }
}

function initFacultyAttendance(){
  loadRegisteredStudents();
  refreshRegisteredStudentsPanel();
  // Ensure button states reflect current faceRecEnabled value
  setTimeout(updateFaceRecButtons, 50);
}

function renderAssessments(){
  return `<div class="card">
    <div class="card-header"><div class="card-title">📋 Assessments</div><button class="btn btn-primary btn-sm">+ Create</button></div>
    <div class="tbl-wrap"><table>
      <thead><tr><th>Title</th><th>Course</th><th>Date</th><th>Submissions</th><th>Status</th></tr></thead>
      <tbody>
        <tr><td class="fw-semibold">Quiz 1 – Arrays</td><td>CS301</td><td>Feb 10</td><td><span class="badge badge-green">45/45</span></td><td><span class="badge badge-gray">closed</span></td></tr>
        <tr><td class="fw-semibold">Mid Term Exam</td><td>CS302</td><td>Feb 25</td><td><span class="badge badge-orange">12/42</span></td><td><span class="badge badge-green">active</span></td></tr>
      </tbody>
    </table></div>
  </div>`;
}

function renderAssignments(){
  if(AMS.role==='faculty'){
    return `<div class="card">
      <div class="card-header"><div class="card-title">📄 Assignment Management</div>
        <div class="d-flex gap-md">
          <select id="assignmentCourseSelect" class="form-control" style="width:200px" onchange="loadAssignmentsForCourse()">
            <option value="">All Assignments</option>
          </select>
          <button class="btn btn-primary btn-sm" onclick="showCreateAssignmentModal()">+ Create Assignment</button>
        </div>
      </div>
      <div class="tbl-wrap"><table>
        <thead><tr><th>Assignment</th><th>Course</th><th>Due Date</th><th>Submitted</th><th>Graded</th><th>Pending</th><th>Actions</th></tr></thead>
        <tbody id="assignmentTableBody">
          <tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text2)">Loading assignments...</td></tr>
        </tbody>
      </table></div>
    </div>`;
  }else{
    // Student view
    return `<div class="card">
      <div class="card-header"><div class="card-title">📋 My Assignments</div>
        <button class="btn btn-outline btn-sm" onclick="loadStudentAssignments()">🔄 Refresh</button>
      </div>
      <div class="tbl-wrap"><table>
        <thead><tr><th>Assignment</th><th>Course</th><th>Due Date</th><th>Status</th><th>Marks</th><th>Feedback</th></tr></thead>
        <tbody id="studentAssignmentBody">
          <tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text2)">Loading...</td></tr>
        </tbody>
      </table></div>
    </div>`;
  }
}

async function loadAssignmentsForCourse(){
  const courseId=document.getElementById('assignmentCourseSelect')?.value;
  try{
    let url='/api/assignments';
    if(courseId) url+=`?course_id=${courseId}`;
    
    const res=await fetch(url);
    const data=await res.json();
    
    if(data.success && data.assignments){
      const tbody=document.getElementById('assignmentTableBody');
      tbody.innerHTML=data.assignments.map(a=>`<tr>
        <td class="fw-semibold">${a.title}</td>
        <td>${a.course_id}</td>
        <td>${new Date(a.due_date).toLocaleDateString()}</td>
        <td id="submitted_${a.id}">-</td>
        <td id="graded_${a.id}">-</td>
        <td id="pending_${a.id}">-</td>
        <td><button class="btn btn-outline btn-xs" onclick="showSubmissions('${a.id}')">📊 View</button></td>
      </tr>`).join('');
      
      // Load submission counts
      data.assignments.forEach(a=>{
        loadSubmissionStats(a.id);
      });
    }
  }catch(e){console.log(e);toast('Error loading assignments','error');}
}

async function loadSubmissionStats(assignmentId){
  try{
    const res=await fetch(`/api/assignments/${assignmentId}/submissions`);
    const data=await res.json();
    
    if(data.success && data.submissions){
      const submitted=data.submissions.filter(s=>s.submission_status==='submitted').length;
      const graded=data.submissions.filter(s=>s.submission_status==='graded').length;
      const pending=data.submissions.filter(s=>!s.marks_obtained).length;
      
      document.getElementById(`submitted_${assignmentId}`).textContent=submitted;
      document.getElementById(`graded_${assignmentId}`).textContent=graded;
      document.getElementById(`pending_${assignmentId}`).textContent=pending;
    }
  }catch(e){console.log(e);}
}

function showCreateAssignmentModal(){
  const courseId=document.getElementById('assignmentCourseSelect')?.value;
  if(!courseId){toast('Please select a course','warning');return;}
  
  const modal=document.createElement('div');
  modal.className='modal-overlay';
  modal.innerHTML=`<div class="modal-content" style="width:600px">
    <div class="modal-header">
      <h3>Create New Assignment</h3>
      <button class="btn-close" onclick="this.closest('.modal-overlay').remove()">×</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label>Title</label>
        <input type="text" id="assignTitle" class="form-control" placeholder="Assignment title">
      </div>
      <div class="form-group">
        <label>Description</label>
        <textarea id="assignDesc" class="form-control" rows="3" placeholder="Detailed instructions"></textarea>
      </div>
      <div class="d-flex gap-md">
        <div class="form-group" style="flex:1">
          <label>Type</label>
          <select id="assignType" class="form-control">
            <option value="homework">Homework</option>
            <option value="project">Project</option>
            <option value="quiz">Quiz</option>
            <option value="practical">Practical</option>
          </select>
        </div>
        <div class="form-group" style="flex:1">
          <label>Total Marks</label>
          <input type="number" id="assignMarks" class="form-control" value="100" min="1">
        </div>
      </div>
      <div class="form-group">
        <label>Due Date</label>
        <input type="datetime-local" id="assignDue" class="form-control">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
      <button class="btn btn-primary" onclick="createNewAssignment()">Create</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
}

async function createNewAssignment(){
  const courseId=document.getElementById('assignmentCourseSelect').value;
  const data={
    course_id: courseId,
    faculty_id: AMS.user.id,
    title: document.getElementById('assignTitle').value,
    description: document.getElementById('assignDesc').value,
    assignment_type: document.getElementById('assignType').value,
    total_marks: parseInt(document.getElementById('assignMarks').value),
    due_date: new Date(document.getElementById('assignDue').value).toISOString(),
    status: 'published'
  };
  
  try{
    const res=await fetch('/api/assignments', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data)});
    const result=await res.json();
    if(result.success){
      document.querySelector('.modal-overlay')?.remove();
      toast('Assignment created','success');
      loadAssignmentsForCourse();
    }else{
      toast(result.error,'error');
    }
  }catch(e){console.log(e);toast('Error creating assignment','error');}
}

function showSubmissions(assignmentId){
  toast('Viewing submissions for assignment','info');
  // Show modal with submissions and grading interface
}

async function loadStudentAssignments(){
  try{
    const res=await fetch(`/api/assignments?student_id=${AMS.user.id}`);
    const data=await res.json();
    
    if(data.success && data.assignments){
      const tbody=document.getElementById('studentAssignmentBody');
      tbody.innerHTML=data.assignments.map(a=>`<tr>
        <td class="fw-semibold">${a.title}</td>
        <td>${a.course_id}</td>
        <td>${new Date(a.due_date).toLocaleDateString()}</td>
        <td><span class="badge badge-orange">pending</span></td>
        <td>-</td>
        <td><button class="btn btn-outline btn-xs" onclick="submitAssignment('${a.id}')">📤 Submit</button></td>
      </tr>`).join('');
    }
  }catch(e){console.log(e);}
}

function submitAssignment(assignmentId){
  toast('Submit assignment interface (file upload)','info');
}

function renderInternalExam(){
  return `<div class="card">
    <div class="card-header"><div class="card-title">🏫 Internal Examination</div><button class="btn btn-primary btn-sm">+ Schedule</button></div>
    <div class="tbl-wrap"><table>
      <thead><tr><th>Exam</th><th>Course</th><th>Date</th><th>Status</th></tr></thead>
      <tbody>
        <tr><td class="fw-semibold">Internal 1</td><td>CS301</td><td>Feb 20</td><td><span class="badge badge-orange">upcoming</span></td></tr>
      </tbody>
    </table></div>
  </div>`;
}

function renderQuestionPaper(){
  return `<div class="card">
    <div class="card-header"><div class="card-title">📃 Question Paper Generation</div></div>
    <div class="form-row">
      <div class="form-group"><label>Course</label><select><option>CS301 – Data Structures</option></select></div>
      <div class="form-group"><label>Total Marks</label><input type="number" value="50"/></div>
    </div>
    <button class="btn btn-primary" onclick="toast('Question paper generated!','success')">⚡ Generate Paper</button>
  </div>`;
}

function renderCourseFile(){
  return `<div class="card">
    <div class="card-header"><div class="card-title">🗂️ Course File</div></div>
    <div class="form-group"><label>Select Course</label><select><option>CS301 – Data Structures</option></select></div>
    <button class="btn btn-primary mt-md" onclick="toast('Course file generated!','success')">📥 Generate Course File</button>
  </div>`;
}

function renderMarkComputation(){
  return `<div class="card">
    <div class="card-header"><div class="card-title">🔢 Mark Computation</div></div>
    <div class="tbl-wrap"><table>
      <thead><tr><th>Roll No</th><th>Name</th><th>Internal 1</th><th>Internal 2</th><th>Computed</th><th>Grade</th></tr></thead>
      <tbody>${[
        {r:'CS001',n:'Alice J.',i1:44,i2:46},{r:'CS002',n:'Bob S.',i1:38,i2:42},
      ].map(s=>{
        const comp=Math.round((Math.max(s.i1,s.i2)/50)*50);
        const grade=comp>=45?'O':comp>=40?'A+':comp>=35?'A':'B+';
        return `<tr><td>${s.r}</td><td>${s.n}</td><td>${s.i1}</td><td>${s.i2}</td><td class="fw-bold">${comp}</td><td><span class="badge badge-green">${grade}</span></td></tr>`;
      }).join('')}</tbody>
    </table></div>
    <button class="btn btn-primary mt-lg" onclick="toast('Marks finalised!','success')">Finalise Marks</button>
  </div>`;
}

function renderCustomReports(){
  return `<div class="card">
    <div class="card-header"><div class="card-title">📊 Custom Reports</div></div>
    <div class="form-row">
      <div class="form-group"><label>Report Type</label><select><option>Attendance Report</option><option>Mark Sheet</option><option>Defaulters List</option></select></div>
      <div class="form-group"><label>Course</label><select><option>All Courses</option><option>CS301</option></select></div>
    </div>
    <div class="d-flex gap-md">
      <button class="btn btn-primary" onclick="toast('Report generated!','success')">Generate</button>
      <button class="btn btn-outline">📥 Excel</button>
      <button class="btn btn-outline">📥 PDF</button>
    </div>
  </div>`;
}

function renderOnlineExam(){
  return `<div class="card">
    <div class="card-header"><div class="card-title">🖥️ Online Examination</div><button class="btn btn-primary btn-sm">+ Create</button></div>
    <div class="tbl-wrap"><table>
      <thead><tr><th>Exam</th><th>Course</th><th>Date</th><th>Status</th></tr></thead>
      <tbody><tr><td>Online Quiz 3</td><td>CS301</td><td>Feb 28</td><td><span class="badge badge-orange">Draft</span></td></tr></tbody>
    </table></div>
  </div>`;
}

function renderStaffReport(){
  return `<div class="card">
    <div class="card-header"><div class="card-title">👤 Staff Active Report</div>
      <div class="form-row" style="margin:0;align-items:flex-end;gap:.5rem">
        <input type="date" style="padding:.35rem .6rem;border-radius:6px;border:1px solid var(--border);background:var(--ink3);color:var(--text);font-size:.82rem"/>
        <span class="text-sm text-muted">to</span>
        <input type="date" style="padding:.35rem .6rem;border-radius:6px;border:1px solid var(--border);background:var(--ink3);color:var(--text);font-size:.82rem"/>
        <button class="btn btn-primary btn-sm" onclick="toast('Report generated','success')">Generate</button>
      </div>
    </div>
    <div class="stats-grid" style="grid-template-columns:repeat(4,1fr)">
      <div class="stat-card blue"><div class="s-icon">📅</div><div class="s-val">18</div><div class="s-lbl">Classes Taken</div></div>
      <div class="stat-card green"><div class="s-icon">📚</div><div class="s-val">5</div><div class="s-lbl">Active Courses</div></div>
      <div class="stat-card teal"><div class="s-icon">📝</div><div class="s-val">12</div><div class="s-lbl">Assessments</div></div>
      <div class="stat-card orange"><div class="s-icon">⏱️</div><div class="s-val">96h</div><div class="s-lbl">Total Hours</div></div>
    </div>
  </div>`;
}

function renderWorkLog(){
  return `<div class="card">
    <div class="card-header"><div class="card-title">📋 Daily Work Log</div></div>
    <div class="form-row">
      <div class="form-group"><label>Date</label><input type="date" value="${new Date().toISOString().split('T')[0]}"/></div>
      <div class="form-group"><label>Hours Worked</label><input type="number" value="7"/></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem">
      ${[1,2,3,4,5,6].map(h=>`<div class="form-group" style="background:var(--ink3);border:1px solid var(--border);border-radius:var(--radius);padding:1rem">
        <label>Hour ${h}</label>
        <input placeholder="Activity for hour ${h} (e.g. Batch: CS2024A, Subject: CS301, Topics: Linked Lists)" style="width:100%;margin-top:.3rem"/>
      </div>`).join('')}
    </div>
    <div class="form-group"><label>Work Description (Summary)</label><textarea placeholder="Summarise your work…" style="min-height:100px"></textarea></div>
    <div class="announcement info mb-md">
      <div class="d-flex justify-between align-center">
        <div>
          <div class="ann-title">Previous Work Log Status</div>
          <div class="text-sm text-muted">Feb 14, 2024 — <span class="badge badge-green">Verified by HOD</span> <span class="badge badge-blue">Approved by Principal</span></div>
          <div class="text-sm text-muted">Feb 13, 2024 — <span class="badge badge-orange">Pending HOD Verification</span></div>
        </div>
      </div>
    </div>
    <button class="btn btn-primary" onclick="toast('Work log submitted! Awaiting HOD verification.','success')">Submit Work Log</button>
  </div>`;
}

function renderAppraisal(){
  const achievements=[
    {date:'05-05-2024',category:'International Fellowships',notes:'IEEE Fellowship Award',status:'approved'},
    {date:'01-01-2024',category:'International Fellowships',notes:'Research Grant – AI Lab',status:'approved'},
    {date:'15-03-2024',category:'Publications',notes:'Paper in IEEE Transactions',status:'pending'},
  ];
  return `<div class="card">
    <div class="card-header">
      <div class="card-title">🌟 Staff Appraisal — Manage Achievements</div>
      <button class="btn btn-primary btn-sm" onclick="document.getElementById('achievementModal').style.display='flex'">+ Add New Achievement</button>
    </div>
    <p class="text-muted mb-md">Achievements are visible to IQAC Coordinator and Head of Department.</p>
    <div class="tbl-wrap"><table>
      <thead><tr><th>Sl. No.</th><th>Achievement Date</th><th>Category</th><th>Notes</th><th>Status</th></tr></thead>
      <tbody>${achievements.map((a,i)=>`<tr>
        <td>${i+1}</td>
        <td>${a.date}</td>
        <td>${a.category}</td>
        <td class="text-muted">${a.notes}</td>
        <td><span class="badge badge-${a.status==='approved'?'green':'orange'}">${a.status}</span></td>
      </tr>`).join('')}</tbody>
    </table></div>
  </div>

  <div id="achievementModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:1000;align-items:center;justify-content:center">
    <div class="card" style="width:90%;max-width:480px">
      <div class="card-header">
        <div class="card-title">➕ Add New Achievement</div>
        <button class="btn btn-outline btn-sm" onclick="document.getElementById('achievementModal').style.display='none'">✕</button>
      </div>
      <div style="padding:1.5rem">
        <div class="form-group"><label>Achievement Date *</label><input type="date"/></div>
        <div class="form-group"><label>Category *</label>
          <select>
            <option>International Fellowships</option>
            <option>Publications</option>
            <option>Awards & Honours</option>
            <option>Research Projects</option>
            <option>Industrial Collaboration</option>
            <option>Community Service</option>
          </select>
        </div>
        <div class="form-group"><label>Notes / Description</label><textarea placeholder="Describe your achievement…"></textarea></div>
        <div class="d-flex gap-md mt-md">
          <button class="btn btn-outline" style="flex:1" onclick="document.getElementById('achievementModal').style.display='none'">Cancel</button>
          <button class="btn btn-primary" style="flex:1" onclick="saveAchievement()">Save</button>
        </div>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="card-header"><div class="card-title">📊 Appraisal Score Overview</div><span class="badge badge-green">Overall: A Grade</span></div>
    ${[
      {label:'Teaching Quality',score:88},{label:'Research & Publications',score:72},
      {label:'Student Feedback Score',score:91},{label:'Overall',score:85},
    ].map(it=>`<div class="mb-md">
      <div class="d-flex justify-between mb-sm"><span class="text-sm fw-semibold">${it.label}</span><span class="text-sm text-muted">${it.score}/100</span></div>
      <div class="progress-wrap progress-blue"><div class="progress-bar" style="width:${it.score}%"></div></div>
    </div>`).join('')}
  </div>`;
}

function saveAchievement(){
  document.getElementById('achievementModal').style.display='none';
  toast('Achievement added! Pending IQAC approval.','success');
}

// ==========================================================
//  ADMIN MODULES
// ==========================================================
function renderAdminDashboard(){
  // Load attendance data in background
  setTimeout(() => loadAdminAttendanceStats(), 100);
  
  return `
  <div class="stats-grid">
    <div class="stat-card blue"><div class="s-icon">👨‍🎓</div><div class="s-val" id="adminTotalStudents">1,234</div><div class="s-lbl">Total Students</div><div class="s-badge up">▲ 12 new this week</div></div>
    <div class="stat-card green"><div class="s-icon">👩‍🏫</div><div class="s-val" id="adminTotalFaculty">89</div><div class="s-lbl">Faculty Members</div></div>
    <div class="stat-card teal"><div class="s-icon">📊</div><div class="s-val" id="adminAvgAtt">91.2%</div><div class="s-lbl">Avg Attendance</div></div>
    <div class="stat-card orange"><div class="s-icon">🎓</div><div class="s-val" id="adminActiveCourses">48</div><div class="s-lbl">Active Courses</div></div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.25rem">
    <div class="card">
      <div class="card-header"><div class="card-title">📊 Department Attendance</div></div>
      <div class="bar-chart mt-md" id="deptAttendanceChart">${[
        {lbl:'Computer Sci.',pct:91},{lbl:'Electronics',pct:88},{lbl:'Mechanical',pct:85},{lbl:'Civil',pct:87},
      ].map(d=>`<div class="bar-row"><div class="bar-label text-xs">${d.lbl}</div>
        <div class="bar-fill"><div class="bar-inner" style="width:${d.pct}%"></div></div>
        <div class="bar-val text-xs">${d.pct}%</div></div>`).join('')}
      </div>
    </div>
    <div class="card">
      <div class="card-header"><div class="card-title">⚡ Admin Actions</div></div>
      <div style="display:flex;flex-direction:column;gap:.5rem">
        <button class="btn btn-primary w-full" onclick="loadModule('a-users','User Management')">👥 Add New User</button>
        <button class="btn btn-teal w-full" onclick="loadModule('a-register','Face Registration')">👤 Register Student Face</button>
        <button class="btn btn-outline w-full" onclick="loadModule('a-logs','Audit Logs')">📋 View Audit Logs</button>
        <button class="btn btn-orange w-full" onclick="loadModule('a-config','System Config')">⚙️ System Config</button>
        <button class="btn btn-outline w-full" onclick="loadModule('a-isorules','ISO Rules / Faculty Rules')">📜 Manage Rules</button>
        <button class="btn btn-outline w-full" onclick="loadModule('a-exam','Exam Module')">📝 Exam Module</button>
        <button class="btn btn-teal" style="width:100%" onclick="loadAdminAttendanceStats()">🔄 Refresh Attendance</button>
      </div>
    </div>
  </div>`;
}

// Load attendance stats for admin dashboard
async function loadAdminAttendanceStats() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const res = await fetch(`http://localhost:6001/api/attendance?date=${today}`).catch(() => null);
    
    if(!res || !res.ok) {
      console.warn('Failed to load admin attendance stats');
    } else {
      const data = await res.json();
      const records = data.records || [];
      if(records.length > 0) {
        let verifiedCount = records.filter(r => r.verified === true || r.verified === 'true').length;
        const total = records.length;
        const avgAttendance = Math.round((verifiedCount / total) * 100);
        document.getElementById('adminAvgAtt').textContent = avgAttendance + '%';
        console.log(`[ADMIN] Attendance: ${avgAttendance}%`);
      }
    }
    // additional counts
    const stuResp = await fetch('/api/users/list?role=student');
    const stuJson = await stuResp.json();
    const stuCount = stuJson.success && stuJson.users ? stuJson.users.length : 0;
    document.getElementById('adminTotalStudents').textContent = stuCount;

    const facResp = await fetch('/api/users/list?role=faculty');
    const facJson = await facResp.json();
    const facCount = facJson.success && facJson.users ? facJson.users.length : 0;
    document.getElementById('adminTotalFaculty').textContent = facCount;

    const courseResp = await fetch('/api/courses');
    const courseJson = await courseResp.json();
    const courseCount = courseJson.success && courseJson.courses ? courseJson.courses.length : 0;
    document.getElementById('adminActiveCourses').textContent = courseCount;

  } catch(e) {
    console.error('[ADMIN ATTENDANCE]', e);
  }
}

// ── NEW: ISO Rules / Faculty Rules (Admin) ────────────────
function renderAdminISORules(){
  const facultyRules=[
    {id:1,rule:'All faculty must submit attendance within 30 minutes of class end.',active:true},
    {id:2,rule:'Daily Work Log must be submitted by 6:00 PM each working day.',active:true},
    {id:3,rule:'Course materials must be uploaded at least one week before class.',active:true},
    {id:4,rule:'Internal marks must be submitted within 48 hours of exam completion.',active:false},
    {id:5,rule:'Faculty must be present in campus during working hours (9 AM – 5 PM).',active:true},
  ];
  return `<div class="card">
    <div class="card-header">
      <div class="card-title">📜 ISO Rules — Faculty Rules</div>
      <button class="btn btn-primary btn-sm" onclick="document.getElementById('addRuleModal').style.display='flex'">+ Add Rule</button>
    </div>
    <p class="text-muted mb-md">Rules set here will be reflected in the faculty's Rules and Regulations page.</p>
    <div class="tbl-wrap"><table>
      <thead><tr><th>Sl. No.</th><th>Rule</th><th>Active</th><th>Actions</th></tr></thead>
      <tbody>${facultyRules.map(r=>`<tr>
        <td>${r.id}</td>
        <td>${r.rule}</td>
        <td>
          <input type="checkbox" ${r.active?'checked':''} style="width:18px;height:18px;cursor:pointer" onchange="toast('Rule ${r.active?'deactivated':'activated'}','info')"/>
        </td>
        <td class="d-flex gap-sm">
          <button class="btn btn-outline btn-sm" onclick="toast('Editing rule ${r.id}…','info')">✏️ Edit</button>
          <button class="btn btn-danger btn-sm" onclick="toast('Rule ${r.id} deleted','warning')">🗑️ Delete</button>
        </td>
      </tr>`).join('')}</tbody>
    </table></div>
  </div>

  <div id="addRuleModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:1000;align-items:center;justify-content:center">
    <div class="card" style="width:90%;max-width:480px">
      <div class="card-header">
        <div class="card-title">➕ Add New Rule</div>
        <button class="btn btn-outline btn-sm" onclick="document.getElementById('addRuleModal').style.display='none'">✕</button>
      </div>
      <div style="padding:1.5rem">
        <div class="form-group"><label>Rule Type</label>
          <select><option>Faculty Rules</option><option>Student Rules</option><option>ISO Rules</option></select>
        </div>
        <div class="form-group"><label>Rule Description *</label>
          <textarea placeholder="Enter the rule description…" style="min-height:100px"></textarea>
        </div>
        <div class="form-group d-flex align-center gap-md">
          <input type="checkbox" id="ruleActive" checked style="width:18px;height:18px"/>
          <label for="ruleActive">Active immediately</label>
        </div>
        <div class="d-flex gap-md mt-md">
          <button class="btn btn-outline" style="flex:1" onclick="document.getElementById('addRuleModal').style.display='none'">Cancel</button>
          <button class="btn btn-primary" style="flex:1" onclick="document.getElementById('addRuleModal').style.display='none';toast('Rule saved and reflected for faculty','success')">Save Rule</button>
        </div>
      </div>
    </div>
  </div>`;
}

// ── NEW: College Timetable Management (Admin) ─────────────
function renderAdminTimetableMgmt(){
  return `<div class="card">
    <div class="card-header">
      <div class="card-title">🗓️ College Timetable Management</div>
      <button class="btn btn-primary btn-sm" onclick="toast('Creating new timetable…','info')">+ Create Timetable</button>
    </div>
    <div class="form-row" style="align-items:flex-end">
      <div class="form-group"><label>Academic Year</label>
        <select><option>2024-25</option><option>2023-24</option></select>
      </div>
      <div class="form-group"><label>Department</label>
        <select><option>All</option><option>Computer Science</option><option>Electronics</option><option>Mechanical</option></select>
      </div>
      <div class="form-group"><label>Batch</label>
        <select><option>All</option><option>CS2024A</option><option>CS2024B</option></select>
      </div>
      <div class="form-group" style="margin-top:auto">
        <button class="btn btn-primary" onclick="toast('Timetables loaded','success')">Search</button>
      </div>
    </div>
    <div class="tbl-wrap"><table>
      <thead><tr><th>Batch</th><th>Department</th><th>Semester</th><th>Faculty Assigned</th><th>Subjects</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>${[
        {batch:'CS2024A',dept:'Computer Science',sem:'S5',faculty:'Dr. Smith, Dr. Johnson',subjects:6,status:'active'},
        {batch:'CS2024B',dept:'Computer Science',sem:'S5',faculty:'Dr. Brown, Prof. Williams',subjects:5,status:'active'},
        {batch:'EC2024A',dept:'Electronics',sem:'S3',faculty:'Dr. Patel',subjects:4,status:'draft'},
      ].map(t=>`<tr>
        <td class="fw-semibold">${t.batch}</td>
        <td>${t.dept}</td>
        <td><span class="badge badge-blue">${t.sem}</span></td>
        <td class="text-muted">${t.faculty}</td>
        <td>${t.subjects}</td>
        <td><span class="badge badge-${t.status==='active'?'green':'orange'}">${t.status}</span></td>
        <td class="d-flex gap-sm">
          <button class="btn btn-outline btn-sm" onclick="toast('Editing timetable for ${t.batch}…','info')">✏️ Edit</button>
          <button class="btn btn-outline btn-sm" onclick="toast('Viewing ${t.batch} timetable…','info')">👁 View</button>
        </td>
      </tr>`).join('')}</tbody>
    </table></div>
  </div>`;
}

// ── NEW: Committee Management (Admin) ─────────────────────
function renderAdminCommittee(){
  const committees=[
    {name:'IQAC Committee',coordinator:'Dr. Smith',members:8,meetings:12,lastMeeting:'Feb 10'},
    {name:'Grievance Cell',coordinator:'Prof. Williams',members:5,meetings:20,lastMeeting:'Jan 28'},
    {name:'Anti-Ragging Committee',coordinator:'Dr. Johnson',members:10,meetings:6,lastMeeting:'Feb 02'},
    {name:'Cultural Committee',coordinator:'Dr. Brown',members:15,meetings:8,lastMeeting:'Jan 15'},
    {name:'Sports Committee',coordinator:'Dr. Patel',members:12,meetings:5,lastMeeting:'Dec 10'},
  ];
  return `<div class="card">
    <div class="card-header">
      <div class="card-title">🏛️ Committee Management</div>
      <button class="btn btn-primary btn-sm" onclick="toast('Creating new committee…','info')">+ Create Committee</button>
    </div>
    <div class="tbl-wrap"><table>
      <thead><tr><th>Committee Name</th><th>Coordinator</th><th>Members</th><th>Meetings Held</th><th>Last Meeting</th><th>Actions</th></tr></thead>
      <tbody>${committees.map(c=>`<tr>
        <td class="fw-semibold">${c.name}</td>
        <td>${c.coordinator}</td>
        <td>${c.members}</td>
        <td>${c.meetings}</td>
        <td>${c.lastMeeting}</td>
        <td class="d-flex gap-sm">
          <button class="btn btn-outline btn-sm" onclick="toast('Managing members of ${c.name}…','info')">👥 Members</button>
          <button class="btn btn-outline btn-sm" onclick="toast('Viewing minutes for ${c.name}…','info')">📋 Minutes</button>
          <button class="btn btn-danger btn-sm" onclick="toast('${c.name} deleted','warning')">🗑️</button>
        </td>
      </tr>`).join('')}</tbody>
    </table></div>
  </div>`;
}

// ── NEW: Exam Module (Admin) ──────────────────────────────
function renderAdminExamModule(){
  const exams=[
    {name:'Internal Exam 1',batch:'CS2024A',date:'Feb 20, 2024',halls:['H301','H302'],status:'upcoming',invigilators:4},
    {name:'Internal Exam 1',batch:'CS2024B',date:'Feb 20, 2024',halls:['H303','H304'],status:'upcoming',invigilators:4},
    {name:'Evaluation I',batch:'ECE2024',date:'Feb 05, 2024',halls:['H302','H304','H305'],status:'completed',invigilators:6},
  ];
  return `<div class="card">
    <div class="card-header">
      <div class="card-title">📝 Exam Module</div>
      <button class="btn btn-primary btn-sm" onclick="toast('Creating new exam…','info')">+ Create Exam</button>
    </div>
    <div class="d-flex gap-md mb-md">
      <button class="btn btn-primary btn-sm">All Exams</button>
      <button class="btn btn-outline btn-sm" onclick="toast('Showing upcoming exams','info')">Upcoming</button>
      <button class="btn btn-outline btn-sm" onclick="toast('Showing completed exams','info')">Completed</button>
    </div>
    <div class="tbl-wrap"><table>
      <thead><tr><th>Exam Name</th><th>Batch</th><th>Date</th><th>Halls</th><th>Invigilators</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>${exams.map(e=>`<tr>
        <td class="fw-semibold">${e.name}</td>
        <td><span class="badge badge-blue">${e.batch}</span></td>
        <td>${e.date}</td>
        <td>${e.halls.map(h=>`<span class="badge badge-teal" style="margin-right:.2rem">${h}</span>`).join('')}</td>
        <td>${e.invigilators}</td>
        <td><span class="badge badge-${e.status==='upcoming'?'orange':'green'}">${e.status}</span></td>
        <td class="d-flex gap-sm">
          <button class="btn btn-outline btn-sm" onclick="toast('Assigning halls for ${e.name}…','info')">🏛️ Halls</button>
          <button class="btn btn-outline btn-sm" onclick="toast('Assigning staff for ${e.name}…','info')">👤 Staff</button>
          <button class="btn btn-outline btn-sm" onclick="toast('Viewing duty for ${e.name}…','info')">📋 Duty</button>
        </td>
      </tr>`).join('')}</tbody>
    </table></div>
  </div>

  <div class="card">
    <div class="card-header"><div class="card-title">📊 Invigilation Assignment</div></div>
    <div class="form-row" style="align-items:flex-end">
      <div class="form-group"><label>Exam</label><select><option>Internal Exam 1 – CS2024A</option></select></div>
      <div class="form-group"><label>Date</label><input type="date" value="2024-02-20"/></div>
      <div class="form-group"><label>Session</label>
        <select><option>Forenoon (FN) – 9:00 AM–12:00 PM</option><option>Afternoon (AN) – 2:00 PM–5:00 PM</option></select>
      </div>
      <div class="form-group" style="margin-top:auto">
        <button class="btn btn-primary" onclick="toast('Invigilation schedule loaded','success')">Load</button>
      </div>
    </div>
    <div class="tbl-wrap"><table>
      <thead><tr><th>Sl. No.</th><th>Staff Name</th><th>Department</th><th>Hall Allotted</th><th>Action</th></tr></thead>
      <tbody>${[
        {sl:1,name:'Dr. Smith',dept:'CS',hall:'H301'},
        {sl:2,name:'Prof. Williams',dept:'CS',hall:'H302'},
        {sl:3,name:'Dr. Brown',dept:'EC',hall:'H303'},
      ].map(s=>`<tr>
        <td>${s.sl}</td><td class="fw-semibold">${s.name}</td><td>${s.dept}</td>
        <td><span class="badge badge-teal">${s.hall}</span></td>
        <td><button class="btn btn-danger btn-sm" onclick="toast('Removed ${s.name} from duty','warning')">Remove</button></td>
      </tr>`).join('')}</tbody>
    </table></div>
    <button class="btn btn-primary mt-md" onclick="toast('Invigilation duty saved and faculty notified!','success')">💾 Save & Notify Faculty</button>
  </div>`;
}

// ── USER MANAGEMENT (with combined face+user flow) ────────
function renderUserManagement(){
  return `<div class="card">
    <div class="card-header">
      <div class="card-title">👥 User Management</div>
      <div class="d-flex gap-md">
        <div class="search-wrap"><span class="search-icon">🔍</span><input placeholder="Search users…" id="userSearch" oninput="filterUsers(this.value)"/></div>
        <button class="btn btn-primary btn-sm" onclick="openAddUserModal()">+ Add User</button>
      </div>
    </div>
    <div class="tbl-wrap"><table>
      <thead><tr><th>ID</th><th>Name</th><th>Role</th><th>Dept</th><th>Email</th><th>Face</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody id="userTableBody"><tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--text3)">Loading users…</td></tr></tbody>
    </table></div>
  </div>

  <div id="addUserModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:1000;align-items:center;justify-content:center;overflow-y:auto">
    <div class="card" style="width:90%;max-width:550px;margin:2rem auto">
      <div class="card-header">
        <div class="card-title">➕ Add New User</div>
        <button class="btn btn-outline btn-sm" onclick="closeAddUserModal()">✕</button>
      </div>
      <div style="padding:1.5rem">

        <!-- Step 1: User Form (No Face) -->
        <div id="addUserFormSection">
          <div class="form-group"><label>Role</label>
            <select id="newUserRole" onchange="updateRoleFields()">
              <option value="student">Student</option>
              <option value="faculty">Faculty</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div class="form-group"><label>Full Name *</label><input id="newUserName" placeholder="Enter full name"/></div>
          <div class="form-group"><label>Username *</label><input id="newUserUsername" placeholder="Enter username"/></div>
          <div class="form-group"><label>Email *</label><input id="newUserEmail" type="email" placeholder="Enter email"/></div>
          <div class="form-group"><label>Password *</label><input id="newUserPass" type="password" placeholder="Enter password"/></div>
          <div class="form-group"><label>Department *</label><input id="newUserDept" placeholder="e.g. Computer Science"/></div>
          <div class="form-group" id="studentFieldsGroup" style="display:none">
            <div class="form-row">
              <div class="form-group"><label>Year</label><input id="newUserYear" placeholder="e.g. 2024"/></div>
              <div class="form-group"><label>Sem</label><input id="newUserSemester" placeholder="e.g. 1"/></div>
            </div>
            <div class="form-row">
              <div class="form-group"><label>Roll Number</label><input id="newUserRoll" placeholder="e.g. 20241cse0001"/></div>
              <div class="form-group"><label>Section</label><input id="newUserSection" placeholder="e.g. A"/></div>
            </div>
          </div>
          <div class="form-group" style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--border);width:100%">
            <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;width:100%">
              <input type="checkbox" id="newUserCaptureFace" onchange="updateFaceCaptureUI()" style="flex-shrink:0"/> 
              <span>📷 Capture face immediately (optional)</span>
            </label>
            <p style="font-size:0.8rem;color:var(--text2);margin-top:0.5rem;margin-left:0">Note: You can always add face later in Student Settings</p>
          </div>
          <button class="btn btn-primary" style="width:100%;margin-top:1rem" onclick="submitAddUserForm()" id="addUserFormSubmitBtn">✅ Add User</button>
        </div>

        <!-- Step 2: Optional Face Capture -->
        <div id="addUserFaceCaptureSection" style="display:none">
          <p class="text-muted text-sm mb-md">Position the face in the circle below</p>
          <div class="camera-wrap" style="max-width:400px;margin:0 auto">
            <video id="addUserVideo" autoplay playsinline></video>
            <div class="camera-ring"></div>
            <div class="camera-status">Position face in circle</div>
          </div>
          <div class="d-flex gap-md mt-md">
            <button class="btn btn-outline" style="flex:1" onclick="cancelFaceCaptureForNewUser()">Skip</button>
            <button class="btn btn-primary" style="flex:1" onclick="capturePhotoForNewUser()">📷 Capture</button>
          </div>
        </div>

        <!-- Step 3: Face Preview & Register -->
        <div id="addUserFacePreviewSection" style="display:none">
          <p class="text-muted text-sm mb-md">✅ Face captured successfully!</p>
          <img id="addUserPreviewImg" style="max-width:300px;border-radius:var(--radius);border:1px solid var(--border);display:block;margin:1rem auto"/>
          <div class="d-flex gap-md mt-md">
            <button class="btn btn-outline" style="flex:1" onclick="retakeCaptureForNewUser()">🔄 Retake</button>
            <button class="btn btn-success" style="flex:1" id="addUserFaceSubmitBtn" onclick="submitAddUserWithFace()">✅ Add User & Register Face</button>
          </div>
        </div>

      </div>
    </div>
  </div>`;
}

function openAddUserModal(){
  AMS.newUserFaceData=null;
  AMS.newUserId=null;
  AMS.newUserRoll=null;
  document.getElementById('addUserModal').style.display='flex';
  document.getElementById('addUserFormSection').style.display='block';
  document.getElementById('addUserFaceCaptureSection').style.display='none';
  document.getElementById('addUserFacePreviewSection').style.display='none';
  document.getElementById('newUserCaptureFace').checked=false;
  updateRoleFields();
}

function closeAddUserModal(){
  stopCamera();
  document.getElementById('addUserModal').style.display='none';
  ['newUserName','newUserUsername','newUserEmail','newUserPass','newUserDept','newUserRoll','newUserSection'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.value='';
  });
  AMS.newUserFaceData=null;
  AMS.newUserId=null;
  AMS.newUserRoll=null;
}

function updateRoleFields(){
  const role=document.getElementById('newUserRole').value;
  document.getElementById('studentFieldsGroup').style.display=role==='student'?'block':'none';
  if(role==='student'){
    // ensure username follows roll whenever roll changes
    document.getElementById('newUserRoll').addEventListener('input',syncRollToUsername);
    document.getElementById('newUserDept').addEventListener('input',generateRoll);
    document.getElementById('newUserYear').addEventListener('input',generateRoll);
    document.getElementById('newUserSemester').addEventListener('input',generateRoll);
  }
}

function updateFaceCaptureUI(){
  // Just toggle checkbox state; camera will start in submitAddUserForm() after user is created
  const captureFace=document.getElementById('newUserCaptureFace').checked;
  // Show warning if unchecked
  if(!captureFace){
    console.log('Face capture disabled for this user');
  }
}

function syncRollToUsername(){
  const roll=document.getElementById('newUserRoll').value.trim();
  if(roll){
    document.getElementById('newUserUsername').value=roll;
  }
}

async function generateRoll(){
  const dept=document.getElementById('newUserDept').value.trim().toLowerCase().replace(/[^a-z0-9]/g,'');
  const year=document.getElementById('newUserYear').value.trim()||new Date().getFullYear();
  const sem=document.getElementById('newUserSemester').value.trim()||'1';
  if(!dept) return;
  try{
    const resp=await fetch('http://localhost:6001/api/users/list?role=student');
    if(!resp.ok) return;
    const data=await resp.json();
    const users=data.users||[];
    const prefix=`${year}${sem}${dept}`;
    const count=users.filter(u=>u.roll_no && u.roll_no.startsWith(prefix)).length;
    const seq=String(count+1).padStart(4,'0');
    const roll=`${prefix}${seq}`;
    document.getElementById('newUserRoll').value=roll;
    document.getElementById('newUserUsername').value=roll;
  }catch(e){
    console.warn('generateRoll failed',e);
  }
}

async function startCaptureForNewUser(){
  document.getElementById('addUserFormSection').style.display='none';
  document.getElementById('addUserFaceCaptureSection').style.display='block';
  document.getElementById('addUserFacePreviewSection').style.display='none';
  const v=document.getElementById('addUserVideo');
  try{
    await startCamera(v);
  }catch(e){
    toast(`Camera error: ${e.message}`,'error');
    cancelFaceCaptureForNewUser();
  }
}

function cancelCaptureForNewUser(){
  stopCamera();
  document.getElementById('addUserFacePreviewSection').style.display='none';
  document.getElementById('addUserFaceCaptureSection').style.display='none';
  document.getElementById('addUserFormSection').style.display='block';
  document.getElementById('newUserCaptureFace').checked=false;
}

function cancelFaceCaptureForNewUser(){
  stopCamera();
  document.getElementById('addUserFacePreviewSection').style.display='none';
  document.getElementById('addUserFaceCaptureSection').style.display='none';
  document.getElementById('addUserFormSection').style.display='block';
  document.getElementById('newUserCaptureFace').checked=false;
  AMS.newUserFaceData=null;
}

function capturePhotoForNewUser(){
  try{
    const v=document.getElementById('addUserVideo');
    if(!v.srcObject){toast('📷 Camera not initialized','error');return;}
    if(v.videoWidth===0||v.videoHeight===0){
      toast('📷 Camera initializing, please wait...','info');
      setTimeout(()=>capturePhotoForNewUser(),800);
      return;
    }
    const data=captureFrame(v);
    AMS.newUserFaceData=data;
    stopCamera();
    document.getElementById('addUserFaceCaptureSection').style.display='none';
    document.getElementById('addUserFacePreviewSection').style.display='block';
    document.getElementById('addUserPreviewImg').src=data;
    toast('✅ Face captured!','success');
  }catch(e){
    toast(`Capture error: ${e.message}`,'error');
  }
}

function retakeCaptureForNewUser(){
  document.getElementById('addUserFacePreviewSection').style.display='none';
  startCaptureForNewUser();
}

/**
 * Step 1: Submit user form (name, email, password) via /api/users/add
 * If face capture is enabled, proceed to face registration.
 * Otherwise, close modal.
 */
async function submitAddUserForm(){
  const role    = document.getElementById('newUserRole').value;
  const name    = document.getElementById('newUserName').value.trim();
  const username= document.getElementById('newUserUsername').value.trim();
  const email   = document.getElementById('newUserEmail').value.trim();
  const pass    = document.getElementById('newUserPass').value;
  const dept    = document.getElementById('newUserDept').value.trim();
  const roll    = document.getElementById('newUserRoll').value.trim();
  const section = document.getElementById('newUserSection').value.trim();
  const captureFace = document.getElementById('newUserCaptureFace').checked;

  if(!name||!username||!email||!pass||!dept){
    toast('Please fill all required fields','warning');
    return;
  }

  const btn=document.getElementById('addUserFormSubmitBtn');
  if(btn){btn.disabled=true;btn.textContent='⏳ Creating user…';}

  try{
    // Call /api/users/add to create user account (no face)
    const resp=await fetch('http://localhost:6001/api/users/add',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        role,
        full_name:name,
        username,
        email,
        password:pass,
        department:dept,
        roll_no:role==='student'?roll:'',
        section:role==='student'?section:''
      })
    }).catch(()=>null);

    if(!resp){
      toast('Backend not responding','error');
      return;
    }

    const data=await resp.json();

    if(!data.success){
      toast(data.error||'Failed to add user','error');
      return;
    }

    const userId=data.user_id;
    AMS.newUserId=userId;
    AMS.newUserRoll=roll;
    
    toast(`✅ User ${name} created!`,'success');

    // If face capture enabled, proceed to face registration
    if(captureFace){
      document.getElementById('addUserFormSection').style.display='none';
      document.getElementById('addUserFaceCaptureSection').style.display='block';
      const v=document.getElementById('addUserVideo');
      await startCamera(v);
    }else{
      closeAddUserModal();
      await loadUserList();
    }
  }catch(e){
    toast('Error: '+e.message,'error');
  }finally{
    if(btn){btn.disabled=false;btn.textContent='✅ Add User';}
  }
}

/**
 * Step 2: Register face for the user that was just created
 * Registers face via /api/users/register-face
 */
async function submitAddUserWithFace(){
  // If face capture was skipped, just finish
  if(!AMS.newUserFaceData){
    closeAddUserModal();
    await loadUserList();
    return;
  }

  const btn=document.getElementById('addUserFaceSubmitBtn');
  if(btn){btn.disabled=true;btn.textContent='⏳ Registering face…';}

  try{
    toast('Registering face…','info');

    // Convert base64 image to blob
    const base64=AMS.newUserFaceData.split(',')[1];
    const byteCharacters=atob(base64);
    const byteArray=new Uint8Array(byteCharacters.length);
    for(let i=0;i<byteCharacters.length;i++) byteArray[i]=byteCharacters.charCodeAt(i);
    const blob=new Blob([byteArray],{type:'image/jpeg'});

    // Build FormData for /api/users/register-face
    const form=new FormData();
    form.append('image',blob,'face.jpg');
    
    // Only append identifiers if they're set (not null/undefined)
    if(AMS.newUserId){
      form.append('user_id',AMS.newUserId);
    }
    if(AMS.newUserRoll){
      form.append('roll_no',AMS.newUserRoll);
    }
    
    // Verify we have at least one identifier
    if(!AMS.newUserId && !AMS.newUserRoll){
      toast('Error: User ID and Roll Number are missing. Create user first.','error');
      return;
    }

    const resp=await fetch('http://localhost:6001/api/users/register-face',{
      method:'POST',body:form
    }).catch(()=>null);

    if(!resp){
      toast('Backend not responding','error');
      return;
    }

    const data=await resp.json();

    if(data.success){
      toast(`✅ Face registered successfully!`,'success');
      closeAddUserModal();
      await loadUserList();
    }else{
      toast(data.error||'Failed to register face','error');
    }
  }catch(e){
    toast('Error: '+e.message,'error');
  }finally{
    if(btn){btn.disabled=false;btn.textContent='✅ Register Face';}
  }
}

function filterUsers(query){
  document.querySelectorAll('#userTableBody tr').forEach(row=>{
    row.style.display=row.textContent.toLowerCase().includes(query.toLowerCase())?'':'none';
  });
}

async function loadUserList(){
  try{
    const resp=await fetch('http://localhost:6001/api/users/list').catch(()=>null);
    if(!resp||!resp.ok) throw new Error('Failed');
    const data=await resp.json();
    const users=data.users||[];
    const tbody=document.getElementById('userTableBody');
    if(!users.length){
      tbody.innerHTML='<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--text3)">No users found</td></tr>';
      return;
    }
    tbody.innerHTML=users.map(u=>`<tr>
      <td class="fw-semibold">${u.id}</td>
      <td>${u.full_name||u.username}</td>
      <td><span class="badge badge-${u.role==='admin'?'red':u.role==='faculty'?'blue':'green'}">${u.role}</span></td>
      <td>${u.department||'–'}</td>
      <td>${u.email||'–'}</td>
      <td><span class="badge badge-teal">✓ Registered</span></td>
      <td><span class="badge badge-green">Active</span></td>
      <td><button class="btn btn-outline btn-sm" onclick="toast('Edit coming soon…','info')">Edit</button></td>
    </tr>`).join('');
  }catch(e){
    document.getElementById('userTableBody').innerHTML='<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--text3)">Failed to load users</td></tr>';
  }
}

// ── FACE REGISTRATION (standalone) ───────────────────────
function renderFaceRegistration(){
  return `<div class="card">
    <div class="card-header"><div class="card-title">👤 Live Face Registration</div></div>
    <p class="text-muted mb-lg">Register or update a student's face data only. To create a full user account with face, use <strong>User Management → Add User</strong>.</p>
    <div class="form-row">
      <div class="form-group"><label>Full Name</label><input id="regName" placeholder="Student full name"/></div>
      <div class="form-group"><label>Department</label><input id="regDept" placeholder="e.g. cse"/></div>
      <div class="form-group"><label>Year</label><input id="regYearShort" placeholder="e.g. 2024"/></div>
      <div class="form-group"><label>Semester</label><input id="regSem" placeholder="e.g. 1"/></div>
      <div class="form-group"><label>Roll Number</label><input id="regRoll" placeholder="e.g. 20241cse0001"/></div>
      <div class="form-group"><label>Admission No.</label><input id="regAdm" placeholder="leave empty for auto"/></div>
      <div class="form-group"><label>Section</label><input id="regSec" placeholder="e.g. A"/></div>
      <div class="form-group"><label>Academic Year</label><input id="regYear" placeholder="2024-25" value="2024-25"/></div>
    </div>
    <div id="regCamSection">
      <button class="btn btn-teal" onclick="startRegCamera()">📷 Capture Live Photo</button>
    </div>
    <div id="regCamWrap" style="display:none">
      <div class="camera-wrap" style="max-width:400px">
        <video id="regVideo" autoplay playsinline></video>
        <div class="camera-ring"></div>
        <div class="camera-status">Position student face in circle</div>
      </div>
      <div class="d-flex gap-md mt-md">
        <button class="btn btn-outline" onclick="cancelRegCamera()">Cancel</button>
        <button class="btn btn-primary" onclick="captureRegPhoto()">📷 Capture</button>
      </div>
    </div>
    <div id="regPreview" style="display:none">
      <img id="regPreviewImg" style="max-width:200px;border-radius:var(--radius);border:1px solid var(--border)"/>
      <div class="d-flex gap-md mt-md">
        <button class="btn btn-outline" onclick="retakeRegPhoto()">Retake</button>
        <button class="btn btn-primary" onclick="submitRegistration()">✅ Register Face</button>
      </div>
    </div>
  </div>`;
}

function initFaceRegistration(){}

async function startRegCamera(){
  document.getElementById('regCamSection').style.display='none';
  document.getElementById('regCamWrap').style.display='block';
  await startCamera(document.getElementById('regVideo'));
}

function cancelRegCamera(){
  stopCamera();
  document.getElementById('regCamSection').style.display='block';
  document.getElementById('regCamWrap').style.display='none';
}

function captureRegPhoto(){
  const v=document.getElementById('regVideo');
  const data=captureFrame(v);
  stopCamera();
  document.getElementById('regCamWrap').style.display='none';
  document.getElementById('regPreview').style.display='block';
  document.getElementById('regPreviewImg').src=data;
}

function retakeRegPhoto(){
  document.getElementById('regPreview').style.display='none';
  startRegCamera();
}

async function submitRegistration(){
  const name=document.getElementById('regName')?.value.trim();
  let roll=document.getElementById('regRoll')?.value.trim();
  let admission=document.getElementById('regAdm')?.value.trim();
  const section=document.getElementById('regSec')?.value.trim();
  const year=document.getElementById('regYear')?.value.trim()||'2024-25';
  const imgSrc=document.getElementById('regPreviewImg')?.src;

  // ensure admission number exists
  if(!admission){
    admission = crypto.randomUUID();
    document.getElementById('regAdm').value = admission;
  }
  // auto-generate roll if dept/year/sem provided
  if(!roll){
    const dept=document.getElementById('regDept')?.value.trim().toLowerCase().replace(/[^a-z0-9]/g,'');
    const yr=document.getElementById('regYearShort')?.value.trim()||new Date().getFullYear();
    const sem=document.getElementById('regSem')?.value.trim()||'1';
    if(dept){
      roll = `${yr}${sem}${dept}001`;
      document.getElementById('regRoll').value = roll;
    }
  }

  // sync roll back to username logic not needed here but ensure it's set
  

  if(!name||!roll||!admission){toast('Please fill Full Name, Roll Number and Admission No.','warning');return;}
  if(!imgSrc||imgSrc===window.location.href){toast('Please capture a photo first','warning');return;}

  try{
    toast('Processing face encoding…','info');
    const base64=imgSrc.split(',')[1];
    const byteCharacters=atob(base64);
    const byteArray=new Uint8Array(byteCharacters.length);
    for(let i=0;i<byteCharacters.length;i++) byteArray[i]=byteCharacters.charCodeAt(i);
    const blob=new Blob([byteArray],{type:'image/jpeg'});

    const form=new FormData();
    form.append('image',blob,'face.jpg');
    form.append('name',name);
    form.append('roll_no',roll);
    form.append('admission_no',admission);
    form.append('section',section||'–');
    form.append('academic_year',year);

    const resp=await fetch('http://localhost:6001/api/register',{method:'POST',body:form});
    const data=await resp.json();

    if(!resp.ok||!data.success){toast(data.error||'Registration failed','error');return;}

    toast('Face registered successfully!','success');
    document.getElementById('regPreview').style.display='none';
    document.getElementById('regCamSection').style.display='block';
    ['regName','regRoll','regAdm','regSec'].forEach(id=>{
      const el=document.getElementById(id);
      if(el) el.value='';
    });
  }catch(e){
    toast('Error: '+e.message,'error');
  }
}

function renderSystemConfig(){
  // Render inputs with IDs so they can be populated/updated dynamically
  const tol = (AMS.systemConfig && AMS.systemConfig.tolerance) ? AMS.systemConfig.tolerance : '0.5';
  const lat = (AMS.college && AMS.college.lat) ? AMS.college.lat : COLLEGE_LAT;
  const lng = (AMS.college && AMS.college.lng) ? AMS.college.lng : COLLEGE_LNG;
  const rad = (AMS.college && AMS.college.radiusKm) ? AMS.college.radiusKm : COLLEGE_KM;
  const qr = (AMS.systemConfig && AMS.systemConfig.qr_expiry_minutes) ? AMS.systemConfig.qr_expiry_minutes : '5';
  const end = (AMS.systemConfig && AMS.systemConfig.attendance_window_end) ? AMS.systemConfig.attendance_window_end : '18:00';

  return `<div class="card">
    <div class="card-header"><div class="card-title">⚙️ System Configuration</div></div>
    <div class="form-group"><label>Face Recognition Tolerance</label><input id="cfg_tolerance" type="number" step="0.01" value="${tol}"/><small class="text-dim">0.4=strict, 0.6=lenient</small></div>
    <div class="form-group"><label>College Latitude</label><input id="cfg_college_lat" type="number" step="0.000001" value="${lat}"/><small class="text-dim">GPS latitude of campus center</small></div>
    <div class="form-group"><label>College Longitude</label><input id="cfg_college_lng" type="number" step="0.000001" value="${lng}"/><small class="text-dim">GPS longitude of campus center</small></div>
    <div class="form-group"><label>Campus Radius (km)</label><input id="cfg_college_rad" type="number" step="0.01" value="${rad}"/><small class="text-dim">Geofence radius in kilometres</small></div>
    <div class="form-group"><label>QR Expiry (minutes)</label><input id="cfg_qr_expiry" type="number" value="${qr}"/><small class="text-dim">How long QR codes are valid</small></div>
    <div class="form-group"><label>Attendance Window End</label><input id="cfg_att_end" type="time" value="${end}"/><small class="text-dim">Students cannot mark after this time</small></div>
    <div class="d-flex gap-md"><button class="btn btn-primary" onclick="saveSystemConfig()">Save Settings</button><button class="btn btn-outline" onclick="loadSystemConfig()">Reload</button></div>
  </div>`;
}

// Fetch system configuration from backend and update AMS.global state
async function loadSystemConfig(){
  try{
    const resp = await fetch('http://localhost:6001/api/system-config');
    if(!resp.ok) return;
    const data = await resp.json();
    // data expected: {college_lat, college_lng, college_radius_km, tolerance, qr_expiry_minutes, attendance_window_end}
    AMS.college = AMS.college || {};
    if(typeof data.college_lat === 'number') AMS.college.lat = data.college_lat;
    if(typeof data.college_lng === 'number') AMS.college.lng = data.college_lng;
    if(typeof data.college_radius_km === 'number') AMS.college.radiusKm = data.college_radius_km;
    AMS.systemConfig = AMS.systemConfig || {};
    if(data.tolerance) AMS.systemConfig.tolerance = data.tolerance;
    if(data.qr_expiry_minutes) AMS.systemConfig.qr_expiry_minutes = data.qr_expiry_minutes;
    if(data.attendance_window_end) AMS.systemConfig.attendance_window_end = data.attendance_window_end;
    // update the inputs if present
    const latEl = document.getElementById('cfg_college_lat'); if(latEl) latEl.value = AMS.college.lat;
    const lngEl = document.getElementById('cfg_college_lng'); if(lngEl) lngEl.value = AMS.college.lng;
    const radEl = document.getElementById('cfg_college_rad'); if(radEl) radEl.value = AMS.college.radiusKm;
    const tolEl = document.getElementById('cfg_tolerance'); if(tolEl) tolEl.value = AMS.systemConfig.tolerance;
    const qrEl = document.getElementById('cfg_qr_expiry'); if(qrEl) qrEl.value = AMS.systemConfig.qr_expiry_minutes || '';
    const endEl = document.getElementById('cfg_att_end'); if(endEl) endEl.value = AMS.systemConfig.attendance_window_end || '';
    return data;
  }catch(e){console.warn('loadSystemConfig failed',e);}
}

// Save system config to backend and apply locally
async function saveSystemConfig(){
  try{
    const payload = {
      college_lat: parseFloat(document.getElementById('cfg_college_lat').value),
      college_lng: parseFloat(document.getElementById('cfg_college_lng').value),
      college_radius_km: parseFloat(document.getElementById('cfg_college_rad').value),
      tolerance: document.getElementById('cfg_tolerance').value,
      qr_expiry_minutes: parseInt(document.getElementById('cfg_qr_expiry').value||'5',10),
      attendance_window_end: document.getElementById('cfg_att_end').value
    };
    const resp = await fetch('http://localhost:6001/api/system-config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const data = await resp.json().catch(()=>({}));
    if(!resp.ok){toast(data.error||'Failed saving config','error'); return}
    // update local state
    AMS.college.lat = payload.college_lat;
    AMS.college.lng = payload.college_lng;
    AMS.college.radiusKm = payload.college_radius_km;
    AMS.systemConfig = AMS.systemConfig || {};
    AMS.systemConfig.tolerance = payload.tolerance;
    AMS.systemConfig.qr_expiry_minutes = payload.qr_expiry_minutes;
    AMS.systemConfig.attendance_window_end = payload.attendance_window_end;
    toast('Configuration saved!','success');
  }catch(e){console.error('saveSystemConfig',e);toast('Save failed','error')}
}

function renderAuditLogs(){
  return `<div class="card">
    <div class="card-header"><div class="card-title">📋 Audit Logs</div><button class="btn btn-outline btn-sm">📥 Export</button></div>
    <div class="tbl-wrap"><table>
      <thead><tr><th>Time</th><th>User</th><th>Role</th><th>Action</th><th>Module</th></tr></thead>
      <tbody>${[
        {t:'09:12',u:'STU001',r:'student',a:'Attendance Marked',m:'Attendance'},
        {t:'09:05',u:'FAC001',r:'faculty',a:'QR Generated',m:'Attendance'},
        {t:'08:55',u:'ADM001',r:'admin',a:'User + Face Registered',m:'User Management'},
        {t:'08:40',u:'ADM001',r:'admin',a:'ISO Rule Added',m:'ISO Rules'},
        {t:'08:30',u:'FAC002',r:'faculty',a:'Work Log Submitted',m:'Daily Work Log'},
      ].map(l=>`<tr>
        <td class="text-muted">${l.t}</td><td class="fw-semibold">${l.u}</td>
        <td><span class="badge badge-${l.r==='admin'?'red':l.r==='faculty'?'blue':'green'}">${l.r}</span></td>
        <td>${l.a}</td><td>${l.m}</td>
      </tr>`).join('')}</tbody>
    </table></div>
  </div>`;
}

function renderGlobalReports(){
  return `<div class="card">
    <div class="card-header"><div class="card-title">📊 Global Reports</div></div>
    <div class="form-row">
      <div class="form-group"><label>Report Type</label><select><option>Attendance Summary</option><option>Fee Collection</option><option>Exam Results</option></select></div>
      <div class="form-group"><label>Department</label><select><option>All Departments</option><option>Computer Science</option></select></div>
      <div class="form-group"><label>From Date</label><input type="date"/></div>
      <div class="form-group"><label>To Date</label><input type="date"/></div>
    </div>
    <div class="d-flex gap-md"><button class="btn btn-primary" onclick="toast('Report generated!','success')">Generate</button><button class="btn btn-outline">📥 Excel</button><button class="btn btn-outline">📥 PDF</button></div>
  </div>`;
}

function renderAdminAttendance(){
  return `<div class="card">
    <div class="card-header"><div class="card-title">✅ Student Attendance (Admin)</div></div>
    <div style="margin-bottom:1rem;font-size:0.9rem;color:var(--text2)">You (Admin) can edit ANY attendance record, including those marked via face recognition.</div>
    <div class="tbl-wrap"><table>
      <thead><tr><th>Roll No</th><th>Name</th><th>Subject</th><th>Date</th><th>Method</th><th>Status</th><th>Edit</th></tr></thead>
      <tbody>
        <tr>
          <td>CS001</td>
          <td>Alice J.</td>
          <td>CS301</td>
          <td>Feb 14</td>
          <td><span class="badge badge-blue">📷 Face</span></td>
          <td><span class="badge badge-green">Present</span></td>
          <td><select style="padding:.3rem;background:var(--ink3);border:1px solid var(--border);border-radius:4px;color:var(--text)" onchange="toast('Attendance updated','success')"><option selected>Present</option><option>Absent</option></select></td>
        </tr>
        <tr>
          <td>CS002</td>
          <td>Bob S.</td>
          <td>CS301</td>
          <td>Feb 14</td>
          <td><span class="badge badge-orange">✍️ Manual</span></td>
          <td><span class="badge badge-red">Absent</span></td>
          <td><select style="padding:.3rem;background:var(--ink3);border:1px solid var(--border);border-radius:4px;color:var(--text)" onchange="toast('Attendance updated','success')"><option>Present</option><option selected>Absent</option></select></td>
        </tr>
      </tbody>
    </table></div>
  </div>`;
}

function renderAdminFees(){
  return `<div class="card">
    <div class="card-header"><div class="card-title">💳 Student Fees (Admin)</div></div>
    <div class="tbl-wrap"><table>
      <thead><tr><th>Student</th><th>Fee Type</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>
        <tr><td>CS001 – Alice</td><td>Exam Fee</td><td>₹2,400</td><td><span class="badge badge-red">Pending</span></td>
          <td><button class="btn btn-success btn-sm" onclick="toast('Marked as paid','success')">Mark Paid</button></td></tr>
      </tbody>
    </table></div>
  </div>`;
}

function renderAdminPerformance(){
  return `<div class="card">
    <div class="card-header"><div class="card-title">📈 Student Performance (Admin)</div></div>
    <div class="tbl-wrap"><table>
      <thead><tr><th>Student</th><th>CGPA</th><th>Attendance</th><th>Rank</th></tr></thead>
      <tbody><tr><td>CS001 – Alice J.</td><td>8.4</td><td>91%</td><td>#12</td></tr></tbody>
    </table></div>
  </div>`;
}

function renderAdminLeave(){
  return `<div class="card">
    <div class="card-header"><div class="card-title">🏖️ Leave Management (Admin)</div></div>
    <div class="tbl-wrap"><table>
      <thead><tr><th>Student</th><th>Type</th><th>Dates</th><th>Status</th><th>Action</th></tr></thead>
      <tbody>
        <tr><td>CS001</td><td>Medical</td><td>Feb 12–13</td><td><span class="badge badge-orange">Pending</span></td>
          <td class="d-flex gap-sm">
            <button class="btn btn-success btn-sm" onclick="toast('Leave approved','success')">Approve</button>
            <button class="btn btn-danger btn-sm" onclick="toast('Leave rejected','warning')">Reject</button>
          </td></tr>
      </tbody>
    </table></div>
  </div>`;
}

function renderAdminPlacement(){
  return `<div class="card">
    <div class="card-header"><div class="card-title">💼 Placement Data (Admin)</div><button class="btn btn-primary btn-sm">+ Add Company</button></div>
    <div class="tbl-wrap"><table>
      <thead><tr><th>Company</th><th>Role</th><th>Package</th><th>Deadline</th><th>Registered</th></tr></thead>
      <tbody><tr><td>Google</td><td>SWE Intern</td><td>₹25 LPA</td><td>Feb 28</td><td>12</td></tr></tbody>
    </table></div>
  </div>`;
}

function renderAdminGrievances(){
  return `<div class="card">
    <div class="card-header"><div class="card-title">⚖️ Grievances (Admin)</div></div>
    <div class="tbl-wrap"><table>
      <thead><tr><th>Ticket</th><th>Student</th><th>Subject</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>
        <tr><td>GRV-1234</td><td>CS001</td><td>Marks correction</td><td><span class="badge badge-orange">Open</span></td>
          <td class="d-flex gap-sm">
            <button class="btn btn-primary btn-sm" onclick="toast('Reviewing…','info')">Respond</button>
            <button class="btn btn-success btn-sm" onclick="toast('Resolved','success')">Resolve</button>
          </td></tr>
      </tbody>
    </table></div>
  </div>`;
}

// ── Boot ──────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded',()=>{
  const pageLoader=document.getElementById('pageLoader');
  const loginPage=document.getElementById('loginPage');
  if(pageLoader) pageLoader.style.display='none';
  if(loginPage) loginPage.style.display='flex';

  const savedSession=localStorage.getItem('ams_session');
  if(savedSession){
    try{
      const session=JSON.parse(savedSession);
      AMS.user=session.user;
      AMS.role=session.role;
      initDashboard();
      return;
    }catch(e){localStorage.removeItem('ams_session');}
  }

  const params=new URLSearchParams(window.location.search);
  const qrSessionId=params.get('qr');
  const course=params.get('course');
  if(qrSessionId && course){
    showQRAttendanceForm(qrSessionId,course);
  }else{
    const topbarDate=document.getElementById('topbarDate');
    if(topbarDate) topbarDate.textContent=fmtDate();
  }
});

// ── QR Attendance Form (mobile student view) ──────────────
function showQRAttendanceForm(sessionId,course){
  const pageLoader=document.getElementById('pageLoader');
  const qrPage=document.getElementById('qrAttendancePage');
  if(pageLoader) pageLoader.style.display='none';
  if(qrPage){
    qrPage.style.cssText='display:flex !important;position:fixed;top:0;left:0;right:0;bottom:0;z-index:2000;align-items:center;justify-content:center;background:var(--ink)';
  }
  document.getElementById('qrAttContent').innerHTML=`
    <div class="form-group">
      <label>Roll Number / Student ID</label>
      <input id="qrRollNo" type="text" placeholder="e.g., CS001" style="width:100%;padding:.7rem;border-radius:8px;border:1px solid var(--border);background:var(--ink3);color:var(--text);font-size:1rem"/>
    </div>
    <div class="form-group">
      <label>Full Name</label>
      <input id="qrName" type="text" placeholder="Enter your full name" style="width:100%;padding:.7rem;border-radius:8px;border:1px solid var(--border);background:var(--ink3);color:var(--text);font-size:1rem"/>
    </div>
    <div class="form-group">
      <label>Course</label>
      <input type="text" value="${course}" disabled style="width:100%;padding:.7rem;border-radius:8px;border:1px solid var(--border);background:var(--ink3);color:var(--text2);opacity:0.6;font-size:1rem"/>
    </div>
    <button class="btn btn-primary" onclick="captureQRFaceAndLocation('${sessionId}','${course}')" style="width:100%;padding:.8rem;margin-top:1rem">📷 Capture Face & Location</button>
    <button class="btn btn-outline" onclick="cancelQRAttendance()" style="width:100%;padding:.8rem;margin-top:.5rem">Cancel</button>
  `;
}

async function captureQRFaceAndLocation(sessionId,course){
  const rollNo=document.getElementById('qrRollNo').value.trim();
  const name=document.getElementById('qrName').value.trim();
  if(!rollNo||!name){alert('Please enter Roll Number and Name');return;}
  const body=document.getElementById('qrAttContent');
  body.innerHTML=`<div class="att-status"><div class="att-icon-wrap loading" style="animation:spin 1.2s linear infinite">📍</div><p>Verifying location…</p></div>`;
  try{
    const loc=await getLocation();
    if(!isInCollege(loc.lat,loc.lng)){
      body.innerHTML=`<div class="att-status"><div class="att-icon-wrap error">📍</div><h3 class="text-red">❌ Not in Campus</h3><button class="btn btn-outline mt-md" onclick="showQRAttendanceForm('${sessionId}','${course}')">Go Back</button></div>`;
      return;
    }
    body.innerHTML=`<div class="camera-wrap" id="qrFaceCapture">
      <video id="qrCaptureVideo" autoplay playsinline style="width:100%;height:100%;object-fit:cover"></video>
      <div class="camera-ring"></div>
      <div class="camera-status">📍 Location verified ✅ — Position your face</div>
    </div>
    <div style="text-align:center;margin-top:1rem">
      <button class="btn btn-primary" onclick="captureQRFaceSnapshot('${sessionId}','${course}','${rollNo}','${name}')">📷 Capture Face</button>
    </div>`;
    const video=document.getElementById('qrCaptureVideo');
    const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'}});
    video.srcObject=stream;
    AMS.cameraStream=stream;
  }catch(e){
    body.innerHTML=`<div class="att-status"><div class="att-icon-wrap error">❌</div><p>${e.message}</p><button class="btn btn-outline mt-md" onclick="showQRAttendanceForm('${sessionId}','${course}')">Go Back</button></div>`;
  }
}

async function captureQRFaceSnapshot(sessionId,course,rollNo,name){
  stopCamera();
  const body=document.getElementById('qrAttContent');
  body.innerHTML=`<div class="att-status"><div class="att-icon-wrap loading" style="animation:spin 1.2s linear infinite">🔍</div><p>Verifying face…</p></div>`;
  setTimeout(()=>{
    body.innerHTML=`<div class="att-status">
      <div class="att-icon-wrap success">✅</div>
      <h3 class="text-green">Attendance Marked - PRESENT</h3>
      <p>Roll No: <strong>${rollNo}</strong></p>
      <p>Name: <strong>${name}</strong></p>
      <p>Course: <strong>${course}</strong></p>
      <p class="text-muted text-sm">Time: ${fmtTime()}</p>
      <button class="btn btn-outline mt-md" onclick="returnToHome()" style="width:100%">↩ Home</button>
    </div>`;
  },2000);
}

function cancelQRAttendance(){
  stopCamera();
  if(confirm('Cancel attendance marking?')) window.location.href=window.location.origin;
}

function returnToHome(){
  stopCamera();
  window.location.href=window.location.origin;
}