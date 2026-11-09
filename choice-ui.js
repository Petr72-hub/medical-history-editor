'use strict';
function choiceState(f){
 const saved=current().forms?.[f.id];if(saved)return saved;
 const value=current().values[f.id]||'';
 const exact=f.groups.length===1&&f.groups[0].options.includes(value);
 return {groups:f.groups.map((g,i)=>({value:exact&&i===0?value:'',details:{}})),note:exact?'':value};
}
function renderChoiceField(f){
 const state=choiceState(f);
 return `<fieldset class="choicefield field long" id="group_${f.id}"><legend>${esc(f.label)}</legend>${f.hint?`<p class="hint">${esc(f.hint)}</p>`:''}<div class="choicegrid">${f.groups.map((g,i)=>{
 const a=state.groups[i]||{value:'',details:{}},id=`choice_${f.id}_${i}`,label=g.label?f.label+' — '+g.label:f.label;
 const detail=a.details?.[a.value]||'',expanded=a.value==='__other'||g.expand.includes(a.value)||!!detail;
 return `<div class="choiceitem"><label for="${id}">${esc(g.label||'Вариант')}</label><select id="${id}" aria-label="${esc(label)}" data-choice-field="${f.id}" data-choice-index="${i}"><option value="">Не выбрано</option>${g.options.map(o=>`<option value="${esc(o)}" ${a.value===o?'selected':''}>${esc(o)}</option>`).join('')}<option value="__other" ${a.value==='__other'?'selected':''}>Другое — свой текст</option></select><button class="detailtoggle" type="button" data-detail-toggle="${f.id}" data-index="${i}" ${!a.value||expanded?'hidden':''}>Уточнить</button><div id="detailbox_${f.id}_${i}" ${expanded?'':'hidden'}><label class="detaillabel" for="detail_${f.id}_${i}">${a.value==='__other'?'Свой вариант подробно':'Уточнение выбранного варианта'}</label><textarea id="detail_${f.id}_${i}" aria-label="${esc(label)} — подробности" data-choice-detail="${f.id}" data-index="${i}" rows="2">${esc(detail)}</textarea></div></div>`;
 }).join('')}</div><details class="freenote" ${state.note?'open':''}><summary>Свободное описание и дополнения${state.note?' · есть текст':''}</summary><label for="note_${f.id}">Дополнение: ${esc(f.label)}</label><textarea id="note_${f.id}" data-choice-note="${f.id}" rows="3">${esc(state.note)}</textarea></details></fieldset>`;
}
function editableState(id){const f=SECTIONS.flatMap(s=>s.fields).find(f=>f.id===id);current().forms??={};current().forms[id]??=choiceState(f);return {f,state:current().forms[id]};}
function syncChoice(f,state){
 const lines=f.groups.map((g,i)=>{const a=state.groups[i];if(!a?.value)return '';const detail=(a.details?.[a.value]||'').trim();const text=a.value==='__other'?detail:a.value+(detail?' — '+detail:'');return text?(g.label?g.label+': ':'')+text:'';}).filter(Boolean);
 if(state.note.trim())lines.push(state.note.trim());current().values[f.id]=lines.join('\n');updateRecord();updateProgress();
}
$('fields').addEventListener('change',e=>{
 const t=e.target,id=t.dataset.choiceField;if(!id)return;
 const {f,state}=editableState(id),i=+t.dataset.choiceIndex;
 state.groups[i]??={value:'',details:{}};state.groups[i].value=t.value;syncChoice(f,state);
 const old=$('group_'+id);old.outerHTML=renderChoiceField(f);
 const detail=$('detailbox_'+id+'_'+i);if(!detail.hidden)$('detail_'+id+'_'+i).focus();else $('choice_'+id+'_'+i).focus();
});
$('fields').addEventListener('input',e=>{
 const t=e.target,id=t.dataset.choiceDetail||t.dataset.choiceNote;if(!id)return;
 const {f,state}=editableState(id);
 if(t.dataset.choiceNote)state.note=t.value;else{const a=state.groups[+t.dataset.index];a.details??={};a.details[a.value]=t.value;}
 syncChoice(f,state);
});
$('fields').addEventListener('click',e=>{
 const t=e.target.closest('[data-detail-toggle]');if(!t)return;
 $('detailbox_'+t.dataset.detailToggle+'_'+t.dataset.index).hidden=false;t.hidden=true;$('detail_'+t.dataset.detailToggle+'_'+t.dataset.index).focus();
});
render();
