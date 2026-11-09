'use strict';
const $=id=>document.getElementById(id), KEY='case-history-v1';
let db={version:1,records:[],active:null}, currentSection='passport', unsaved=false, readBlocked=false;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2);
const current=()=>db.records.find(r=>r.id===db.active);
const applicable=s=>s.fields.filter(f=>f.mode==='both'||f.mode===current().kind);
function error(message){$('error').textContent=message;$('error').hidden=false;}
function validate(data){
 if(!data||data.version!==1||!Array.isArray(data.records)||data.records.length>2000)throw Error('Неверный формат резервной копии.');
 for(const r of data.records){if(!r||typeof r.id!=='string'||typeof r.name!=='string'||!['adult','child'].includes(r.kind)||!r.values||Array.isArray(r.values)||typeof r.values!=='object'||!r.checks||typeof r.checks!=='object'||Array.isArray(r.checks)||!Array.isArray(r.observations))throw Error('Повреждена запись истории.');
 if(Object.values(r.values).some(v=>typeof v!=='string')||Object.values(r.checks).some(v=>!['','done','no','na'].includes(v)))throw Error('Некорректные значения полей.');
 if(r.forms!==undefined){if(!r.forms||Array.isArray(r.forms)||typeof r.forms!=='object')throw Error('Некорректные варианты полей.');for(const form of Object.values(r.forms)){if(!form||typeof form.note!=='string'||!Array.isArray(form.groups)||form.groups.some(g=>!g||typeof g.value!=='string'||!g.details||Array.isArray(g.details)||typeof g.details!=='object'||Object.values(g.details).some(d=>typeof d!=='string')))throw Error('Некорректное подробное описание.');}}
 for(const row of r.observations)if(!row||typeof row!=='object'||Array.isArray(row)||Object.values(row).some(v=>typeof v!=='string'))throw Error('Некорректная строка наблюдений.');
 }
 return data;
}
function save(){if(readBlocked){unsaved=true;error('Хранилище не удалось прочитать. Скачайте резервную копию текущей работы. Для восстановления используйте другой профиль браузера.');return false;}try{db.updated=new Date().toISOString();localStorage.setItem(KEY,JSON.stringify(db));unsaved=false;$('saved').textContent='Сохранено в этом браузере';$('error').hidden=true;return true;}catch(e){unsaved=true;$('saved').textContent='Не сохранено';error('Не удалось сохранить в браузере. Скачайте резервную копию JSON, чтобы не потерять работу.');return false;}}
function makeRecord(name,kind){const r={id:uid(),name:name.trim()||'Новая история',kind,values:{},checks:{},observations:[],updated:new Date().toISOString()};db.records.push(r);db.active=r.id;return r;}
function updateRecord(){current().updated=new Date().toISOString();save();updateNav();}
function updateNav(){const r=current();$('nav').innerHTML=SECTIONS.map((s,i)=>{const fields=applicable(s),n=fields.filter(f=>r.values[f.id]?.trim()).length;return `<button data-section="${s.id}" ${currentSection===s.id?'aria-current="page"':''}><span class="mark ${n===fields.length?'done':''}">${n===fields.length?'✓':String(i+1).padStart(2,'0')}</span>${esc(s.title)}</button>`}).join('')+(r.kind==='child'?`<button data-section="checks" ${currentSection==='checks'?'aria-current="page"':''}>Самопроверка осмотра</button>`:'');}
function recordList(){$('records').innerHTML=db.records.map(r=>`<option value="${esc(r.id)}">${esc(r.name)} · ${r.kind==='child'?'ребёнок':'взрослый'}</option>`).join('');$('records').value=db.active;}
function render(){
 const r=current();recordList();updateNav();$('recordname').textContent=r.name;$('kind').textContent=r.kind==='child'?'Детская история болезни':'Взрослая история болезни';
 $('stepper').hidden=currentSection==='checks';$('source').hidden=false;
 if(currentSection==='checks'){renderChecks();return;}
 const s=SECTIONS.find(s=>s.id===currentSection),n=SECTIONS.indexOf(s);$('title').textContent=s.title;$('chapter').textContent=`Раздел ${n+1} из ${SECTIONS.length}`;$('source').href=`sources/history.pdf#page=${s.page}`;$('source').textContent=`Методичка · стр. ${s.page} ↗`;
 $('intro').textContent=s.id==='vitae'&&r.kind==='child'?'Общий анамнез дополнен детскими разделами из пособия по осмотру (печатные стр. 9–12).':s.id==='temperature'?'Введите фактические измерения. В Word и при печати они будут представлены таблицей.':s.id==='results'?'Внесите результаты проведённых исследований. Перечень назначений автоматически не формируется.':'Заполняйте по полученным сведениям. Пустые поля не попадут в документ. Выберите вариант или «Другое» для своего текста.';
 $('fields').innerHTML='<div class="formgrid">'+applicable(s).map(f=>{
 const v=r.values[f.id]||'',hint=f.hint?`<p class="hint" id="hint_${f.id}">${esc(f.hint)}</p>`:'',attrs=`id="${f.id}" data-field="${f.id}" ${f.hint?`aria-describedby="hint_${f.id}"`:''}`;
 let control;if(f.groups)return renderChoiceField(f);if(f.type.startsWith('select:'))control=`<select ${attrs}><option value="">Не выбрано</option>${f.type.slice(7).split(';').map(o=>`<option ${v===o?'selected':''}>${esc(o)}</option>`).join('')}</select>`;
 else if(f.type!=='text')control=`<input type="${f.type}" ${attrs} value="${esc(v)}">`;
 else if(['passport','passport'].includes(s.id)||/^(Масса|Рост|Окружность|Частота)/.test(f.label))control=`<input ${attrs} value="${esc(v)}" autocomplete="off">`;
 else control=`<textarea ${attrs} rows="3">${esc(v)}</textarea>`;
 return `<div class="field ${control.startsWith('<textarea')?'long':''}"><label for="${f.id}">${esc(f.label)}</label>${control}${hint}</div>`;
 }).join('')+'</div>';
 if(s.id==='temperature')renderObservations();
 if(s.id==='passport')$('fields').insertAdjacentHTML('beforeend','<div class="recordtools"><button id="rename">Переименовать черновик</button><button id="delete" class="danger">Удалить эту историю</button></div>');
 $('prev').disabled=n===0;$('next').disabled=n===SECTIONS.length-1;updateProgress();
}
function updateProgress(){const s=SECTIONS.find(s=>s.id===currentSection);if(!s)return;const fs=applicable(s);$('progress').textContent=`Заполнено полей: ${fs.filter(f=>current().values[f.id]?.trim()).length} из ${fs.length}`;}
function go(id){currentSection=id;render();$('title').tabIndex=-1;$('title').focus({preventScroll:true});window.scrollTo(0,0);$('menu').setAttribute('aria-expanded','false');document.querySelector('aside').classList.remove('open');}
function renderChecks(){
 $('title').textContent='Самопроверка осмотра';$('chapter').textContent='Отдельно от истории болезни';$('source').href='sources/checklists.pdf';$('source').textContent='Полное пособие ↗';$('intro').textContent='Краткий список основных этапов, а не полная копия чек-листов. Выберите «Выполнено», «Не выполнено» или «Не применимо». Эти отметки не попадают в текст истории.';
 $('fields').innerHTML=CHECKS.map(g=>`<section class="checkgroup"><div class="grouphead"><h3>${esc(g.title)}</h3><a href="sources/checklists.pdf#page=${g.page}" target="_blank">Открыть раздел пособия ↗</a></div>${g.items.map(i=>`<div class="checkrow"><label for="${i.id}">${esc(i.label)}</label><select id="${i.id}" data-check="${i.id}">${[['','Не отмечено'],['done','Выполнено'],['no','Не выполнено'],['na','Не применимо']].map(([v,l])=>`<option value="${v}" ${current().checks[i.id]===v?'selected':''}>${l}</option>`).join('')}</select></div>`).join('')}</section>`).join('');
}
const OBS=[['date','Дата','date'],['period','Время','text'],['day','День болезни','text'],['hospital','День стационара','text'],['temp','T, °C','text'],['pulse','Пульс /мин','text'],['breath','ЧДД /мин','text'],['bp','АД, мм рт. ст.','text']];
function renderObservations(){const div=document.createElement('div');div.id='observations';div.innerHTML=`<div class="tablewrap"><table><thead><tr>${OBS.map(x=>`<th>${x[1]}</th>`).join('')}<th>Действие</th></tr></thead><tbody>${current().observations.map((row,i)=>`<tr>${OBS.map(([k,l,t])=>`<td><input type="${t}" aria-label="${l}, строка ${i+1}" data-row="${i}" data-col="${k}" value="${esc(row[k]||'')}"></td>`).join('')}<td><button data-remove="${i}" aria-label="Удалить измерение ${i+1}">Удалить</button></td></tr>`).join('')}</tbody></table></div><button id="addrow">Добавить измерение</button>`;$('fields').append(div);}
function documentParts(){const r=current();return SECTIONS.map(s=>({title:s.title,fields:applicable(s).map(f=>({label:f.label,value:(r.values[f.id]||'').trim()})).filter(f=>f.value),observations:s.id==='temperature'?r.observations.filter(row=>OBS.some(([k])=>row[k]?.trim())):null})).filter(s=>s.fields.length||s.observations?.length);}
function preview(){const parts=documentParts();$('paper').innerHTML=parts.length?parts.map(s=>`<section><h2>${esc(s.title)}</h2>${s.fields.map(f=>`<p><strong>${esc(f.label)}:</strong> ${esc(f.value)}</p>`).join('')}${s.observations?.length?observationHTML(s.observations):''}</section>`).join(''):'<p class="emptydocument">Документ пока пуст. Заполните нужные поля истории болезни.</p>';$('print').disabled=!parts.length;$('previewdialog').showModal();}
function observationHTML(rows){const columns=OBS.filter(([k])=>rows.some(r=>r[k]?.trim()));return rows.length?`<table><thead><tr>${columns.map(x=>`<th>${x[1]}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${columns.map(([k])=>`<td>${esc(r[k]?.trim()||'')}</td>`).join('')}</tr>`).join('')}</tbody></table>`:'<p>Наблюдения не внесены.</p>';}
function download(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),10000);}
function backup(){download(new Blob([JSON.stringify(db,null,2)],{type:'application/json'}),'Истории-болезни-'+new Date().toISOString().slice(0,10)+'.json');}
document.addEventListener('input',e=>{const t=e.target;if(t.dataset.field){current().values[t.dataset.field]=t.value;updateRecord();updateProgress();}if(t.dataset.col){current().observations[+t.dataset.row][t.dataset.col]=t.value;updateRecord();}});
document.addEventListener('change',e=>{const t=e.target;if(t.dataset.check){current().checks[t.dataset.check]=t.value;updateRecord();}});
$('fields').addEventListener('click',e=>{const t=e.target.closest('button');if(!t)return;if(t.id==='addrow'){current().observations.push({});updateRecord();render();}if(t.dataset.remove!==undefined&&confirm('Удалить это измерение?')){current().observations.splice(+t.dataset.remove,1);updateRecord();render();}if(t.id==='rename'){const n=prompt('Название черновика',current().name);if(n?.trim()){current().name=n.trim().slice(0,160);updateRecord();render();}}if(t.id==='delete'&&confirm(`Удалить историю «${current().name}»? Восстановление возможно только из вашей резервной копии.`)){db.records=db.records.filter(r=>r.id!==db.active);if(!db.records.length)makeRecord('Новая история','child');else db.active=db.records[0].id;save();go('passport');}});
$('nav').addEventListener('click',e=>{const b=e.target.closest('[data-section]');if(b)go(b.dataset.section);});
$('records').onchange=e=>{db.active=e.target.value;save();go('passport');};
$('new').onclick=()=>{$('newname').value='';$('newdialog').showModal();};
$('newdialog').addEventListener('close',()=>{if($('newdialog').returnValue==='create'){makeRecord($('newname').value,$('newkind').value);save();go('passport');}});
$('prev').onclick=()=>go(SECTIONS[SECTIONS.findIndex(s=>s.id===currentSection)-1].id);
$('next').onclick=()=>go(SECTIONS[SECTIONS.findIndex(s=>s.id===currentSection)+1].id);
$('menu').onclick=()=>{const open=document.querySelector('aside').classList.toggle('open');$('menu').setAttribute('aria-expanded',String(open));};
$('preview').onclick=preview;$('closepreview').onclick=()=>$('previewdialog').close();$('print').onclick=()=>window.print();
$('word').onclick=()=>{try{const parts=documentParts();if(!parts.length){error('Документ пуст. Заполните хотя бы одно поле перед экспортом.');return;}download(makeDocx(current(),parts,OBS),current().name.replace(/[<>:"/\\|?*]/g,'_')+'.docx');}catch(e){error('Не удалось создать Word: '+e.message);}};
$('backup').onclick=backup;$('restore').onclick=()=>$('importfile').click();
$('importfile').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;if(f.size>30*1024*1024)throw Error('Файл больше 30 МБ.');const incoming=validate(JSON.parse(await f.text()));if(!incoming.records.length)throw Error('В копии нет историй.');for(const r of incoming.records){const copy=JSON.parse(JSON.stringify(r));copy.id=uid();copy.name+=' (импорт)';db.records.push(copy);}db.active=db.records[db.records.length-1].id;save();go('passport');}catch(err){error('Импорт не выполнен: '+err.message);}finally{e.target.value='';}};
$('help').onclick=()=>$('helpdialog').showModal();$('closehelp').onclick=()=>$('helpdialog').close();
window.addEventListener('beforeunload',e=>{if(unsaved){e.preventDefault();e.returnValue='';}});
window.addEventListener('storage',e=>{if(e.key===KEY){readBlocked=true;unsaved=true;error('Истории изменены в другой вкладке. Скачайте копию текущей работы, затем перезагрузите эту вкладку.');}});
try{const raw=localStorage.getItem(KEY);if(raw)db=validate(JSON.parse(raw));}catch(e){readBlocked=true;error('Не удалось прочитать сохранённые истории. Исходные данные не перезаписаны. Используйте резервную копию или другой профиль браузера.');}
if(!db.records.length)makeRecord('Первая история','child');if(!current())db.active=db.records[0].id;
