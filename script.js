'use strict';

const KEY = 'reminderflow_data_v1';
let data = loadData();

const $ = id => document.getElementById(id);
const today = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };

function loadData(){
  try {
    const x = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(x) ? x : [];
  } catch { return []; }
}
function save(){ localStorage.setItem(KEY, JSON.stringify(data)); render(); }
function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2); }
function days(s){ return Math.ceil((new Date(s+'T00:00:00') - today()) / 86400000); }
function prettyDate(s){ return new Date(s+'T00:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}); }
function initials(n){ return (n||'?').trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase(); }
function status(d){
  if(d<0) return ['overdue', Math.abs(d)+'d overdue'];
  if(d===0) return ['today','Due today'];
  if(d<=7) return ['soon','Due in '+d+'d'];
  return ['later','Due in '+d+'d'];
}
function escapeHtml(s){
  return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}

/* Google Calendar event: creates an all-day event because the app stores only a reminder date. */
function calendarUrl(r){
  const [y,m,d] = r.date.split('-').map(Number);
  const pad = n => String(n).padStart(2,'0');
  const next = new Date(y,m-1,d+1);
  const end = `${next.getFullYear()}${pad(next.getMonth()+1)}${pad(next.getDate())}`;
  const start = `${y}${pad(m)}${pad(d)}`;
  const u = new URL('https://calendar.google.com/calendar/render');
  u.searchParams.set('action','TEMPLATE');
  u.searchParams.set('text', r.name);
  u.searchParams.set('dates', `${start}/${end}`);
  u.searchParams.set('details', r.description || '');
  return u.toString();
}
function openExternal(url){
  const w = window.open(url,'_blank','noopener,noreferrer');
  if(!w) location.href = url;
}
function openCalendar(r){ openExternal(calendarUrl(r)); }

function render(){
  const all = data.filter(x=>x && x.name && x.date);
  const q = ($('search').value||'').toLowerCase().trim();
  const f = $('filter').value;

  const overdue = all.filter(x=>days(x.date)<0).length;
  const t = all.filter(x=>days(x.date)===0).length;
  const seven = all.filter(x=>days(x.date)>=0&&days(x.date)<=7).length;
  const thirty = all.filter(x=>days(x.date)>=0&&days(x.date)<=30).length;

  $('overdue').textContent=overdue;
  $('today').textContent=t;
  $('seven').textContent=seven;
  $('thirty').textContent=thirty;
  $('heroTotal').textContent=all.length;

  $('morning').textContent =
    overdue ? `${overdue} overdue reminder${overdue>1?'s':''} need attention first.` :
    t ? `${t} reminder${t>1?'s':''} due today.` :
    seven ? `${seven} reminder${seven>1?'s':''} coming up in the next 7 days.` :
    'No urgent reminders — your queue is clear.';

  const list = all
    .filter(r => `${r.name} ${r.description||''}`.toLowerCase().includes(q))
    .filter(r => {
      const d=days(r.date);
      return f==='all' ||
        (f==='overdue'&&d<0) ||
        (f==='today'&&d===0) ||
        (f==='7'&&d>=0&&d<=7) ||
        (f==='30'&&d>=0&&d<=30);
    })
    .sort((a,b)=>new Date(a.date)-new Date(b.date));

  $('empty').style.display=list.length?'none':'block';

  $('list').innerHTML=list.map(r=>{
    const [s,b]=status(days(r.date));
    return `<article class="card">
      <div class="reminder">
        <div class="avatar">${escapeHtml(initials(r.name))}</div>
        <div><b>${escapeHtml(r.name)}</b><span class="muted">Reminder</span></div>
      </div>
      <div class="description-col">
        <span class="column-label">DESCRIPTION</span>
        <span class="description ${r.description?'':'empty-description'}">${r.description?escapeHtml(r.description):'—'}</span>
      </div>
      <div class="status">
        <b>${escapeHtml(prettyDate(r.date))}</b>
        <span class="badge ${s}">${escapeHtml(b)}</span>
      </div>
      <div class="cardactions">
        <button class="mini cal" data-action="cal" data-id="${r.id}" title="Save to Google Calendar" aria-label="Save to Google Calendar">📅</button>
        <button class="mini" data-action="edit" data-id="${r.id}" title="Edit reminder" aria-label="Edit reminder">✎</button>
        <button class="mini delete-mini" data-action="delete" data-id="${r.id}" title="Delete reminder" aria-label="Delete reminder">🗑</button>
      </div>
    </article>`;
  }).join('');
}

function deleteReminder(id){
  const r=data.find(x=>x.id===id);
  if(!r)return;
  if(confirm(`Delete "${r.name}"? This cannot be undone.`)){
    data=data.filter(x=>x.id!==id);
    save();
  }
}

function openForm(r=null){
  $('form').reset();
  $('id').value=r?.id||'';
  $('modalTitle').textContent=r?'Edit Reminder':'Add Reminder';
  $('name').value=r?.name||'';
  $('date').value=r?.date||new Date().toISOString().slice(0,10);
  $('description').value=r?.description||'';
  $('del').classList.toggle('hidden',!r);
  updatePreview();
  $('dlg').showModal();
  $('name').focus();
}

function updatePreview(){
  const name=$('name').value.trim()||'Reminder';
  const date=$('date').value||new Date().toISOString().slice(0,10);
  const desc=$('description').value.trim();
  $('preview').textContent=`${name} — ${prettyDate(date)}${desc?' · '+desc:''}`;
  $('descCount').textContent=`${$('description').value.length}/500 characters`;
}

function downloadBlob(text,name,type){
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([text],{type}));
  a.download=name;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),500);
}

function csvExport(){
  const q=v=>`"${String(v??'').replace(/"/g,'""')}"`;
  const head=['Reminder Name','Description','Reminder Date'];
  downloadBlob(
    [head.map(q).join(','),...data.map(r=>[r.name,r.description||'',r.date].map(q).join(','))].join('\n'),
    'reminderflow-reminders.csv','text/csv'
  );
}

function backup(){ downloadBlob(JSON.stringify(data,null,2),'reminderflow-backup.json','application/json'); }

['add','add2','add3'].forEach(id=>$(id).addEventListener('click',()=>openForm()));
$('cancel').addEventListener('click',()=>$('dlg').close());
$('x').addEventListener('click',()=>$('dlg').close());

['name','date','description'].forEach(id=>$(id).addEventListener('input',updatePreview));

$('form').addEventListener('submit',e=>{
  e.preventDefault();
  const id=$('id').value;
  const r={
    id:id||uid(),
    name:$('name').value.trim(),
    description:$('description').value.trim(),
    date:$('date').value
  };
  if(!r.name||!r.date)return;
  const i=data.findIndex(x=>x.id===id);
  if(i>=0)data[i]=r; else data.push(r);
  save();
  $('dlg').close();
});

$('saveCalendar').addEventListener('click',()=>{
  const r={
    name:$('name').value.trim(),
    description:$('description').value.trim(),
    date:$('date').value
  };
  if(!r.name||!r.date){
    alert('Please enter a reminder name and date.');
    return;
  }
  openCalendar(r);
});

$('del').addEventListener('click',()=>{
  const id=$('id').value;
  if(id && confirm('Delete this reminder?')){
    data=data.filter(x=>x.id!==id);
    save();
    $('dlg').close();
  }
});

$('list').addEventListener('click',e=>{
  const b=e.target.closest('[data-action]');
  if(!b)return;
  const r=data.find(x=>x.id===b.dataset.id);
  if(!r)return;
  if(b.dataset.action==='cal')openCalendar(r);
  if(b.dataset.action==='edit')openForm(r);
  if(b.dataset.action==='delete')deleteReminder(r.id);
});

$('search').addEventListener('input',render);
$('filter').addEventListener('change',render);

$('priority').addEventListener('click',()=>{
  $('filter').value='7';
  render();
  window.scrollTo({top:$('list').offsetTop-20,behavior:'smooth'});
});

$('backup').addEventListener('click',backup);

$('import').addEventListener('change',e=>{
  const f=e.target.files[0];
  if(!f)return;
  const rd=new FileReader();
  rd.onload=()=>{
    try{
      const x=JSON.parse(rd.result);
      if(!Array.isArray(x))throw Error();
      const clean=x.filter(r=>r&&r.name&&r.date).map(r=>({
        id:r.id||uid(),
        name:String(r.name),
        description:String(r.description||''),
        date:String(r.date)
      }));
      if(confirm('Replace current reminders with this backup?')){
        data=clean;
        save();
      }
    }catch{
      alert('Invalid backup file.');
    }
    e.target.value='';
  };
  rd.readAsText(f);
});

$('bell').addEventListener('click',async()=>{
  if(!('Notification' in window)){
    alert('Browser notifications are not supported.');
    return;
  }
  const p=await Notification.requestPermission();
  if(p==='granted'){
    new Notification('ReminderFlow',{body:'Browser notifications are enabled.'});
  }
});

render();