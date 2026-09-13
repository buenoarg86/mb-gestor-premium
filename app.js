// MB Gestor Luxury Pro V9.9.5 — Etapa 3A • Faixa Ativa Premium
(() => {
  'use strict';
  // MB Gestor Luxury Pro V9.9.5 — Etapa 3A • Faixa Ativa Premium

  const APP_VERSION = '9.9.5';
  const STORAGE_KEY = 'mb_gestor_premium_v1';
  const DEFAULT_STATE = {
    version: 1,
    students: [],
    expenses: [],
    payments: [],
    schedule: {},
    attendance: {},
    makeups: {},
    // Metadados de reposições manuais (sem consumo de crédito).
    makeupManual: {},
    reminderDrafts: [],
    birthdayNotifications: {},
    studioClosures: [],
    plannedAbsences: [],
    waitlist: [],
    prospects: [],
    trials: [],
    monthClosures: [],
    physicalAssessments: [],
    auditLog: [],
    trash: [],
    settings: {
      studioName: 'Studio Márcio Bueno',
      trainerName: 'Márcio Bueno',
      chargeDaysBefore: 3,
      currency: 'BRL',
      financialValuesVisible: false,
      financePinHash: '',
      financePinEnabled: false,
      lastBackupAt: null,
      lastBackupSummary: null,
      lastBackupVersion: '',
      lastBackupExportedAt: null
    }
  };

  const NAV = [
    {id:'dashboard', label:'Início', icon:'home', title:'Visão geral'},
    {id:'students', label:'Alunos', icon:'users', title:'Alunos'},
    {id:'assessments', label:'Avaliação', icon:'chart', title:'Avaliação física'},
    {id:'finance', label:'Financeiro', icon:'wallet', title:'Financeiro'},
    {id:'charges', label:'Cobranças', icon:'bell', title:'Mensalidades e pendências'},
    {id:'reminders', label:'Lembretes', icon:'message', title:'Lembretes e WhatsApp'},
    {id:'consent', label:'Termos', icon:'file', title:'Termos de consentimento'},
    {id:'schedule', label:'Agenda', icon:'calendar', title:'Agenda semanal'},
    {id:'settings', label:'Ajustes', icon:'settings', title:'Sistema, dados e preferências'}
  ];

  let state = loadState();
  let currentView = 'dashboard';
  let deferredInstallPrompt = null;
  let financeTab = 'summary';
  let chargeTab = 'all';
  let studentFilter = 'all';
  let scheduleCompact = false;
  let scheduleViewMode = 'day';
  let selectedScheduleDay = ({1:'mon',2:'tue',3:'wed',4:'thu',5:'fri'}[new Date().getDay()] || 'mon');
  let scheduleMonthAnchor = new Date(new Date().getFullYear(), new Date().getMonth(), 1, 12);
  // Privacidade persistente: o app lembra se os valores ficaram ocultos ou visíveis.
  let financialValuesVisible = Boolean(state.settings?.financialValuesVisible);
  let financeUnlockedThisSession = false;

  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];
  const viewEl = $('#view');
  const pageTitle = $('#pageTitle');
  const modalRoot = $('#modalRoot');
  const toastRoot = $('#toastRoot');

  function uid(prefix='id') {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return structuredClone(DEFAULT_STATE);
      const parsed = JSON.parse(raw);
      return {
        ...structuredClone(DEFAULT_STATE),
        ...parsed,
        students: Array.isArray(parsed.students) ? parsed.students : [],
        expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
        payments: Array.isArray(parsed.payments) ? parsed.payments : [],
        schedule: (parsed.schedule && typeof parsed.schedule === 'object') ? parsed.schedule : {},
        attendance: (parsed.attendance && typeof parsed.attendance === 'object') ? parsed.attendance : {},
        makeups: (parsed.makeups && typeof parsed.makeups === 'object') ? parsed.makeups : {},
        makeupManual: (parsed.makeupManual && typeof parsed.makeupManual === 'object') ? parsed.makeupManual : {},
        reminderDrafts: Array.isArray(parsed.reminderDrafts) ? parsed.reminderDrafts : [],
        birthdayNotifications: (parsed.birthdayNotifications && typeof parsed.birthdayNotifications === 'object') ? parsed.birthdayNotifications : {},
        studioClosures: Array.isArray(parsed.studioClosures) ? parsed.studioClosures : [],
        plannedAbsences: Array.isArray(parsed.plannedAbsences) ? parsed.plannedAbsences : [],
        waitlist: Array.isArray(parsed.waitlist) ? parsed.waitlist : [],
        prospects: Array.isArray(parsed.prospects) ? parsed.prospects : [],
        trials: Array.isArray(parsed.trials) ? parsed.trials : [],
        monthClosures: Array.isArray(parsed.monthClosures) ? parsed.monthClosures : [],
        physicalAssessments: Array.isArray(parsed.physicalAssessments) ? parsed.physicalAssessments : [],
        auditLog: Array.isArray(parsed.auditLog) ? parsed.auditLog : [],
        trash: Array.isArray(parsed.trash) ? parsed.trash : [],
        settings: {...DEFAULT_STATE.settings, ...(parsed.settings || {})}
      };
    } catch (err) {
      console.error('Falha ao carregar dados', err);
      return structuredClone(DEFAULT_STATE);
    }
  }

  function saveState() {
    // Persistência simples e previsível: não substituímos o objeto `state` aqui,
    // pois modais abertos podem manter referências válidas durante fluxos em várias etapas.
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function refreshStateFromStorage(){
    state = loadState();
    financialValuesVisible = Boolean(state.settings?.financialValuesVisible);
  }

  function escapeHTML(value='') {
    return String(value)
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'",'&#039;');
  }

  function icon(name) {
    return `<svg aria-hidden="true"><use href="#i-${name}"></use></svg>`;
  }

  function parseLocalDate(value) {
    if (!value) return null;
    const [y,m,d] = value.split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m-1, d, 12, 0, 0, 0);
  }

  function todayNoon() {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate(), 12, 0, 0, 0);
  }

  function isoToday() {
    const d = todayNoon();
    const p = n => String(n).padStart(2,'0');
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
  }

  function fmtDate(value) {
    const d = parseLocalDate(value);
    return d ? new Intl.DateTimeFormat('pt-BR').format(d) : '—';
  }

  function fmtMoney(value) {
    return new Intl.NumberFormat('pt-BR',{style:'currency',currency:state.settings.currency || 'BRL'}).format(Number(value)||0);
  }

  function privateMoney(value) { return financialValuesVisible ? fmtMoney(value) : 'R$ •••••'; }
  function toggleFinancialVisibility() { financialValuesVisible=!financialValuesVisible; state.settings.financialValuesVisible=financialValuesVisible; saveState(); render(); }
  function pluralCount(value,singular,plural){const n=Number(value)||0;return `${n} ${n===1?singular:plural}`}
  function firstName(value=''){return String(value||'').trim().split(/\s+/)[0]||'aluno'}
  function monthDate(year,monthIndex){return new Date(year,monthIndex,1,12,0,0,0)}
  function shiftMonth(date,delta){return monthDate(date.getFullYear(),date.getMonth()+delta)}
  function isSameMonth(a,b){return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()}
  function currentScheduleDay(){return ({0:'sun',1:'mon',2:'tue',3:'wed',4:'thu',5:'fri',6:'sat'}[todayNoon().getDay()]||'mon')}
  function resetScheduleToToday(){scheduleWeekStart=mondayOf();scheduleMonthAnchor=monthDate(todayNoon().getFullYear(),todayNoon().getMonth());selectedScheduleDay=currentScheduleDay();scheduleViewMode='day'}
  function fixedScheduleEntries(studentId){
    const out=[];
    Object.entries(state.schedule||{}).forEach(([key,ids])=>{
      if(!Array.isArray(ids)||!ids.map(String).includes(String(studentId)))return;
      const split=key.indexOf('_');if(split<0)return;
      const day=key.slice(0,split),time=key.slice(split+1),dayIndex=SCHEDULE_DAYS.findIndex(d=>d.id===day);
      if(dayIndex>=0)out.push({day,time,label:SCHEDULE_DAYS[dayIndex].label,dayIndex});
    });
    return out.sort((a,b)=>a.dayIndex-b.dayIndex||a.time.localeCompare(b.time));
  }
  function fixedScheduleText(studentId){const rows=fixedScheduleEntries(studentId);return rows.length?rows.map(x=>`${x.label} ${x.time}`).join(' • '):'Nenhum horário fixo'}
  function fixedScheduleMessage(studentId){
    const rows=fixedScheduleEntries(studentId);
    if(!rows.length)return 'nenhum horário fixo cadastrado';
    const parts=rows.map(x=>`${x.label.toLowerCase()} às ${x.time}`);
    return parts.length===1?parts[0]:`${parts.slice(0,-1).join(', ')} e ${parts.at(-1)}`;
  }


  function ageFromBirth(value) {
    const birth = parseLocalDate(value);
    if (!birth) return null;
    const now = todayNoon();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
    return Math.max(0, age);
  }




// V9.4 • Gestão executiva: espera, interessados, experimental, fechamento e histórico.
function addAudit(action, detail=''){
  state.auditLog=state.auditLog||[];
  state.auditLog.unshift({id:uid('log'),at:new Date().toISOString(),action:String(action||'Ação'),detail:String(detail||'')});
  state.auditLog=state.auditLog.slice(0,500);
}
function waitlistFor(day,time){return (state.waitlist||[]).filter(w=>w.day===day&&w.time===time)}
function trialsFor(date,day,time){return (state.trials||[]).filter(t=>t.date===date&&t.day===day&&t.time===time&&t.status!=='cancelled')}
function prospectsOpen(){return (state.prospects||[]).filter(p=>!['matriculado','perdido'].includes(p.status||'novo'))}
function snapshotMonth(mk=monthKey()){
  const students=activeStudents(), billing=billingStudents(), freq=attendanceSummary(mk);
  const received=state.payments.filter(p=>monthKey(p.date)===mk).reduce((a,p)=>a+(Number(p.amount)||0),0);
  const expenses=state.expenses.filter(e=>monthKey(e.date)===mk).reduce((a,e)=>a+(Number(e.amount)||0),0);
  const occ=occupancyStats();
  return {mk,label:monthLabel(mk),closedAt:new Date().toISOString(),students:students.length,expected:billing.reduce((a,s)=>a+(Number(s.monthlyFee)||0),0),received,expenses,net:received-expenses,present:freq.present,absent:freq.absent,makeups:freq.makeups,occupancy:occ.percent};
}
function closedMonth(mk){return (state.monthClosures||[]).find(x=>x.mk===mk)||null}
function previousMonthKey(mk=monthKey()){const [y,m]=mk.split('-').map(Number),d=new Date(y,m-2,1,12);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}
function deltaText(current,previous,suffix=''){if(previous==null)return 'Sem comparação';const d=current-previous;if(d===0)return 'Sem alteração';return `${d>0?'+':''}${d}${suffix}`}
function formatDateTimeBR(v){try{return new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(v))}catch{return '—'}}

function openOccupationMap(){
  const o=occupancyStats(),slotMap=new Map(o.slots.map(x=>[`${x.day}_${x.time}`,x]));
  const rows=SCHEDULE_DAYS.map(d=>`<div class="occupancy-day"><strong>${d.label}</strong><div class="occupancy-slots">${scheduleHours(d.id).map(time=>{const slot=slotMap.get(`${d.id}_${time}`)||{count:0,vacancies:4},n=slot.count,p=Math.round(n/4*100),cls=n>=4?'full':n>=3?'high':n>=2?'mid':n?'low':'empty';return `<button class="occupancy-chip ${cls}" data-occ-day="${d.id}" data-occ-time="${time}"><span>${time}</span><strong>${n}/4</strong><small>${slot.vacancies} vaga${slot.vacancies===1?'':'s'} • ${p}%</small></button>`}).join('')}</div></div>`).join('');
  openModal('Mapa de ocupação',`<div class="luxury-modal-hero"><span class="luxury-orb">◈</span><div><strong>Ocupação semanal</strong><small>${o.used}/${o.totalCapacity} vagas ocupadas • ${o.free} livres • ${o.percent}% de ocupação</small></div></div><div class="occupancy-map">${rows}</div><div class="notice compact">Pausas vigentes liberam a vaga operacional. Toque em um horário para abrir a Agenda exatamente naquela turma.</div>`);
  $$('[data-occ-day]',modalRoot).forEach(b=>b.addEventListener('click',()=>{const targetDay=b.dataset.occDay,targetTime=b.dataset.occTime;closeModal();navigate('schedule');selectedScheduleDay=targetDay;scheduleViewMode='day';renderSchedule();setTimeout(()=>document.querySelector(`[data-day="${targetDay}"][data-time="${targetTime}"]`)?.scrollIntoView({behavior:'smooth',block:'center'}),120)}));
}

function openProspectsManager(){
  const rows=[...(state.prospects||[])].sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
  openModal('Interessados e experimentais',`<form id="prospectForm" class="form-grid two"><div class="notice" style="grid-column:1/-1">Cadastre contatos interessados e transforme oportunidades em aula experimental sem misturar com alunos ativos.</div><div class="field"><label>Nome</label><input name="name" required /></div><div class="field"><label>WhatsApp</label><input name="whatsapp" inputmode="tel" /></div><div class="field"><label>Horário desejado</label><input name="desiredTime" placeholder="Ex.: 18:00" /></div><div class="field"><label>Status</label><select name="status"><option value="novo">Novo contato</option><option value="experimental">Aula experimental</option><option value="decidindo">Decidindo</option><option value="matriculado">Matriculado</option><option value="perdido">Não avançou</option></select></div><div class="modal-actions" style="grid-column:1/-1"><button type="button" class="btn btn-secondary" data-close-modal>Cancelar</button><button class="btn btn-primary" type="submit">${icon('plus')} Adicionar interessado</button></div></form><div class="section-head compact-head"><div><h3>Pipeline</h3><p>${rows.length} contato${rows.length===1?'':'s'}</p></div></div><div class="prospect-list">${rows.length?rows.map(p=>`<article class="prospect-card"><div><span class="prospect-status ${escapeHTML(p.status||'novo')}">${escapeHTML((p.status||'novo').replace('experimental','experimental'))}</span><strong>${escapeHTML(p.name)}</strong><small>${escapeHTML(p.whatsapp||'Sem WhatsApp')} ${p.desiredTime?`• deseja ${escapeHTML(p.desiredTime)}`:''}</small></div><div class="prospect-actions"><button class="mini-icon js-prospect-trial" data-id="${p.id}" title="Agendar aula experimental">${icon('calendar')}</button><button class="mini-icon js-prospect-whatsapp" data-id="${p.id}" title="WhatsApp">${icon('message')}</button><button class="mini-icon danger js-prospect-delete" data-id="${p.id}" title="Arquivar">${icon('trash')}</button></div></article>`).join(''):emptyState('Nenhum interessado','Cadastre o primeiro contato acima.')}</div>`);
  $('#prospectForm').addEventListener('submit',e=>{e.preventDefault();const fd=new FormData(e.currentTarget),p={id:uid('lead'),name:String(fd.get('name')||'').trim(),whatsapp:String(fd.get('whatsapp')||'').trim(),desiredTime:String(fd.get('desiredTime')||'').trim(),status:String(fd.get('status')||'novo'),createdAt:new Date().toISOString()};state.prospects.push(p);addAudit('Interessado cadastrado',p.name);saveState();closeModal();openProspectsManager();toast('Interessado cadastrado.')});
  $$('.js-prospect-whatsapp',modalRoot).forEach(b=>b.addEventListener('click',()=>{const p=state.prospects.find(x=>x.id===b.dataset.id),phone=cleanPhone(p?.whatsapp);if(!phone)return toast('WhatsApp não cadastrado.');window.open(`https://wa.me/${phone}?text=${encodeURIComponent(`Olá, ${p.name.split(' ')[0]}! Aqui é do Studio Márcio Bueno. Estou entrando em contato sobre seu interesse em treinar conosco.`)}`,'_blank','noopener,noreferrer')}));
  $$('.js-prospect-delete',modalRoot).forEach(b=>b.addEventListener('click',()=>{const p=state.prospects.find(x=>x.id===b.dataset.id);state.trash.unshift({id:uid('trash'),type:'prospect',deletedAt:new Date().toISOString(),data:p});state.prospects=state.prospects.filter(x=>x.id!==b.dataset.id);addAudit('Interessado arquivado',p?.name||'');saveState();closeModal();openProspectsManager()}));
  $$('.js-prospect-trial',modalRoot).forEach(b=>b.addEventListener('click',()=>openTrialScheduler(b.dataset.id)));
}

function openTrialScheduler(prospectId){
  const p=state.prospects.find(x=>x.id===prospectId);if(!p)return;
  openModal(`Aula experimental • ${p.name}`,`<form id="trialForm" class="form-grid two"><div class="notice" style="grid-column:1/-1">A aula experimental aparece na Agenda com destaque próprio e não entra na frequência dos alunos matriculados.</div><div class="field"><label>Data</label><input name="date" type="date" min="${isoToday()}" required /></div><div class="field"><label>Horário</label><select name="time" required><option value="">Selecione</option>${[...new Set(SCHEDULE_DAYS.flatMap(d=>scheduleHours(d.id)))].sort().map(h=>`<option value="${h}" ${p.desiredTime===h?'selected':''}>${h}</option>`).join('')}</select></div><div class="modal-actions" style="grid-column:1/-1"><button type="button" class="btn btn-secondary" data-close-modal>Cancelar</button><button class="btn btn-primary" type="submit">Agendar experimental</button></div></form>`);
  $('#trialForm').addEventListener('submit',e=>{e.preventDefault();const fd=new FormData(e.currentTarget),date=String(fd.get('date')),d=parseLocalDate(date),day=dayIdFromDate(d);if(!day)return toast('Escolha um dia útil de segunda a sexta.');const trial={id:uid('trial'),prospectId:p.id,name:p.name,whatsapp:p.whatsapp,date,day,time:String(fd.get('time')),status:'scheduled',createdAt:new Date().toISOString()};state.trials.push(trial);p.status='experimental';addAudit('Aula experimental agendada',`${p.name} • ${fmtDate(date)} ${trial.time}`);saveState();closeModal();toast('Aula experimental agendada.');});
}

function openWaitlistManager(day,time){
  const dayLabel=SCHEDULE_DAYS.find(d=>d.id===day)?.label||day,rows=waitlistFor(day,time),students=[...activeStudents()].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
  openModal(`Lista de espera • ${dayLabel} ${time}`,`<form id="waitlistForm" class="form-grid"><div class="notice">Cadastre alunos interessados neste horário. Quando surgir vaga, o nome ficará pronto para contato.</div><div class="field"><label>Aluno</label><select name="studentId" required><option value="">Selecione</option>${students.map(s=>`<option value="${s.id}">${escapeHTML(s.name)}</option>`).join('')}</select></div><div class="field"><label>Observação (opcional)</label><input name="note" placeholder="Ex.: prefere terça, aceita reposição" /></div><div class="modal-actions"><button type="button" class="btn btn-secondary" data-close-modal>Cancelar</button><button class="btn btn-primary" id="addWaitlist" type="submit" disabled>Adicionar à espera</button></div></form><div class="section-head compact-head"><div><h3>Em espera</h3><p>${rows.length} aguardando</p></div></div><div class="history-list">${rows.length?rows.map(w=>{const s=state.students.find(x=>x.id===w.studentId);return `<div class="history-row"><div><strong>${escapeHTML(s?.name||'Aluno')}</strong><span>${escapeHTML(w.note||'Aguardando vaga')}</span></div><div class="inline-actions"><button class="mini-icon js-wait-whatsapp" data-id="${w.id}" title="WhatsApp">${icon('message')}</button><button class="mini-icon danger js-wait-remove" data-id="${w.id}" title="Remover da espera">${icon('x')}</button></div></div>`}).join(''):emptyState('Lista vazia','Nenhum aluno aguardando este horário.')}</div>`);
  const form=$('#waitlistForm'),addBtn=$('#addWaitlist');
  form.elements.studentId.addEventListener('change',()=>{addBtn.disabled=!form.elements.studentId.value});
  form.addEventListener('submit',e=>{e.preventDefault();const fd=new FormData(e.currentTarget),studentId=String(fd.get('studentId'));if(!studentId)return;if(rows.some(x=>String(x.studentId)===studentId))return toast('Este aluno já está na lista.');state.waitlist.push({id:uid('wait'),studentId,day,time,note:String(fd.get('note')||'').trim(),createdAt:new Date().toISOString()});const st=state.students.find(x=>x.id===studentId);addAudit('Lista de espera',`${st?.name||'Aluno'} • ${dayLabel} ${time}`);saveState();closeModal();openWaitlistManager(day,time);toast('Aluno adicionado à lista de espera.')});
  $$('.js-wait-remove',modalRoot).forEach(b=>b.addEventListener('click',()=>{const w=state.waitlist.find(x=>x.id===b.dataset.id),st=state.students.find(x=>x.id===w?.studentId);openModal('Remover da lista de espera',`<div class="notice">Confirma remover <strong>${escapeHTML(st?.name||'este aluno')}</strong> da lista de espera de ${escapeHTML(dayLabel)} às ${escapeHTML(time)}?</div><div class="modal-actions"><button class="btn btn-secondary" data-close-modal>Cancelar</button><button class="btn btn-danger" id="confirmWaitlistRemoval">Remover</button></div>`);$('#confirmWaitlistRemoval').addEventListener('click',()=>{state.waitlist=state.waitlist.filter(x=>x.id!==b.dataset.id);addAudit('Lista de espera removida',`${st?.name||'Aluno'} • ${dayLabel} ${time}`);saveState();closeModal();openWaitlistManager(day,time);toast('Aluno removido da lista de espera.')});}));
  $$('.js-wait-whatsapp',modalRoot).forEach(b=>b.addEventListener('click',()=>{const w=state.waitlist.find(x=>x.id===b.dataset.id),st=state.students.find(x=>x.id===w?.studentId),phone=cleanPhone(st?.whatsapp);if(!phone)return toast('Aluno sem WhatsApp válido cadastrado.');window.open(`https://wa.me/${phone}?text=${encodeURIComponent(`Olá, ${firstName(st.name)}! Surgiu uma possibilidade de vaga no horário de ${time} no Studio Márcio Bueno. Se ainda tiver interesse, me avise por aqui.`)}`,'_blank','noopener,noreferrer')}));
}

function openMonthlyClose(){
  const mk=monthKey(),snap=closedMonth(mk),prev=closedMonth(previousMonthKey(mk)),live=snapshotMonth(mk),base=snap||live;
  openModal('Fechamento mensal',`<div class="luxury-modal-hero"><span class="luxury-orb">◆</span><div><strong>${escapeHTML(monthLabel(mk))}</strong><small>${snap?'Mês fechado e preservado':'Prévia atual • ainda aberto'}</small></div></div><section class="metrics close-metrics">${metricCard('users',base.students,'Alunos')}${metricCard('wallet',privateMoney(base.received),'Recebido')}${metricCard('check',base.present,'Presenças')}${metricCard('users',`${base.occupancy}%`,'Ocupação')}</section>${prev?`<div class="compare-grid"><div><span>Receita</span><strong>${deltaText(base.received,prev.received,'')}</strong><small>vs. ${prev.label}</small></div><div><span>Alunos</span><strong>${deltaText(base.students,prev.students)}</strong><small>vs. ${prev.label}</small></div><div><span>Presenças</span><strong>${deltaText(base.present,prev.present)}</strong><small>vs. ${prev.label}</small></div><div><span>Ocupação</span><strong>${deltaText(base.occupancy,prev.occupancy,' p.p.')}</strong><small>vs. ${prev.label}</small></div></div>`:'<div class="notice compact">O comparativo aparecerá depois que houver pelo menos dois meses fechados.</div>'}<div class="modal-actions"><button class="btn btn-secondary" data-close-modal>Voltar</button>${snap?'':`<button class="btn btn-primary" id="confirmMonthClose">Fechar ${escapeHTML(monthLabel(mk))}</button>`}</div>`);
  $('#confirmMonthClose')?.addEventListener('click',()=>{state.monthClosures.push(snapshotMonth(mk));addAudit('Fechamento mensal realizado',monthLabel(mk));saveState();closeModal();toast('Mês fechado e preservado.');});
}

function openHolidayQuick(){
  openModal('Marcar feriado',`<form id="holidayQuickForm" class="form-grid"><div class="notice">O dia ficará destacado no calendário e as aulas serão canceladas sem gerar faltas.</div><div class="field"><label>Data</label><input name="date" type="date" required /></div><div class="field"><label>Nome do feriado</label><input name="label" placeholder="Ex.: Dia da Independência" required /></div><div class="modal-actions"><button class="btn btn-secondary" type="button" data-close-modal>Cancelar</button><button class="btn btn-primary" type="submit">Marcar feriado</button></div></form>`);
  $('#holidayQuickForm').addEventListener('submit',e=>{e.preventDefault();const fd=new FormData(e.currentTarget),date=String(fd.get('date')),label=String(fd.get('label')||'Feriado').trim();state.studioClosures.push({id:uid('close'),startDate:date,endDate:date,type:'Feriado',label});addAudit('Feriado marcado',`${label} • ${fmtDate(date)}`);saveState();closeModal();toast('Feriado marcado no calendário.');if(currentView==='schedule')renderSchedule();});
}

function openAuditHistory(){const rows=(state.auditLog||[]).slice(0,160);openModal('Histórico do sistema',`<div class="history-list audit-history">${rows.length?rows.map(x=>{const a=String(x.action||'').toLowerCase(),tone=a.includes('presença')?'ok':a.includes('falta')?'danger':a.includes('pagamento')||a.includes('receita')||a.includes('gasto')?'money':a.includes('backup')?'backup':'neutral';return `<div class="history-row audit-row audit-${tone}"><span class="audit-dot" aria-hidden="true"></span><div><strong>${escapeHTML(x.action)}</strong><span>${escapeHTML(x.detail||'')} • ${formatDateTimeBR(x.at)}</span></div></div>`}).join(''):emptyState('Sem alterações registradas','As próximas ações importantes aparecerão aqui.')}</div>`)}
function trashTypeLabel(type){return type==='student'?'Aluno':type==='prospect'?'Interessado':type==='payment'?'Receita':type==='expense'?'Gasto':'Item'}
function openTrash(){const rows=state.trash||[];openModal('Lixeira protegida',`<div class="notice">Itens removidos ficam aqui para evitar perda por toque acidental.</div><div class="history-list">${rows.length?rows.map(x=>`<div class="history-row"><div><strong>${escapeHTML(x.data?.name||trashTypeLabel(x.type))}</strong><span>${x.type==='student'?'Cadastro':escapeHTML(trashTypeLabel(x.type))} removido em ${formatDateTimeBR(x.deletedAt)}</span></div>${x.type==='student'?`<button class="btn btn-secondary btn-small js-restore-trash" data-id="${x.id}">Restaurar aluno</button>`:''}</div>`).join(''):emptyState('Lixeira vazia','Nenhum item removido recentemente.')}</div>`);$$('.js-restore-trash',modalRoot).forEach(b=>b.addEventListener('click',()=>{const item=state.trash.find(x=>x.id===b.dataset.id);if(!item)return;state.students.push(item.data);state.trash=state.trash.filter(x=>x.id!==item.id);addAudit('Aluno restaurado',item.data?.name||'');saveState();closeModal();toast('Aluno restaurado com sucesso.');render()}))}

  function studioTime(value) {
    const start=parseLocalDate(value); if(!start) return '—';
    const now=todayNoon(); if(start>now) return 'Ainda não iniciou';
    let years=now.getFullYear()-start.getFullYear();
    let months=now.getMonth()-start.getMonth();
    if(now.getDate()<start.getDate()) months--;
    if(months<0){years--;months+=12;}
    const parts=[];
    if(years) parts.push(`${years} ano${years===1?'':'s'}`);
    if(months) parts.push(`${months} ${months===1?'mês':'meses'}`);
    return parts.length?parts.join(' e '):'Menos de 1 mês';
  }

  function birthdayInfo(s) {
    const b=parseLocalDate(s.birthDate); if(!b) return null;
    const now=todayNoon();
    let next=new Date(now.getFullYear(),b.getMonth(),b.getDate(),12);
    if(next<now) next=new Date(now.getFullYear()+1,b.getMonth(),b.getDate(),12);
    return {days:Math.round((next-now)/86400000), next};
  }

  function birthdayStudents(maxDays=7){
    return activeStudents({includePaused:true}).map(s=>({s,info:birthdayInfo(s)}))
      .filter(x=>x.info && x.info.days<=maxDays).sort((a,b)=>a.info.days-b.info.days);
  }


  // V9.3 • Ausências, pausas, feriados/recessos, inatividade e relatórios.
  function dateBetweenISO(date,start,end){return Boolean(date&&start&&end&&String(date)>=String(start)&&String(date)<=String(end))}
  function closureForDate(date){return (state.studioClosures||[]).find(c=>dateBetweenISO(date,c.startDate,c.endDate))||null}
  function studentPauseAt(s,date=isoToday()){return s&&s.pauseStart&&s.pauseEnd&&dateBetweenISO(date,s.pauseStart,s.pauseEnd)?{startDate:s.pauseStart,endDate:s.pauseEnd,reason:s.pauseReason||'Pausa programada'}:null}
  function plannedAbsenceFor(studentId,date){return (state.plannedAbsences||[]).find(a=>String(a.studentId)===String(studentId)&&a.date===date)||null}
  function plannedAbsencesOn(date){return (state.plannedAbsences||[]).filter(a=>a.date===date)}
  function lastPresenceDate(studentId){let last='';Object.entries(state.attendance||{}).forEach(([k,map])=>{if(map?.[studentId]==='present'){const d=k.slice(0,10);if(d>last)last=d}});return last}
  function daysSinceISO(date){const d=parseLocalDate(date);if(!d)return null;return Math.max(0,Math.floor((todayNoon()-d)/86400000))}
  function inactivityInfo(s){
    const lastPresence=lastPresenceDate(s.id),start=s.startDate||'',base=lastPresence||start,days=daysSinceISO(base);
    return {last:lastPresence,base,days,hasPresence:Boolean(lastPresence),attention:Number.isFinite(days)&&days>=10};
  }
  function inactivityLabel(info){if(!info?.attention)return '';return info.hasPresence?`Sem treino há ${info.days} dias`:'Nenhum treino registrado';}
  function inactiveAttentionStudents(){return activeStudents().map(s=>({s,info:inactivityInfo(s)})).filter(x=>x.info.attention).sort((a,b)=>b.info.days-a.info.days)}
  function studentStatusBadge(s,date=isoToday()){const pause=studentPauseAt(s,date);if(pause)return `<span class="status pause">Pausado até ${fmtDate(pause.endDate)}</span>`;const inactivity=inactivityInfo(s);if(inactivity.attention)return `<span class="status warn">${inactivityLabel(inactivity)}</span>`;return ''}
  function effectiveFixedStudentIds(day,time,date){return slotStudents(day,time).filter(id=>{const s=state.students.find(x=>String(x.id)===String(id));return s&&!studentPauseAt(s,date)&&!plannedAbsenceFor(id,date)})}
  function sendBirthdayWhatsApp(id){const s=state.students.find(x=>x.id===id);if(!s)return;const bi=birthdayInfo(s);if(!bi||bi.days!==0)return toast(bi?`O aniversário de ${firstName(s.name)} é em ${bi.days} dia${bi.days===1?'':'s'}. A felicitação fica disponível na data correta.`:'Data de nascimento não cadastrada.');const phone=cleanPhone(s.whatsapp);if(!phone)return toast('Cadastre um WhatsApp válido para este aluno.');const first=(s.name||'').split(' ')[0]||s.name;const text=`Parabéns, ${first}! 🎉 Que seu novo ciclo venha com muita saúde, energia e conquistas. Um grande abraço do Studio Márcio Bueno!`;window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`,'_blank','noopener,noreferrer')}
  function currentYear(){return todayNoon().getFullYear()}
  function annualReportRows(year=currentYear()){
    const out=[];
    for(let m=0;m<12;m++){
      const mk=`${year}-${String(m+1).padStart(2,'0')}`;
      const received=state.payments.filter(p=>monthKey(p.date)===mk).reduce((a,p)=>a+(Number(p.amount)||0),0);
      const expenses=state.expenses.filter(e=>monthKey(e.date)===mk).reduce((a,e)=>a+(Number(e.amount)||0),0);
      const freq=attendanceSummary(mk);
      out.push({mk,label:new Intl.DateTimeFormat('pt-BR',{month:'short'}).format(new Date(year,m,1,12)).replace('.',''),received,expenses,net:received-expenses,present:freq.present,absent:freq.absent,makeups:freq.makeups});
    }
    return out;
  }
  function annualReportHTML(year=currentYear()){
    const rows=annualReportRows(year),sum=k=>rows.reduce((a,r)=>a+(Number(r[k])||0),0),max=Math.max(1,...rows.map(r=>r.received));
    const chart=financialValuesVisible?`<div class="annual-bars">${rows.map(r=>`<div class="annual-bar-col"><div class="annual-bar-track"><span style="height:${Math.max(3,Math.round(r.received/max*100))}%"></span></div><strong>${escapeHTML(r.label)}</strong><small>${r.present} treinos</small></div>`).join('')}</div>`:`<div class="financial-private-placeholder">${icon('eye')}<strong>Gráfico financeiro oculto</strong><span>Use “Mostrar valores” no Financeiro para revelar dados monetários.</span></div>`;
    return `<section class="annual-report-hero"><div><span class="section-overline">RELATÓRIO ANUAL</span><h3>${year}</h3><p>Dados reais registrados no MB Gestor.</p></div><span class="annual-crown">✦</span></section><section class="metrics annual-metrics">${metricCard('wallet',privateMoney(sum('received')),'Recebido no ano','good')}${metricCard('chart',privateMoney(sum('net')),'Saldo anual',sum('net')>=0?'good':'danger')}${metricCard('check',sum('present'),'Presenças','good')}${metricCard('x',sum('absent'),'Faltas',sum('absent')?'danger':'')}${metricCard('users',sum('makeups'),'Reposições')}</section>${chart}<div class="history-list annual-table">${rows.map(r=>`<div class="history-row"><div><strong>${monthLabel(r.mk)}</strong><span>${r.present} presenças • ${r.absent} faltas • ${r.makeups} reposições</span></div><strong class="money-positive">${privateMoney(r.received)}</strong></div>`).join('')}</div>`;
  }

  const SCHEDULE_DAYS=[
    {id:'mon',label:'Segunda'},{id:'tue',label:'Terça'},{id:'wed',label:'Quarta'},
    {id:'thu',label:'Quinta'},{id:'fri',label:'Sexta'}
  ];
  const SCHEDULE_CALENDAR_DAYS=[...SCHEDULE_DAYS,{id:'sat',label:'Sábado',weekend:true},{id:'sun',label:'Domingo',weekend:true}];
  const WEEK_HOURS=['06:00','07:00','08:00','09:00','16:00','17:00','18:00','19:00'];
  const FRIDAY_HOURS=['06:00','07:00','08:00','09:00','10:00'];
  function scheduleHours(day){return day==='fri'?FRIDAY_HOURS:WEEK_HOURS}
  function slotKey(day,time){return `${day}_${time}`}
  function slotStudents(day,time){return Array.isArray(state.schedule?.[slotKey(day,time)])?state.schedule[slotKey(day,time)]:[]}

  function isoDate(d){const p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`}
  function addDays(date,days){const d=new Date(date.getFullYear(),date.getMonth(),date.getDate(),12);d.setDate(d.getDate()+days);return d}
  function mondayOf(date=todayNoon()){const d=new Date(date.getFullYear(),date.getMonth(),date.getDate(),12);const wd=d.getDay()||7;d.setDate(d.getDate()-wd+1);return d}
  let scheduleWeekStart=mondayOf();
  function isCurrentScheduleWeek(){return isoDate(scheduleWeekStart)===isoDate(mondayOf())}
  function displayedScheduleMonthKey(){return `${scheduleMonthAnchor.getFullYear()}-${String(scheduleMonthAnchor.getMonth()+1).padStart(2,'0')}`}
  function scheduleDateForDay(day){const idx=SCHEDULE_CALENDAR_DAYS.findIndex(d=>d.id===day);return isoDate(addDays(scheduleWeekStart,Math.max(0,idx)))}
  function attendanceKey(date,day,time){return `${date}__${slotKey(day,time)}`}
  function attendanceMap(date,day,time){return state.attendance?.[attendanceKey(date,day,time)]||{}}
  function attendanceStatus(date,day,time,studentId){return attendanceMap(date,day,time)[studentId]||''}
  function setAttendance(date,day,time,studentId,status){
    state.attendance=state.attendance||{};const k=attendanceKey(date,day,time),sid=String(studentId);
    state.attendance[k]=state.attendance[k]||{};
    if(status)state.attendance[k][sid]=status;else delete state.attendance[k][sid];
    if(!Object.keys(state.attendance[k]).length)delete state.attendance[k];
    saveState();
  }

  // V9: uma aula pode receber várias reposições. Dados antigos (1 ID em string)
  // são convertidos de forma compatível para uma lista de IDs.
  function makeupStudentIds(date,day,time){
    const raw=state.makeups?.[attendanceKey(date,day,time)];
    if(Array.isArray(raw)) return [...new Set(raw.filter(Boolean).map(String))];
    return raw ? [String(raw)] : [];
  }
  function effectiveMakeupStudentIds(date,day,time){
    return makeupStudentIds(date,day,time).filter(id=>{
      const st=state.students.find(x=>String(x.id)===String(id));
      return st&&st.active!==false&&!studentPauseAt(st,date)&&!plannedAbsenceFor(id,date);
    });
  }
  function isMakeupStudentAtKey(key,studentId){
    const raw=state.makeups?.[key];
    return Array.isArray(raw) ? raw.map(String).includes(String(studentId)) : String(raw||'')===String(studentId);
  }
  function isManualMakeupAtKey(key,studentId){
    return Boolean(state.makeupManual?.[key]?.[String(studentId)]);
  }
  function makeupCreditBalance(studentId){
    let absences=0,completed=0,scheduled=0;
    const today=isoToday(),student=state.students.find(x=>String(x.id)===String(studentId));
    Object.entries(state.attendance||{}).forEach(([k,map])=>{const p=parseAttendanceStorageKey(k),date=p?.date||k.slice(0,10);if(map?.[studentId]==='absent'&&student&&!closureForDate(date)&&!studentPauseAt(student,date)&&!plannedAbsenceFor(studentId,date))absences++;});
    Object.entries(state.makeups||{}).forEach(([k,raw])=>{
      const ids=Array.isArray(raw)?raw:[raw].filter(Boolean);if(!ids.map(String).includes(String(studentId)))return;
      // Reposição criada como exceção manual não consome crédito atual nem futuro.
      if(isManualMakeupAtKey(k,studentId))return;
      const p=parseAttendanceStorageKey(k),date=p?.date||k.slice(0,10);if(closureForDate(date)||(student&&(studentPauseAt(student,date)||plannedAbsenceFor(studentId,date))))return;
      if(state.attendance?.[k]?.[studentId]==='present')completed++;else if(date>=today)scheduled++;
    });
    return {absences,completed,scheduled,available:Math.max(0,absences-completed-scheduled)};
  }
  function monthLabel(key){if(!/^\d{4}-\d{2}$/.test(key))return key;const [y,m]=key.split('-').map(Number);return new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(new Date(y,m-1,1,12))}
  function attendanceSummary(mk=monthKey(),studentId=''){
    let present=0,absent=0,makeups=0;const target=studentId?String(studentId):'';
    Object.entries(state.attendance||{}).forEach(([k,map])=>{
      const date=k.slice(0,10);if(!date.startsWith(mk)||!map||closureForDate(date))return;
      Object.entries(map).forEach(([id,status])=>{
        if(target&&String(id)!==target)return;
        const student=state.students.find(x=>String(x.id)===String(id));
        if(!student||studentPauseAt(student,date)||plannedAbsenceFor(id,date))return;
        if(status==='present'){present++;if(isMakeupStudentAtKey(k,id))makeups++;}
        if(status==='absent')absent++;
      });
    });
    return {present,absent,makeups};
  }
  function monthlyAttendanceCount(studentId,mk=monthKey()){return attendanceSummary(mk,studentId).present}
  function monthlyAttendanceStats(studentId,mk=monthKey()){return attendanceSummary(mk,studentId)}

  function attendanceHistory(studentId){
    const rows=[],student=state.students.find(x=>String(x.id)===String(studentId));
    Object.entries(state.attendance||{}).forEach(([k,map])=>{
      if(!map || !map[studentId]) return;
      const date=k.slice(0,10);if(!student||closureForDate(date)||studentPauseAt(student,date)||plannedAbsenceFor(studentId,date))return;
      const parts=k.split('__'),slot=(parts[1]||'').split('_');
      rows.push({date,status:map[studentId],isMakeup:isMakeupStudentAtKey(k,studentId),time:slot.slice(1).join('_').replace('-',':')||''});
    });
    return rows.sort((a,b)=>b.date.localeCompare(a.date));
  }

  function birthdaysThisMonth(){
    const m=todayNoon().getMonth();
    return state.students.filter(s=>{const b=parseLocalDate(s.birthDate);return b&&b.getMonth()===m;}).sort((a,b)=>parseLocalDate(a.birthDate).getDate()-parseLocalDate(b.birthDate).getDate());
  }

  function occupancyStats(anchor=mondayOf()){
    const slots=[];
    SCHEDULE_DAYS.forEach((d,index)=>{const date=isoDate(addDays(anchor,index));scheduleHours(d.id).forEach(time=>{const count=effectiveFixedStudentIds(d.id,time,date).length;slots.push({day:d.id,label:d.label,time,date,count,vacancies:Math.max(0,4-count)});});});
    const totalCapacity=slots.length*4,used=slots.reduce((a,x)=>a+x.count,0),full=slots.filter(x=>x.count>=4).length,empty=slots.filter(x=>x.count===0).length,percent=totalCapacity?Math.round(used/totalCapacity*100):0;
    return {slots,totalCapacity,used,free:Math.max(0,totalCapacity-used),full,empty,percent,busiest:[...slots].sort((a,b)=>b.count-a.count||a.time.localeCompare(b.time)).slice(0,5)};
  }

  function makeupSummary(){
    const now=todayNoon(), end=addDays(now,7), mk=monthKey();
    let scheduledNext7=0, completedMonth=0;
    Object.entries(state.makeups||{}).forEach(([k,raw])=>{
      const ids=Array.isArray(raw)?raw:[raw].filter(Boolean);
      if(!ids.length) return;
      const dateStr=k.slice(0,10), d=parseLocalDate(dateStr);
      if(d && d>=now && d<=end) scheduledNext7+=ids.length;
      ids.forEach(studentId=>{if(dateStr.startsWith(mk) && state.attendance?.[k]?.[studentId]==='present') completedMonth++;});
    });
    return {scheduledNext7,completedMonth};
  }

  function paymentsByMonth(){
    const groups={};
    state.payments.forEach(p=>{const mk=monthKey(p.date); if(!mk)return; (groups[mk] ||= []).push(p)});
    return Object.entries(groups).sort((a,b)=>b[0].localeCompare(a[0]));
  }

  function daysBetween(a,b) {
    const one = parseLocalDate(a);
    const two = b instanceof Date ? b : parseLocalDate(b);
    if (!one || !two) return 99999;
    return Math.round((one-two)/86400000);
  }

  function dueInfo(student) {
    const days = daysBetween(student.dueDate, todayNoon());
    if (days < 0) return {key:'overdue', cls:'danger', text:`Vencida há ${Math.abs(days)} dia${Math.abs(days)===1?'':'s'}`, days};
    if (days === 0) return {key:'today', cls:'warn', text:'Vence hoje', days};
    if (days <= Number(state.settings.chargeDaysBefore || 3)) return {key:'soon', cls:'warn', text:`Vence em ${days} dia${days===1?'':'s'}`, days};
    return {key:'ok', cls:'ok', text:`Em dia • ${fmtDate(student.dueDate)}`, days};
  }

  function activeStudents(options={}) {
    const includePaused=Boolean(options.includePaused),date=options.date||isoToday();
    return state.students.filter(s => s.active !== false && (includePaused || !studentPauseAt(s,date)));
  }

  // Base financeira/cadastral: uma pausa operacional não apaga obrigações ou histórico financeiro.
  // Isso mantém o faturamento estável mesmo em pausas curtas, enquanto as telas operacionais
  // (Agenda, Ativos, Retorno, Confirmação de horário) continuam excluindo pausas vigentes.
  function billingStudents(){
    return state.students.filter(s => s.active !== false);
  }

  function monthKey(dateValue) {
    const d = dateValue ? parseLocalDate(dateValue) : todayNoon();
    if (!d) return '';
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  }

  function metrics() {
    const operationalStudents = activeStudents();
    const students = billingStudents();
    const expected = students.reduce((a,s)=>a+(Number(s.monthlyFee)||0),0);
    const mk = monthKey();
    const monthPayments = state.payments.filter(p=>monthKey(p.date)===mk);
    const received = monthPayments.reduce((a,p)=>a+(Number(p.amount)||0),0);

    // V6.3: a divisão PIX/Dinheiro segue SEMPRE a forma de pagamento
    // preferencial atual da ficha do aluno. Também aceita registros legados
    // que tenham salvo "Dinheiro"/"PIX" por extenso.
    const normalizePaymentMethod = (value) => {
      const v = String(value || '').trim().toLowerCase();
      if (v === 'cash' || v === 'dinheiro') return 'cash';
      if (v === 'pix') return 'pix';
      return '';
    };
    const paymentMethodFor = (p) => {
      const student = state.students.find(s=>String(s.id)===String(p.studentId));
      const preferred = normalizePaymentMethod(student?.paymentMethod);
      if (preferred) return preferred;
      const legacy = normalizePaymentMethod(p.paymentMethod);
      if (legacy) return legacy;
      // Mantém a conciliação: todo recebimento sem classificação conhecida
      // continua compondo o total e entra provisoriamente em PIX.
      return 'pix';
    };

    const pix = monthPayments.reduce((sum,p)=>sum+(paymentMethodFor(p)==='pix'?(Number(p.amount)||0):0),0);
    const cash = monthPayments.reduce((sum,p)=>sum+(paymentMethodFor(p)==='cash'?(Number(p.amount)||0):0),0);
    // V7: potencial de recebimento por forma preferencial, independente de pagamento realizado.
    const potentialPix = students.filter(s=>s.paymentMethod!=='cash').reduce((a,s)=>a+(Number(s.monthlyFee)||0),0);
    const potentialCash = students.filter(s=>s.paymentMethod==='cash').reduce((a,s)=>a+(Number(s.monthlyFee)||0),0);
    const remainingPix = Math.max(0, potentialPix-pix);
    const remainingCash = Math.max(0, potentialCash-cash);
    const remainingTotal = Math.max(0, expected-received);
    const expenses = state.expenses.filter(e=>monthKey(e.date)===mk).reduce((a,e)=>a+(Number(e.amount)||0),0);
    const overdueStudents = students.filter(s=>dueInfo(s).key==='overdue');
    const overdue = overdueStudents.length;
    const overdueValue = overdueStudents.reduce((a,s)=>a+(Number(s.monthlyFee)||0),0);
    const soon = students.filter(s=>['today','soon'].includes(dueInfo(s).key)).length;
    const makeups = makeupSummary();
    return {students:students.length, activeStudents:operationalStudents.length, expected, received, pix, cash, potentialPix, potentialCash, remainingPix, remainingCash, remainingTotal, expenses, net:received-expenses, overdue, overdueValue, soon, makeups};
  }

  const MOBILE_NAV_IDS=['dashboard','schedule','students','finance'];
  const MORE_NAV_IDS=['assessments','charges','reminders','consent','settings'];

  function renderNav() {
    const desktop = $('#desktopNav');
    const mobile = $('#mobileNav');
    desktop.innerHTML = NAV.map(n=>navButton(n)).join('');
    const primary=MOBILE_NAV_IDS.map(id=>NAV.find(n=>n.id===id)).filter(Boolean);
    mobile.innerHTML = primary.map(n=>navButton(n)).join('') + `<button class="nav-btn ${MORE_NAV_IDS.includes(currentView)?'active':''}" id="mobileMore" type="button">${icon('more')}<span>Mais</span></button>`;
    $$('[data-nav]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.nav)));
    $('#mobileMore')?.addEventListener('click',openMoreMenu);
  }

  function navButton(n) {
    return `<button class="nav-btn ${currentView===n.id?'active':''}" data-nav="${n.id}" type="button">${icon(n.icon)}<span>${n.label}</span></button>`;
  }

  function openMoreMenu(){
    const items=MORE_NAV_IDS.map(id=>NAV.find(n=>n.id===id)).filter(Boolean);
    openModal('Mais opções',`<div class="more-menu-grid">${items.map(n=>`<button type="button" class="more-menu-item" data-more-nav="${n.id}"><span class="more-menu-icon">${icon(n.icon)}</span><span><strong>${n.label}</strong><small>${n.title}</small></span></button>`).join('')}</div>`);
    $$('[data-more-nav]',modalRoot).forEach(b=>b.addEventListener('click',()=>{const id=b.dataset.moreNav;closeModal();navigate(id)}));
  }

  async function hashPin(value){
    const text=String(value||'');
    if(window.crypto?.subtle){
      const data=new TextEncoder().encode(text);
      const buf=await crypto.subtle.digest('SHA-256',data);
      return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
    }
    return btoa(unescape(encodeURIComponent(text)));
  }

  function financeLockEnabled(){return Boolean(state.settings?.financePinEnabled && state.settings?.financePinHash)}

  function requestFinanceUnlock(targetView){
    openModal('Área financeira protegida',`<div class="finance-lock-panel"><div class="finance-lock-icon">${icon('lock')}</div><strong>Digite seu PIN</strong><span>Proteção local para Financeiro e Cobranças.</span></div><form id="financeUnlockForm" class="form-grid"><div class="field"><label>PIN</label><input id="financeUnlockPin" name="pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="off" placeholder="••••" required /></div><div class="modal-actions"><button type="button" class="btn btn-secondary" data-close-modal>Cancelar</button><button class="btn btn-primary" type="submit">${icon('check')} Desbloquear</button></div></form>`);
    const form=$('#financeUnlockForm');
    setTimeout(()=>$('#financeUnlockPin')?.focus(),80);
    form.addEventListener('submit',async e=>{e.preventDefault();const pin=String(new FormData(form).get('pin')||'');const hash=await hashPin(pin);if(hash!==state.settings.financePinHash){toast('PIN incorreto.');$('#financeUnlockPin').value='';return;}financeUnlockedThisSession=true;closeModal();navigate(targetView);});
  }

  function navigate(id) {
    const next = NAV.some(n=>n.id===id) ? id : 'dashboard';
    if(['finance','charges'].includes(next) && financeLockEnabled() && !financeUnlockedThisSession){requestFinanceUnlock(next);return;}
    // Ao abrir/tocar na Agenda, a referência operacional sempre volta para hoje.
    // Navegações internas que precisam de outro dia podem sobrescrever o alvo logo depois.
    if(next==='schedule') resetScheduleToToday();
    currentView = next;
    const item = NAV.find(n=>n.id===currentView);
    pageTitle.textContent = item?.title || 'MB Gestor';
    renderNav();
    render();
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function render() {
    const renderer = {
      dashboard: renderDashboard,
      students: renderStudents,
      assessments: renderAssessments,
      finance: renderFinance,
      charges: renderCharges,
      reminders: renderReminders,
      consent: renderConsent,
      schedule: renderSchedule,
      settings: renderSettings
    }[currentView] || renderDashboard;
    renderer();
  }

  function metricCard(iconName, value, label, cls='', attrs='') {
    return `<article class="metric ${cls} ${attrs?'actionable':''}" ${attrs}><div class="metric-icon">${icon(iconName)}</div><div class="value">${value}</div><div class="label">${label}</div></article>`;
  }

  function greetingText(){
    const h=new Date().getHours();
    return h<12?'Bom dia':h<18?'Boa tarde':'Boa noite';
  }

  function todayStudioSummary(){
    const now=todayNoon(), jsDay=now.getDay();
    const dayId={1:'mon',2:'tue',3:'wed',4:'thu',5:'fri'}[jsDay]||'';
    const date=isoToday();
    let classes=0, fixedStudents=0, makeups=0, present=0, absent=0;
    if(dayId){
      scheduleHours(dayId).forEach(time=>{
        const fixed=effectiveFixedStudentIds(dayId,time,date);
        const k=attendanceKey(date,dayId,time);
        const makeupIds=effectiveMakeupStudentIds(date,dayId,time);
        if(fixed.length||makeupIds.length) classes++;
        fixedStudents+=fixed.length;
        makeups+=makeupIds.length;
        const map=state.attendance?.[k]||{},eligibleIds=[...new Set([...fixed,...makeupIds])].filter(id=>{const st=state.students.find(x=>String(x.id)===String(id));return st&&!studentPauseAt(st,date)&&!plannedAbsenceFor(id,date)});
        present+=eligibleIds.filter(id=>map[id]==='present').length;
        absent+=eligibleIds.filter(id=>map[id]==='absent').length;
      });
    }
    const attention=billingStudents().filter(s=>dueInfo(s).days<=Number(state.settings.chargeDaysBefore||3)).length;
    return {dayId,classes,fixedStudents,makeups,present,absent,attention};
  }

  function renderDashboard() {
    const m=metrics(), today=todayStudioSummary(), occ=occupancyStats(), mk=monthKey();
    const monthPresence=attendanceSummary(mk).present;
    const upcoming=billingStudents().map(s=>({s,info:dueInfo(s)})).filter(x=>x.info.days<=7).sort((a,b)=>a.info.days-b.info.days).slice(0,6);
    const firstName=(state.settings.trainerName||'Márcio').trim().split(/\s+/)[0];
    const todayClosure=closureForDate(isoToday()),todayPlanned=plannedAbsencesOn(isoToday()).length,inactiveAlerts=inactiveAttentionStudents().length,bday7=birthdayStudents(7);
    viewEl.innerHTML=`
      <section class="hero luxury-hero">
        <div class="luxury-glow"></div>
        <div class="hero-grid">
          <div class="hero-copy">
            <span class="badge">MB Gestor • Private Edition</span>
            <p class="luxury-kicker">${greetingText()}, ${escapeHTML(firstName)}</p>
            <h2>Seu Studio.<br><em>Sob controle.</em></h2>
            <p>Uma visão elegante e objetiva do que importa hoje.</p>
            <div class="hero-actions"><button class="btn btn-primary btn-small" data-nav="schedule">${icon('calendar')} Ver agenda</button><button class="btn btn-ghost btn-small" data-nav="students">${icon('users')} Alunos</button></div>
          </div>
          <div class="luxury-logo-wrap"><img class="hero-logo" src="assets/logo-interna.jpg" alt="Identidade Márcio Bueno Personal Trainer" /><span>PREMIUM</span></div>
        </div>
      </section>

      <div class="section-head luxury-section-head"><div><span class="section-overline">HOJE</span><h3>Resumo do dia</h3><p>${today.dayId?'Agenda, alunos e pendências em um único olhar':'Hoje não há grade fixa de aulas.'}</p></div><span class="live-dot">Atual</span></div>
      <section class="today-grid">
        <article class="today-card actionable" data-nav="schedule"><div class="today-icon">${icon('calendar')}</div><div><strong>${today.classes}</strong><span>Aulas hoje</span><small>${today.fixedStudents} aluno${today.fixedStudents===1?'':'s'} previsto${today.fixedStudents===1?'':'s'}</small></div></article>
        <article class="today-card actionable" data-nav="schedule"><div class="today-icon">${icon('check')}</div><div><strong>${today.present}</strong><span>Presenças</span><small>${today.absent} falta${today.absent===1?'':'s'} registrada${today.absent===1?'':'s'}</small></div></article>
        <article class="today-card actionable" data-nav="schedule"><div class="today-icon">${icon('users')}</div><div><strong>${today.makeups}</strong><span>Reposições</span><small>Agendadas para hoje</small></div></article>
        <article class="today-card actionable ${today.attention?'attention':''}" data-nav="charges"><div class="today-icon">${icon('bell')}</div><div><strong>${today.attention}</strong><span>Financeiro</span><small>Mensalidades que pedem atenção</small></div></article>
      </section>

      ${(today.attention||today.makeups||bday7.length||todayPlanned||inactiveAlerts||todayClosure)?`<section class="attention-hub attention-hub-v93"><div class="attention-hub-head"><span>${icon('bell')}</span><div><strong>Central Hoje</strong><small>Agenda inteligente • prioridades e oportunidades</small></div></div><div class="attention-hub-items">${todayClosure?`<button data-nav="schedule" class="hub-closure"><strong>FERIADO</strong><span>${escapeHTML(todayClosure.label||todayClosure.type||'Studio fechado')}</span></button>`:''}${todayPlanned?`<button data-nav="schedule"><strong>${todayPlanned}</strong><span>ausência${todayPlanned===1?'':'s'} programada${todayPlanned===1?'':'s'} hoje</span></button>`:''}${today.attention?`<button data-nav="charges"><strong>${today.attention}</strong><span>mensalidade${today.attention===1?'':'s'} para acompanhar</span></button>`:''}${today.makeups?`<button data-nav="schedule"><strong>${today.makeups}</strong><span>${today.makeups===1?'reposição':'reposições'} hoje</span></button>`:''}${bday7.length?`<button data-student-birthday="1"><strong>${bday7.length}</strong><span>aniversário${bday7.length===1?'':'s'} em até 7 dias</span></button>`:''}${inactiveAlerts?`<button data-student-attention="1"><strong>${inactiveAlerts}</strong><span>aluno${inactiveAlerts===1?'':'s'} sem treinar há 10+ dias</span></button>`:''}</div></section>`:''}

      <section class="metrics luxury-metrics management-cockpit">
        ${metricCard('users',m.activeStudents,'Alunos ativos','','data-dashboard-kpi="students"')}
        ${metricCard('wallet',privateMoney(m.expected),'Receita prevista','','data-dashboard-kpi="expected"')}
        ${metricCard('chart',privateMoney(m.received),'Recebido no mês','good','data-dashboard-kpi="received"')}
        ${metricCard('calendar',monthPresence,'Presenças no mês','good','data-dashboard-kpi="attendance"')}
        ${metricCard('users',`${occ.percent}%`,'Ocupação da grade',occ.percent>=75?'good':'','data-dashboard-kpi="occupancy"')}
        ${metricCard('bell',m.overdue,'Mensalidades vencidas',m.overdue?'danger':'good','data-dashboard-kpi="overdue"')}
      </section>
      <section class="executive-actions"><button class="executive-card" id="openAnnualReport"><span class="executive-icon">✦</span><div><strong>Relatório anual</strong><small>Financeiro, frequência e evolução mês a mês</small></div><span class="executive-arrow">›</span></button>${bday7.length?`<div class="birthday-luxury-list">${bday7.slice(0,3).map(({s,info})=>`<button class="birthday-luxury-item js-birthday-whatsapp" data-id="${s.id}"><span>🎂</span><div><strong>${escapeHTML(s.name)}</strong><small>${info.days===0?'Aniversário hoje':`Em ${info.days} dia${info.days===1?'':'s'}`}</small></div><em>${icon('message')}</em></button>`).join('')}</div>`:''}</section>

      <section class="v94-command-grid"><button class="v94-command-card" id="openOccupationMap"><span class="command-3d">▦</span><div><strong>Mapa de ocupação</strong><small>Veja horários cheios e oportunidades</small></div></button><button class="v94-command-card" id="openProspects"><span class="command-3d">✦</span><div><strong>Interessados</strong><small>${prospectsOpen().length} contato${prospectsOpen().length===1?'':'s'} em acompanhamento</small></div></button><button class="v94-command-card" id="openMonthlyClose"><span class="command-3d">◇</span><div><strong>Fechamento mensal</strong><small>Compare evolução mês a mês</small></div></button><button class="v94-command-card" id="openHolidayQuickDashboard"><span class="command-3d">★</span><div><strong>Marcar feriado</strong><small>Cancele o dia sem gerar faltas</small></div></button></section>

      <div class="section-head luxury-section-head"><div><span class="section-overline">PERFORMANCE</span><h3>Saúde do Studio</h3><p>Indicadores que merecem sua atenção</p></div></div>
      <section class="cards grid2 luxury-panels">
        <article class="card"><div class="premium-card-title"><span>Financeiro</span>${icon('wallet')}</div><div class="list-row"><div class="list-main"><strong>A receber no mês</strong><span>Previsto menos recebido</span></div><strong>${privateMoney(m.remainingTotal)}</strong></div><div class="list-row"><div class="list-main"><strong>Valor vencido</strong><span>${m.overdue} mensalidade${m.overdue===1?'':'s'} vencida${m.overdue===1?'':'s'}</span></div><strong class="${m.overdue?'money-negative':''}">${privateMoney(m.overdueValue)}</strong></div></article>
        <article class="card"><div class="premium-card-title"><span>Agenda</span>${icon('calendar')}</div><div class="list-row"><div class="list-main"><strong>Reposições próximas</strong><span>Próximos 7 dias</span></div><strong>${m.makeups.scheduledNext7}</strong></div><div class="list-row"><div class="list-main"><strong>Realizadas no mês</strong><span>Contabilizadas como presença</span></div><strong>${m.makeups.completedMonth}</strong></div></article>
      </section>

      <div class="section-head luxury-section-head"><div><span class="section-overline">FINANCEIRO</span><h3>Visão financeira</h3><p>Mês atual</p></div><div class="privacy-actions"><button class="mini-icon" id="toggleFinancePrivacy" type="button" title="Mostrar ou ocultar valores">${icon(financialValuesVisible?'eye-off':'eye')}</button><button class="btn btn-secondary btn-small" data-nav="finance">Detalhes</button></div></div>
      <section class="finance-grid luxury-finance">
        <article class="card highlight"><div class="premium-card-title"><span>Fluxo do mês</span><span class="gold-mark">MB</span></div><div class="list-row"><div class="list-main"><strong>Receitas recebidas</strong><span>Pagamentos registrados</span></div><strong class="money-positive">${privateMoney(m.received)}</strong></div><div class="list-row"><div class="list-main"><strong>Gastos</strong><span>Despesas cadastradas</span></div><strong class="money-negative">${privateMoney(m.expenses)}</strong></div><div class="list-row balance-row"><div class="list-main"><strong>Saldo do mês</strong><span>Receitas menos gastos</span></div><strong class="${m.net>=0?'money-positive':'money-negative'}">${privateMoney(m.net)}</strong></div></article>
        <article class="card"><div class="premium-card-title"><span>Recebimentos</span>${icon('chart')}</div><div class="list-row"><div class="list-main"><strong>Mensalidades vencidas</strong><span>Precisam de atenção</span></div><span class="status ${m.overdue?'danger':'ok'}">${m.overdue}</span></div><div class="list-row"><div class="list-main"><strong>Vencendo em breve</strong><span>Próximos ${state.settings.chargeDaysBefore} dias</span></div><span class="status ${m.soon?'warn':'ok'}">${m.soon}</span></div><div class="list-row"><div class="list-main"><strong>Potencial PIX</strong><span>Base ativa</span></div><strong>${privateMoney(m.potentialPix)}</strong></div><div class="list-row"><div class="list-main"><strong>Potencial dinheiro</strong><span>Base ativa</span></div><strong>${privateMoney(m.potentialCash)}</strong></div></article>
      </section>
      ${renderBirthdayPanel()}
      <div class="section-head luxury-section-head"><div><span class="section-overline">PRÓXIMOS DIAS</span><h3>Vencimentos</h3><p>Até 7 dias e mensalidades já vencidas</p></div><button class="btn btn-primary btn-small" data-nav="charges">${icon('bell')} Ver cobranças</button></div>
      <section class="cards">${upcoming.length?upcoming.map(({s,info})=>chargeMiniRow(s,info)).join(''):emptyState('Tudo tranquilo por aqui','Nenhuma mensalidade vencida ou com vencimento nos próximos 7 dias.')}</section>`;
    
    $('#openAnnualReport')?.addEventListener('click',()=>openModal('Relatório anual',annualReportHTML()));
    $('#openOccupationMap')?.addEventListener('click',openOccupationMap);
    $('#openProspects')?.addEventListener('click',openProspectsManager);
    $('#openMonthlyClose')?.addEventListener('click',openMonthlyClose);
    $('#openHolidayQuickDashboard')?.addEventListener('click',openHolidayQuick);
    $$('.js-birthday-whatsapp',viewEl).forEach(b=>b.addEventListener('click',()=>sendBirthdayWhatsApp(b.dataset.id)));
    $('#toggleFinancePrivacy')?.addEventListener('click',toggleFinancialVisibility);
    $$('[data-nav]',viewEl).forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.nav)));
    $('[data-student-attention]',viewEl)?.addEventListener('click',()=>{studentFilter='attention';navigate('students');});
    $('[data-student-birthday]',viewEl)?.addEventListener('click',()=>{studentFilter='birthday';navigate('students');});
    $$('[data-dashboard-kpi]',viewEl).forEach(card=>card.addEventListener('click',()=>{
      const k=card.dataset.dashboardKpi;
      if(k==='students'){studentFilter='active';navigate('students');}
      else if(k==='expected'){financeTab='summary';navigate('finance');}
      else if(k==='received'){financeTab='payments';navigate('finance');}
      else if(k==='attendance'){navigate('schedule');scheduleViewMode='month';renderSchedule();}
      else if(k==='occupancy')openOccupationMap();
      else if(k==='overdue'){chargeTab='overdue';navigate('charges');}
    }));
    $$('.js-charge-whatsapp',viewEl).forEach(b=>b.addEventListener('click',()=>sendChargeWhatsApp(b.dataset.id)));
  }

  function emptyState(title, text) {
    return `<div class="empty"><strong>${escapeHTML(title)}</strong>${escapeHTML(text)}</div>`;
  }

  function chargeMiniRow(student, info) {
    return `<article class="card"><div class="list-row"><div class="list-main"><strong>${escapeHTML(student.name)}</strong><span>${info.text} • ${privateMoney(student.monthlyFee)}</span></div><button class="mini-icon js-charge-whatsapp" data-id="${student.id}" title="Enviar cobrança">${icon('message')}</button></div></article>`;
  }

  function renderStudents() {
    const students=[...state.students].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
    const pausedCount=students.filter(s=>s.active!==false&&studentPauseAt(s)).length,activeCount=students.filter(s=>s.active!==false&&!studentPauseAt(s)).length,inactiveCount=students.filter(s=>s.active===false).length,monthBirthdays=birthdaysThisMonth(),attentionCount=inactiveAttentionStudents().length,birthdaySoon=birthdayStudents(7),birthdaySoonIds=new Set(birthdaySoon.map(x=>String(x.s.id)));
    viewEl.innerHTML=`
      <div class="section-head"><div><h3>Cadastro de alunos</h3><p>${activeCount} ativo${activeCount===1?'':'s'} • ${inactiveCount} inativo${inactiveCount===1?'':'s'}</p></div><button class="btn btn-primary" id="addStudent">${icon('plus')} Novo aluno</button></div>
      <div class="student-toolbar"><div class="search-wrap">${icon('search')}<input id="studentSearch" type="search" placeholder="Buscar por nome, WhatsApp ou e-mail" autocomplete="off" /></div><div class="tabs student-filter-tabs"><button class="tab ${studentFilter==='all'?'active':''}" data-student-filter="all">Todos (${students.length})</button><button class="tab ${studentFilter==='active'?'active':''}" data-student-filter="active">Ativos (${activeCount})</button><button class="tab ${studentFilter==='inactive'?'active':''}" data-student-filter="inactive">Inativos (${inactiveCount})</button><button class="tab ${studentFilter==='paused'?'active':''}" data-student-filter="paused">Pausados (${pausedCount})</button><button class="tab ${studentFilter==='attention'?'active':''}" data-student-filter="attention">Atenção (${attentionCount})</button><button class="tab ${studentFilter==='birthday'?'active':''}" data-student-filter="birthday">Aniversários próximos (${birthdaySoon.length})</button></div></div>
      ${monthBirthdays.length?`<div class="birthday-month-strip"><strong>🎂 Aniversariantes do mês</strong><span>${monthBirthdays.map(s=>`${escapeHTML(s.name)} • ${String(parseLocalDate(s.birthDate).getDate()).padStart(2,'0')}/${String(parseLocalDate(s.birthDate).getMonth()+1).padStart(2,'0')}`).join(' &nbsp; • &nbsp; ')}</span></div>`:''}
      <section id="studentsList" class="cards"></section>`;
    const list=$('#studentsList');
    const draw=()=>{const q=($('#studentSearch')?.value||'').trim().toLowerCase(),qDigits=q.replace(/\D/g,'');const filtered=students.filter(s=>{const text=[s.name,s.email].some(v=>String(v||'').toLowerCase().includes(q))||String(s.whatsapp||'').toLowerCase().includes(q)||(qDigits&&phoneDigits(s.whatsapp).includes(qDigits));const status=studentFilter==='all'||(studentFilter==='active'&&s.active!==false&&!studentPauseAt(s))||(studentFilter==='inactive'&&s.active===false)||(studentFilter==='paused'&&s.active!==false&&Boolean(studentPauseAt(s)))||(studentFilter==='attention'&&inactivityInfo(s).attention&&!studentPauseAt(s))||(studentFilter==='birthday'&&birthdaySoonIds.has(String(s.id)));return text&&status;});list.innerHTML=filtered.length?filtered.map(studentCard).join(''):emptyState('Nenhum aluno encontrado',q?'Tente outro termo de busca.':'Nenhum aluno neste filtro.');bindStudentActions();};
    const tabsEl=$('.student-filter-tabs',viewEl);
    const revealActiveFilter=(smooth=false)=>{if(!tabsEl)return;const active=$('.tab.active',tabsEl);if(!active)return;const left=Math.max(0,active.offsetLeft-(tabsEl.clientWidth-active.offsetWidth)/2);if(typeof tabsEl.scrollTo==='function')tabsEl.scrollTo({left,behavior:smooth?'smooth':'auto'});else tabsEl.scrollLeft=left;};
    draw();$('#studentSearch').addEventListener('input',draw);$$('[data-student-filter]',viewEl).forEach(b=>b.addEventListener('click',()=>{studentFilter=b.dataset.studentFilter;$$('[data-student-filter]',viewEl).forEach(x=>x.classList.toggle('active',x.dataset.studentFilter===studentFilter));draw();revealActiveFilter(true);}));requestAnimationFrame(()=>revealActiveFilter(false));$('#addStudent').addEventListener('click',()=>openStudentModal());
  }

  function studentCard(s) {
    const age = ageFromBirth(s.birthDate);
    const info = dueInfo(s);
    const mk = monthKey();
    const trainingCount = monthlyAttendanceCount(s.id,mk);
    const credits = makeupCreditBalance(s.id);
    return `<article class="card student-card">
      <div class="student-profile">
        <div class="student-photo">${s.photoData?`<img src="${s.photoData}" alt="Foto de ${escapeHTML(s.name)}" />`:`<span>${escapeHTML((s.name||'?').trim().charAt(0).toUpperCase())}</span>`}</div>
        <div class="student-info">
        <div class="student-name">${escapeHTML(s.name)}</div>
        <div class="student-meta"><span><strong>${age ?? '—'} anos</strong></span><span>${escapeHTML(s.whatsapp||'Sem WhatsApp')}</span><span>${escapeHTML(s.email||'Sem e-mail')}</span></div>
        <div class="student-meta"><span>Início: <strong>${fmtDate(s.startDate)}</strong></span><span>No Studio: <strong>${studioTime(s.startDate)}</strong></span><span>Vencimento: <strong>${fmtDate(s.dueDate)}</strong></span><span><strong>${privateMoney(s.monthlyFee)}</strong></span></div>
        <div style="margin-top:10px"><span class="status ${info.cls}">${info.text}</span>${s.active===false?' <span class="status neutral">Inativo</span>':''} ${studentStatusBadge(s)} <span class="status neutral">🏋️ Treinos em ${monthLabel(mk).replace(/ de \d{4}$/,'')}: ${trainingCount}</span> <span class="status ${credits.available?'warn':'neutral'}">↻ Reposições disponíveis: ${credits.available}</span></div>
        </div>
      </div>
      <div class="student-actions">
        <button class="mini-icon js-student-history" data-id="${s.id}" title="Histórico de presença e faltas">${icon('calendar')}</button>
        <button class="mini-icon js-student-training-whatsapp" data-id="${s.id}" data-month="${mk}" title="Enviar treinos pelo WhatsApp">${icon('message')}</button>
        <button class="mini-icon js-edit-student" data-id="${s.id}" title="Editar aluno">${icon('edit')}</button>
        <button class="mini-icon danger js-delete-student" data-id="${s.id}" title="Excluir aluno">${icon('trash')}</button>
      </div>
    </article>`;
  }

  function bindStudentActions() {
    $$('.js-student-history',viewEl).forEach(b=>b.addEventListener('click',()=>openStudentHistory(b.dataset.id)));
    $$('.js-student-training-whatsapp',viewEl).forEach(b=>b.addEventListener('click',()=>sendMonthlyAttendanceWhatsApp(b.dataset.id,b.dataset.month)));
    $$('.js-edit-student',viewEl).forEach(b=>b.addEventListener('click',()=>openStudentModal(b.dataset.id)));
    $$('.js-delete-student',viewEl).forEach(b=>b.addEventListener('click',()=>confirmDeleteStudent(b.dataset.id)));
  }

  function studentMonthTrend(studentId,months=6){
    const now=todayNoon(),out=[];
    for(let i=months-1;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1,12),mk=monthKey(isoDate(d)),st=monthlyAttendanceStats(studentId,mk);out.push({mk,label:new Intl.DateTimeFormat('pt-BR',{month:'short'}).format(d).replace('.',''),...st});}
    return out;
  }

  function openStudentHistory(id){
    const s=state.students.find(x=>x.id===id);if(!s)return;
    const rows=attendanceHistory(id),present=rows.filter(x=>x.status==='present').length,absent=rows.filter(x=>x.status==='absent').length,makeups=rows.filter(x=>x.isMakeup&&x.status==='present').length,credits=makeupCreditBalance(id),mk=monthKey(),monthStats=monthlyAttendanceStats(id,mk);
    const payments=state.payments.filter(p=>String(p.studentId)===String(id)).sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,8);
    const paidThisMonth=payments.some(p=>monthKey(p.date)===mk),trend=studentMonthTrend(id,6),maxTrend=Math.max(1,...trend.map(x=>x.present));
    const phone=cleanPhone(s.whatsapp),pause=studentPauseAt(s),planned=(state.plannedAbsences||[]).filter(a=>String(a.studentId)===String(id)&&a.date>=isoToday()).sort((a,b)=>a.date.localeCompare(b.date)),fixedText=fixedScheduleText(id);
    openModal(`Ficha Premium • ${s.name}`,`<section class="student-premium-summary"><div class="student-photo premium-profile-photo">${s.photoData?`<img src="${s.photoData}" alt="" />`:`<span>${escapeHTML((s.name||'?').charAt(0).toUpperCase())}</span>`}</div><div><h4>${escapeHTML(s.name)}</h4><p>${ageFromBirth(s.birthDate)??'—'} anos • no Studio há ${studioTime(s.startDate)}</p><div class="profile-pills"><span>${s.paymentMethod==='cash'?'Dinheiro':'PIX'}</span><span class="${paidThisMonth?'profile-paid':'profile-pending'}">${paidThisMonth?'Mensalidade registrada':'Pagamento pendente no mês'}</span><span>${s.active===false?'Inativo':pause?'Pausado':'Aluno ativo'}</span></div></div></section>
      <section class="metrics history-metrics">${metricCard('check',monthStats.present,'Treinos no mês','good')}${metricCard('x',monthStats.absent,'Faltas no mês',monthStats.absent?'danger':'')}${metricCard('calendar',credits.available,'Créditos disponíveis',credits.available?'warn':'')}${metricCard('users',credits.scheduled,'Reposições agendadas')}</section>
      <div class="profile-detail-grid"><div><span>WhatsApp</span><strong>${escapeHTML(formatPhoneBR(s.whatsapp))}</strong></div><div><span>Vencimento</span><strong>${fmtDate(s.dueDate)}</strong></div><div><span>Mensalidade</span><strong>${privateMoney(s.monthlyFee)}</strong></div><div><span>Total de reposições feitas</span><strong>${makeups}</strong></div><div class="profile-detail-wide"><span>Horários fixos sincronizados com a Agenda</span><strong>${escapeHTML(fixedText)}</strong></div></div>${pause?`<div class="student-pause-banner"><strong>⏸ Aluno em pausa</strong><span>${fmtDate(pause.startDate)} a ${fmtDate(pause.endDate)} • ${escapeHTML(pause.reason)}</span><button type="button" class="btn btn-secondary btn-small" id="historyResume">Retomar treinos</button></div>`:''}${planned.length?`<div class="planned-absence-strip"><strong>Ausências programadas</strong><span>${planned.slice(0,3).map(a=>`${fmtDate(a.date)}${a.reason?` • ${escapeHTML(a.reason)}`:''}`).join(' &nbsp; | &nbsp; ')}</span></div>`:''}${s.privateNotes?`<div class="private-notes-card"><span class="section-overline">PRIVADO</span><strong>Observações internas</strong><p>${escapeHTML(s.privateNotes)}</p></div>`:''}
      ${assessmentProfileCardHTML(s)}
      <div class="student-quick-actions">${phone?`<button class="btn btn-primary btn-small" id="historyWhatsapp">${icon('message')} WhatsApp</button>`:''}<button class="btn btn-secondary btn-small" id="historyMonthly">${icon('calendar')} Resumo do mês</button><button class="btn btn-secondary btn-small" id="historyAbsence">${icon('calendar')} Programar ausência</button><button class="btn btn-secondary btn-small" id="historyEdit">${icon('edit')} Editar cadastro</button></div>
      <div class="section-head compact-head"><div><h3>Evolução • 6 meses</h3><p>Treinos realizados por mês</p></div></div><div class="student-trend">${trend.map(x=>`<div class="student-trend-col"><div class="student-trend-bar"><span style="height:${Math.max(5,Math.round(x.present/maxTrend*100))}%"></span></div><strong>${x.present}</strong><small>${escapeHTML(x.label)}</small></div>`).join('')}</div>
      <div class="section-head compact-head"><div><h3>Pagamentos</h3><p>Últimos registros deste aluno</p></div></div><div class="history-list payment-history-list">${payments.length?payments.map(p=>`<div class="history-row"><div><strong>${fmtDate(p.date)}</strong><span>${escapeHTML((p.method||s.paymentMethod||'pix').toUpperCase())}</span></div><strong class="money-positive">${privateMoney(p.amount)}</strong></div>`).join(''):emptyState('Sem pagamentos','Nenhum pagamento individual registrado para este aluno.')}</div>
      <div class="section-head compact-head"><div><h3>Histórico de frequência</h3><p>${present} presenças • ${absent} faltas</p></div></div><div class="history-list">${rows.length?rows.map(r=>`<div class="history-row"><div><strong>${fmtDate(r.date)}</strong><span>${r.isMakeup?'Reposição • ':''}${escapeHTML(r.time||'')}</span></div><span class="status ${r.status==='present'?'ok':'danger'}">${r.status==='present'?'Presente':'Falta'}</span></div>`).join(''):emptyState('Sem histórico','Ainda não há presenças ou faltas registradas para este aluno.')}</div>`);
    $('#historyWhatsapp')?.addEventListener('click',()=>window.open(`https://wa.me/${phone}?text=${encodeURIComponent(`Olá, ${(s.name||'').split(' ')[0]}! Tudo bem?`)}`,'_blank','noopener,noreferrer'));
    $('#historyMonthly')?.addEventListener('click',()=>sendMonthlyAttendanceWhatsApp(id,mk));
    $('#historyAbsence')?.addEventListener('click',()=>{closeModal();openPlannedAbsenceModal(id)});
    $('#historyResume')?.addEventListener('click',()=>{openModal('Encerrar pausa agora',`<div class="notice">Deseja retomar os treinos de <strong>${escapeHTML(s.name)}</strong> agora? A data original de início no Studio será preservada.</div><div class="modal-actions"><button class="btn btn-secondary" data-close-modal>Cancelar</button><button class="btn btn-primary" id="confirmResumeStudent">Retomar treinos</button></div>`);$('#confirmResumeStudent').addEventListener('click',()=>{s.pauseStart='';s.pauseEnd='';s.pauseReason='';addAudit('Pausa encerrada',s.name);saveState();closeModal();render();toast('Treinos retomados.');});});
    $('#historyEdit')?.addEventListener('click',()=>{closeModal();openStudentModal(id)});
    $('#historyAssessmentNew')?.addEventListener('click',()=>{closeModal();openAssessmentModal(id)});
    $('#historyAssessmentHistory')?.addEventListener('click',()=>{closeModal();openAssessmentHistory(id)});
    $('#historyAssessmentEvolution')?.addEventListener('click',()=>{closeModal();openAssessmentEvolution(id)});
  }

  // === V9.9.5 • Etapa 3A — Faixa Ativa Premium =============================
  // A avaliação permanece opcional e independente das rotinas operacionais.
  // Objetivo e estágio são definidos pelo profissional. Tendências mostram variação numérica,
  // nunca uma interpretação automática de "bom" ou "ruim".
  const ASSESSMENT_OBJECTIVES=[
    ['', 'Não definido'],
    ['health','Saúde e qualidade de vida'],
    ['conditioning','Condicionamento físico'],
    ['strength','Força e hipertrofia'],
    ['recomposition','Recomposição corporal'],
    ['mobility','Mobilidade e funcionalidade'],
    ['performance','Desempenho esportivo'],
    ['maintenance','Manutenção'],
    ['other','Outro']
  ];
  const ASSESSMENT_STAGES=[
    ['', 'Não definido'],
    ['initial','Avaliação inicial'],
    ['adaptation','Adaptação'],
    ['evolution','Em evolução'],
    ['consolidation','Consolidação'],
    ['maintenance','Manutenção'],
    ['reassessment','Reavaliação necessária']
  ];
  const ASSESSMENT_EVOLUTION_METRICS=[
    {key:'weight',label:'Peso',unit:'kg',digits:1},
    {key:'bmi',label:'IMC',unit:'kg/m²',digits:1},
    {key:'ircq',label:'IRCQ',unit:'',digits:2},
    {key:'neck',label:'Pescoço',unit:'cm',digits:1},
    {key:'chest',label:'Peitoral',unit:'cm',digits:1},
    {key:'waist',label:'Cintura',unit:'cm',digits:1},
    {key:'abdomen',label:'Abdômen',unit:'cm',digits:1},
    {key:'hip',label:'Quadril',unit:'cm',digits:1},
    {key:'bicepsRelaxedR',label:'Bíceps relaxado • D',unit:'cm',digits:1},
    {key:'bicepsRelaxedL',label:'Bíceps relaxado • E',unit:'cm',digits:1},
    {key:'bicepsContractedR',label:'Bíceps contraído • D',unit:'cm',digits:1},
    {key:'bicepsContractedL',label:'Bíceps contraído • E',unit:'cm',digits:1},
    {key:'wristR',label:'Punho • D',unit:'cm',digits:1},
    {key:'wristL',label:'Punho • E',unit:'cm',digits:1},
    {key:'thighProximalR',label:'Coxa proximal • D',unit:'cm',digits:1},
    {key:'thighProximalL',label:'Coxa proximal • E',unit:'cm',digits:1},
    {key:'thighMedialR',label:'Coxa medial • D',unit:'cm',digits:1},
    {key:'thighMedialL',label:'Coxa medial • E',unit:'cm',digits:1},
    {key:'thighDistalR',label:'Coxa distal • D',unit:'cm',digits:1},
    {key:'thighDistalL',label:'Coxa distal • E',unit:'cm',digits:1},
    {key:'calfR',label:'Panturrilha • D',unit:'cm',digits:1},
    {key:'calfL',label:'Panturrilha • E',unit:'cm',digits:1}
  ];


  // Etapa 3A — mapa visual interno. O guia orienta padronização de coleta e não
  // substitui o protocolo profissional escolhido pelo Studio.
  const ASSESSMENT_ANATOMICAL_GUIDE=[
    {key:'neck',group:'trunk',label:'Pescoço',short:'Pescoço',defaultView:'front',bilateral:false,focus:{front:{x:150,y:82,w:48,h:12},back:{x:150,y:82,w:48,h:12}},point:'Circunferência na base do pescoço, logo abaixo da região laríngea.',tape:'Mantenha a fita horizontal, nivelada e apenas encostada na pele.',standard:'Cabeça neutra, ombros relaxados e o mesmo ponto em todas as reavaliações.'},
    {key:'chest',group:'trunk',label:'Peitoral',short:'Peitoral',defaultView:'front',bilateral:false,focus:{front:{x:150,y:132,w:92,h:13},back:{x:150,y:132,w:92,h:13}},point:'Circunferência horizontal do tórax no nível padronizado pelo Studio.',tape:'Passe a fita ao redor do tórax sem inclinar e sem comprimir.',standard:'Registre sempre no mesmo momento respiratório e com braços relaxados.'},
    {key:'waist',group:'trunk',label:'Cintura',short:'Cintura',defaultView:'front',bilateral:false,focus:{front:{x:150,y:176,w:76,h:12},back:{x:150,y:176,w:76,h:12}},point:'Região entre a última costela palpável e a crista ilíaca; use o mesmo marco em todas as coletas.',tape:'Fita paralela ao chão, ajustada sem apertar o tecido.',standard:'Abdômen relaxado, postura ereta e respiração natural.'},
    {key:'abdomen',group:'trunk',label:'Abdômen',short:'Abdômen',defaultView:'front',bilateral:false,focus:{front:{x:150,y:198,w:82,h:12},back:{x:150,y:198,w:82,h:12}},point:'Nível abdominal de referência adotado pelo Studio, visualizado na linha umbilical do guia.',tape:'Circunde o tronco mantendo a fita horizontal e sem compressão.',standard:'Não recolher o abdômen; repetir exatamente o mesmo nível nas reavaliações.'},
    {key:'hip',group:'trunk',label:'Quadril',short:'Quadril',defaultView:'back',bilateral:false,focus:{front:{x:150,y:226,w:104,h:14},back:{x:150,y:226,w:104,h:14}},point:'Maior circunferência do quadril/glúteos.',tape:'Passe a fita no ponto de maior projeção mantendo-a nivelada.',standard:'Pés próximos, peso distribuído e postura neutra.'},
    {key:'bicepsRelaxed',group:'upper',label:'Bíceps relaxado',short:'Bíceps relax.',defaultView:'front',bilateral:true,focus:{front:{R:{x:96,y:137,w:22,h:34},L:{x:204,y:137,w:22,h:34}},back:{R:{x:204,y:137,w:22,h:34},L:{x:96,y:137,w:22,h:34}}},point:'Região média do braço no ponto adotado para a circunferência do bíceps relaxado.',tape:'Fita perpendicular ao eixo do braço, sem comprimir.',standard:'Braço solto ao lado do corpo; repita o mesmo ponto e postura.'},
    {key:'bicepsContracted',group:'upper',label:'Bíceps contraído',short:'Bíceps contraído',defaultView:'front',bilateral:true,focus:{front:{R:{x:96,y:137,w:24,h:36},L:{x:204,y:137,w:24,h:36}},back:{R:{x:204,y:137,w:24,h:36},L:{x:96,y:137,w:24,h:36}}},point:'Maior circunferência do braço durante contração padronizada.',tape:'Posicione a fita perpendicular ao braço sem deformar o contorno.',standard:'Use sempre a mesma posição de braço e o mesmo nível de contração.'},
    {key:'wrist',group:'upper',label:'Punho',short:'Punho',defaultView:'front',bilateral:true,focus:{front:{R:{x:73,y:222,w:20,h:16},L:{x:227,y:222,w:20,h:16}},back:{R:{x:227,y:222,w:20,h:16},L:{x:73,y:222,w:20,h:16}}},point:'Menor circunferência do punho, imediatamente proximal às proeminências ósseas.',tape:'Fita justa, horizontal e sem compressão.',standard:'Mão e antebraço relaxados.'},
    {key:'thighProximal',group:'lower',label:'Coxa proximal',short:'Coxa proximal',defaultView:'front',bilateral:true,focus:{front:{R:{x:132,y:263,w:34,h:18},L:{x:168,y:263,w:34,h:18}},back:{R:{x:168,y:263,w:34,h:18},L:{x:132,y:263,w:34,h:18}}},point:'Porção superior da coxa, próxima à raiz, no nível definido pelo protocolo do Studio.',tape:'Fita horizontal ao redor da coxa, sem compressão.',standard:'Pés apoiados e musculatura relaxada; preserve a mesma distância de referência.'},
    {key:'thighMedial',group:'lower',label:'Coxa medial',short:'Coxa medial',defaultView:'front',bilateral:true,focus:{front:{R:{x:134,y:306,w:31,h:18},L:{x:166,y:306,w:31,h:18}},back:{R:{x:166,y:306,w:31,h:18},L:{x:134,y:306,w:31,h:18}}},point:'Região média da coxa entre a raiz da coxa e o joelho.',tape:'Fita perpendicular ao eixo da coxa.',standard:'Defina e repita o mesmo ponto médio em todas as avaliações.'},
    {key:'thighDistal',group:'lower',label:'Coxa distal',short:'Coxa distal',defaultView:'front',bilateral:true,focus:{front:{R:{x:136,y:345,w:28,h:17},L:{x:164,y:345,w:28,h:17}},back:{R:{x:164,y:345,w:28,h:17},L:{x:136,y:345,w:28,h:17}}},point:'Porção inferior da coxa, acima do joelho, no nível padronizado pelo Studio.',tape:'Fita horizontal, sem inclinação e sem apertar.',standard:'Mantenha a mesma distância do joelho nas reavaliações.'},
    {key:'calf',group:'lower',label:'Panturrilha',short:'Panturrilha',defaultView:'back',bilateral:true,focus:{front:{R:{x:137,y:400,w:25,h:25},L:{x:163,y:400,w:25,h:25}},back:{R:{x:163,y:400,w:25,h:25},L:{x:137,y:400,w:25,h:25}}},point:'Maior circunferência da panturrilha.',tape:'Mova a fita até encontrar o maior perímetro e mantenha-a horizontal.',standard:'Apoio e distribuição de peso semelhantes em todas as coletas.'}
  ];
  const ASSESSMENT_GUIDE_GROUPS=[['trunk','Tronco'],['upper','Membros superiores'],['lower','Membros inferiores']];
  const ANATOMICAL_GUIDE_MODEL_FRONT='data:image/webp;base64,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';
  const ANATOMICAL_GUIDE_MODEL_BACK='data:image/webp;base64,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';
  function anatomicalGuideItem(key){return ASSESSMENT_ANATOMICAL_GUIDE.find(x=>x.key===String(key||''))||ASSESSMENT_ANATOMICAL_GUIDE.find(x=>x.key==='waist')}
  function anatomicalGuideFocus(item,view,side){
    const base=item?.focus?.[view]||item?.focus?.front;if(!base)return null;
    return item.bilateral?(base[side]||base.R):base;
  }
  function anatomicalGuideFigure(item,view='front',side='R'){
    const back=view==='back';
    const label=back?'VISTA POSTERIOR':'VISTA FRONTAL';
    const leftCode=back?'E':'D';
    const rightCode=back?'D':'E';
    const src=back?ANATOMICAL_GUIDE_MODEL_BACK:ANATOMICAL_GUIDE_MODEL_FRONT;
    const focus=anatomicalGuideFocus(item,view,side)||{x:150,y:176,w:76,h:12};
    const left=Math.max(4,((focus.x-focus.w/2-8)/300)*100);
    const top=Math.max(3,((focus.y-focus.h/2-8)/470)*100);
    const width=Math.min(92,((focus.w+16)/300)*100);
    const height=Math.min(26,((focus.h+16)/470)*100);
    return `<figure class="anatomy-photo-figure ${back?'is-back':'is-front'}" role="img" aria-label="Modelo clínico premium ${back?'posterior':'frontal'} com destaque ativo da medida ${escapeHTML(item.label)}${item.bilateral?` no lado ${side==='L'?'esquerdo':'direito'} do aluno`:''}">
      <div class="anatomy-photo-stage">
        <img class="anatomy-photo anatomy-photo-base" src="${src}" alt="${back?'Vista posterior':'Vista frontal'} do guia anatômico"/>
        <span class="anatomy-photo-matte" aria-hidden="true"></span>
        <span class="anatomy-photo-focus-ring" style="left:${left.toFixed(2)}%;top:${top.toFixed(2)}%;width:${width.toFixed(2)}%;height:${height.toFixed(2)}%" aria-hidden="true"></span>
        <span class="anatomy-photo-fade anatomy-photo-fade-left" aria-hidden="true"></span>
        <span class="anatomy-photo-fade anatomy-photo-fade-right" aria-hidden="true"></span>
      </div>
      <div class="anatomy-photo-badge is-left" aria-hidden="true"><strong>${leftCode}</strong><span>Lado do aluno</span></div>
      <div class="anatomy-photo-badge is-right" aria-hidden="true"><strong>${rightCode}</strong><span>Lado do aluno</span></div>
      <div class="anatomy-photo-active-side ${item.bilateral?'':'is-neutral'}">${item.bilateral?`Faixa ativa: ${escapeHTML(item.label)} • lado ${side==='L'?'esquerdo':'direito'} do aluno.`:`Faixa ativa: ${escapeHTML(item.label)} • medida central.`}</div>
      <figcaption class="anatomy-photo-caption">${label}</figcaption>
    </figure>`;
  }
  function closeAnatomicalGuide(){document.querySelector('#anatomicalGuideLayer')?.remove();document.body.classList.remove('anatomical-guide-open')}
  function openAnatomicalGuide(initialKey='waist',initialSide='R'){
    closeAnatomicalGuide();
    const returnFocus=document.activeElement;
    let item=anatomicalGuideItem(initialKey),group=item.group,view=item.defaultView||'front',side=item.bilateral&&(initialSide==='L'?'L':'R')||'R';
    const layer=document.createElement('div');layer.id='anatomicalGuideLayer';layer.className='anatomical-guide-layer';layer.innerHTML=`<div class="anatomical-guide-shell" role="dialog" aria-modal="true" aria-labelledby="anatomicalGuideTitle"><header class="anatomical-guide-header"><div><span class="section-overline">ETAPA 3 • GUIA PREMIUM</span><h3 id="anatomicalGuideTitle">Guia anatômico de mensuração</h3><p>Pontos visuais para repetir a coleta com o mesmo padrão.</p></div><button type="button" class="anatomical-guide-close" aria-label="Fechar guia">${icon('x')}</button></header><div class="anatomical-guide-group-tabs" id="anatomicalGuideGroups"></div><div class="anatomical-guide-layout"><section class="anatomical-guide-visual"><div class="anatomical-guide-view-tabs"><button type="button" data-anatomy-view="front">Frente</button><button type="button" data-anatomy-view="back">Costas</button></div><div id="anatomicalGuideFigure"></div><div id="anatomicalGuideSide"></div></section><section class="anatomical-guide-content"><div class="anatomical-guide-picker"><span>Medida selecionada</span><div id="anatomicalGuideMeasures"></div></div><article class="anatomical-guide-info" id="anatomicalGuideInfo"></article><div class="anatomical-guide-protocol"><strong>Padronização acima de tudo</strong><span>Protocolos antropométricos podem adotar referências diferentes. Escolha o padrão do Studio e repita exatamente o mesmo ponto, postura e condição nas reavaliações.</span></div></section></div></div>`;
    document.body.appendChild(layer);document.body.classList.add('anatomical-guide-open');
    const render=()=>{
      const groups=$('#anatomicalGuideGroups',layer),fig=$('#anatomicalGuideFigure',layer),measures=$('#anatomicalGuideMeasures',layer),info=$('#anatomicalGuideInfo',layer),sideBox=$('#anatomicalGuideSide',layer);
      groups.innerHTML=ASSESSMENT_GUIDE_GROUPS.map(([key,label])=>`<button type="button" class="${group===key?'active':''}" data-anatomy-group="${key}">${escapeHTML(label)}</button>`).join('');
      measures.innerHTML=ASSESSMENT_ANATOMICAL_GUIDE.filter(x=>x.group===group).map(x=>`<button type="button" class="${item.key===x.key?'active':''}" data-anatomy-measure="${x.key}">${escapeHTML(x.short||x.label)}</button>`).join('');
      $$('[data-anatomy-view]',layer).forEach(b=>b.classList.toggle('active',b.dataset.anatomyView===view));
      fig.innerHTML=anatomicalGuideFigure(item,view,side);
      sideBox.innerHTML=item.bilateral?`<div class="anatomical-guide-side-toggle"><span>Lado do aluno</span><button type="button" class="${side==='R'?'active':''}" data-anatomy-side="R">Direito</button><button type="button" class="${side==='L'?'active':''}" data-anatomy-side="L">Esquerdo</button><small>D/E acompanha o corpo do aluno, não quem observa.</small></div>`:`<div class="anatomical-guide-side-note"><strong>Sem lateralidade</strong><span>D/E identifica o lado do aluno em cada vista.</span></div>`;
      info.innerHTML=`<div class="anatomical-guide-info-head"><span class="anatomical-guide-index">${String(ASSESSMENT_ANATOMICAL_GUIDE.findIndex(x=>x.key===item.key)+1).padStart(2,'0')}</span><div><span>${escapeHTML(ASSESSMENT_GUIDE_GROUPS.find(([k])=>k===item.group)?.[1]||'Mensuração')}</span><strong>${escapeHTML(item.label)}${item.bilateral?` • ${side==='R'?'Direito':'Esquerdo'}`:''}</strong></div></div><div class="anatomical-guide-rule"><span>PONTO</span><p>${escapeHTML(item.point)}</p></div><div class="anatomical-guide-rule"><span>FITA</span><p>${escapeHTML(item.tape)}</p></div><div class="anatomical-guide-rule"><span>REPETIÇÃO</span><p>${escapeHTML(item.standard)}</p></div>`;
      $$('[data-anatomy-group]',layer).forEach(b=>b.onclick=()=>{group=b.dataset.anatomyGroup;item=ASSESSMENT_ANATOMICAL_GUIDE.find(x=>x.group===group)||item;view=item.defaultView||'front';side='R';render()});
      $$('[data-anatomy-measure]',layer).forEach(b=>b.onclick=()=>{item=anatomicalGuideItem(b.dataset.anatomyMeasure);group=item.group;view=item.defaultView||view;side='R';render()});
      $$('[data-anatomy-view]',layer).forEach(b=>b.onclick=()=>{view=b.dataset.anatomyView;render()});
      $$('[data-anatomy-side]',layer).forEach(b=>b.onclick=()=>{side=b.dataset.anatomySide;render()});
    };
    layer.querySelector('.anatomical-guide-close').addEventListener('click',()=>{closeAnatomicalGuide();returnFocus?.focus?.()});
    layer.addEventListener('click',e=>{if(e.target===layer){closeAnatomicalGuide();returnFocus?.focus?.()}});
    layer.addEventListener('keydown',e=>{if(e.key==='Escape'){closeAnatomicalGuide();returnFocus?.focus?.()}});
    render();setTimeout(()=>layer.querySelector('.anatomical-guide-close')?.focus(),0);
  }
  function assessmentNumber(value,digits=1){
    const n=Number(value);if(!Number.isFinite(n))return '—';
    return new Intl.NumberFormat('pt-BR',{minimumFractionDigits:digits,maximumFractionDigits:digits}).format(n);
  }
  function parseAssessmentNumber(value){
    const raw=String(value??'').trim().replace(',','.');if(!raw)return null;
    const n=Number(raw);return Number.isFinite(n)&&n>0?n:null;
  }
  function ageOnDate(birthDate,referenceDate){
    const birth=parseLocalDate(birthDate),ref=parseLocalDate(referenceDate)||todayNoon();if(!birth)return null;
    let age=ref.getFullYear()-birth.getFullYear();const m=ref.getMonth()-birth.getMonth();
    if(m<0||(m===0&&ref.getDate()<birth.getDate()))age--;return Math.max(0,age);
  }
  function assessmentsForStudent(studentId){
    return (state.physicalAssessments||[]).filter(a=>String(a.studentId)===String(studentId)).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
  }
  function latestAssessment(studentId){return assessmentsForStudent(studentId)[0]||null}
  function assessmentBMI(a){
    const kg=Number(a?.weight),cm=Number(a?.heightCm);if(!(kg>0&&cm>0))return null;
    const m=cm/100;return kg/(m*m);
  }
  function assessmentIRCQ(a){
    const waist=Number(a?.measurements?.waist),hip=Number(a?.measurements?.hip);return waist>0&&hip>0?waist/hip:null;
  }
  function bmiClassification(a,student){
    const bmi=assessmentBMI(a),age=ageOnDate(student?.birthDate,a?.date);if(bmi==null)return {label:'Sem cálculo',tone:'neutral',note:'Informe peso e altura.'};
    if(age==null)return {label:'Sem classificação',tone:'neutral',note:'Data de nascimento necessária.'};
    if(age<20)return {label:'Avaliar por idade/sexo',tone:'neutral',note:'A escala adulta não é aplicada antes dos 20 anos.'};
    if(bmi<18.5)return {label:'Baixo peso',tone:'warn',note:'Referência adulta OMS.'};
    if(bmi<25)return {label:'Faixa adequada',tone:'ok',note:'Referência adulta OMS.'};
    if(bmi<30)return {label:'Sobrepeso',tone:'warn',note:'Referência adulta OMS.'};
    if(bmi<35)return {label:'Obesidade I',tone:'danger',note:'Referência adulta OMS.'};
    if(bmi<40)return {label:'Obesidade II',tone:'danger',note:'Referência adulta OMS.'};
    return {label:'Obesidade III',tone:'danger',note:'Referência adulta OMS.'};
  }
  function ircqClassification(a,student){
    const ratio=assessmentIRCQ(a),age=ageOnDate(student?.birthDate,a?.date);if(ratio==null)return {label:'Sem cálculo',tone:'neutral',note:'Informe cintura e quadril.'};
    if(age==null||age<20)return {label:'Sem escala adulta',tone:'neutral',note:'Classificação automática somente para adultos.'};
    const sex=String(a?.referenceSex||'');if(!['male','female'].includes(sex))return {label:'Sem classificação',tone:'neutral',note:'Selecione o sexo de referência para aplicar o ponto de corte.'};
    const cutoff=sex==='male'?0.90:0.85;
    return ratio>=cutoff?{label:'Acima da referência',tone:'danger',note:`Ponto de corte: ${assessmentNumber(cutoff,2)}.`}:{label:'Dentro da referência',tone:'ok',note:`Ponto de corte: ${assessmentNumber(cutoff,2)}.`};
  }
  function assessmentStatusPill(result){return `<span class="status ${result.tone}">${escapeHTML(result.label)}</span>`}
  function assessmentMetric(value,label,detail='',tone=''){
    return `<article class="assessment-result ${tone}"><span>${escapeHTML(label)}</span><strong>${escapeHTML(value)}</strong>${detail?`<small>${escapeHTML(detail)}</small>`:''}</article>`;
  }
  function assessmentOptionLabel(options,value){return options.find(([key])=>key===String(value||''))?.[1]||'Não definido'}
  function assessmentSelectOptions(options,value){return options.map(([key,label])=>`<option value="${escapeHTML(key)}" ${String(value||'')===key?'selected':''}>${escapeHTML(label)}</option>`).join('')}
  function assessmentContextChips(a){
    const objective=assessmentOptionLabel(ASSESSMENT_OBJECTIVES,a?.objective),stage=assessmentOptionLabel(ASSESSMENT_STAGES,a?.stage);
    return `<div class="assessment-context-chips"><span><b>Objetivo</b>${escapeHTML(objective)}</span><span><b>Estágio</b>${escapeHTML(stage)}</span></div>`;
  }
  function assessmentMetricConfig(key){return ASSESSMENT_EVOLUTION_METRICS.find(m=>m.key===key)||ASSESSMENT_EVOLUTION_METRICS[0]}
  function assessmentValue(a,key){
    if(!a)return null;
    if(key==='weight')return Number(a.weight)>0?Number(a.weight):null;
    if(key==='bmi')return assessmentBMI(a);
    if(key==='ircq')return assessmentIRCQ(a);
    const n=Number(a.measurements?.[key]);return n>0?n:null;
  }
  function assessmentSeries(studentId,key){
    return assessmentsForStudent(studentId).slice().reverse().map(a=>({date:a.date,value:assessmentValue(a,key),assessment:a})).filter(p=>Number.isFinite(p.value));
  }
  function assessmentShortDate(date){
    const d=parseLocalDate(date);return d?new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit'}).format(d):'—';
  }
  function assessmentDelta(current,base,digits=1,unit=''){
    const valid=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));if(!valid(current)||!valid(base))return {text:'Sem comparação',dir:'flat',raw:null};
    const c=Number(current),b=Number(base);
    const diff=c-b,eps=Math.pow(10,-digits)/2;if(Math.abs(diff)<eps)return {text:`→ 0${unit?` ${unit}`:''}`,dir:'flat',raw:0};
    return {text:`${diff>0?'↑':'↓'} ${assessmentNumber(Math.abs(diff),digits)}${unit?` ${unit}`:''}`,dir:diff>0?'up':'down',raw:diff};
  }
  function assessmentTrendCard(label,current,base,unit='',digits=1,caption='vs. anterior'){
    const d=assessmentDelta(current,base,digits,unit),valid=current!==null&&current!==undefined&&current!==''&&Number.isFinite(Number(current)),value=valid?`${assessmentNumber(current,digits)}${unit?` ${unit}`:''}`:'—';
    return `<article class="assessment-trend-card"><span>${escapeHTML(label)}</span><strong>${escapeHTML(value)}</strong><small class="${d.dir}">${escapeHTML(d.text)} <i>${escapeHTML(caption)}</i></small></article>`;
  }
  function assessmentLineChart(series,config){
    if(series.length<2)return `<div class="assessment-chart-empty"><strong>Dados insuficientes para o gráfico</strong><span>São necessários pelo menos dois registros deste indicador.</span></div>`;
    const width=680,height=270,padL=54,padR=22,padT=24,padB=48,vals=series.map(p=>p.value),rawMin=Math.min(...vals),rawMax=Math.max(...vals),spread=Math.max(rawMax-rawMin,Math.max(Math.abs(rawMax),1)*.06),min=rawMin-spread*.22,max=rawMax+spread*.22,range=Math.max(max-min,1e-9),innerW=width-padL-padR,innerH=height-padT-padB;
    const x=i=>padL+(series.length===1?innerW/2:(i/(series.length-1))*innerW),y=v=>padT+((max-v)/range)*innerH,points=series.map((p,i)=>`${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
    const ticks=4,grid=Array.from({length:ticks},(_,i)=>{const ratio=i/(ticks-1),yy=padT+ratio*innerH,val=max-ratio*range;return `<line x1="${padL}" y1="${yy.toFixed(1)}" x2="${width-padR}" y2="${yy.toFixed(1)}" class="assessment-chart-grid"/><text x="${padL-9}" y="${(yy+4).toFixed(1)}" text-anchor="end" class="assessment-chart-ylabel">${escapeHTML(assessmentNumber(val,config.digits))}</text>`}).join('');
    const every=Math.max(1,Math.ceil(series.length/5)),labels=series.map((p,i)=>((i%every===0||i===series.length-1)?`<text x="${x(i).toFixed(1)}" y="${height-15}" text-anchor="middle" class="assessment-chart-xlabel">${escapeHTML(assessmentShortDate(p.date))}</text>`:'')).join('');
    const dots=series.map((p,i)=>`<circle cx="${x(i).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="5" class="assessment-chart-dot"><title>${escapeHTML(fmtDate(p.date))}: ${escapeHTML(assessmentNumber(p.value,config.digits))}${config.unit?` ${escapeHTML(config.unit)}`:''}</title></circle>`).join('');
    const pointLabels=series.length<=4?series.map((p,i)=>`<text x="${x(i).toFixed(1)}" y="${(y(p.value)-11).toFixed(1)}" text-anchor="middle" class="assessment-chart-point-label">${escapeHTML(assessmentNumber(p.value,config.digits))}</text>`).join(''):'';
    const compactSeries=series.length<=4;
    return `<div class="assessment-chart-scroll ${compactSeries?'is-compact':''}"><svg class="assessment-line-chart ${compactSeries?'compact-series':''}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Evolução de ${escapeHTML(config.label)}">${grid}<polyline points="${points}" class="assessment-chart-line"/>${dots}${pointLabels}${labels}</svg></div>`;
  }
  function assessmentEvolutionTable(series,config){
    return `<div class="assessment-evolution-table">${series.map((p,i)=>{const prev=series[i-1]?.value,d=assessmentDelta(p.value,prev,config.digits,config.unit),isFirst=i===0,isCurrent=i===series.length-1;const note=isFirst?'Primeiro registro':isCurrent?`${escapeHTML(d.text)} • Registro atual`:escapeHTML(d.text);return `<div class="${isFirst?'is-first':''} ${isCurrent?'is-current':''}"><span>${escapeHTML(fmtDate(p.date))}</span><strong>${escapeHTML(assessmentNumber(p.value,config.digits))}${config.unit?` ${escapeHTML(config.unit)}`:''}</strong><small class="${isFirst?'flat':d.dir}">${note}</small></div>`}).join('')}</div>`;
  }
  function assessmentProfileCardHTML(student){
    const rows=assessmentsForStudent(student.id),a=rows[0];
    if(!a)return `<section class="profile-assessment-card empty-assessment"><div class="profile-assessment-head"><div><span class="section-overline">AVALIAÇÃO FÍSICA</span><strong>Ainda sem avaliação</strong><p>Opcional. O cadastro e todas as demais funções continuam normalmente.</p></div><span class="assessment-emblem">${icon('chart')}</span></div><button class="btn btn-secondary btn-small" id="historyAssessmentNew">${icon('plus')} Criar primeira avaliação</button></section>`;
    const bmi=assessmentBMI(a),ircq=assessmentIRCQ(a),bc=bmiClassification(a,student),rc=ircqClassification(a,student);
    return `<section class="profile-assessment-card"><div class="profile-assessment-head"><div><span class="section-overline">AVALIAÇÃO FÍSICA</span><strong>Última avaliação • ${fmtDate(a.date)}</strong><p>${rows.length} ${rows.length===1?'registro':'registros'} no histórico.</p></div><span class="assessment-emblem">${icon('chart')}</span></div>${assessmentContextChips(a)}<div class="assessment-profile-metrics">${assessmentMetric(bmi==null?'—':assessmentNumber(bmi,1),'IMC',bc.label,bc.tone)}${assessmentMetric(ircq==null?'—':assessmentNumber(ircq,2),'IRCQ',rc.label,rc.tone)}${assessmentMetric(a.weight?`${assessmentNumber(a.weight,1)} kg`:'—','Peso')}${assessmentMetric(a.measurements?.waist?`${assessmentNumber(a.measurements.waist,1)} cm`:'—','Cintura')}</div><div class="profile-assessment-actions"><button class="btn btn-primary btn-small" id="historyAssessmentNew">${icon('plus')} Nova avaliação</button><button class="btn btn-secondary btn-small" id="historyAssessmentHistory">Histórico</button>${rows.length>1?`<button class="btn btn-secondary btn-small" id="historyAssessmentEvolution">${icon('chart')} Evolução física</button>`:''}</div></section>`;
  }
  function renderAssessments(){
    const students=[...state.students].sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'pt-BR'));
    const withAssessment=students.filter(s=>latestAssessment(s.id)).length,total=(state.physicalAssessments||[]).filter(a=>students.some(s=>String(s.id)===String(a.studentId))).length,withEvolution=students.filter(s=>assessmentsForStudent(s.id).length>1).length;
    viewEl.innerHTML=`<section class="assessment-hero"><div><span class="section-overline">AVALIAÇÃO FÍSICA</span><h2>Perímetros & evolução</h2><p>Avaliação opcional, histórico comparável e leitura visual da evolução — sem interferir nas demais áreas do app.</p></div><span class="assessment-hero-icon">${icon('chart')}</span></section>
      <section class="metrics assessment-top-metrics">${metricCard('users',students.length,'Alunos cadastrados')}${metricCard('check',withAssessment,'Com avaliação','good')}${metricCard('chart',total,'Avaliações salvas')}${metricCard('chart',withEvolution,'Com evolução')}</section>
      <div class="assessment-guidance"><strong>Base antropométrica responsável</strong><span>IMC = peso ÷ altura² • IRCQ = cintura ÷ quadril. Os gráficos mostram tendência numérica; objetivo e estágio são definidos pelo profissional. Os indicadores são de triagem, não diagnóstico clínico.</span></div>
      <button type="button" class="assessment-guide-entry" id="assessmentGuideEntry"><span class="assessment-guide-entry-icon">${icon('body')}</span><span><b>Guia anatômico premium</b><small>Consulte os pontos de mensuração antes ou durante a avaliação.</small></span><i>${icon('eye')}</i></button>
      <div class="section-head"><div><h3>Alunos</h3><p>Selecione um aluno para avaliar, consultar histórico ou acompanhar evolução.</p></div></div>
      <div class="search-wrap">${icon('search')}<input id="assessmentSearch" placeholder="Buscar aluno por nome" autocomplete="off" /></div>
      <div class="tabs assessment-tabs"><button class="tab active" data-assessment-filter="all">Todos</button><button class="tab" data-assessment-filter="done">Avaliados</button><button class="tab" data-assessment-filter="evolution">Com evolução</button><button class="tab" data-assessment-filter="pending">Sem avaliação</button></div>
      <section id="assessmentStudentList" class="cards assessment-student-list"></section>`;
    let filter='all';
    const draw=()=>{const q=String($('#assessmentSearch')?.value||'').trim().toLocaleLowerCase('pt-BR');const list=students.filter(s=>{const rows=assessmentsForStudent(s.id),has=Boolean(rows.length);if(filter==='done'&&!has)return false;if(filter==='evolution'&&rows.length<2)return false;if(filter==='pending'&&has)return false;return !q||String(s.name||'').toLocaleLowerCase('pt-BR').includes(q)});$('#assessmentStudentList').innerHTML=list.length?list.map(s=>{const rows=assessmentsForStudent(s.id),a=rows[0],bmi=a?assessmentBMI(a):null,ircq=a?assessmentIRCQ(a):null,bc=a?bmiClassification(a,s):null,rc=a?ircqClassification(a,s):null;return `<article class="card assessment-student-card"><div class="assessment-student-main"><div class="student-photo tiny-photo">${s.photoData?`<img src="${s.photoData}" alt="" />`:`<span>${escapeHTML((s.name||'?').charAt(0).toUpperCase())}</span>`}</div><div><strong>${escapeHTML(s.name)}</strong><span>${a?`Última avaliação: ${fmtDate(a.date)} • ${rows.length} ${rows.length===1?'registro':'registros'}`:'Nenhuma avaliação registrada'}${s.active===false?' • aluno inativo':''}</span>${a?`${assessmentContextChips(a)}<div class="assessment-inline-status"><span>IMC <b>${bmi==null?'—':assessmentNumber(bmi,1)}</b> ${assessmentStatusPill(bc)}</span><span>IRCQ <b>${ircq==null?'—':assessmentNumber(ircq,2)}</b> ${assessmentStatusPill(rc)}</span></div>`:''}</div></div><div class="assessment-student-actions"><button class="btn ${a?'btn-secondary':'btn-primary'} btn-small js-assessment-new" data-id="${s.id}">${icon('plus')} ${a?'Nova':'Avaliar'}</button>${a?`<button class="btn btn-secondary btn-small js-assessment-history" data-id="${s.id}">Histórico</button>`:''}${rows.length>1?`<button class="btn btn-secondary btn-small js-assessment-evolution" data-id="${s.id}">${icon('chart')} Evolução</button>`:''}</div></article>`}).join(''):emptyState('Nenhum aluno neste filtro','Ajuste a busca ou escolha outro filtro.');$$('.js-assessment-new',viewEl).forEach(b=>b.addEventListener('click',()=>openAssessmentModal(b.dataset.id)));$$('.js-assessment-history',viewEl).forEach(b=>b.addEventListener('click',()=>openAssessmentHistory(b.dataset.id)));$$('.js-assessment-evolution',viewEl).forEach(b=>b.addEventListener('click',()=>openAssessmentEvolution(b.dataset.id)));};
    $('#assessmentGuideEntry')?.addEventListener('click',()=>openAnatomicalGuide('waist'));
    $('#assessmentSearch')?.addEventListener('input',draw);$$('[data-assessment-filter]',viewEl).forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.assessmentFilter;$$('[data-assessment-filter]',viewEl).forEach(x=>x.classList.toggle('active',x===b));draw()}));draw();
  }
  function assessmentInput(name,label,value='',required=false,guideKey='',guideSide=''){
    const guide=guideKey?`<button type="button" class="assessment-guide-mini" data-anatomical-key="${escapeHTML(guideKey)}" ${guideSide?`data-anatomical-side="${guideSide}"`:''} aria-label="Abrir guia de ${escapeHTML(label.replace(' *',''))}" title="Ver ponto de mensuração">${icon('body')}</button>`:'';
    return `<div class="field"><div class="assessment-field-label"><label>${escapeHTML(label)}</label>${guide}</div><div class="assessment-input-wrap"><input name="${name}" type="number" inputmode="decimal" min="1" max="300" step="0.1" ${required?'required':''} value="${value??''}" placeholder="0,0" /><span>cm</span></div></div>`
  }
  function assessmentPair(title,guideKey,rightName,leftName,rightValue='',leftValue=''){
    return `<div class="assessment-pair"><div class="assessment-pair-title"><div><strong>${escapeHTML(title)}</strong><span>Direito / Esquerdo</span></div><button type="button" class="assessment-guide-pair" data-anatomical-key="${escapeHTML(guideKey)}" aria-label="Abrir guia de ${escapeHTML(title)}">${icon('body')} Guia</button></div><div class="assessment-pair-grid">${assessmentInput(rightName,'Direito',rightValue,false,guideKey,'R')}${assessmentInput(leftName,'Esquerdo',leftValue,false,guideKey,'L')}</div></div>`;
  }
  function openAssessmentModal(studentId,assessmentId=null){
    const student=state.students.find(s=>String(s.id)===String(studentId));if(!student)return;
    const existing=assessmentId?(state.physicalAssessments||[]).find(a=>String(a.id)===String(assessmentId)):null,last=latestAssessment(studentId),m=existing?.measurements||{};
    const defaultSex=existing?.referenceSex||last?.referenceSex||'',defaultObjective=existing?.objective??last?.objective??'',defaultStage=existing?.stage??last?.stage??(last?'':'initial');
    openModal(`${existing?'Editar':'Nova'} avaliação • ${student.name}`,`<form id="physicalAssessmentForm" class="assessment-form"><div class="assessment-form-intro"><div class="student-photo tiny-photo">${student.photoData?`<img src="${student.photoData}" alt="" />`:`<span>${escapeHTML((student.name||'?').charAt(0).toUpperCase())}</span>`}</div><div><strong>${escapeHTML(student.name)}</strong><span>${ageFromBirth(student.birthDate)??'—'} anos • avaliação opcional</span></div><button type="button" class="assessment-guide-main" data-anatomical-key="waist">${icon('body')} <span>Guia anatômico</span></button></div><div class="notice">Preencha os dados disponíveis. Peso, altura, cintura e quadril sustentam os resultados automáticos. Objetivo e estágio são contextos profissionais e não alteram os cálculos.</div>
      <section class="assessment-form-section"><div class="assessment-form-section-head"><span>01</span><div><strong>Dados da avaliação</strong><small>Contexto e indicadores</small></div></div><div class="form-grid two"><div class="field"><label>Data da avaliação *</label><input name="date" type="date" required value="${escapeHTML(existing?.date||isoToday())}" /></div><div class="field"><label>Sexo de referência para IRCQ</label><select name="referenceSex"><option value="" ${!defaultSex?'selected':''}>Não informar</option><option value="male" ${defaultSex==='male'?'selected':''}>Masculino</option><option value="female" ${defaultSex==='female'?'selected':''}>Feminino</option></select><small>Usado apenas para aplicar o ponto de corte adulto do IRCQ.</small></div><div class="field"><label>Objetivo atual</label><select name="objective">${assessmentSelectOptions(ASSESSMENT_OBJECTIVES,defaultObjective)}</select></div><div class="field"><label>Estágio atual</label><select name="stage">${assessmentSelectOptions(ASSESSMENT_STAGES,defaultStage)}</select><small>Definido pelo profissional; o app não classifica automaticamente.</small></div><div class="field"><label>Peso *</label><div class="assessment-input-wrap"><input name="weight" type="number" inputmode="decimal" min="10" max="400" step="0.1" required value="${existing?.weight??''}" placeholder="0,0" /><span>kg</span></div></div><div class="field"><label>Altura *</label><div class="assessment-input-wrap"><input name="heightCm" type="number" inputmode="decimal" min="80" max="250" step="0.1" required value="${existing?.heightCm??last?.heightCm??''}" placeholder="0,0" /><span>cm</span></div></div></div><div id="assessmentLiveResults" class="assessment-live-results"></div></section>
      <section class="assessment-form-section"><div class="assessment-form-section-head"><span>02</span><div><strong>Tronco</strong><small>Perímetros em centímetros</small></div></div><div class="form-grid two">${assessmentInput('neck','Pescoço',m.neck,false,'neck')}${assessmentInput('chest','Peitoral',m.chest,false,'chest')}${assessmentInput('waist','Cintura *',m.waist,true,'waist')}${assessmentInput('abdomen','Abdômen',m.abdomen,false,'abdomen')}${assessmentInput('hip','Quadril *',m.hip,true,'hip')}</div></section>
      <section class="assessment-form-section"><div class="assessment-form-section-head"><span>03</span><div><strong>Membros superiores</strong><small>Direito e esquerdo</small></div></div>${assessmentPair('Bíceps relaxado','bicepsRelaxed','bicepsRelaxedR','bicepsRelaxedL',m.bicepsRelaxedR,m.bicepsRelaxedL)}${assessmentPair('Bíceps contraído','bicepsContracted','bicepsContractedR','bicepsContractedL',m.bicepsContractedR,m.bicepsContractedL)}${assessmentPair('Punho','wrist','wristR','wristL',m.wristR,m.wristL)}</section>
      <section class="assessment-form-section"><div class="assessment-form-section-head"><span>04</span><div><strong>Membros inferiores</strong><small>Direito e esquerdo</small></div></div>${assessmentPair('Coxa proximal','thighProximal','thighProximalR','thighProximalL',m.thighProximalR,m.thighProximalL)}${assessmentPair('Coxa medial','thighMedial','thighMedialR','thighMedialL',m.thighMedialR,m.thighMedialL)}${assessmentPair('Coxa distal','thighDistal','thighDistalR','thighDistalL',m.thighDistalR,m.thighDistalL)}${assessmentPair('Panturrilha','calf','calfR','calfL',m.calfR,m.calfL)}</section>
      <section class="assessment-form-section"><div class="field"><label>Observações da avaliação</label><textarea name="notes" rows="3" placeholder="Ex.: condições da avaliação, observações posturais ou contexto relevante">${escapeHTML(existing?.notes||'')}</textarea></div></section><div class="modal-actions assessment-save-actions"><button type="button" class="btn btn-secondary" data-close-modal>Cancelar</button><button class="btn btn-primary" type="submit">${icon('check')} ${existing?'Salvar alterações':'Salvar avaliação'}</button></div></form>`);
    const form=$('#physicalAssessmentForm');
    $$('[data-anatomical-key]',form).forEach(b=>b.addEventListener('click',()=>openAnatomicalGuide(b.dataset.anatomicalKey||'waist',b.dataset.anatomicalSide||'R')));
    const preview=()=>{const fd=new FormData(form),draft={date:String(fd.get('date')||isoToday()),referenceSex:String(fd.get('referenceSex')||''),weight:parseAssessmentNumber(fd.get('weight')),heightCm:parseAssessmentNumber(fd.get('heightCm')),measurements:{waist:parseAssessmentNumber(fd.get('waist')),hip:parseAssessmentNumber(fd.get('hip'))}},bmi=assessmentBMI(draft),ircq=assessmentIRCQ(draft),bc=bmiClassification(draft,student),rc=ircqClassification(draft,student);$('#assessmentLiveResults').innerHTML=`${assessmentMetric(bmi==null?'—':assessmentNumber(bmi,1),'IMC',bc.label,bc.tone)}${assessmentMetric(ircq==null?'—':assessmentNumber(ircq,2),'IRCQ',rc.label,rc.tone)}`;};
    ['weight','heightCm','waist','hip','date','referenceSex'].forEach(name=>form.elements[name]?.addEventListener('input',preview));preview();
    form.addEventListener('submit',e=>{e.preventDefault();const fd=new FormData(form);const num=n=>parseAssessmentNumber(fd.get(n));const record={id:existing?.id||uid('assess'),studentId:student.id,date:String(fd.get('date')),referenceSex:String(fd.get('referenceSex')||''),objective:String(fd.get('objective')||''),stage:String(fd.get('stage')||''),weight:num('weight'),heightCm:num('heightCm'),measurements:{neck:num('neck'),chest:num('chest'),waist:num('waist'),abdomen:num('abdomen'),hip:num('hip'),bicepsRelaxedR:num('bicepsRelaxedR'),bicepsRelaxedL:num('bicepsRelaxedL'),bicepsContractedR:num('bicepsContractedR'),bicepsContractedL:num('bicepsContractedL'),wristR:num('wristR'),wristL:num('wristL'),thighProximalR:num('thighProximalR'),thighProximalL:num('thighProximalL'),thighMedialR:num('thighMedialR'),thighMedialL:num('thighMedialL'),thighDistalR:num('thighDistalR'),thighDistalL:num('thighDistalL'),calfR:num('calfR'),calfL:num('calfL')},notes:String(fd.get('notes')||'').trim(),createdAt:existing?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
      if(!(record.weight>0&&record.heightCm>0&&record.measurements.waist>0&&record.measurements.hip>0))return toast('Informe peso, altura, cintura e quadril para salvar a avaliação.');
      const commitAssessment=()=>{state.physicalAssessments=state.physicalAssessments||[];if(existing)state.physicalAssessments=state.physicalAssessments.map(a=>a.id===existing.id?record:a);else state.physicalAssessments.push(record);const bmi=assessmentBMI(record),ircq=assessmentIRCQ(record);addAudit(existing?'Avaliação física atualizada':'Avaliação física registrada',`${student.name} • ${fmtDate(record.date)} • IMC ${assessmentNumber(bmi,1)} • IRCQ ${assessmentNumber(ircq,2)} • ${assessmentOptionLabel(ASSESSMENT_STAGES,record.stage)}`);saveState();closeModal();render();toast(existing?'Avaliação atualizada.':'Avaliação física salva.');};
      if(record.date>isoToday()){openPremiumConfirm({title:'Data futura na avaliação',message:`A avaliação está marcada para ${fmtDate(record.date)}. Confirme somente se essa data estiver correta.`,confirmLabel:'Salvar mesmo assim',cancelLabel:'Revisar data',onConfirm:commitAssessment});return;}
      commitAssessment();});
  }
  function assessmentMeasurementsHTML(a){
    const m=a.measurements||{},single=[['Pescoço',m.neck],['Peitoral',m.chest],['Cintura',m.waist],['Abdômen',m.abdomen],['Quadril',m.hip]],pairs=[['Bíceps relaxado',m.bicepsRelaxedR,m.bicepsRelaxedL],['Bíceps contraído',m.bicepsContractedR,m.bicepsContractedL],['Punho',m.wristR,m.wristL],['Coxa proximal',m.thighProximalR,m.thighProximalL],['Coxa medial',m.thighMedialR,m.thighMedialL],['Coxa distal',m.thighDistalR,m.thighDistalL],['Panturrilha',m.calfR,m.calfL]];
    return `<div class="assessment-detail-grid">${single.map(([l,v])=>`<div><span>${escapeHTML(l)}</span><strong>${v?`${assessmentNumber(v,1)} cm`:'—'}</strong></div>`).join('')}</div><div class="assessment-bilateral-table"><div class="assessment-bilateral-head"><span>Perímetro</span><span>Direito</span><span>Esquerdo</span></div>${pairs.map(([l,r,left])=>`<div><strong>${escapeHTML(l)}</strong><span>${r?`${assessmentNumber(r,1)} cm`:'—'}</span><span>${left?`${assessmentNumber(left,1)} cm`:'—'}</span></div>`).join('')}</div>`;
  }
  function openAssessmentHistory(studentId){
    const student=state.students.find(s=>String(s.id)===String(studentId));if(!student)return;const rows=assessmentsForStudent(studentId);
    openModal(`Avaliações • ${student.name}`,`<div class="assessment-history-head"><div><span class="section-overline">HISTÓRICO</span><strong>${rows.length} ${rows.length===1?'avaliação':'avaliações'} registrada${rows.length===1?'':'s'}</strong><p>Os registros são independentes e preservam a evolução ao longo do tempo.</p></div><div class="assessment-history-top-actions"><button class="btn btn-primary btn-small" id="historyNewAssessment">${icon('plus')} Nova avaliação</button>${rows.length>1?`<button class="btn btn-secondary btn-small" id="historyEvolutionAssessment">${icon('chart')} Evolução</button>`:''}</div></div>${rows.length?`<div class="assessment-history-list">${rows.map((a,index)=>{const bmi=assessmentBMI(a),ircq=assessmentIRCQ(a),bc=bmiClassification(a,student),rc=ircqClassification(a,student),isLatest=index===0;return `<article class="assessment-history-card ${isLatest?'is-latest':''}"><div class="assessment-history-date"><div><strong>${fmtDate(a.date)}</strong><span>${a.weight?`${assessmentNumber(a.weight,1)} kg`:''}${a.heightCm?` • ${assessmentNumber(a.heightCm,1)} cm`:''}</span></div><div class="assessment-history-badges">${isLatest?'<span class="pill assessment-latest-pill">Mais recente</span>':''}<span class="pill">${ageOnDate(student.birthDate,a.date)??'—'} anos</span></div></div>${assessmentContextChips(a)}<div class="assessment-profile-metrics">${assessmentMetric(bmi==null?'—':assessmentNumber(bmi,1),'IMC',bc.label,bc.tone)}${assessmentMetric(ircq==null?'—':assessmentNumber(ircq,2),'IRCQ',rc.label,rc.tone)}</div><div class="assessment-history-actions"><button class="btn btn-secondary btn-small js-assessment-open" data-id="${a.id}">Abrir detalhes</button><button class="mini-icon js-assessment-edit" data-id="${a.id}" title="Editar">${icon('edit')}</button><button class="mini-icon danger js-assessment-delete" data-id="${a.id}" title="Excluir">${icon('trash')}</button></div></article>`}).join('')}</div>`:emptyState('Ainda sem avaliação','Crie a primeira avaliação física deste aluno.')}`);
    $('#historyNewAssessment')?.addEventListener('click',()=>{closeModal();openAssessmentModal(studentId)});$('#historyEvolutionAssessment')?.addEventListener('click',()=>openAssessmentEvolution(studentId));$$('.js-assessment-open',modalRoot).forEach(b=>b.addEventListener('click',()=>openAssessmentDetails(studentId,b.dataset.id)));$$('.js-assessment-edit',modalRoot).forEach(b=>b.addEventListener('click',()=>openAssessmentModal(studentId,b.dataset.id)));$$('.js-assessment-delete',modalRoot).forEach(b=>b.addEventListener('click',()=>confirmDeleteAssessment(studentId,b.dataset.id)));
  }
  function openAssessmentDetails(studentId,assessmentId){
    const student=state.students.find(s=>String(s.id)===String(studentId)),a=(state.physicalAssessments||[]).find(x=>String(x.id)===String(assessmentId));if(!student||!a)return;const bmi=assessmentBMI(a),ircq=assessmentIRCQ(a),bc=bmiClassification(a,student),rc=ircqClassification(a,student);
    openModal(`Avaliação • ${student.name}`,`<div class="assessment-detail-head"><div><span class="section-overline">${fmtDate(a.date)}</span><strong>Resultados antropométricos</strong><p>${a.referenceSex==='male'?'Referência IRCQ masculina':a.referenceSex==='female'?'Referência IRCQ feminina':'IRCQ sem classificação por sexo'}</p></div><button class="btn btn-secondary btn-small" id="backAssessmentHistory">Voltar</button></div>${assessmentContextChips(a)}<div class="assessment-profile-metrics detail-results">${assessmentMetric(a.weight?`${assessmentNumber(a.weight,1)} kg`:'—','Peso')}${assessmentMetric(a.heightCm?`${assessmentNumber(a.heightCm,1)} cm`:'—','Altura')}${assessmentMetric(bmi==null?'—':assessmentNumber(bmi,1),'IMC',bc.label,bc.tone)}${assessmentMetric(ircq==null?'—':assessmentNumber(ircq,2),'IRCQ',rc.label,rc.tone)}</div><div class="assessment-scale-note"><strong>Leitura das escalas</strong><span>IMC: ${escapeHTML(bc.label)}. ${escapeHTML(bc.note)}<br>IRCQ: ${escapeHTML(rc.label)}. ${escapeHTML(rc.note)}</span></div><div class="section-head compact-head"><div><h3>Perímetros</h3><p>Valores registrados em centímetros</p></div></div>${assessmentMeasurementsHTML(a)}${a.notes?`<div class="assessment-notes"><span class="section-overline">OBSERVAÇÕES</span><p>${escapeHTML(a.notes)}</p></div>`:''}<div class="assessment-detail-actions"><button class="btn btn-primary btn-small" id="editAssessmentDetail">${icon('edit')} Editar avaliação</button>${assessmentsForStudent(studentId).length>1?`<button class="btn btn-secondary btn-small" id="detailAssessmentEvolution">${icon('chart')} Ver evolução</button>`:''}</div>`);
    $('#backAssessmentHistory')?.addEventListener('click',()=>openAssessmentHistory(studentId));$('#editAssessmentDetail')?.addEventListener('click',()=>openAssessmentModal(studentId,assessmentId));$('#detailAssessmentEvolution')?.addEventListener('click',()=>openAssessmentEvolution(studentId));
  }
  function assessmentBilateralCard(label,right,left){
    const r=Number(right),l=Number(left);if(!(r>0&&l>0))return '';
    const diff=Math.abs(r-l),side=diff<.05?'equivalentes no registro':(r>l?'D maior':'E maior');
    return `<article class="assessment-bilateral-card"><span>${escapeHTML(label)}</span><strong>D ${assessmentNumber(r,1)} <i>•</i> E ${assessmentNumber(l,1)}</strong><small>Diferença ${assessmentNumber(diff,1)} cm • ${escapeHTML(side)}</small></article>`;
  }
  function openAssessmentEvolution(studentId){
    const student=state.students.find(s=>String(s.id)===String(studentId));if(!student)return;const rowsDesc=assessmentsForStudent(studentId),rows=rowsDesc.slice().reverse();
    if(rows.length<2){openModal(`Evolução • ${student.name}`,`<div class="assessment-chart-empty"><strong>A evolução aparece a partir da segunda avaliação</strong><span>Já existe ${rows.length} registro. Salve uma nova avaliação em outra data para liberar comparativos e gráficos.</span></div><div class="modal-actions"><button class="btn btn-secondary" id="evolutionBackHistory">Voltar</button><button class="btn btn-primary" id="evolutionNewAssessment">${icon('plus')} Nova avaliação</button></div>`);$('#evolutionBackHistory')?.addEventListener('click',()=>openAssessmentHistory(studentId));$('#evolutionNewAssessment')?.addEventListener('click',()=>openAssessmentModal(studentId));return;}
    const first=rows[0],latest=rows[rows.length-1],previous=rows[rows.length-2],preferred=['waist','weight','abdomen','hip','bicepsContractedR'],defaultKey=preferred.find(k=>assessmentSeries(studentId,k).length>=2)||ASSESSMENT_EVOLUTION_METRICS.find(m=>assessmentSeries(studentId,m.key).length>=2)?.key||'weight';
    const firstLatest=[['Peso','weight','kg',1],['IMC','bmi','',1],['IRCQ','ircq','',2],['Cintura','waist','cm',1],['Abdômen','abdomen','cm',1],['Quadril','hip','cm',1]];
    const bilateral=[assessmentBilateralCard('Bíceps relaxado',latest.measurements?.bicepsRelaxedR,latest.measurements?.bicepsRelaxedL),assessmentBilateralCard('Bíceps contraído',latest.measurements?.bicepsContractedR,latest.measurements?.bicepsContractedL),assessmentBilateralCard('Punho',latest.measurements?.wristR,latest.measurements?.wristL),assessmentBilateralCard('Coxa proximal',latest.measurements?.thighProximalR,latest.measurements?.thighProximalL),assessmentBilateralCard('Coxa medial',latest.measurements?.thighMedialR,latest.measurements?.thighMedialL),assessmentBilateralCard('Coxa distal',latest.measurements?.thighDistalR,latest.measurements?.thighDistalL),assessmentBilateralCard('Panturrilha',latest.measurements?.calfR,latest.measurements?.calfL)].filter(Boolean).join('');
    openModal(`Evolução • ${student.name}`,`<div class="assessment-evolution-head"><div><span class="section-overline">EVOLUÇÃO ANTROPOMÉTRICA</span><strong>${rows.length} avaliações • ${fmtDate(first.date)} → ${fmtDate(latest.date)}</strong><p>Comparativos históricos com leitura neutra da direção das medidas.</p></div><button class="btn btn-secondary btn-small" id="evolutionBackHistory">Voltar ao histórico</button></div>${assessmentContextChips(latest)}
      <div class="assessment-evolution-note"><strong>Última × anterior</strong><span>As setas indicam apenas aumento, redução ou estabilidade numérica. A interpretação do resultado depende do objetivo e do contexto profissional.</span></div>
      <div class="assessment-trend-grid">${assessmentTrendCard('Peso',latest.weight,previous.weight,'kg',1)}${assessmentTrendCard('Cintura',latest.measurements?.waist,previous.measurements?.waist,'cm',1)}${assessmentTrendCard('Abdômen',latest.measurements?.abdomen,previous.measurements?.abdomen,'cm',1)}${assessmentTrendCard('Quadril',latest.measurements?.hip,previous.measurements?.hip,'cm',1)}</div>
      <section class="assessment-evolution-panel"><div class="assessment-evolution-panel-head"><div><span class="section-overline">GRÁFICO DE EVOLUÇÃO</span><h3 id="assessmentEvolutionChartTitle">Indicador</h3></div><div class="field assessment-metric-picker"><label>Indicador</label><select id="assessmentEvolutionMetric">${ASSESSMENT_EVOLUTION_METRICS.map(m=>`<option value="${m.key}" ${m.key===defaultKey?'selected':''}>${escapeHTML(m.label)}</option>`).join('')}</select></div></div><div id="assessmentEvolutionChart"></div><div class="assessment-chart-legend"><span>Primeiro registro</span><i></i><span>Registro atual</span></div><div id="assessmentEvolutionTable"></div></section>
      <div class="section-head compact-head"><div><h3>Primeira × atual</h3><p>Variação acumulada entre o primeiro e o registro mais recente.</p></div></div><div class="assessment-trend-grid assessment-first-last">${firstLatest.map(([label,key,unit,digits])=>assessmentTrendCard(label,assessmentValue(latest,key),assessmentValue(first,key),unit,digits,'desde a primeira')).join('')}</div>
      <div class="section-head compact-head"><div><h3>Comparativo bilateral atual</h3><p>Diferença registrada entre lado direito e esquerdo, sem classificação automática.</p></div></div>${bilateral?`<div class="assessment-bilateral-cards">${bilateral}</div>`:`<div class="assessment-chart-empty compact"><strong>Sem pares completos</strong><span>Preencha as medidas direita e esquerda para visualizar este comparativo.</span></div>`}
      <div class="assessment-evolution-footer"><button class="btn btn-primary btn-small" id="evolutionNewAssessment">${icon('plus')} Nova avaliação</button><button class="btn btn-secondary btn-small" id="evolutionOpenLatest">Abrir última avaliação</button></div>`);
    const renderChart=()=>{const key=$('#assessmentEvolutionMetric')?.value||defaultKey,config=assessmentMetricConfig(key),series=assessmentSeries(studentId,key);$('#assessmentEvolutionChartTitle').textContent=`${config.label}${config.unit?` • ${config.unit}`:''}`;$('#assessmentEvolutionChart').innerHTML=assessmentLineChart(series,config);$('#assessmentEvolutionTable').innerHTML=assessmentEvolutionTable(series,config);};
    $('#assessmentEvolutionMetric')?.addEventListener('change',renderChart);$('#evolutionBackHistory')?.addEventListener('click',()=>openAssessmentHistory(studentId));$('#evolutionNewAssessment')?.addEventListener('click',()=>openAssessmentModal(studentId));$('#evolutionOpenLatest')?.addEventListener('click',()=>openAssessmentDetails(studentId,latest.id));renderChart();
  }
  function confirmDeleteAssessment(studentId,assessmentId){
    const student=state.students.find(s=>String(s.id)===String(studentId)),a=(state.physicalAssessments||[]).find(x=>String(x.id)===String(assessmentId));if(!student||!a)return;openModal('Excluir avaliação física',`<div class="notice">Confirma excluir a avaliação de <strong>${escapeHTML(student.name)}</strong> realizada em <strong>${fmtDate(a.date)}</strong>? Esta ação remove somente este registro de avaliação e não altera o cadastro do aluno.</div><div class="modal-actions"><button class="btn btn-secondary" id="cancelAssessmentDelete">Cancelar</button><button class="btn btn-danger" id="confirmAssessmentDelete">Excluir avaliação</button></div>`);$('#cancelAssessmentDelete').addEventListener('click',()=>openAssessmentHistory(studentId));$('#confirmAssessmentDelete').addEventListener('click',()=>{state.physicalAssessments=state.physicalAssessments.filter(x=>x.id!==assessmentId);addAudit('Avaliação física removida',`${student.name} • ${fmtDate(a.date)}`);saveState();closeModal();render();toast('Avaliação removida.');});
  }

  function openStudentModal(id=null) {
    const s = id ? state.students.find(x=>x.id===id) : null;
    const title = s ? 'Editar aluno' : 'Novo aluno';
    openModal(title, `
      <form id="studentForm" class="form-grid two">
        <div class="field" style="grid-column:1/-1"><label>Foto do aluno</label><div class="photo-picker luxury-photo-picker"><div id="photoPreview" class="photo-preview">${s?.photoData?`<img src="${s.photoData}" alt="Foto do aluno" />`:(s?.name?`<span>${escapeHTML(String(s.name).trim().charAt(0).toUpperCase())}</span>`:`<span class="photo-placeholder">${icon('users')}</span>`)}</div><div class="photo-picker-controls"><input id="studentPhoto" class="photo-file-input" type="file" accept="image/*" /><label for="studentPhoto" class="btn btn-secondary btn-small photo-file-button">${icon('upload')} <span id="photoFileLabel">${s?.photoData?'Alterar foto':'Adicionar foto'}</span></label><small>Opcional. A foto será reduzida e salva somente no app.</small><button id="removePhoto" type="button" class="btn btn-secondary btn-small ${s?.photoData?'':'hidden'}">Remover foto</button></div></div></div>
        <div class="field" style="grid-column:1/-1"><label>Nome completo *</label><input name="name" required value="${escapeHTML(s?.name||'')}" placeholder="Nome do aluno" /></div>
        <div class="field"><label>Data de nascimento *</label><input name="birthDate" type="date" required value="${escapeHTML(s?.birthDate||'')}" /><small>Toque na data para escolher também mês e ano.</small></div>
        <div class="field"><label>Idade</label><input id="agePreview" disabled value="${s?.birthDate ? `${ageFromBirth(s.birthDate)} anos` : 'Calculada automaticamente'}" /></div>
        <div class="field"><label>WhatsApp *</label><input name="whatsapp" inputmode="tel" required value="${escapeHTML(s?.whatsapp||'')}" placeholder="(31) 99999-9999" /></div>
        <div class="field"><label>E-mail</label><input name="email" type="email" value="${escapeHTML(s?.email||'')}" placeholder="aluno@email.com" /></div>
        <div class="field"><label>Data de início dos treinos *</label><input name="startDate" type="date" required value="${escapeHTML(s?.startDate||isoToday())}" /></div>
        <div class="field"><label>Vencimento da mensalidade *</label><input name="dueDate" type="date" required value="${escapeHTML(s?.dueDate||isoToday())}" /></div>
        <div class="field"><label>Valor da mensalidade *</label><input name="monthlyFee" type="number" min="0" step="0.01" required value="${escapeHTML(s?.monthlyFee ?? '')}" placeholder="0,00" /></div>
        <div class="field"><label>Forma de pagamento preferencial</label><select name="paymentMethod"><option value="pix" ${s?.paymentMethod!=='cash'?'selected':''}>PIX</option><option value="cash" ${s?.paymentMethod==='cash'?'selected':''}>Dinheiro</option></select></div>
        <div class="field"><label>Situação</label><select name="active"><option value="true" ${s?.active!==false?'selected':''}>Ativo</option><option value="false" ${s?.active===false?'selected':''}>Inativo</option></select></div>
        <div class="field"><label>Pausa / férias do aluno • início</label><input name="pauseStart" type="date" value="${escapeHTML(s?.pauseStart||'')}" /></div>
        <div class="field"><label>Data final da pausa</label><input name="pauseEnd" type="date" value="${escapeHTML(s?.pauseEnd||'')}" /></div>
        <div class="field" style="grid-column:1/-1"><label>Motivo da pausa</label><input name="pauseReason" value="${escapeHTML(s?.pauseReason||'')}" placeholder="Ex.: férias, viagem, afastamento" /></div>
        ${s&&studentPauseAt(s)?`<div class="pause-edit-action" style="grid-column:1/-1"><div><strong>Pausa ativa até ${fmtDate(s.pauseEnd)}</strong><span>A data original de início será preservada.</span></div><button type="button" class="btn btn-secondary btn-small" id="resumeFromEdit">Encerrar pausa agora</button></div>`:''}
        <div class="field" style="grid-column:1/-1"><label>Observações privadas</label><textarea name="privateNotes" rows="4" placeholder="Anotações administrativas visíveis somente neste app">${escapeHTML(s?.privateNotes||'')}</textarea><small>Use para combinações de horário, pagamento ou observações internas.</small></div>
        <div class="modal-actions" style="grid-column:1/-1"><button type="button" class="btn btn-secondary" data-close-modal>Cancelar</button><button class="btn btn-primary" type="submit">${icon('check')} ${s?'Salvar alterações':'Criar aluno'}</button></div>
      </form>
    `);
    const form = $('#studentForm');
    let photoData=s?.photoData||'';
    const photoInput=$('#studentPhoto');
    const photoPreview=$('#photoPreview');
    const removePhoto=$('#removePhoto');
    const photoFileLabel=$('#photoFileLabel');
    async function compressPhoto(file){return await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>{const img=new Image();img.onload=()=>{const max=320,scale=Math.min(1,max/Math.max(img.width,img.height)),w=Math.max(1,Math.round(img.width*scale)),h=Math.max(1,Math.round(img.height*scale));const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);resolve(c.toDataURL('image/jpeg',.72))};img.onerror=reject;img.src=reader.result};reader.onerror=reject;reader.readAsDataURL(file)});}
    photoInput.addEventListener('change',async()=>{const file=photoInput.files?.[0];if(!file)return;try{photoData=await compressPhoto(file);photoPreview.innerHTML=`<img src="${photoData}" alt="Foto do aluno" />`;removePhoto.classList.remove('hidden');if(photoFileLabel)photoFileLabel.textContent='Alterar foto'}catch(e){toast('Não foi possível carregar essa foto.')}});
    removePhoto.addEventListener('click',()=>{photoData='';photoInput.value='';const initial=(form.elements.name.value||'').trim().charAt(0).toUpperCase();photoPreview.innerHTML=initial?`<span>${escapeHTML(initial)}</span>`:`<span class="photo-placeholder">${icon('users')}</span>`;removePhoto.classList.add('hidden');if(photoFileLabel)photoFileLabel.textContent='Adicionar foto'});
    form.birthDate.addEventListener('change',()=>{$('#agePreview').value = form.birthDate.value ? `${ageFromBirth(form.birthDate.value)} anos` : 'Calculada automaticamente';});
    $('#resumeFromEdit')?.addEventListener('click',()=>{form.elements.pauseStart.value='';form.elements.pauseEnd.value='';form.elements.pauseReason.value='';toast('Pausa marcada para encerramento. Salve as alterações para confirmar.');});
    form.addEventListener('submit', e=>{
      e.preventDefault();
      const fd = new FormData(form);
      const whatsappRaw=String(fd.get('whatsapp')||'').trim(),phoneCheck=validateWhatsApp(whatsappRaw);
      if(!phoneCheck.valid){toast(phoneCheck.reason||'Informe um WhatsApp válido com DDD e 9 dígitos.');form.elements.whatsapp.focus();return;}
      const pauseStart=String(fd.get('pauseStart')||''),pauseEnd=String(fd.get('pauseEnd')||'');
      if((pauseStart&&!pauseEnd)||(!pauseStart&&pauseEnd)){toast('Preencha início e fim da pausa, ou deixe ambos vazios.');return;}
      if(pauseStart&&pauseEnd&&pauseEnd<pauseStart){toast('O fim da pausa deve ser igual ou posterior ao início.');return;}
      const record = {
        id: s?.id || uid('stu'),
        name: String(fd.get('name')).trim(),
        birthDate: String(fd.get('birthDate')),
        whatsapp: phoneCheck.formatted,
        email: String(fd.get('email')).trim(),
        startDate: String(fd.get('startDate')),
        dueDate: String(fd.get('dueDate')),
        monthlyFee: Number(fd.get('monthlyFee')) || 0,
        paymentMethod: String(fd.get('paymentMethod')||'pix'),
        active: String(fd.get('active')) === 'true',
        pauseStart,
        pauseEnd,
        pauseReason: String(fd.get('pauseReason')||'').trim(),
        privateNotes: String(fd.get('privateNotes')||'').trim(),
        photoData,
        consent: s?.consent || {sentAt:null,acceptedAt:null},
        createdAt: s?.createdAt || new Date().toISOString()
      };
      if (s) state.students = state.students.map(x=>x.id===s.id?record:x); else state.students.push(record);
      if(!s)addAudit('Aluno criado',record.name);
      else {
        const hadPause=Boolean(s.pauseStart&&s.pauseEnd),hasPause=Boolean(record.pauseStart&&record.pauseEnd);
        if(!hadPause&&hasPause)addAudit('Pausa iniciada',`${record.name} • ${fmtDate(record.pauseStart)} a ${fmtDate(record.pauseEnd)}${record.pauseReason?` • ${record.pauseReason}`:''}`);
        else if(hadPause&&!hasPause)addAudit('Pausa encerrada',record.name);
        else if(hadPause&&hasPause&&(s.pauseStart!==record.pauseStart||s.pauseEnd!==record.pauseEnd||s.pauseReason!==record.pauseReason))addAudit('Pausa atualizada',`${record.name} • ${fmtDate(record.pauseStart)} a ${fmtDate(record.pauseEnd)}`);
        else addAudit('Aluno atualizado',record.name);
      }
      saveState(); closeModal(); toast(s?'Aluno atualizado.':'Aluno criado com sucesso.'); render();
    });
  }

  function openPlannedAbsenceModal(id){
    const st=state.students.find(x=>x.id===id);if(!st)return;
    const future=(state.plannedAbsences||[]).filter(a=>String(a.studentId)===String(id)&&a.date>=isoToday()).sort((a,b)=>a.date.localeCompare(b.date));
    openModal(`Ausência programada • ${st.name}`,`<form id="absencePlanForm" class="form-grid"><div class="notice">Essa ausência libera a vaga para reposição e <strong>não registra falta</strong> automaticamente.</div><div class="field"><label>Data</label><input name="date" type="date" min="${isoToday()}" required /></div><div class="field"><label>Motivo (opcional)</label><input name="reason" placeholder="Ex.: viagem, compromisso" /></div><div class="modal-actions"><button type="button" class="btn btn-secondary" data-close-modal>Cancelar</button><button class="btn btn-primary" type="submit">Salvar ausência</button></div></form>${future.length?`<div class="section-head compact-head"><div><h3>Próximas ausências</h3></div></div><div class="history-list">${future.map(a=>`<div class="history-row"><div><strong>${fmtDate(a.date)}</strong><span>${escapeHTML(a.reason||'Ausência avisada')}</span></div><button class="mini-icon js-remove-planned" data-id="${a.id}">${icon('x')}</button></div>`).join('')}</div>`:''}`);
    $('#absencePlanForm').addEventListener('submit',e=>{e.preventDefault();const fd=new FormData(e.currentTarget),date=String(fd.get('date')),reason=String(fd.get('reason')||'').trim();state.plannedAbsences=state.plannedAbsences||[];state.plannedAbsences.push({id:uid('abs'),studentId:id,date,reason,createdAt:new Date().toISOString()});const d=parseLocalDate(date),dayId=dayIdFromDate(d);if(dayId)scheduleHours(dayId).forEach(time=>{if(slotStudents(dayId,time).includes(id))setAttendance(date,dayId,time,id,'')});saveState();closeModal();toast('Ausência programada. A vaga ficará disponível.');render();});
    $$('.js-remove-planned').forEach(b=>b.addEventListener('click',()=>{state.plannedAbsences=state.plannedAbsences.filter(a=>a.id!==b.dataset.id);saveState();closeModal();openPlannedAbsenceModal(id);toast('Ausência removida.')}));
  }

  function openClosuresManager(){
    const rows=[...(state.studioClosures||[])].sort((a,b)=>String(a.startDate).localeCompare(String(b.startDate)));
    openModal('Feriados e recesso do Studio',`<form id="closureForm" class="form-grid two"><div class="notice" style="grid-column:1/-1">Bloqueie um dia ou um período inteiro. As aulas ficam marcadas como canceladas e <strong>ninguém recebe falta</strong>.</div><div class="field"><label>Início</label><input name="startDate" type="date" required /></div><div class="field"><label>Fim</label><input name="endDate" type="date" required /></div><div class="field"><label>Tipo</label><select name="type"><option>Feriado</option><option>Recesso</option><option>Studio fechado</option><option>Outro</option></select></div><div class="field"><label>Descrição</label><input name="label" placeholder="Ex.: Independência do Brasil" /></div><div class="modal-actions" style="grid-column:1/-1"><button type="button" class="btn btn-secondary" data-close-modal>Cancelar</button><button class="btn btn-primary" type="submit">Bloquear período</button></div></form><div class="section-head compact-head"><div><h3>Períodos cadastrados</h3><p>${rows.length} registro${rows.length===1?'':'s'}</p></div></div><div class="history-list">${rows.length?rows.map(c=>`<div class="history-row"><div><strong>${escapeHTML(c.label||c.type)}</strong><span>${fmtDate(c.startDate)}${c.endDate!==c.startDate?` a ${fmtDate(c.endDate)}`:''} • ${escapeHTML(c.type)}</span></div><button class="mini-icon js-remove-closure" data-id="${c.id}">${icon('x')}</button></div>`).join(''):emptyState('Nenhum bloqueio','Cadastre feriados, recessos ou dias de Studio fechado.')}</div>`);
    const form=$('#closureForm');form.startDate.addEventListener('change',()=>{if(!form.endDate.value||form.endDate.value<form.startDate.value)form.endDate.value=form.startDate.value});form.addEventListener('submit',e=>{e.preventDefault();const fd=new FormData(form),startDate=String(fd.get('startDate')),endDate=String(fd.get('endDate'));if(endDate<startDate)return toast('A data final deve ser igual ou posterior à inicial.');state.studioClosures=state.studioClosures||[];state.studioClosures.push({id:uid('close'),startDate,endDate,type:String(fd.get('type')),label:String(fd.get('label')||fd.get('type')).trim()});addAudit('Calendário bloqueado',`${String(fd.get('type'))} • ${fmtDate(startDate)}${endDate!==startDate?' a '+fmtDate(endDate):''}`);saveState();closeModal();toast('Período bloqueado na agenda.');renderSchedule();});$$('.js-remove-closure').forEach(b=>b.addEventListener('click',()=>{const closure=state.studioClosures.find(c=>c.id===b.dataset.id);openModal('Remover feriado / recesso',`<div class="notice">Confirma remover <strong>${escapeHTML(closure?.label||closure?.type||'este bloqueio')}</strong> do calendário? As aulas do período voltarão a aparecer normalmente.</div><div class="modal-actions"><button class="btn btn-secondary" data-close-modal>Cancelar</button><button class="btn btn-danger" id="confirmClosureRemoval">Remover</button></div>`);$('#confirmClosureRemoval').addEventListener('click',()=>{state.studioClosures=state.studioClosures.filter(c=>c.id!==b.dataset.id);addAudit('Bloqueio de calendário removido',closure?.label||closure?.type||'');saveState();closeModal();openClosuresManager();toast('Bloqueio removido.');});}));
  }

  function confirmDeleteStudent(id) {
    const s = state.students.find(x=>x.id===id); if (!s) return;
    openModal('Excluir aluno', `<div class="notice">O cadastro de <strong>${escapeHTML(s.name)}</strong> será removido da lista de alunos e enviado para a <strong>Lixeira</strong>, de onde poderá ser restaurado.</div><div class="modal-actions"><button class="btn btn-secondary" data-close-modal>Cancelar</button><button class="btn btn-danger" id="confirmDelete">${icon('trash')} Mover para lixeira</button></div>`);
    $('#confirmDelete').addEventListener('click',()=>{state.trash=state.trash||[];state.trash.unshift({id:uid('trash'),type:'student',deletedAt:new Date().toISOString(),data:structuredClone(s)});state.students=state.students.filter(x=>x.id!==id);addAudit('Aluno enviado à lixeira',s.name);saveState(); closeModal(); toast('Aluno movido para a lixeira.'); render();});
  }

  function financeTrend(months=6){
    const out=[],now=todayNoon();
    for(let i=months-1;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1,12),mk=monthKey(isoDate(d)),received=state.payments.filter(p=>monthKey(p.date)===mk).reduce((a,p)=>a+(Number(p.amount)||0),0),expenses=state.expenses.filter(e=>monthKey(e.date)===mk).reduce((a,e)=>a+(Number(e.amount)||0),0);out.push({mk,label:new Intl.DateTimeFormat('pt-BR',{month:'short'}).format(d).replace('.',''),received,expenses,net:received-expenses})}return out;
  }
  function financeTrendHTML(){
    if(!financialValuesVisible)return `<article class="card finance-trend-card"><div class="premium-card-title"><span>Últimos 6 meses</span>${icon('chart')}</div><div class="financial-private-placeholder">${icon('eye')}<strong>Valores e gráfico ocultos</strong><span>A privacidade também protege proporções, barras e dicas de valor.</span></div></article>`;
    const rows=financeTrend(6),max=Math.max(1,...rows.map(x=>Math.max(x.received,x.expenses)));
    return `<article class="card finance-trend-card"><div class="premium-card-title"><span>Últimos 6 meses</span>${icon('chart')}</div><div class="finance-bars">${rows.map(x=>`<div class="finance-bar-col"><div class="finance-bars-stack"><span class="finance-bar received" style="height:${Math.max(3,Math.round(x.received/max*100))}%" title="Recebido: ${fmtMoney(x.received)}"></span><span class="finance-bar expense" style="height:${Math.max(3,Math.round(x.expenses/max*100))}%" title="Gastos: ${fmtMoney(x.expenses)}"></span></div><strong>${escapeHTML(x.label)}</strong><small>${fmtMoney(x.net)}</small></div>`).join('')}</div><div class="finance-legend"><span>▮ Recebido</span><span>▮ Gastos</span><span>Saldo abaixo de cada mês</span></div></article>`;
  }

  function renderFinance() {
    const m = metrics();
    const tabs = [['summary','Resumo'],['payments','Receitas'],['expenses','Gastos']];
    viewEl.innerHTML = `
      <section class="finance-privacy-hero">
        <div class="finance-privacy-icon">${icon(financialValuesVisible?'eye-off':'eye')}</div>
        <div class="finance-privacy-copy"><strong>${financialValuesVisible?'Ocultar valores':'Mostrar valores'}</strong><span>Controle de privacidade financeira</span></div>
        <button type="button" class="finance-privacy-switch ${financialValuesVisible?'on':''}" id="financePrivacyTop" aria-label="${financialValuesVisible?'Ocultar':'Mostrar'} valores"><span></span></button>
      </section>
      <div class="tabs">${tabs.map(([id,l])=>`<button class="tab ${financeTab===id?'active':''}" data-fin-tab="${id}">${l}</button>`).join('')}</div>
      <div id="financeContent"></div>`;
    $$('[data-fin-tab]').forEach(b=>b.addEventListener('click',()=>{financeTab=b.dataset.finTab;renderFinance();}));
    $('#financePrivacyTop')?.addEventListener('click',toggleFinancialVisibility);
    const c = $('#financeContent');
    if (financeTab==='summary') {
      c.innerHTML = `
        <section class="metrics">
          ${metricCard('wallet',privateMoney(m.expected),'Receita mensal prevista')}
          ${metricCard('chart',privateMoney(m.received),'Receita recebida','good')}
          ${metricCard('receipt',privateMoney(m.expenses),'Gastos do mês',m.expenses?'danger':'')}
          ${metricCard('wallet',privateMoney(m.net),'Saldo do mês',m.net>=0?'good':'danger')}
        </section>
        ${financeTrendHTML()}
        <div class="section-head"><div><h3>Visão do mês</h3><p>Valores calculados automaticamente • mensalidades pendentes são geradas pela base ativa</p></div></div>
        <section class="cards grid2 payment-breakdown">
          <article class="card"><div class="list-row"><div class="list-main"><strong>Potencial via PIX</strong><span>Todos os alunos ativos cadastrados como PIX</span></div><strong>${privateMoney(m.potentialPix)}</strong></div><div class="list-row"><div class="list-main"><strong>Já recebido via PIX</strong><span>Mês atual</span></div><strong class="money-positive">${privateMoney(m.pix)}</strong></div><div class="list-row"><div class="list-main"><strong>Potencial ainda a receber</strong><span>PIX</span></div><strong>${privateMoney(m.remainingPix)}</strong></div></article>
          <article class="card"><div class="list-row"><div class="list-main"><strong>Potencial em dinheiro</strong><span>Todos os alunos ativos cadastrados como Dinheiro</span></div><strong>${privateMoney(m.potentialCash)}</strong></div><div class="list-row"><div class="list-main"><strong>Já recebido em dinheiro</strong><span>Mês atual</span></div><strong class="money-positive">${privateMoney(m.cash)}</strong></div><div class="list-row"><div class="list-main"><strong>Potencial ainda a receber</strong><span>Dinheiro</span></div><strong>${privateMoney(m.remainingCash)}</strong></div></article>
        </section>
        <section class="cards grid2"><article class="card"><div class="list-row"><div class="list-main"><strong>Cadastros faturáveis</strong><span>Base de mensalidades, inclusive pausas vigentes</span></div><strong>${m.students}</strong></div><div class="list-row"><div class="list-main"><strong>Ticket médio</strong><span>Média por cadastro faturável</span></div><strong>${privateMoney(m.students?m.expected/m.students:0)}</strong></div><div class="list-row"><div class="list-main"><strong>Em atraso</strong><span>${m.overdue} aluno${m.overdue===1?'':'s'} • valor pendente</span></div><strong>${privateMoney(m.overdueValue)}</strong></div></article><article class="card"><div class="notice">A receita prevista é a soma das mensalidades cadastradas. A receita recebida só aumenta quando você registra um pagamento na aba Cobranças ou Receitas.</div></article></section>`;
    } else if (financeTab==='payments') renderPayments(c);
    else renderExpenses(c);
  }

  function renderPayments(c) {
    const groups = paymentsByMonth();
    const current = monthKey();
    const students = billingStudents();
    const currentPaidIds = new Set(
      state.payments.filter(p => monthKey(p.date) === current).map(p => String(p.studentId))
    );
    const pending = students.filter(s => !currentPaidIds.has(String(s.id)));

    c.innerHTML = `
      <div class="section-head">
        <div><h3>Receitas e histórico</h3><p>Pagamentos preservados mês a mês</p></div>
        <button class="btn btn-primary" id="addPayment">${icon('plus')} Registrar receita</button>
      </div>
      <section class="card">
        <div class="list-row">
          <div class="list-main"><strong>Situação do mês atual</strong><span>${students.length-currentPaidIds.size} aluno${students.length-currentPaidIds.size===1?'':'s'} sem pagamento registrado</span></div>
          <strong>${privateMoney(pending.reduce((a,s)=>a+(Number(s.monthlyFee)||0),0))}</strong>
        </div>
      </section>
      <div class="finance-history-tools">
        <div class="search-wrap">${icon('search')}<input id="paymentSearch" type="search" placeholder="Buscar aluno ou descrição" /></div>
        <select id="paymentMethodFilter" aria-label="Forma de pagamento">
          <option value="all">Todas as formas</option>
          <option value="pix">PIX</option>
          <option value="cash">Dinheiro</option>
        </select>
      </div>
      <div id="paymentHistoryRoot"></div>`;

    const draw = () => {
      const q = ($('#paymentSearch').value || '').trim().toLowerCase();
      const method = $('#paymentMethodFilter').value;
      const filteredGroups = groups
        .map(([mk,payments]) => {
          const filtered = payments.filter(p => {
            const st = state.students.find(x => String(x.id) === String(p.studentId));
            const pm = p.paymentMethod || st?.paymentMethod || 'pix';
            const matchesText = !q || [st?.name,p.description,p.reference,p.type].some(v => String(v||'').toLowerCase().includes(q));
            const matchesMethod = method === 'all' || pm === method;
            return matchesText && matchesMethod;
          });
          return [mk, filtered];
        })
        .filter(([,payments]) => payments.length);

      const root = $('#paymentHistoryRoot');
      if (!filteredGroups.length) {
        root.innerHTML = emptyState('Nenhuma receita encontrada','Ajuste a busca ou os filtros.');
      } else {
        root.innerHTML = filteredGroups.map(([mk,payments]) => {
          const total = payments.reduce((a,p)=>a+(Number(p.amount)||0),0);
          const cards = [...payments]
            .sort((a,b)=>String(b.date).localeCompare(String(a.date)))
            .map(p => {
              const st = state.students.find(x => String(x.id) === String(p.studentId));
              const pm = p.paymentMethod || st?.paymentMethod || 'pix';
              return `<article class="card">
                <div class="list-row">
                  <div class="list-main">
                    <strong>${escapeHTML(st?.name||p.description||'Receita')}</strong>
                    <span>${fmtDate(p.date)} • ${escapeHTML(p.reference||p.type||'Mensalidade')} • ${pm==='cash'?'Dinheiro':'PIX'}</span>
                  </div>
                  <div class="finance-row-actions">
                    <strong class="money-positive">${privateMoney(p.amount)}</strong>
                    <button class="mini-icon js-edit-payment" data-id="${p.id}" title="Editar">${icon('edit')}</button>
                    <button class="mini-icon danger js-del-payment" data-id="${p.id}" title="Excluir">${icon('trash')}</button>
                  </div>
                </div>
              </article>`;
            }).join('');
          return `<div class="section-head compact-head"><div><h3>${monthLabel(mk)}</h3><p>${payments.length} pagamento${payments.length===1?'':'s'} • ${privateMoney(total)}</p></div></div><section class="cards">${cards}</section>`;
        }).join('');
      }

      $$('.js-del-payment', c).forEach(b => b.addEventListener('click', () => {
        const payment = state.payments.find(x => x.id === b.dataset.id);
        openModal('Excluir receita',`
          <div class="notice">Confirma a exclusão desta receita${payment?` de <strong>${privateMoney(payment.amount)}</strong>`:''}? Esta ação altera os totais financeiros.</div>
          <div class="modal-actions"><button class="btn btn-secondary" data-close-modal>Cancelar</button><button class="btn btn-danger" id="confirmDeletePayment">Excluir</button></div>
        `);
        $('#confirmDeletePayment').addEventListener('click', () => {
          state.payments = state.payments.filter(x => x.id !== b.dataset.id);
          addAudit('Receita excluída',`${payment?.studentName||state.students.find(x=>String(x.id)===String(payment?.studentId))?.name||'Aluno'} • ${fmtDate(payment?.date)} • ${fmtMoney(payment?.amount)}`);
          saveState(); closeModal(); renderFinance(); toast('Receita excluída.');
        });
      }));
      $$('.js-edit-payment', c).forEach(b => b.addEventListener('click', () => openPaymentEditModal(b.dataset.id)));
    };

    $('#paymentSearch').addEventListener('input', draw);
    $('#paymentMethodFilter').addEventListener('change', draw);
    $('#addPayment').addEventListener('click', openPaymentModal);
    draw();
  }

  function openPaymentModal(preselectedId='') {
    if(!financialValuesVisible){toast('Mostre os valores antes de registrar uma receita.');return;}
    const students = billingStudents();
    if (!students.length) return toast('Cadastre um aluno ativo antes de registrar uma mensalidade.');
    const hasPreselected=students.some(x=>String(x.id)===String(preselectedId));
    openModal('Registrar receita', `<form id="paymentForm" class="form-grid"><div class="field"><label>Aluno *</label><select name="studentId" required><option value="" ${hasPreselected?'':'selected'} disabled>Selecionar aluno</option>${students.map(s=>`<option value="${s.id}" ${String(s.id)===String(preselectedId)?'selected':''}>${escapeHTML(s.name)}</option>`).join('')}</select></div><div class="form-grid two"><div class="field"><label>Data *</label><input type="date" name="date" required value="${isoToday()}" /></div><div class="field"><label>Valor *</label><input type="number" name="amount" step="0.01" min="0" required /></div></div><div class="field"><label>Forma de pagamento *</label><select name="paymentMethod" required><option value="pix">PIX</option><option value="cash">Dinheiro</option></select></div><div class="field"><label>Referência</label><input name="reference" value="Mensalidade" /></div><div class="field"><label><input id="advanceDue" type="checkbox" checked style="width:auto;margin-right:8px" /> Avançar vencimento do aluno em 1 mês</label></div><div class="modal-actions"><button type="button" class="btn btn-secondary" data-close-modal>Cancelar</button><button class="btn btn-primary" type="submit">${icon('check')} Registrar</button></div></form>`);
    const form=$('#paymentForm');
    const syncAmount=()=>{const st=state.students.find(x=>String(x.id)===String(form.studentId.value));form.amount.value=st?Number(st.monthlyFee||0).toFixed(2):'';};
    const syncPaymentMethod=()=>{const st=state.students.find(x=>String(x.id)===String(form.studentId.value));if(st)form.paymentMethod.value=st.paymentMethod||'pix';};
    form.studentId.addEventListener('change',()=>{syncAmount();syncPaymentMethod();});
    if(hasPreselected){syncAmount();syncPaymentMethod();}
    form.addEventListener('submit',e=>{e.preventDefault();const fd=new FormData(form),sid=String(fd.get('studentId')||'');if(!sid)return toast('Selecione um aluno.');const st=state.students.find(x=>String(x.id)===sid);const payment={id:uid('pay'),studentId:sid,studentName:st?.name||'',date:String(fd.get('date')),amount:Number(fd.get('amount'))||0,paymentMethod:String(fd.get('paymentMethod')||'pix'),reference:String(fd.get('reference')||'Mensalidade').trim(),type:String(fd.get('reference')||'Mensalidade').trim()||'Mensalidade',createdAt:new Date().toISOString()};state.payments.push(payment);if($('#advanceDue').checked&&st)st.dueDate=addMonthsISO(st.dueDate||isoToday(),1);addAudit('Receita registrada',`${st?.name||'Aluno'} • ${fmtDate(payment.date)} • ${fmtMoney(payment.amount)} • ${payment.paymentMethod==='cash'?'Dinheiro':'PIX'}`);saveState();closeModal();toast('Receita registrada.');render();});
  }

  function addMonthsISO(value, months) {
    const d=parseLocalDate(value)||todayNoon();
    const originalDay=d.getDate();
    d.setDate(1); d.setMonth(d.getMonth()+months);
    const last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();
    d.setDate(Math.min(originalDay,last));
    const p=n=>String(n).padStart(2,'0');
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
  }

  function openPaymentEditModal(id){
    if(!financialValuesVisible){toast('Mostre os valores antes de editar uma receita.');return;}
    const p=state.payments.find(x=>String(x.id)===String(id));if(!p)return;
    const students=[...state.students].sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'pt-BR')),original=structuredClone(p);
    openModal('Editar receita',`<form id="editPaymentForm" class="form-grid"><div class="field"><label>Aluno *</label><select name="studentId" required>${students.map(st=>`<option value="${st.id}" ${String(st.id)===String(p.studentId)?'selected':''}>${escapeHTML(st.name)}</option>`).join('')}</select></div><div class="field"><label>Data *</label><input name="date" type="date" required value="${escapeHTML(p.date||isoToday())}" /></div><div class="field"><label>Valor *</label><input name="amount" type="number" min="0" step="0.01" required value="${Number(p.amount)||0}" /></div><div class="field"><label>Forma de pagamento *</label><select name="paymentMethod"><option value="pix" ${(p.paymentMethod||'pix')==='pix'?'selected':''}>PIX</option><option value="cash" ${p.paymentMethod==='cash'?'selected':''}>Dinheiro</option></select></div><div class="field"><label>Referência</label><input name="reference" value="${escapeHTML(p.reference||p.type||'Mensalidade')}" /></div><label class="toggle-row"><input id="editAdvanceDue" type="checkbox"><span>Avançar vencimento do aluno em 1 mês <small>Somente se você quiser executar esta ação agora.</small></span></label><div class="notice compact">A edição altera este lançamento existente. Nenhuma nova receita será criada.</div><div class="modal-actions"><button type="button" class="btn btn-secondary" data-close-modal>Cancelar</button><button class="btn btn-primary" type="submit">${icon('check')} Salvar alterações</button></div></form>`);
    $('#editPaymentForm').addEventListener('submit',e=>{e.preventDefault();const fd=new FormData(e.currentTarget),sid=String(fd.get('studentId')),st=state.students.find(x=>String(x.id)===sid),updated={...p,studentId:sid,studentName:st?.name||p.studentName||'',date:String(fd.get('date')),amount:Number(fd.get('amount'))||0,paymentMethod:String(fd.get('paymentMethod')||'pix'),reference:String(fd.get('reference')||'Mensalidade').trim(),type:String(fd.get('reference')||'Mensalidade').trim()||'Mensalidade',updatedAt:new Date().toISOString()};state.payments=state.payments.map(x=>String(x.id)===String(id)?updated:x);if($('#editAdvanceDue').checked&&st)st.dueDate=addMonthsISO(st.dueDate||isoToday(),1);const changes=[];if(String(original.studentId)!==sid)changes.push(`aluno: ${original.studentName||'—'} → ${st?.name||'—'}`);if(original.date!==updated.date)changes.push(`data: ${fmtDate(original.date)} → ${fmtDate(updated.date)}`);if(Number(original.amount)!==Number(updated.amount))changes.push(`valor: ${fmtMoney(original.amount)} → ${fmtMoney(updated.amount)}`);if((original.paymentMethod||'pix')!==updated.paymentMethod)changes.push(`forma: ${(original.paymentMethod||'pix')==='cash'?'Dinheiro':'PIX'} → ${updated.paymentMethod==='cash'?'Dinheiro':'PIX'}`);if((original.reference||original.type||'')!==updated.reference)changes.push(`referência: ${original.reference||original.type||'—'} → ${updated.reference}`);addAudit('Receita editada',`${st?.name||updated.studentName||'Aluno'} • ${changes.join(' • ')||'dados conferidos sem alteração estrutural'}`);saveState();closeModal();renderFinance();toast('Alterações salvas na receita existente.');});
  }

  function renderExpenses(c) {
    const expenses=[...state.expenses].sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    c.innerHTML=`<div class="section-head"><div><h3>Gastos</h3><p>Despesas do studio</p></div><button class="btn btn-primary" id="addExpense">${icon('plus')} Novo gasto</button></div><section class="cards">${expenses.length?expenses.map(e=>`<article class="card"><div class="list-row"><div class="list-main"><strong>${escapeHTML(e.description)}</strong><span>${fmtDate(e.date)} • ${escapeHTML(e.category||'Outros')}${e.recurring?' • Recorrente':''}</span></div><div class="finance-row-actions"><strong class="money-negative">${privateMoney(e.amount)}</strong><button class="mini-icon js-edit-expense" data-id="${e.id}" title="Editar">${icon('edit')}</button><button class="mini-icon danger js-del-expense" data-id="${e.id}" title="Excluir">${icon('trash')}</button></div></div></article>`).join(''):emptyState('Nenhum gasto cadastrado','Cadastre equipamentos, manutenção, impostos, serviços e outras despesas.')}</section>`;
    $('#addExpense').addEventListener('click',()=>openExpenseModal());
    $$('.js-edit-expense',c).forEach(b=>b.addEventListener('click',()=>{if(!financialValuesVisible)return toast('Mostre os valores antes de editar um gasto.');openExpenseModal(b.dataset.id)}));
    $$('.js-del-expense',c).forEach(b=>b.addEventListener('click',()=>{const e=state.expenses.find(x=>x.id===b.dataset.id);openModal('Excluir gasto',`<div class="notice">Confirma excluir <strong>${escapeHTML(e?.description||'este gasto')}</strong>? O saldo do mês será recalculado.</div><div class="modal-actions"><button class="btn btn-secondary" data-close-modal>Cancelar</button><button class="btn btn-danger" id="confirmDeleteExpense">Excluir</button></div>`);$('#confirmDeleteExpense').addEventListener('click',()=>{state.expenses=state.expenses.filter(x=>x.id!==b.dataset.id);addAudit('Gasto excluído',`${e?.description||'Gasto'} • ${fmtDate(e?.date)} • ${fmtMoney(e?.amount)}`);saveState();closeModal();renderFinance();toast('Gasto excluído.');});}));
  }

  function openExpenseModal(id=null) {
    const existing=id?state.expenses.find(x=>x.id===id):null;
    if(existing&&!financialValuesVisible)return toast('Mostre os valores antes de editar um gasto.');
    openModal(existing?'Editar gasto':'Novo gasto',`<form id="expenseForm" class="form-grid"><div class="field"><label>Descrição *</label><input name="description" required value="${escapeHTML(existing?.description||'')}" placeholder="Ex.: Manutenção de equipamento" /></div><div class="form-grid two"><div class="field"><label>Categoria</label><select name="category">${['Equipamentos','Manutenção','Impostos','Serviços','Materiais','Estrutura','Energia','Água','Marketing','Outros'].map(x=>`<option ${existing?.category===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Data *</label><input type="date" name="date" required value="${escapeHTML(existing?.date||isoToday())}" /></div></div><div class="field"><label>Valor *</label><input type="number" name="amount" min="0" step="0.01" required value="${existing?.amount??''}" /></div><label class="toggle-row"><input type="checkbox" name="recurring" ${existing?.recurring?'checked':''}><span>Gasto recorrente mensal</span></label><div class="modal-actions"><button type="button" class="btn btn-secondary" data-close-modal>Cancelar</button><button class="btn btn-primary" type="submit">${icon('check')} ${existing?'Salvar alterações':'Salvar gasto'}</button></div></form>`);
    $('#expenseForm').addEventListener('submit',e=>{e.preventDefault();const fd=new FormData(e.currentTarget),record={id:existing?.id||uid('exp'),description:String(fd.get('description')).trim(),category:String(fd.get('category')||'Outros'),date:String(fd.get('date')),amount:Number(fd.get('amount'))||0,recurring:fd.get('recurring')==='on',createdAt:existing?.createdAt||new Date().toISOString()};if(existing){state.expenses=state.expenses.map(x=>x.id===existing.id?record:x);addAudit('Gasto editado',`${record.description} • ${fmtDate(record.date)} • ${fmtMoney(record.amount)}`);}else{state.expenses.push(record);addAudit('Gasto registrado',`${record.description} • ${fmtDate(record.date)} • ${fmtMoney(record.amount)}`);}saveState();closeModal();renderFinance();toast(existing?'Gasto atualizado.':'Gasto registrado.');});
  }

  function renderCharges() {
    const students=billingStudents().map(s=>({s,info:dueInfo(s)})).sort((a,b)=>a.info.days-b.info.days);
    const tabs=[['all','Todos'],['overdue','Vencidos'],['soon','Vencendo']];
    const filtered=students.filter(x=>chargeTab==='all'||(chargeTab==='overdue'?x.info.key==='overdue':['today','soon'].includes(x.info.key)));
    viewEl.innerHTML=`<div class="tabs">${tabs.map(([id,l])=>`<button class="tab ${chargeTab===id?'active':''}" data-charge-tab="${id}">${l}</button>`).join('')}</div><div class="notice">O botão de WhatsApp abre uma mensagem pronta. O envio só acontece quando você confirma no WhatsApp.</div><div class="section-head"><div><h3>Lembretes de mensalidade</h3><p>Vencimentos e cobranças</p></div></div><section class="cards">${filtered.length?filtered.map(({s,info})=>`<article class="card"><div class="student-card"><div><div class="student-name">${escapeHTML(s.name)}</div><div class="student-meta"><span>Vencimento: <strong>${fmtDate(s.dueDate)}</strong></span><span><strong>${privateMoney(s.monthlyFee)}</strong></span></div><div style="margin-top:9px"><span class="status ${info.cls}">${info.text}</span></div></div><div class="student-actions"><button class="mini-icon js-charge-whatsapp" data-id="${s.id}" title="WhatsApp">${icon('message')}</button><button class="mini-icon js-mark-paid" data-id="${s.id}" title="Registrar pagamento">${icon('check')}</button></div></div></article>`).join(''):emptyState('Nenhum aluno nessa situação','As cobranças aparecerão aqui conforme as datas de vencimento.')}</section>`;
    $$('[data-charge-tab]').forEach(b=>b.addEventListener('click',()=>{chargeTab=b.dataset.chargeTab;renderCharges();}));
    $$('.js-charge-whatsapp').forEach(b=>b.addEventListener('click',()=>sendChargeWhatsApp(b.dataset.id)));
    $$('.js-mark-paid').forEach(b=>b.addEventListener('click',()=>openPaymentModal(b.dataset.id)));
  }

  function phoneDigits(value){
    const digits=String(value||'').replace(/\D/g,'');
    return digits.startsWith('55')&&digits.length>11?digits.slice(2):digits;
  }
  function validateWhatsApp(value){
    const local=phoneDigits(value);
    if(!local)return {valid:false,reason:'Informe o WhatsApp do aluno.'};
    if(local.length!==11)return {valid:false,reason:'WhatsApp incompleto. Informe DDD + 9 dígitos.'};
    if(local.charAt(2)!=='9')return {valid:false,reason:'Confira o celular: após o DDD deve haver 9 dígitos.'};
    return {valid:true,local,international:`55${local}`,formatted:`(${local.slice(0,2)}) ${local.slice(2,7)}-${local.slice(7)}`};
  }
  function cleanPhone(value) {
    const check=validateWhatsApp(value);
    return check.valid?check.international:'';
  }

  function chargeMessage(s) {
    const info=dueInfo(s);
    const first=s.name.split(' ')[0];
    if (info.key==='overdue') return `Olá, ${first}! Tudo bem? Passando para lembrar que sua mensalidade do Studio Márcio Bueno, no valor de ${fmtMoney(s.monthlyFee)}, venceu em ${fmtDate(s.dueDate)}. Quando puder, me confirme o pagamento. Obrigado!`;
    if (info.key==='today') return `Olá, ${first}! Tudo bem? Passando para lembrar que sua mensalidade do Studio Márcio Bueno, no valor de ${fmtMoney(s.monthlyFee)}, vence hoje (${fmtDate(s.dueDate)}). Obrigado!`;
    return `Olá, ${first}! Tudo bem? Só passando para lembrar que sua mensalidade do Studio Márcio Bueno, no valor de ${fmtMoney(s.monthlyFee)}, vence em ${fmtDate(s.dueDate)}. Obrigado!`;
  }

  function sendChargeWhatsApp(id) {
    const s=state.students.find(x=>x.id===id); if(!s)return;
    if(!financialValuesVisible)return toast('Mostre os valores no Financeiro antes de preparar uma cobrança.');
    if(!(Number(s.monthlyFee)>0))return toast('Valor da mensalidade não cadastrado para este aluno.');
    if(!parseLocalDate(s.dueDate))return toast('Vencimento da mensalidade não cadastrado para este aluno.');
    const phone=cleanPhone(s.whatsapp);
    if(!phone)return toast('Cadastre um WhatsApp válido para este aluno.');
    const url=`https://wa.me/${phone}?text=${encodeURIComponent(chargeMessage(s))}`;
    window.open(url,'_blank','noopener,noreferrer');
  }

  function consentText(s) {
    const age=ageFromBirth(s.birthDate);
    return `TERMO DE CONSENTIMENTO E AUTODECLARAÇÃO PARA PRÁTICA DE ATIVIDADE FÍSICA\n\nEu, ${s.name}, ${age ?? '___'} anos, declaro que as informações sobre minha saúde fornecidas ao profissional responsável são verdadeiras e que não tenho conhecimento de condição que me impeça de participar das atividades físicas propostas.\n\nComprometo-me a informar imediatamente qualquer dor, mal-estar, alteração de saúde, uso de medicamento relevante ou orientação médica que possa interferir na prática de exercícios.\n\nEstou ciente de que este termo não substitui avaliação, diagnóstico ou liberação médica quando houver indicação, sintomas, fatores de risco ou recomendação de profissional de saúde.\n\nAo responder “LI E ACEITO” a esta mensagem, confirmo que li e compreendi o conteúdo acima e autorizo o registro deste aceite pelo Studio Márcio Bueno.\n\nData: ${fmtDate(isoToday())}\nStudio Márcio Bueno • Personal Trainer`;
  }

  function formatPhoneBR(value){
    const check=validateWhatsApp(value);
    if(check.valid)return `+55 (${check.local.slice(0,2)}) ${check.local.slice(2,7)}-${check.local.slice(7)}`;
    const digits=phoneDigits(value);
    if(digits.length===10)return `+55 (${digits.slice(0,2)}) ${digits.slice(2,6)}-${digits.slice(6)} • incompleto`;
    return value?'Número inválido':'Sem WhatsApp';
  }

  function reminderTemplate(type){
    const templates={
      frequency:'Olá, [nome]! Seu resumo de [mes] no Studio Márcio Bueno: você realizou [treinos] treino(s), teve [faltas] falta(s) e [reposicoes] reposição(ões). Continue firme! 💪',
      charge:'Olá, [nome]! Tudo bem? Passando para lembrar que sua mensalidade do Studio Márcio Bueno, no valor de [valor], [status_vencimento]. Quando puder, me confirme o pagamento. Obrigado!',
      birthday:'Olá, [nome]! 🎉 Passando para desejar um feliz aniversário! Que seu novo ciclo seja cheio de saúde, conquistas e bons momentos. Um abraço do Studio Márcio Bueno!',
      absence:'Olá, [nome]! Tudo bem? Sentimos sua falta nos últimos treinos. Quando puder, me avise para organizarmos sua rotina e mantermos a frequência. 💪',
      confirmation:'Olá, [nome]! Tudo bem? Passando para confirmar seu horário de treino no Studio Márcio Bueno: [horarios]. Se precisar ajustar, me avise por aqui. 👍',
      makeup:'Olá, [nome]! Tudo bem? [situacao_reposicao] Se tiver interesse, me responda por aqui para combinarmos o melhor horário.',
      general:'Olá, [nome]! Tudo bem? Passando para deixar um lembrete do Studio Márcio Bueno.'
    };
    return templates[type]||templates.general;
  }

  function billingStatusText(student){
    if(!student?.dueDate)return '';
    const days=daysBetween(student.dueDate,todayNoon()),date=fmtDate(student.dueDate);
    if(days<0)return `venceu em ${date}`;
    if(days===0)return `vence hoje (${date})`;
    return `vence em ${date}`;
  }
  function personalizeReminder(template, student, mk=monthKey()){
    const st=monthlyAttendanceStats(student.id,mk);
    let out=String(template||'')
      .replaceAll('[nome]',firstName(student.name))
      .replaceAll('[treinos]',String(st.present))
      .replaceAll('[faltas]',String(st.absent))
      .replaceAll('[reposicoes]',String(st.makeups))
      .replaceAll('[mes]',monthLabel(mk))
      .replaceAll('[valor]',fmtMoney(student.monthlyFee))
      .replaceAll('[vencimento]',fmtDate(student.dueDate))
      .replaceAll('[forma_pagamento]',student.paymentMethod==='cash'?'Dinheiro':'PIX')
      .replaceAll('[status_vencimento]',billingStatusText(student))
      .replaceAll('[horarios]',fixedScheduleMessage(student.id))
      .replaceAll('[saldo_reposicoes_texto]',(()=>{const n=makeupCreditBalance(student.id).available;return n>0?`${n} ${n===1?'reposição disponível':'reposições disponíveis'}`:'sem créditos disponíveis (agendamento manual permitido)'})())
      .replaceAll('[situacao_reposicao]',(()=>{const n=makeupCreditBalance(student.id).available;return n>0?`Você possui ${n} ${n===1?'crédito de reposição disponível':'créditos de reposição disponíveis'} no Studio Márcio Bueno.`:'No momento você está sem créditos de reposição, mas posso fazer um agendamento manual no Studio Márcio Bueno.'})());
    out=out.replace(/\b1 treino\(s\)/gi,'1 treino').replace(/\b(\d+) treino\(s\)/gi,'$1 treinos')
      .replace(/\b1 falta\(s\)/gi,'1 falta').replace(/\b(\d+) falta\(s\)/gi,'$1 faltas')
      .replace(/\b1 reposição\(ões\)/gi,'1 reposição').replace(/\b(\d+) reposição\(ões\)/gi,'$1 reposições');
    return out;
  }

  function renderReminders(){
    const students=[...activeStudents()].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')),mk=monthKey();
    const overdueIds=new Set(students.filter(s=>dueInfo(s).key==='overdue').map(s=>String(s.id)));
    const birthdayTodayIds=new Set(birthdayStudents(0).map(x=>String(x.s.id)));
    const birthdayUpcomingIds=new Set(birthdayStudents(7).filter(x=>x.info.days>0).map(x=>String(x.s.id)));
    const absentIds=new Set(students.filter(s=>monthlyAttendanceStats(s.id,mk).absent>0).map(s=>String(s.id)));
    const frequencySets={
      zero:new Set(students.filter(s=>monthlyAttendanceStats(s.id,mk).present===0).map(s=>String(s.id))),
      low:new Set(students.filter(s=>{const n=monthlyAttendanceStats(s.id,mk).present;return n>=1&&n<=4}).map(s=>String(s.id))),
      mid:new Set(students.filter(s=>{const n=monthlyAttendanceStats(s.id,mk).present;return n>=5&&n<=8}).map(s=>String(s.id))),
      high:new Set(students.filter(s=>monthlyAttendanceStats(s.id,mk).present>=9).map(s=>String(s.id)))
    };
    let activeFilter='none',frequencyFilter='all',sendMode='group',searchQuery='',currentTemplate='frequency';
    const selectedIds=new Set();
    const filterIds=()=>{
      let base=activeFilter==='overdue'?overdueIds:activeFilter==='birthday'?birthdayTodayIds:activeFilter==='birthdayUpcoming'?birthdayUpcomingIds:activeFilter==='absent'?absentIds:new Set(students.map(s=>String(s.id)));
      if(frequencyFilter!=='all')base=new Set([...base].filter(id=>frequencySets[frequencyFilter].has(id)));
      return base;
    };
    const visibleStudents=()=>{const qDigits=searchQuery.replace(/\D/g,'');return activeFilter==='none'&&!searchQuery?[]:students.filter(s=>filterIds().has(String(s.id))&&(!searchQuery||[s.name,s.email].some(v=>String(v||'').toLowerCase().includes(searchQuery))||String(s.whatsapp||'').toLowerCase().includes(searchQuery)||(qDigits&&phoneDigits(s.whatsapp).includes(qDigits))))};
    viewEl.innerHTML=`<div class="notice reminder-intro">${icon('message')}<div><strong>Central de comunicação</strong><span>Fluxo simples: escolha a mensagem, selecione os destinatários e revise antes de abrir o WhatsApp.</span></div></div>
      <section class="reminder-steps"><span class="active">1 <b>Mensagem</b></span><span>2 <b>Destinatários</b></span><span>3 <b>Revisar</b></span></section>
      <section class="card reminder-card">
        <div class="reminder-mode-switch"><button type="button" class="reminder-mode" data-mode="individual">${icon('users')} Individual</button><button type="button" class="reminder-mode active" data-mode="group">${icon('message')} Grupo de alunos</button></div>
        <div class="field"><label>Mensagem</label><textarea id="reminderMessage" class="auto-message reminder-auto-grow" placeholder="Escolha um modelo ou escreva sua mensagem."></textarea><small>Campos automáticos: <strong>[nome]</strong>, <strong>[treinos]</strong>, <strong>[faltas]</strong>, <strong>[reposicoes]</strong> <span class="token-help">(reposições)</span>, <strong>[mes]</strong>, <strong>[valor]</strong>, <strong>[vencimento]</strong>, <strong>[status_vencimento]</strong>, <strong>[forma_pagamento]</strong>, <strong>[horarios]</strong> e <strong>[saldo_reposicoes_texto]</strong>.</small></div>
        <div class="reminder-template-head"><strong>Mensagens prontas</strong><span>Personalizadas automaticamente</span></div>
        <div class="reminder-templates">${[['frequency','calendar','Frequência do mês'],['charge','bell','Cobrança'],['birthday','calendar','Aniversário'],['absence','users','Retorno'],['confirmation','check','Confirmar horário'],['makeup','calendar','Reposição disponível'],['general','message','Geral']].map(([k,i,l],idx)=>`<button type="button" class="btn ${idx===0?'btn-primary':'btn-secondary'} btn-small js-template" data-template="${k}">${icon(i)} ${l}</button>`).join('')}</div>
        <div class="reminder-stage-title"><span class="stage-number">2</span><div><strong>Selecionar destinatários</strong><small>Use busca ou filtro; a lista só aparece quando necessária.</small></div></div>
        <div class="search-wrap">${icon('search')}<input id="reminderSearch" type="search" placeholder="Buscar aluno pelo nome, WhatsApp ou e-mail" /></div>
        <div class="recipient-filters">
          <button class="recipient-filter" data-filter="all">Todos <b>${students.length}</b></button>
          <button class="recipient-filter" data-filter="overdue">Vencidos <b>${overdueIds.size}</b></button>
          <button class="recipient-filter" data-filter="birthday">Aniversário hoje <b>${birthdayTodayIds.size}</b></button><button class="recipient-filter" data-filter="birthdayUpcoming">Próximos 7 dias <b>${birthdayUpcomingIds.size}</b></button>
          <button class="recipient-filter" data-filter="absent">Com faltas <b>${absentIds.size}</b></button>
          <select id="frequencyFilter"><option value="all">Frequência: todas</option><option value="zero">0 treinos (${frequencySets.zero.size})</option><option value="low">1–4 treinos (${frequencySets.low.size})</option><option value="mid">5–8 treinos (${frequencySets.mid.size})</option><option value="high">9+ treinos (${frequencySets.high.size})</option></select>
        </div>
        <div class="recipient-result-bar"><span id="recipientResultLabel">Escolha um filtro ou pesquise um aluno.</span><div><button type="button" class="link-btn" id="selectVisible">Selecionar exibidos</button><button type="button" class="link-btn" id="clearReminder">Limpar</button></div></div>
        <div id="reminderStudents" class="reminder-students collapsed-list"></div>
        <div class="reminder-footer sticky-reminder-footer"><div class="reminder-selection-summary" id="reminderSelectionSummary">Nenhum aluno selecionado</div><button type="button" class="btn btn-primary" id="prepareReminder" disabled>Revisar mensagens</button></div>
      </section><section id="reminderQueue" class="cards reminder-review" style="margin-top:12px"></section>`;
    const updateSummary=()=>{const n=selectedIds.size;$('#reminderSelectionSummary').innerHTML=n?`<strong>${n} aluno${n===1?'':'s'} selecionado${n===1?'':'s'}</strong><span class="selection-safety-note">Somente estes destinatários entrarão na revisão.</span>`:'<strong>Nenhum aluno selecionado</strong><span class="selection-safety-note">Selecione pelo menos um destinatário.</span>';$('#prepareReminder').disabled=!n;$('#prepareReminder').innerHTML=n?`${icon('check')} Revisar ${n} destinatário${n===1?'':'s'}`:'Revisar mensagens';};
    const resetReminderReview=()=>{const queue=$('#reminderQueue'),footer=$('.sticky-reminder-footer');if(queue)queue.innerHTML='';if(footer)footer.classList.remove('review-mode-hidden');};
    const draw=()=>{const list=visibleStudents(),root=$('#reminderStudents'),visibleIds=new Set(list.map(s=>String(s.id))),hiddenSelected=[...selectedIds].filter(id=>!visibleIds.has(id)).length,collapsed=activeFilter==='none'&&!searchQuery;$('#recipientResultLabel').textContent=list.length?`${list.length} aluno${list.length===1?'':'s'} encontrado${list.length===1?'':'s'} • ${selectedIds.size} selecionado${selectedIds.size===1?'':'s'}${hiddenSelected?` • ${hiddenSelected} fora da lista atual`:''}`:(collapsed?`Lista recolhida • ${students.length} alunos disponíveis`:'Nenhum aluno encontrado');const selectVisibleBtn=$('#selectVisible'),validVisible=list.filter(st=>validateWhatsApp(st.whatsapp).valid).length;if(selectVisibleBtn)selectVisibleBtn.textContent=validVisible?`Selecionar ${validVisible} válido${validVisible===1?'':'s'}`:'Nenhum WhatsApp válido';root.innerHTML=list.length?list.map(s=>{const sid=String(s.id),checked=selectedIds.has(sid),info=dueInfo(s),st=monthlyAttendanceStats(s.id,mk);const tags=[`<span class="status neutral">${st.present} treino${st.present===1?'':'s'}</span>`];if(info.key==='overdue')tags.push('<span class="status danger">Vencido</span>');if(st.absent)tags.push(`<span class="status neutral">${st.absent} falta${st.absent===1?'':'s'}</span>`);const phoneOk=validateWhatsApp(s.whatsapp).valid;if(!phoneOk)tags.push('<span class="status danger">WhatsApp inválido</span>');return `<label class="reminder-student recipient-card ${checked?'selected':''} ${phoneOk?'':'recipient-disabled'}"><input class="recipient-native-control" type="${sendMode==='individual'?'radio':'checkbox'}" name="reminderStudent" value="${sid}" ${checked?'checked':''} ${phoneOk?'':'disabled'}><span class="student-photo tiny-photo">${s.photoData?`<img src="${s.photoData}" alt="" />`:`<span>${escapeHTML((s.name||'?').charAt(0).toUpperCase())}</span>`}</span><span class="reminder-student-info"><strong>${escapeHTML(s.name)}</strong><small>${escapeHTML(formatPhoneBR(s.whatsapp))}</small><span class="reminder-tags">${tags.join('')}</span></span><span class="recipient-check" aria-hidden="true">${phoneOk?icon('check'):'!'}</span></label>`}).join(''):emptyState('Lista recolhida','Escolha um filtro ou pesquise para mostrar apenas os alunos necessários.');
      $$('input[name="reminderStudent"]',root).forEach(x=>x.addEventListener('change',()=>{resetReminderReview();if(sendMode==='individual'){selectedIds.clear();if(x.checked)selectedIds.add(String(x.value));draw();return;}x.checked?selectedIds.add(String(x.value)):selectedIds.delete(String(x.value));draw();}));updateSummary();};
    const clearSelectionForContextChange=()=>{resetReminderReview();if(!selectedIds.size)return;selectedIds.clear();toast('Seleção limpa ao trocar o filtro.');};
    const applyFilter=k=>{if(k!==activeFilter)clearSelectionForContextChange();activeFilter=k;$$('.recipient-filter',viewEl).forEach(b=>b.classList.toggle('active',b.dataset.filter===k));draw();};
    $$('.reminder-mode',viewEl).forEach(b=>b.addEventListener('click',()=>{sendMode=b.dataset.mode;selectedIds.clear();resetReminderReview();$$('.reminder-mode',viewEl).forEach(x=>x.classList.toggle('active',x===b));draw();}));
    $$('.recipient-filter',viewEl).forEach(b=>b.addEventListener('click',()=>applyFilter(b.dataset.filter)));
    $('#frequencyFilter').addEventListener('change',e=>{clearSelectionForContextChange();frequencyFilter=e.target.value;if(activeFilter==='none')activeFilter='all';draw();});
    $('#reminderSearch').addEventListener('input',e=>{resetReminderReview();searchQuery=e.target.value.trim().toLowerCase();if(searchQuery&&activeFilter==='none')activeFilter='all';draw();});
    const messageBox=$('#reminderMessage');const growMessage=()=>{messageBox.style.height='auto';messageBox.style.height=`${Math.min(230,Math.max(110,messageBox.scrollHeight))}px`;};messageBox.addEventListener('input',growMessage);
    $$('.js-template',viewEl).forEach(b=>b.addEventListener('click',()=>{currentTemplate=b.dataset.template;messageBox.value=reminderTemplate(currentTemplate);growMessage();$$('.js-template',viewEl).forEach(x=>{x.classList.toggle('btn-primary',x===b);x.classList.toggle('btn-secondary',x!==b)});if(currentTemplate==='birthday'){selectedIds.clear();applyFilter('birthday');toast(birthdayTodayIds.size?'Mostrando aniversariantes de hoje.':'Não há aniversariante hoje.');}}));
    $('#selectVisible').addEventListener('click',()=>{const list=visibleStudents();if(!list.length)return;const applyVisibleSelection=()=>{resetReminderReview();const valid=list.filter(st=>validateWhatsApp(st.whatsapp).valid);if(sendMode==='individual'){selectedIds.clear();if(valid[0])selectedIds.add(String(valid[0].id));}else valid.forEach(st=>selectedIds.add(String(st.id)));if(valid.length<list.length)toast(`${list.length-valid.length} aluno${list.length-valid.length===1?'':'s'} com WhatsApp inválido ${list.length-valid.length===1?'foi ignorado':'foram ignorados'}.`);draw();};if(sendMode==='group'&&list.length>10){openModal('Selecionar destinatários',`<div class="notice">Você está prestes a selecionar <strong>${list.length} alunos</strong>. Isso pode preparar muitas conversas de WhatsApp. Confirme somente se essa é realmente a sua intenção.</div><div class="modal-actions"><button class="btn btn-secondary" data-close-modal>Cancelar</button><button class="btn btn-primary" id="confirmBulkRecipients">Selecionar ${list.length}</button></div>`);$('#confirmBulkRecipients').addEventListener('click',()=>{closeModal();applyVisibleSelection();toast(`${list.length} destinatários selecionados.`)});return;}applyVisibleSelection();});
    $('#clearReminder').addEventListener('click',()=>{selectedIds.clear();resetReminderReview();draw();});
    let reminderReviewOpening=false;
    const openReminderReview=()=>{
      const msg=$('#reminderMessage')?.value.trim()||'';if(!msg)return toast('Escreva ou escolha uma mensagem primeiro.');
      const selected=[...selectedIds].map(id=>state.students.find(s=>String(s.id)===id)).filter(Boolean).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
      if(!selected.length)return toast('Selecione pelo menos um aluno.');
      if(selected.length!==selectedIds.size)return toast('Revise a seleção: um destinatário não está mais disponível.');
      const financeTokens=/\[(valor|vencimento|status_vencimento)\]/i.test(msg);
      if(financeTokens&&!financialValuesVisible)return toast('Para revisar uma cobrança com valor, primeiro escolha “Mostrar valores” no Financeiro.');
      const reviewCards=selected.map(s=>{
        const phoneCheck=validateWhatsApp(s.whatsapp),missingFinance=financeTokens&&(!(Number(s.monthlyFee)>0)||!parseLocalDate(s.dueDate)),msgFinal=personalizeReminder(msg,s,mk);
        const issues=[],notes=[];if(!phoneCheck.valid)issues.push(phoneCheck.reason);if(missingFinance)issues.push(!(Number(s.monthlyFee)>0)?'Valor da mensalidade não cadastrado.':'Vencimento da mensalidade não cadastrado.');if(currentTemplate==='birthday'){const bi=birthdayInfo(s);if(!bi||bi.days!==0)issues.push(`Aniversário ${bi?`em ${bi.days} dia${bi.days===1?'':'s'}`:'fora da data atual'}. Use a felicitação no dia correto.`);}if(currentTemplate==='confirmation'&&!fixedScheduleEntries(s.id).length)issues.push('Nenhum horário fixo cadastrado para confirmar.');if(currentTemplate==='absence'&&studentPauseAt(s))issues.push('Aluno em pausa ativa: use uma comunicação de retorno da pausa, não de ausência.');if(currentTemplate==='makeup'&&makeupCreditBalance(s.id).available<=0)notes.push('Sem créditos de reposição — agendamento manual permitido.');
        const blocked=issues.length>0;
        return `<article class="card reminder-ready reminder-review-card ${blocked?'review-blocked':''}"><div class="list-main"><strong>${escapeHTML(s.name)}</strong><span>${escapeHTML(formatPhoneBR(s.whatsapp))}</span>${blocked?`<div class="reminder-review-warning">${issues.map(escapeHTML).join(' ')}</div>`:''}${notes.length?`<div class="reminder-review-info">${notes.map(escapeHTML).join(' ')}</div>`:''}<small>${escapeHTML(msgFinal)}</small></div>${!blocked?`<button type="button" class="btn btn-primary js-open-reminder-modal" data-url="https://wa.me/${phoneCheck.international}?text=${encodeURIComponent(msgFinal)}">${icon('message')} <span>Abrir WhatsApp</span></button>`:'<span class="status danger">Revisar dados</span>'}</article>`;
      }).join('');
      openModal('3. Revisar e enviar',`<div class="notice reminder-review-notice"><strong>${selected.length} destinatário${selected.length===1?'':'s'} selecionado${selected.length===1?'':'s'} • ${selected.length} mensage${selected.length===1?'m':'ns'} para revisar</strong><span>Confira cada mensagem abaixo. Nada será enviado automaticamente.</span></div><div class="cards reminder-review-modal">${reviewCards}</div><div class="modal-actions reminder-review-actions"><button type="button" class="btn btn-secondary" data-close-modal>Voltar aos destinatários</button></div>`);
      $$('.js-open-reminder-modal',modalRoot).forEach(btn=>btn.addEventListener('click',()=>{window.open(btn.dataset.url,'_blank','noopener,noreferrer');if(!btn.classList.contains('whatsapp-opened')){btn.classList.add('whatsapp-opened');const label=btn.querySelector('span');if(label)label.textContent='WhatsApp aberto';btn.insertAdjacentHTML('afterbegin','✓ ');}}));
    };
    const reviewBtn=$('#prepareReminder');
    let touchStartX=0,touchStartY=0,lastReviewTrigger=0;
    const triggerReminderReview=(e)=>{
      if(e){e.preventDefault();e.stopPropagation();}
      const now=Date.now();
      if(reminderReviewOpening||reviewBtn.disabled||now-lastReviewTrigger<450)return;
      lastReviewTrigger=now;
      reminderReviewOpening=true;
      reviewBtn.setAttribute('aria-busy','true');
      reviewBtn.innerHTML=`${icon('check')} Abrindo revisão…`;
      try{openReminderReview();}
      finally{
        reminderReviewOpening=false;
        if(document.body.contains(reviewBtn)){
          reviewBtn.removeAttribute('aria-busy');
          reviewBtn.disabled=selectedIds.size===0;
          reviewBtn.innerHTML=selectedIds.size?`${icon('check')} Revisar ${selectedIds.size} destinatário${selectedIds.size===1?'':'s'}`:'Revisar mensagens';
        }
      }
    };
    reviewBtn.addEventListener('touchstart',e=>{const t=e.touches?.[0];if(t){touchStartX=t.clientX;touchStartY=t.clientY;}},{passive:true});
    reviewBtn.addEventListener('touchend',e=>{const t=e.changedTouches?.[0];if(!t)return;const moved=Math.hypot(t.clientX-touchStartX,t.clientY-touchStartY);if(moved<=14)triggerReminderReview(e);},{passive:false});
    reviewBtn.addEventListener('click',e=>{if(Date.now()-lastReviewTrigger<700){e.preventDefault();e.stopPropagation();return;}triggerReminderReview(e);});
    messageBox.value=reminderTemplate('frequency');growMessage();draw();
  }

  function renderConsent() {
    const students=[...activeStudents()].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
    const counts={accepted:students.filter(s=>s.consent?.acceptedAt).length,sent:students.filter(s=>s.consent?.sentAt&&!s.consent?.acceptedAt).length,pending:students.filter(s=>!s.consent?.sentAt&&!s.consent?.acceptedAt).length};
    viewEl.innerHTML=`<div class="notice">Este modelo é uma autodeclaração de consentimento e não substitui avaliação ou liberação médica quando indicada.</div>
      <section class="consent-summary"><div><strong>${students.length}</strong><span>Alunos</span></div><div><strong>${counts.pending}</strong><span>Pendentes</span></div><div><strong>${counts.sent}</strong><span>Enviados</span></div><div><strong>${counts.accepted}</strong><span>Aceitos</span></div></section>
      <div class="student-toolbar"><div class="search-wrap">${icon('search')}<input id="consentSearch" type="search" placeholder="Buscar aluno" /></div><div class="tabs consent-tabs"><button class="tab active" data-consent-filter="all">Todos</button><button class="tab" data-consent-filter="pending">Pendentes</button><button class="tab" data-consent-filter="sent">Enviados</button><button class="tab" data-consent-filter="accepted">Aceitos</button></div></div>
      <section id="consentList" class="cards"></section>`;
    let filter='all';
    const draw=()=>{const q=$('#consentSearch').value.trim().toLowerCase(),list=students.filter(s=>{const c=s.consent||{},status=c.acceptedAt?'accepted':c.sentAt?'sent':'pending';return (!q||s.name.toLowerCase().includes(q))&&(filter==='all'||status===filter)});$('#consentList').innerHTML=list.length?list.map(s=>{const c=s.consent||{},status=c.acceptedAt?'accepted':c.sentAt?'sent':'pending',label=status==='accepted'?`Aceito • ${fmtDate(c.acceptedAt.slice(0,10))}`:status==='sent'?`Aguardando aceite • ${fmtDate(c.sentAt.slice(0,10))}`:'Não enviado';return `<article class="card"><div class="student-card"><div><div class="student-name">${escapeHTML(s.name)}</div><div class="student-meta"><span class="status ${status==='accepted'?'good':status==='sent'?'warn':'neutral'}">${label}</span><span>Versão: <strong>${escapeHTML(c.version||'1.0')}</strong></span></div></div><div class="student-actions"><button class="mini-icon js-open-term" data-id="${s.id}" title="Abrir termo">${icon('file')}</button></div></div></article>`}).join(''):emptyState('Nenhum termo encontrado','Ajuste a busca ou o filtro.');$$('.js-open-term',viewEl).forEach(b=>b.addEventListener('click',()=>openConsentModal(b.dataset.id)));};
    $('#consentSearch').addEventListener('input',draw);$$('[data-consent-filter]',viewEl).forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.consentFilter;$$('[data-consent-filter]',viewEl).forEach(x=>x.classList.toggle('active',x===b));draw();}));draw();
  }

  function openConsentModal(id) {
    const s=state.students.find(x=>x.id===id); if(!s)return;
    const text=consentText(s),c=s.consent||{},version=c.version||'1.0';
    openModal('Termo de consentimento',`<section class="consent-meta-strip"><span>Documento do aluno</span><strong>Versão ${version}</strong></section><div class="consent-box" id="consentText">${escapeHTML(text)}</div><div class="consent-how"><strong>Como aceitar</strong><span>Após o aluno responder “LI E ACEITO”, confirme o aceite abaixo para registrar no sistema.</span></div><div class="modal-actions"><button class="btn btn-secondary" id="copyConsent">Copiar termo</button><button class="btn btn-primary" id="sendConsent">${icon('message')} WhatsApp</button></div><div class="modal-actions"><button class="btn btn-secondary" data-close-modal>Fechar</button><button class="btn ${c.sentAt&&!c.acceptedAt?'btn-success':'btn-secondary'}" id="acceptConsent" ${c.acceptedAt?'disabled':''}>${icon('check')} ${c.acceptedAt?'Aceito em '+fmtDate(c.acceptedAt.slice(0,10)):'Registrar aceite'}</button></div>`);
    $('#copyConsent').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(text);toast('Termo copiado.');}catch{fallbackCopy(text);}});
    $('#sendConsent').addEventListener('click',()=>{const phone=cleanPhone(s.whatsapp);if(!phone)return toast('Cadastre o WhatsApp deste aluno.');s.consent=s.consent||{};s.consent.sentAt=new Date().toISOString();s.consent.version=version;saveState();window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`,'_blank','noopener,noreferrer');toast('Envio registrado. Aguardando aceite.');});
    $('#acceptConsent')?.addEventListener('click',()=>{if(s.consent?.acceptedAt)return;if(!s.consent?.sentAt)return toast('Envie o termo antes de registrar o aceite.');openModal('Confirmar aceite',`<div class="notice">Confirma que <strong>${escapeHTML(s.name)}</strong> respondeu e aceitou o termo versão ${version}?</div><div class="modal-actions"><button class="btn btn-secondary" data-close-modal>Cancelar</button><button class="btn btn-success" id="confirmConsentAccept">${icon('check')} Confirmar aceite</button></div>`);$('#confirmConsentAccept').addEventListener('click',()=>{s.consent=s.consent||{};s.consent.acceptedAt=new Date().toISOString();s.consent.version=version;saveState();closeModal();toast('Aceite registrado com data e versão.');renderConsent();});});
  }

  function fallbackCopy(text){const ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();toast('Texto copiado.');}


  function renderBirthdayPanel(){
    const items=birthdayStudents(7);
    if(!items.length) return '';
    return `<div class="section-head"><div><h3>🎂 Aniversários</h3><p>Hoje e próximos 7 dias</p></div></div>
      <section class="cards">${items.map(({s,info})=>`<article class="card birthday-card"><div class="list-row"><div class="list-main"><strong>${escapeHTML(s.name)}</strong><span>${info.days===0?'🎉 Aniversário hoje':`Em ${info.days} dia${info.days===1?'':'s'} • ${fmtDate(`${info.next.getFullYear()}-${String(info.next.getMonth()+1).padStart(2,'0')}-${String(info.next.getDate()).padStart(2,'0')}`)}`}</span></div><div class="birthday-actions"><span class="status ${info.days===0?'warn':'neutral'}">${info.days===0?'HOJE':'EM BREVE'}</span><button class="mini-icon js-birthday-whatsapp" data-id="${s.id}" title="Enviar parabéns pelo WhatsApp">${icon('message')}</button></div></div></article>`).join('')}</section>`;
  }

  function dayIdFromDate(d){return {0:'sun',1:'mon',2:'tue',3:'wed',4:'thu',5:'fri',6:'sat'}[d.getDay()]||''}
  function weekendRestMessage(date){
    const messages=[
      ['Descansar também faz parte do progresso.','Hoje não há aulas programadas. Aproveite o dia para recuperar o corpo e recarregar as energias.'],
      ['Recuperação é parte do treino.','Um bom descanso prepara você para uma semana mais forte, consistente e produtiva.'],
      ['Uma boa semana começa com uma boa recuperação.','Hoje é dia de desacelerar, cuidar de você e chegar renovado aos próximos treinos.']
    ];
    const d=parseLocalDate(date)||todayNoon(),pick=messages[(d.getDate()+d.getMonth())%messages.length];
    return {title:pick[0],text:pick[1]};
  }
  function weeklyScheduleOverviewHTML(){
    return `<div class="schedule-week-overview">${SCHEDULE_CALENDAR_DAYS.map(d=>{
      const date=scheduleDateForDay(d.id),closure=closureForDate(date);
      if(d.weekend){const rest=weekendRestMessage(date);return `<article class="card week-overview-day weekend-overview-day"><div class="premium-card-title"><span>${d.label}</span><strong>${fmtDate(date).slice(0,5)}</strong></div><div class="weekend-overview-copy"><strong>Descanso</strong><span>${escapeHTML(rest.title)}</span></div></article>`;}
      if(closure)return `<article class="card week-overview-day is-closed"><div class="premium-card-title"><span>${d.label}</span><strong>${fmtDate(date).slice(0,5)}</strong></div><div class="week-closure"><strong>${escapeHTML(closure.type)} — aulas canceladas</strong><span>${escapeHTML(closure.label||'Studio fechado')} • ninguém recebe falta</span></div></article>`;
      const activeSlots=scheduleHours(d.id).filter(t=>effectiveFixedStudentIds(d.id,t,date).length||effectiveMakeupStudentIds(date,d.id,t).length||trialsFor(date,d.id,t).length);
      const fixed=activeSlots.reduce((n,t)=>n+effectiveFixedStudentIds(d.id,t,date).length,0),reps=activeSlots.reduce((n,t)=>n+effectiveMakeupStudentIds(date,d.id,t).length,0);
      return `<article class="card week-overview-day"><div class="premium-card-title"><span>${d.label}</span><strong>${fmtDate(date).slice(0,5)}</strong></div><p>${activeSlots.length} aula${activeSlots.length===1?'':'s'} • ${fixed} fixo${fixed===1?'':'s'} • ${reps} reposição${reps===1?'':'ões'}</p><div class="week-overview-times">${activeSlots.length?activeSlots.map(t=>`<button type="button" class="week-slot-chip" data-week-day="${d.id}" data-week-time="${t}">${t} <span>${effectiveFixedStudentIds(d.id,t,date).length}+${effectiveMakeupStudentIds(date,d.id,t).length}R</span></button>`).join(''):'<span class="muted-inline">Sem alunos neste dia</span>'}</div></article>`
    }).join('')}</div>`;
  }
  function monthlyScheduleOverviewHTML(){
    const anchor=scheduleMonthAnchor,y=anchor.getFullYear(),m=anchor.getMonth(),last=new Date(y,m+1,0).getDate(),firstDow=(new Date(y,m,1,12).getDay()+6)%7;
    const cells=[];for(let i=0;i<firstDow;i++)cells.push('<div class="month-day blank"></div>');
    for(let n=1;n<=last;n++){
      const d=new Date(y,m,n,12),dayId=dayIdFromDate(d),date=isoDate(d),closure=closureForDate(date),isWeekend=dayId==='sat'||dayId==='sun';
      if(isWeekend){cells.push(`<button type="button" class="month-day weekend ${date===isoToday()?'today':''}" data-month-date="${date}"><strong>${n}</strong><span>Descanso</span></button>`);continue;}
      const slots=scheduleHours(dayId),classes=slots.filter(tm=>effectiveFixedStudentIds(dayId,tm,date).length||effectiveMakeupStudentIds(date,dayId,tm).length||trialsFor(date,dayId,tm).length).length,reps=slots.reduce((a,tm)=>a+effectiveMakeupStudentIds(date,dayId,tm).length,0),planned=plannedAbsencesOn(date).length;
      const vacancies=slots.filter(tm=>effectiveFixedStudentIds(dayId,tm,date).length||effectiveMakeupStudentIds(date,dayId,tm).length||trialsFor(date,dayId,tm).length).reduce((a,tm)=>{const occupied=effectiveFixedStudentIds(dayId,tm,date).length+effectiveMakeupStudentIds(date,dayId,tm).length+trialsFor(date,dayId,tm).length;return a+Math.max(0,4-occupied)},0);
      const mapCount=Object.entries(state.attendance||{}).filter(([k])=>k.startsWith(date+'__')).reduce((a,[k,map])=>{const slot=k.split('__')[1]||'',idx=slot.indexOf('_'),tm=slot.slice(idx+1),dId=slot.slice(0,idx);return a+Object.entries(map||{}).filter(([id,v])=>{const st=state.students.find(x=>String(x.id)===String(id));return v==='present'&&st&&!studentPauseAt(st,date)&&!plannedAbsenceFor(id,date)&&dId===dayId&&tm}).length},0);
      cells.push(`<button type="button" class="month-day ${date===isoToday()?'today':''} ${closure?'is-closed':''}" data-month-date="${date}"><strong>${n}</strong>${closure?`<span class="month-closed">${escapeHTML(closure.type)}</span>`:`<span>${classes} aula${classes===1?'':'s'}</span>${reps?`<em>${reps}R</em>`:''}${planned?`<em class="month-absence">${planned}A</em>`:''}${vacancies?`<small>${vacancies} vaga${vacancies===1?'':'s'}</small>`:''}${mapCount?`<small>✓ ${mapCount}</small>`:''}`}</button>`);
    }
    return `<section class="month-overview"><div class="month-weekdays"><span>SEG</span><span>TER</span><span>QUA</span><span>QUI</span><span>SEX</span><span>SÁB</span><span>DOM</span></div><div class="month-grid">${cells.join('')}</div></section>`;
  }

  function renderSchedule(){
    refreshStateFromStorage();
    const isMonth=scheduleViewMode==='month',weekEnd=addDays(scheduleWeekStart,6),displayMk=isMonth?displayedScheduleMonthKey():monthKey(scheduleDateForDay(selectedScheduleDay)),students=[...activeStudents()].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')),occ=occupancyStats(scheduleWeekStart);
    const day=SCHEDULE_CALENDAR_DAYS.find(d=>d.id===selectedScheduleDay)||SCHEDULE_CALENDAR_DAYS[0],date=scheduleDateForDay(day.id),isWeekend=Boolean(day.weekend),slots=isWeekend?[]:scheduleHours(day.id),dayClosure=closureForDate(date),dayPlanned=isWeekend?0:plannedAbsencesOn(date).length,weekendRest=isWeekend?weekendRestMessage(date):null;
    const dayStats=slots.reduce((acc,time)=>{
      const ids=slotStudents(day.id,time),effectiveFixed=effectiveFixedStudentIds(day.id,time,date),makeupIds=effectiveMakeupStudentIds(date,day.id,time),map=attendanceMap(date,day.id,time),eligible=[...new Set([...effectiveFixed,...makeupIds])].filter(id=>{const st=state.students.find(x=>String(x.id)===String(id));return st&&!studentPauseAt(st,date)&&!plannedAbsenceFor(id,date)});
      if(effectiveFixed.length||makeupIds.length)acc.classes++;
      acc.fixed+=effectiveFixed.length;acc.makeups+=makeupIds.length;
      eligible.forEach(id=>{if(map[id]==='present')acc.present++;if(map[id]==='absent')acc.absent++;});
      return acc;
    },{classes:0,fixed:0,makeups:0,present:0,absent:0});
    const navHTML=isMonth?`<div class="week-nav schedule-week-nav month-navigation"><button class="mini-icon" id="prevMonth" title="Mês anterior">‹</button><div class="week-label"><strong>${escapeHTML(monthLabel(displayMk))}</strong>${isSameMonth(scheduleMonthAnchor,todayNoon())?'<span class="current-period-label">Mês atual</span>':'<button class="link-btn" id="currentMonth">Ir para o mês atual</button>'}</div><button class="mini-icon" id="nextMonth" title="Próximo mês">›</button></div>`:`<div class="week-nav schedule-week-nav"><button class="mini-icon" id="prevWeek" title="Semana anterior">‹</button><div class="week-label"><strong>${fmtDate(isoDate(scheduleWeekStart))} — ${fmtDate(isoDate(weekEnd))}</strong>${isCurrentScheduleWeek()?'<span class="current-period-label">Semana atual</span>':'<button class="link-btn" id="currentWeek">Ir para a semana atual</button>'}</div><button class="mini-icon" id="nextWeek" title="Próxima semana">›</button></div>`;

    viewEl.innerHTML=`
      <section class="schedule-pro-head">
        <div><span class="section-overline">AGENDA PREMIUM</span><h3>${scheduleViewMode==='day'?'Agenda diária':scheduleViewMode==='week'?'Agenda semanal':'Agenda mensal'}</h3><p>Personal • até 4 alunos por horário • múltiplas reposições com controle de créditos</p></div>
        <div class="schedule-head-actions">${!isMonth?`<button class="btn btn-secondary btn-small" id="shareMakeupSlots">${icon('message')} Horários de reposição</button>`:''}<button class="btn btn-primary btn-small holiday-3d-btn" id="quickHoliday">★ Marcar feriado</button><button class="btn btn-secondary btn-small" id="manageClosures">Feriados / recesso</button><span class="schedule-pro-badge">${icon('calendar')} ${escapeHTML(monthLabel(displayMk))}</span></div>
      </section>
      ${navHTML}
      <div class="schedule-view-tabs" role="tablist"><button type="button" class="tab ${scheduleViewMode==='day'?'active':''}" data-schedule-view="day">Dia</button><button type="button" class="tab ${scheduleViewMode==='week'?'active':''}" data-schedule-view="week">Semana</button><button type="button" class="tab ${scheduleViewMode==='month'?'active':''}" data-schedule-view="month">Mês</button></div>
      <div class="schedule-day-tabs ${isMonth?'hidden':''}" role="tablist">${SCHEDULE_CALENDAR_DAYS.map(d=>{const dte=parseLocalDate(scheduleDateForDay(d.id)),short=d.label.slice(0,3).toUpperCase(),active=d.id===day.id;return `<button type="button" class="schedule-day-tab ${d.weekend?'weekend-tab':''} ${active?'active':''}" data-schedule-day="${d.id}" role="tab" aria-selected="${active}"><small>${short}</small><strong>${String(dte.getDate()).padStart(2,'0')}</strong></button>`}).join('')}</div>
      ${!isMonth?`<section class="schedule-day-summary ${isWeekend?'weekend-summary':''}"><div><span class="section-overline">${day.label.toUpperCase()}</span><h3>${day.label}, ${fmtDate(date)}</h3><p>${dayClosure?`<strong>${escapeHTML(dayClosure.type)} • ${escapeHTML(dayClosure.label||'Studio fechado')}</strong>`:isWeekend?'<strong>Sem aulas programadas • dia de descanso e recuperação</strong>':`${pluralCount(dayStats.classes,'aula','aulas')} • ${pluralCount(dayStats.fixed,'aluno fixo','alunos fixos')} • ${pluralCount(dayStats.makeups,'reposição','reposições')}${dayPlanned?` • ${pluralCount(dayPlanned,'ausência programada','ausências programadas')}`:''}`}</p></div>${dayClosure?`<div class="schedule-day-mini closed-mini"><span>Aulas canceladas</span></div>`:isWeekend?`<div class="schedule-day-mini weekend-mini"><span>Descanso</span></div>`:`<div class="schedule-day-mini"><span>✓ ${dayStats.present}</span><span>✕ ${dayStats.absent}</span></div>`}</section>`:''}
      ${scheduleViewMode==='day'?(dayClosure?`<section class="closed-day-card"><span>✦</span><div><strong>${escapeHTML(dayClosure.type)} — aulas canceladas</strong><p>${escapeHTML(dayClosure.label||'Studio fechado')} • Nenhum aluno recebe falta neste dia.</p></div></section>`:isWeekend?`<section class="weekend-rest-card"><span>✦</span><div><small>PAUSA PROGRAMADA</small><strong>${escapeHTML(weekendRest.title)}</strong><p>${escapeHTML(weekendRest.text)}</p></div></section>`:`<div class="schedule-pro-list">${slots.map(tm=>scheduleSlotHTML(day.id,tm)).join('')}</div>`):scheduleViewMode==='week'?weeklyScheduleOverviewHTML():monthlyScheduleOverviewHTML()}
      <section class="schedule-insights"><article class="card"><div class="premium-card-title"><span>Ocupação geral</span>${icon('chart')}</div><div class="schedule-kpi">${occ.percent}%</div><small>${occ.used}/${occ.totalCapacity} vagas fixas ocupadas</small></article><article class="card"><div class="premium-card-title"><span>Reposições</span>${icon('users')}</div><div class="schedule-kpi">${makeupSummary().scheduledNext7}</div><small>agendadas nos próximos 7 dias</small></article></section>
      <div class="section-head"><div><h3>Resumo mensal de treinos</h3><p>${monthLabel(displayMk)} • presenças registradas, incluindo reposições</p></div></div>
      <section class="cards">${students.length?students.map(st=>monthlyReportRow(st,displayMk)).join(''):emptyState('Nenhum aluno ativo','Cadastre alunos para gerar o resumo mensal.')}</section>`;

    $$('.schedule-slot',viewEl).forEach(b=>b.addEventListener('click',()=>openScheduleSlot(b.dataset.day,b.dataset.time)));
    $('#manageClosures')?.addEventListener('click',openClosuresManager);$('#quickHoliday')?.addEventListener('click',openHolidayQuick);$('#shareMakeupSlots')?.addEventListener('click',openMakeupAvailabilityShare);
    $$('[data-schedule-view]',viewEl).forEach(b=>b.addEventListener('click',()=>{const next=b.dataset.scheduleView;if(next==='month'&&scheduleViewMode!=='month'){const focus=parseLocalDate(scheduleDateForDay(selectedScheduleDay))||scheduleWeekStart;scheduleMonthAnchor=monthDate(focus.getFullYear(),focus.getMonth())}scheduleViewMode=next;renderSchedule()}));
    $$('[data-week-day]',viewEl).forEach(b=>b.addEventListener('click',()=>openScheduleSlot(b.dataset.weekDay,b.dataset.weekTime)));
    $$('[data-month-date]',viewEl).forEach(b=>b.addEventListener('click',()=>{const d=parseLocalDate(b.dataset.monthDate),dayId=dayIdFromDate(d);if(!dayId)return;scheduleWeekStart=mondayOf(d);selectedScheduleDay=dayId;scheduleViewMode='day';renderSchedule()}));
    $$('.schedule-day-tab',viewEl).forEach(b=>b.addEventListener('click',()=>{selectedScheduleDay=b.dataset.scheduleDay;renderSchedule()}));
    $('#prevWeek')?.addEventListener('click',()=>{scheduleWeekStart=addDays(scheduleWeekStart,-7);renderSchedule()});$('#nextWeek')?.addEventListener('click',()=>{scheduleWeekStart=addDays(scheduleWeekStart,7);renderSchedule()});$('#currentWeek')?.addEventListener('click',()=>{scheduleWeekStart=mondayOf();selectedScheduleDay=currentScheduleDay();renderSchedule()});
    $('#prevMonth')?.addEventListener('click',()=>{scheduleMonthAnchor=shiftMonth(scheduleMonthAnchor,-1);renderSchedule()});$('#nextMonth')?.addEventListener('click',()=>{scheduleMonthAnchor=shiftMonth(scheduleMonthAnchor,1);renderSchedule()});$('#currentMonth')?.addEventListener('click',()=>{scheduleMonthAnchor=monthDate(todayNoon().getFullYear(),todayNoon().getMonth());renderSchedule()});
    $$('.js-month-whatsapp',viewEl).forEach(b=>b.addEventListener('click',()=>sendMonthlyAttendanceWhatsApp(b.dataset.id,displayMk)));
  }

  function monthlyReportRow(s,mk){
    const st=monthlyAttendanceStats(s.id,mk);
    const makeupText=st.makeups===1?'sendo 1 reposição':`sendo ${st.makeups} reposições`;
    const credits=makeupCreditBalance(s.id);
    return `<article class="card monthly-report-card"><div class="list-row"><div class="student-profile"><div class="student-photo tiny-photo">${s.photoData?`<img src="${s.photoData}" alt="" />`:`<span>${escapeHTML((s.name||'?').charAt(0).toUpperCase())}</span>`}</div><div class="list-main"><strong>${escapeHTML(s.name)}</strong><span><strong>${st.present} treino${st.present===1?'':'s'} realizado${st.present===1?'':'s'}</strong> • ${st.absent} falta${st.absent===1?'':'s'} • ${makeupText}</span><small>${monthLabel(mk)} • ${credits.available} crédito${credits.available===1?'':'s'} de reposição ${credits.available===1?'disponível':'disponíveis'}</small></div></div><button class="mini-icon js-month-whatsapp" data-id="${s.id}" title="Enviar resumo mensal pelo WhatsApp">${icon('message')}</button></div></article>`;
  }

  function sendMonthlyAttendanceWhatsApp(id,mk){
    const s=state.students.find(x=>x.id===id);if(!s)return;const phone=cleanPhone(s.whatsapp);if(!phone)return toast('Cadastre um WhatsApp válido para este aluno.');
    const st=monthlyAttendanceStats(id,mk);const first=(s.name||'').split(' ')[0]||s.name;
    const makeupText=st.makeups===1?'sendo 1 reposição':`sendo ${st.makeups} reposições`;
    const text=`Olá, ${first}! Seu resumo de ${monthLabel(mk)} no Studio Márcio Bueno: ${st.present} treino${st.present===1?'':'s'} realizado${st.present===1?'':'s'}, ${st.absent} falta${st.absent===1?'':'s'}, ${makeupText}. 💪`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`,'_blank','noopener,noreferrer');
  }

  function parseAttendanceStorageKey(key){
    const parts=String(key||'').split('__');if(parts.length!==2)return null;const date=parts[0],slot=parts[1],cut=slot.indexOf('_');if(cut<0)return null;return {date,day:slot.slice(0,cut),time:slot.slice(cut+1)};
  }
  function availableMakeupSlotsForWeek(studentId=''){
    const out=[],today=isoToday(),now=new Date(),nowMinutes=now.getHours()*60+now.getMinutes();
    SCHEDULE_DAYS.forEach(day=>{
      const date=scheduleDateForDay(day.id);if(date<today||closureForDate(date))return;
      scheduleHours(day.id).forEach(time=>{
        const [hh,mm]=String(time).split(':').map(Number),slotMinutes=(hh||0)*60+(mm||0);
        if(date===today&&slotMinutes<=nowMinutes)return;
        const fixed=effectiveFixedStudentIds(day.id,time,date),makeups=effectiveMakeupStudentIds(date,day.id,time),trials=trialsFor(date,day.id,time),occupied=fixed.length+makeups.length+trials.length;
        if(!slotStudents(day.id,time).length||occupied>=4)return;
        if(studentId&&(fixed.map(String).includes(String(studentId))||makeups.map(String).includes(String(studentId))))return;
        out.push({date,day:day.id,dayLabel:day.label,time,vacancies:4-occupied});
      });
    });
    return out;
  }
  function groupedMakeupSlotsText(slots){
    const groups=new Map();slots.forEach(x=>{const key=`${x.dayLabel}, ${fmtDate(x.date)}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(x.time)});
    return [...groups.entries()].map(([label,times])=>`• ${label}: ${times.join(', ')}`).join('\n');
  }
  async function copyText(text){try{await navigator.clipboard.writeText(text);toast('Mensagem copiada.')}catch{fallbackCopy(text)}}
  function openMakeupAvailabilityShare(){
    const students=[...activeStudents()].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
    openModal('Horários disponíveis para reposição',`<div class="notice">Escolha um aluno. O MB Gestor lista somente horários desta semana que ainda têm vaga real e não estejam bloqueados por feriado/recesso.</div><div class="field"><label>Aluno</label><select id="makeupShareStudent"><option value="">Selecione</option>${students.map(s=>`<option value="${s.id}">${escapeHTML(s.name)}</option>`).join('')}</select></div><div id="makeupAvailabilityStatus" class="makeup-availability-status"></div><div class="field"><label>Mensagem</label><textarea id="makeupAvailabilityMessage" rows="8" readonly></textarea></div><div class="modal-actions"><button class="btn btn-secondary" data-close-modal>Fechar</button><button class="btn btn-secondary" id="copyMakeupAvailability" disabled>Copiar mensagem</button><button class="btn btn-primary" id="openMakeupAvailabilityWhatsapp" disabled>${icon('message')} Abrir WhatsApp</button></div>`);
    const select=$('#makeupShareStudent'),status=$('#makeupAvailabilityStatus'),box=$('#makeupAvailabilityMessage'),copyBtn=$('#copyMakeupAvailability'),waBtn=$('#openMakeupAvailabilityWhatsapp');
    let currentMessage='',currentPhone='';
    const update=()=>{const st=state.students.find(x=>String(x.id)===String(select.value));if(!st){currentMessage='';currentPhone='';box.value='';status.innerHTML='<span>Selecione um aluno para calcular os horários.</span>';copyBtn.disabled=true;waBtn.disabled=true;return;}const slots=availableMakeupSlotsForWeek(st.id),check=validateWhatsApp(st.whatsapp),credits=makeupCreditBalance(st.id).available,creditText=credits>0?`${credits} ${credits===1?'crédito disponível':'créditos disponíveis'}`:'Sem créditos • agendamento manual permitido';currentPhone=check.valid?check.international:'';if(!slots.length){currentMessage=`Olá, ${firstName(st.name)}! No momento não há horários de reposição disponíveis nesta semana. Assim que surgir uma vaga, aviso você por aqui.`;status.innerHTML=`<strong>Nenhum horário disponível nesta semana.</strong><span>${escapeHTML(creditText)}.</span>`;box.value=currentMessage;copyBtn.disabled=false;waBtn.disabled=!currentPhone;return;}const intro=credits>0?`Você possui ${credits} ${credits===1?'crédito de reposição disponível':'créditos de reposição disponíveis'}.`:'Posso organizar uma reposição manual para você mesmo sem crédito disponível.';currentMessage=`Olá, ${firstName(st.name)}! ${intro} Estes são os horários com vaga nesta semana no Studio Márcio Bueno:\n\n${groupedMakeupSlotsText(slots)}\n\nSe algum funcionar para você, me responda por aqui para confirmarmos. 👍`;status.innerHTML=`<strong>${slots.length} horário${slots.length===1?'':'s'} ${slots.length===1?'disponível':'disponíveis'}</strong><span>${escapeHTML(creditText)} • horários lotados, bloqueados e já passados não aparecem.</span>`;box.value=currentMessage;copyBtn.disabled=false;waBtn.disabled=!currentPhone;};
    select.addEventListener('change',update);copyBtn.addEventListener('click',()=>copyText(currentMessage));waBtn.addEventListener('click',()=>{if(!currentPhone)return toast('Cadastre um WhatsApp válido para este aluno.');window.open(`https://wa.me/${currentPhone}?text=${encodeURIComponent(currentMessage)}`,'_blank','noopener,noreferrer');waBtn.textContent='✓ WhatsApp aberto';waBtn.classList.add('whatsapp-opened')});update();
  }
  function futureMakeupBookings(studentId){
    const today=isoToday(),rows=[];Object.keys(state.makeups||{}).forEach(k=>{if(!isMakeupStudentAtKey(k,studentId))return;const p=parseAttendanceStorageKey(k);if(!p||p.date<today)return;const dayLabel=SCHEDULE_DAYS.find(d=>d.id===p.day)?.label||p.day;rows.push({...p,dayLabel})});return rows.sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time));
  }
  function makeupConfirmationMessage(student){
    const rows=futureMakeupBookings(student.id),items=rows.map(x=>`• ${x.dayLabel}, ${fmtDate(x.date)} às ${x.time}`).join('\n');
    return rows.length===1?`Olá, ${firstName(student.name)}! Sua reposição no Studio Márcio Bueno está confirmada:\n\n${items}\n\nSe precisar ajustar, me avise por aqui. 👍`:`Olá, ${firstName(student.name)}! Suas reposições no Studio Márcio Bueno estão confirmadas:\n\n${items}\n\nSe precisar ajustar, me avise por aqui. 👍`;
  }
  function openMakeupConfirmationShare(studentIds){
    const students=[...new Set(studentIds.map(String))].map(id=>state.students.find(s=>String(s.id)===id)).filter(Boolean);
    if(!students.length)return;
    const confirmedBookings=students.reduce((sum,st)=>sum+futureMakeupBookings(st.id).length,0),multipleBookings=confirmedBookings>1;
    openModal(multipleBookings?'Reposições confirmadas':'Reposição confirmada',`<div class="notice makeup-confirmation-notice"><strong>${multipleBookings?'Agendamentos concluídos.':'Agendamento concluído.'}</strong><span>Revise a confirmação e envie individualmente. Nada é enviado automaticamente.</span></div><div class="cards">${students.map(st=>{const msg=makeupConfirmationMessage(st),check=validateWhatsApp(st.whatsapp);return `<article class="card makeup-confirmation-card"><div class="list-main"><strong>${escapeHTML(st.name)}</strong><span>${escapeHTML(formatPhoneBR(st.whatsapp))}</span><small>${escapeHTML(msg)}</small></div><div class="makeup-confirmation-actions"><button class="btn btn-secondary btn-small js-copy-makeup-confirm" data-id="${st.id}">Copiar mensagem</button>${check.valid?`<button class="btn btn-primary btn-small js-open-makeup-confirm" data-id="${st.id}" data-url="https://wa.me/${check.international}?text=${encodeURIComponent(msg)}">${icon('message')} <span>Abrir WhatsApp</span></button>`:'<span class="status danger">WhatsApp inválido</span>'}</div></article>`}).join('')}</div><div class="modal-actions"><button class="btn btn-secondary" data-close-modal>Concluir</button></div>`);
    $$('.js-copy-makeup-confirm',modalRoot).forEach(btn=>btn.addEventListener('click',()=>{const st=state.students.find(x=>String(x.id)===String(btn.dataset.id));if(st)copyText(makeupConfirmationMessage(st))}));
    $$('.js-open-makeup-confirm',modalRoot).forEach(btn=>btn.addEventListener('click',()=>{window.open(btn.dataset.url,'_blank','noopener,noreferrer');btn.classList.add('whatsapp-opened');const span=btn.querySelector('span');if(span)span.textContent='WhatsApp aberto'}));
  }

  function scheduleSlotHTML(day,time){
    const ids=slotStudents(day,time),date=scheduleDateForDay(day),map=attendanceMap(date,day,time);
    const enrolled=ids.map(id=>state.students.find(s=>s.id===id)).filter(Boolean);
    const makeupIds=makeupStudentIds(date,day,time), makeups=makeupIds.map(id=>state.students.find(s=>s.id===id)).filter(Boolean);
    const allIds=[...new Set([...ids,...makeupIds])],eligibleIds=allIds.filter(id=>{const st=state.students.find(x=>String(x.id)===String(id));return st&&!studentPauseAt(st,date)&&!plannedAbsenceFor(id,date)});
    const present=eligibleIds.filter(id=>map[id]==='present').length, absent=eligibleIds.filter(id=>map[id]==='absent').length;
    const effectiveIds=effectiveFixedStudentIds(day,time,date),effectiveMakeupIds=effectiveMakeupStudentIds(date,day,time),plannedIds=ids.filter(id=>plannedAbsenceFor(id,date)),pausedIds=ids.filter(id=>{const st=state.students.find(x=>String(x.id)===String(id));return Boolean(studentPauseAt(st,date))}),waiters=waitlistFor(day,time),trials=trialsFor(date,day,time),vacancies=Math.max(0,4-(effectiveIds.length+effectiveMakeupIds.length+trials.length));
    const countClass=effectiveIds.length>=4?'full':effectiveIds.length>=3?'busy':effectiveIds.length?'active':'empty';
    return `<button type="button" class="schedule-slot schedule-slot-pro ${countClass} ${makeups.length?'has-makeup':''}" data-day="${day}" data-time="${time}">
      <span class="schedule-time-rail"><strong>${time}</strong><small>PERSONAL</small></span>
      <span class="schedule-slot-body">
        <span class="schedule-slot-top"><strong>Personal</strong><span class="schedule-pills"><span class="schedule-capacity">${effectiveIds.length}/4${makeups.length?` + ${makeups.length}R`:''}</span><span class="schedule-vacancy">${vacancies} vaga${vacancies===1?'':'s'}</span></span></span>
        <span class="schedule-people">${enrolled.length?enrolled.map(s=>{const st=attendanceStatus(date,day,time,s.id);const planned=plannedAbsenceFor(s.id,date),paused=studentPauseAt(s,date);return `<span class="schedule-person ${planned?'is-planned-absence':''} ${paused?'is-paused-student':''}"><span class="schedule-initial ${st==='present'?'is-present':st==='absent'?'is-absent':''}" style="${st==='present'?'background:#2e9b63;border-color:#49bd7d;color:#fff;box-shadow:0 0 0 1px rgba(73,189,125,.18),0 4px 14px rgba(46,155,99,.22);':st==='absent'?'background:#c94b55;border-color:#e46a73;color:#fff;box-shadow:0 0 0 1px rgba(228,106,115,.16),0 4px 14px rgba(201,75,85,.20);':''}">${escapeHTML((s.name||'?').charAt(0).toUpperCase())}</span><span>${escapeHTML(s.name)}${planned?'<small>Ausência avisada</small>':paused?'<small>Pausado</small>':''}</span></span>`}).join(''):`<span class="schedule-empty-line">${icon('users')} Vagas disponíveis</span>`}</span>
        ${(plannedIds.length||pausedIds.length)?`<span class="schedule-availability-note">${plannedIds.length?`${plannedIds.length} ausência${plannedIds.length===1?'':'s'} avisada${plannedIds.length===1?'':'s'}`:''}${plannedIds.length&&pausedIds.length?' • ':''}${pausedIds.length?`${pausedIds.length} em pausa`:''} • vaga liberada</span>`:''}${makeups.length?`<span class="schedule-makeup-group">${makeups.map(m=>`<span class="schedule-makeup-line"><span class="makeup-square">R</span><strong>${escapeHTML(m.name)}</strong><em>Reposição</em></span>`).join('')}</span>`:''}
        ${trials.length?`<span class="trial-lines">${trials.map(t=>`<span class="trial-line"><span class="trial-cube">E</span><strong>${escapeHTML(t.name)}</strong><em>Experimental</em></span>`).join('')}</span>`:''}${waiters.length?`<span class="waitlist-badge">${waiters.length} na lista de espera</span>`:''}${(present||absent)?`<span class="attendance-mini"><span>✓ ${present} presença${present===1?'':'s'}</span><span>✕ ${absent} falta${absent===1?'':'s'}</span></span>`:''}
      </span>
      <span class="schedule-chevron">›</span>
    </button>`;
  }

  function setMakeupStudents(date,day,time,studentIds,manualStudentIds=[]){
    state.makeups=state.makeups||{};
    state.makeupManual=state.makeupManual||{};
    const k=attendanceKey(date,day,time),old=makeupStudentIds(date,day,time),next=[...new Set((studentIds||[]).filter(Boolean).map(String))],manualAdded=new Set((manualStudentIds||[]).map(String));
    const added=next.filter(id=>!old.includes(id)),removed=old.filter(id=>!next.includes(id));
    const oldManual={...(state.makeupManual[k]||{})},nextManual={};
    // Mantém a natureza manual das reposições já existentes e marca apenas novas exceções sem crédito.
    next.forEach(id=>{if(oldManual[id]||manualAdded.has(id))nextManual[id]=true});
    removed.forEach(id=>setAttendance(date,day,time,id,''));
    if(next.length){
      state.makeups[k]=next;
      if(Object.keys(nextManual).length)state.makeupManual[k]=nextManual;else delete state.makeupManual[k];
      // Reposição nova sempre começa em AGUARDANDO. Presença/falta só existe após ação explícita.
      added.forEach(id=>setAttendance(date,day,time,id,''));
    }else{
      delete state.makeups[k];
      delete state.makeupManual[k];
    }
    saveState();
    return {added,removed,kept:next.filter(id=>old.includes(id)),manualAdded:added.filter(id=>manualAdded.has(id))};
  }

  function removeMakeupStudent(date,day,time,studentId){
    const next=makeupStudentIds(date,day,time).filter(id=>String(id)!==String(studentId));
    setMakeupStudents(date,day,time,next);
  }

  function attendanceStudentCard(s,date,day,time,isMakeup=false){
    const st=attendanceStatus(date,day,time,s.id);
    const planned=plannedAbsenceFor(s.id,date),paused=studentPauseAt(s,date);
    const kindLabel=isMakeup?'Reposição':'Aluno fixo';
    const statusLabel=planned?'Ausência programada':paused?'Pausa ativa':st==='present'?'Presente':st==='absent'?'Falta':'Aguardando';
    return `<article class="daily-attendance-card luxury-attendance-card ${isMakeup?'makeup-card':''} ${planned?'planned-absence-card':''} ${paused?'paused-card':''}">
      <div class="attendance-card-top">
        <div class="daily-student attendance-student-main">
          <span class="student-photo tiny-photo attendance-avatar">${s.photoData?`<img src="${s.photoData}" alt="" />`:`<span>${escapeHTML((s.name||'?').charAt(0).toUpperCase())}</span>`}</span>
          <div class="attendance-student-copy"><strong>${escapeHTML(s.name)}</strong><span class="attendance-status-text">${statusLabel}</span></div>
        </div>
        <span class="attendance-kind-badge ${isMakeup?'makeup':''}">${kindLabel}</span>
      </div>
      ${(planned||paused)?`<div class="attendance-hold-note">${planned?'Ausência avisada — não gera falta':'Pausa ativa — frequência suspensa'}</div>`:`<div class="attendance-actions luxury-attendance-actions">
        <button type="button" class="attendance-btn present ${st==='present'?'active':''}" data-att="present" data-id="${s.id}"><span>✓</span> Presente</button>
        <button type="button" class="attendance-btn absent ${st==='absent'?'active':''}" data-att="absent" data-id="${s.id}"><span>✕</span> Falta</button>
      </div>`}
      ${isMakeup?`<button type="button" class="remove-makeup luxury-remove-makeup" data-remove-makeup="${s.id}">${icon('x')} Remover reposição</button>`:''}
    </article>`;
  }

  function bindAttendanceButtons(root,date,day,time){
    $$('.attendance-btn',root).forEach(b=>b.addEventListener('click',()=>{
      const id=b.dataset.id,requested=b.dataset.att,current=attendanceStatus(date,day,time,id),next=current===requested?'':requested,stAudit=state.students.find(s=>String(s.id)===String(id));
      setAttendance(date,day,time,id,next);
      addAudit(next==='present'?'Presença registrada':next==='absent'?'Falta registrada':'Status de frequência redefinido',`${stAudit?.name||'Aluno'} • ${fmtDate(date)} ${time}${next?'':' • aguardando'}`);saveState();
      $$(`.attendance-btn[data-id="${id}"]`,root).forEach(x=>x.classList.toggle('active',Boolean(next)&&x.dataset.att===next));
      const card=b.closest('.luxury-attendance-card'),statusText=card?.querySelector('.attendance-status-text');if(statusText)statusText.textContent=next==='present'?'Presente':next==='absent'?'Falta':'Aguardando';
      const presentNow=$$('.luxury-attendance-card .attendance-btn.present.active',root).length,absentNow=$$('.luxury-attendance-card .attendance-btn.absent.active',root).length,totalEligible=$$('.luxury-attendance-card .attendance-actions',root).length,pendingNow=Math.max(0,totalEligible-presentNow-absentNow);
      const presentChip=$('.lesson-status-strip .is-present',root),absentChip=$('.lesson-status-strip .is-absent',root),pendingChip=$('.lesson-status-strip .is-pending',root);
      if(presentChip)presentChip.textContent=`✓ ${presentNow} presente${presentNow===1?'':'s'}`;if(absentChip)absentChip.textContent=`✕ ${absentNow} falta${absentNow===1?'':'s'}`;if(pendingChip)pendingChip.textContent=`• ${pendingNow} aguardando`;
      if(currentView==='schedule'){renderSchedule();openScheduleSlot(day,time);}
      toast(next==='present'?'Presença registrada.':next==='absent'?'Falta registrada.':'Status voltou para Aguardando.');
    }));
  }

  function openScheduleSlot(day,time){
    const dateCheck=scheduleDateForDay(day),closure=closureForDate(dateCheck);if(closure){toast(`${closure.type}: aulas canceladas neste dia.`);return;}
    const dayLabel=SCHEDULE_DAYS.find(d=>d.id===day)?.label||day,date=scheduleDateForDay(day);
    const ids=slotStudents(day,time).slice(0,4);
    const enrolled=ids.map(id=>state.students.find(s=>s.id===id)).filter(Boolean);
    const makeupIds=makeupStudentIds(date,day,time),makeups=makeupIds.map(id=>state.students.find(s=>s.id===id)).filter(Boolean),effectiveMakeupIds=effectiveMakeupStudentIds(date,day,time),waiters=waitlistFor(day,time),trials=trialsFor(date,day,time);
    const effectiveFixed=effectiveFixedStudentIds(day,time,date).length,vacancies=Math.max(0,4-(effectiveFixed+effectiveMakeupIds.length+trials.length)),allStudents=[...enrolled,...makeups],eligibleStudents=allStudents.filter(st=>!studentPauseAt(st,date)&&!plannedAbsenceFor(st.id,date));
    const present=eligibleStudents.filter(st=>attendanceStatus(date,day,time,st.id)==='present').length;
    const absent=eligibleStudents.filter(st=>attendanceStatus(date,day,time,st.id)==='absent').length;
    const pending=Math.max(0,eligibleStudents.length-present-absent);
    openModal(`${dayLabel} • ${fmtDate(date)} • ${time}`,`
      <section class="lesson-luxury-hero">
        <div class="lesson-luxury-time"><span>${time}</span><small>${dayLabel} • ${fmtDate(date)}</small></div>
        <div class="lesson-luxury-stats">
          <div><strong>${enrolled.length}</strong><span>fixo${enrolled.length===1?'':'s'}</span></div>
          <div><strong>${makeups.length}</strong><span>reposiç${makeups.length===1?'ão':'ões'}</span></div>
          <div><strong>${vacancies}</strong><span>vaga${vacancies===1?'':'s'}</span></div>
        </div>
      </section>
      <div class="lesson-status-strip"><span class="is-present">✓ ${present} presente${present===1?'':'s'}</span><span class="is-absent">✕ ${absent} falta${absent===1?'':'s'}</span><span class="is-pending">• ${pending} aguardando</span></div>

      <section class="lesson-roster-section">
        <div class="lesson-section-head"><div><span class="section-overline">TURMA</span><h4>Alunos fixos</h4></div><span class="lesson-section-count">${enrolled.length}/4</span></div>
        <div class="daily-attendance-list luxury-attendance-list">${enrolled.length?enrolled.map(s=>attendanceStudentCard(s,date,day,time)).join(''):'<div class="empty compact"><strong>Nenhum aluno fixo</strong>Use “Editar alunos da turma” para montar este horário.</div>'}</div>
      </section>

      <section class="lesson-roster-section makeup-roster-section">
        <div class="lesson-section-head"><div><span class="section-overline">FLEXÍVEL</span><h4>Reposições</h4></div><span class="lesson-section-count makeup-count">${makeups.length}</span></div>
        ${makeups.length?`<div class="daily-attendance-list luxury-attendance-list">${makeups.map(m=>attendanceStudentCard(m,date,day,time,true)).join('')}</div>`:`<div class="lesson-empty-state"><span class="makeup-square">R</span><div><strong>Nenhuma reposição nesta aula</strong><small>Adicione quando um aluno precisar repor um treino.</small></div></div>`}
      </section>

      ${trials.length?`<section class="lesson-roster-section"><div class="lesson-section-head"><div><span class="section-overline">EXPERIMENTAL</span><h4>Aulas experimentais</h4></div><span class="lesson-section-count trial-count">${trials.length}</span></div><div class="trial-modal-list">${trials.map(t=>`<div class="trial-modal-row"><span class="trial-cube">E</span><div><strong>${escapeHTML(t.name)}</strong><small>Aula experimental</small></div></div>`).join('')}</div></section>`:''}

      <section class="lesson-tools luxury-lesson-tools">
        <button type="button" class="lesson-tool-card" id="editClassStudents"><span class="lesson-tool-icon">${icon('users')}</span><span><strong>Editar turma</strong><small>Alunos fixos deste horário</small></span><em>›</em></button>
        <button type="button" class="lesson-tool-card makeup-tool" id="addMakeup"><span class="lesson-tool-icon">R</span><span><strong>${makeups.length?'Gerenciar reposições':'Adicionar reposição'}</strong><small>${makeups.length?`${makeups.length} agendada${makeups.length===1?'':'s'} nesta aula`:'Buscar aluno e confirmar'}</small></span><em>›</em></button>
        <button type="button" class="lesson-tool-card" id="manageWaitlist"><span class="lesson-tool-icon">${icon('bell')}</span><span><strong>Lista de espera</strong><small>${waiters.length?`${waiters.length} aluno${waiters.length===1?'':'s'} aguardando`:'Nenhum aluno aguardando'}</small></span><em>›</em></button>
      </section>`);
    const modal=$('.modal');
    bindAttendanceButtons(modal,date,day,time);
    $('#editClassStudents',modal)?.addEventListener('click',()=>openClassEditor(day,time));
    $('#addMakeup',modal)?.addEventListener('click',()=>openMakeupPicker(day,time));
    $('#manageWaitlist',modal)?.addEventListener('click',()=>openWaitlistManager(day,time));
    $$('[data-remove-makeup]',modal).forEach(btn=>btn.addEventListener('click',()=>{const st=state.students.find(x=>String(x.id)===String(btn.dataset.removeMakeup));openModal('Remover reposição',`<div class="notice">Confirma remover a reposição de <strong>${escapeHTML(st?.name||'este aluno')}</strong> em ${fmtDate(date)} às ${escapeHTML(time)}? O crédito agendado voltará a ficar disponível quando aplicável.</div><div class="modal-actions"><button class="btn btn-secondary" data-close-modal>Cancelar</button><button class="btn btn-danger" id="confirmMakeupRemoval">Remover reposição</button></div>`);$('#confirmMakeupRemoval').addEventListener('click',()=>{removeMakeupStudent(date,day,time,btn.dataset.removeMakeup);addAudit('Reposição removida',`${st?.name||'Aluno'} • ${fmtDate(date)} ${time}`);saveState();closeModal();renderSchedule();openScheduleSlot(day,time);toast('Reposição removida e saldo recalculado.');});}));
  }

  function openClassEditor(day,time){
    const dayLabel=SCHEDULE_DAYS.find(d=>d.id===day)?.label||day,date=scheduleDateForDay(day),selected=new Set(slotStudents(day,time));
    const students=[...activeStudents({includePaused:true})].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
    const studentRow=(s)=>`<label class="class-picker-student ${selected.has(s.id)?'selected':''}" data-student-name="${escapeHTML((s.name||'').toLowerCase())}">
      <span class="student-photo tiny-photo class-picker-avatar">${s.photoData?`<img src="${s.photoData}" alt="" />`:`<span>${escapeHTML((s.name||'?').charAt(0).toUpperCase())}</span>`}</span>
      <span class="class-picker-name">${escapeHTML(s.name)}<small>${selected.has(s.id)?'Já faz parte desta turma':'Toque para adicionar à turma'}</small></span>
      <input class="class-picker-checkbox" type="checkbox" name="student" value="${s.id}" ${selected.has(s.id)?'checked':''} aria-label="Selecionar ${escapeHTML(s.name)}">
      <span class="class-picker-check" aria-hidden="true">${icon('check')}</span>
    </label>`;
    openModal(`Editar turma • ${dayLabel} • ${time}`,`
      <form id="slotForm" class="class-picker-form luxury-booking-flow">
        <div class="booking-flow-strip"><span class="active"><b>1</b> Escolher alunos</span><span><b>2</b> Confirmar turma</span></div>
        <div class="class-picker-head luxury-picker-head">
          <div><strong id="classPickerCount">${selected.size} de 4 alunos selecionados</strong><span>${dayLabel} • ${fmtDate(date)} • ${time}</span></div>
          <span class="class-picker-capacity">Máx. 4</span>
        </div>
        <div class="search-wrap class-picker-search">${icon('search')}<input id="classPickerSearch" type="search" placeholder="Buscar aluno pelo nome" autocomplete="off" /></div>
        <div class="picker-guidance picker-guidance-actions"><div><span>Começamos pelos alunos desta turma para manter a tela limpa.</span><strong>Busque um nome ou use “Ver todos” para explorar os ${students.length} alunos.</strong></div><button type="button" class="picker-browse-btn" id="classPickerShowAll">Ver todos</button></div>
        <div class="class-picker-tabs" role="tablist">
          <button type="button" class="class-picker-tab" data-class-filter="all">Buscar <span>${students.length}</span></button>
          <button type="button" class="class-picker-tab active" data-class-filter="selected">Selecionados <span id="classPickerSelectedBadge">${selected.size}</span></button>
        </div>
        <div id="classPickerList" class="class-picker-list modern-picker-list">${students.map(studentRow).join('')}</div>
        <div id="classPickerEmpty" class="empty compact"><strong>Turma atual exibida</strong>Use a busca ou “Ver todos” para adicionar outro aluno.</div>
        <div class="class-picker-actions"><button type="button" class="btn btn-secondary" data-close-modal>Cancelar</button><button type="submit" class="btn btn-primary">${icon('check')} Confirmar turma</button></div>
      </form>`);
    const form=$('#slotForm'),search=$('#classPickerSearch'),list=$('#classPickerList'),empty=$('#classPickerEmpty'),showAllBtn=$('#classPickerShowAll');
    let filter='selected',showAll=false;
    const setFilter=(next)=>{
      filter=next;
      $$('.class-picker-tab',form).forEach(x=>x.classList.toggle('active',x.dataset.classFilter===filter));
    };
    const update=()=>{
      const checked=$$('input[name="student"]:checked',form),count=checked.length,q=(search.value||'').trim().toLowerCase();
      $('#classPickerCount').textContent=`${count} de 4 alunos selecionados`;
      $('#classPickerSelectedBadge').textContent=String(count);
      $$('.class-picker-student',list).forEach(row=>{
        const input=$('input[name="student"]',row),isSelected=input.checked;
        row.classList.toggle('selected',isSelected);
        input.disabled=!isSelected && count>=4;row.classList.toggle('disabled',input.disabled);
        const matchesName=(row.dataset.studentName||'').includes(q);
        let visible=false;
        if(filter==='selected') visible=isSelected && (!q||matchesName);
        else visible=matchesName && (q.length>0||showAll);
        row.classList.toggle('hidden',!visible);
      });
      const hasVisible=$$('.class-picker-student:not(.hidden)',list).length>0;
      empty.classList.toggle('hidden',hasVisible);
      if(!hasVisible){
        if(filter==='selected') empty.innerHTML='<strong>Nenhum aluno selecionado</strong>Busque um nome para montar esta turma.';
        else if(q) empty.innerHTML='<strong>Nenhum aluno encontrado</strong>Tente outro nome.';
        else empty.innerHTML='<strong>Lista recolhida</strong>Digite um nome ou toque em “Ver todos”.';
      }
      showAllBtn.textContent=showAll?'Ocultar lista':'Ver todos';
    };
    search.addEventListener('input',()=>{
      if(search.value.trim()){showAll=false;setFilter('all')}
      update();
    });
    showAllBtn.addEventListener('click',()=>{showAll=!showAll;setFilter('all');if(showAll)search.value='';update()});
    $$('.class-picker-tab',form).forEach(b=>b.addEventListener('click',()=>{setFilter(b.dataset.classFilter);if(filter==='selected'){search.value='';showAll=false}update()}));
    form.addEventListener('change',e=>{if(e.target.name==='student')update()});
    form.addEventListener('submit',e=>{e.preventDefault();const newIds=$$('input[name="student"]:checked',form).map(x=>x.value);state.schedule=state.schedule||{};state.schedule[slotKey(day,time)]=newIds;addAudit('Turma atualizada',`${dayLabel} ${time} • ${newIds.length}/4 alunos fixos`);saveState();closeModal();renderSchedule();openScheduleSlot(day,time);toast('Turma atualizada.');});
    update();
    setTimeout(()=>search.focus({preventScroll:true}),50);
  }

  function openMakeupPicker(day,time){
    const date=scheduleDateForDay(day),fixed=new Set(slotStudents(day,time).map(String)),currentIds=makeupStudentIds(date,day,time).map(String),current=new Set(currentIds);
    const candidates=[...activeStudents()].filter(st=>!fixed.has(String(st.id))&&(current.has(String(st.id))||(!studentPauseAt(st,date)&&!plannedAbsenceFor(st.id,date)))).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
    // Crédito deixa de ser requisito para o agendamento: saldo zero é informativo, não bloqueante.
    const students=candidates;
    const availableCount=students.filter(st=>!current.has(String(st.id))).length;
    const studentRow=(st)=>{const credits=makeupCreditBalance(st.id),existing=current.has(String(st.id)),creditLabel=credits.available>0?`<b class="credit-pill has-credit">${credits.available}</b> ${credits.available===1?'crédito disponível':'créditos disponíveis'}`:'<b class="credit-pill no-credit">Sem créditos</b> <span class="manual-booking-note">agendamento manual permitido</span>';return `<label class="class-picker-student makeup-picker-student ${existing?'selected existing-booking':''}" data-student-name="${escapeHTML((st.name||'').toLowerCase())}" data-existing="${existing?'1':'0'}" data-credits="${credits.available}"><span class="student-photo tiny-photo class-picker-avatar">${st.photoData?`<img src="${st.photoData}" alt="" />`:`<span>${escapeHTML((st.name||'•').charAt(0).toUpperCase())}</span>`}</span><span class="class-picker-name">${escapeHTML(st.name)}<small>${existing?'<b class="existing-booking-pill">JÁ AGENDADA</b> ':''}${creditLabel}</small></span><input class="class-picker-checkbox" type="checkbox" name="makeupStudent" value="${st.id}" ${existing?'checked':''} aria-label="Selecionar ${escapeHTML(st.name)} para reposição"><span class="class-picker-check" aria-hidden="true">${icon('check')}</span></label>`};
    openModal(`Reposições • ${fmtDate(date)} • ${time}`,`
      <form id="makeupPickerForm" class="class-picker-form luxury-booking-flow">
        <div class="booking-flow-strip"><span class="active" id="makeupStep1"><b>1</b> Escolher aluno</span><span id="makeupStep2"><b>2</b> Confirmar alterações</span></div>
        <section class="makeup-picker-hero"><div class="makeup-picker-icon">R</div><div><strong>Reposição nesta aula</strong><span>${fmtDate(date)} • ${time}</span><small>Novas reposições entram como <b>AGUARDANDO</b>. Presença ou falta só será registrada quando você marcar.</small></div></section>
        <div class="search-wrap class-picker-search">${icon('search')}<input id="makeupPickerSearch" type="search" placeholder="Buscar aluno pelo nome" autocomplete="off" /></div>
        <div class="picker-guidance picker-guidance-actions"><div><span>O saldo de reposições será exibido antes da confirmação.</span><strong>${availableCount} ${availableCount===1?'aluno disponível':'alunos disponíveis'} para agendamento de reposição.</strong></div><button type="button" class="picker-browse-btn" id="makeupPickerShowAll">Ver todos</button></div>
        <div class="class-picker-tabs" role="tablist"><button type="button" class="class-picker-tab" data-makeup-filter="all">Disponíveis <span>${availableCount}</span></button><button type="button" class="class-picker-tab active" data-makeup-filter="selected">Nesta aula <span id="makeupPickerSelectedBadge">${current.size}</span></button></div>
        <div id="makeupPickerList" class="class-picker-list modern-picker-list">${students.length?students.map(studentRow).join(''):''}</div>
        <div id="makeupPickerEmpty" class="empty compact"><strong>${current.size?'Reposições atuais exibidas':'Nenhuma reposição nesta aula'}</strong>${current.size?'Use a busca ou “Ver todos” para adicionar outro aluno.':'Busque um aluno disponível para adicionar.'}</div>
        <div id="makeupDeltaSummary" class="makeup-selection-summary makeup-selection-deltas hidden"><div><span>Já agendadas</span><strong id="makeupExistingCount">${current.size}</strong></div><div><span>Novas</span><strong id="makeupNewCount">0</strong></div><div><span>Remover</span><strong id="makeupRemoveCount">0</strong></div><small id="makeupChangeHint">Nenhuma alteração pendente.</small><small id="makeupNoCreditHint" class="makeup-no-credit-hint hidden"></small></div>
        <div id="makeupCapacityAlert" class="makeup-capacity-alert hidden" role="alert" aria-live="polite"></div>
        <div class="class-picker-actions makeup-picker-actions"><button type="button" class="btn btn-secondary" data-close-modal>Cancelar</button><button type="submit" class="btn btn-primary" id="confirmMakeup" disabled>${icon('check')} Nenhuma alteração</button></div>
      </form>`);
    const form=$('#makeupPickerForm'),search=$('#makeupPickerSearch'),list=$('#makeupPickerList'),empty=$('#makeupPickerEmpty'),showAllBtn=$('#makeupPickerShowAll'),confirmBtn=$('#confirmMakeup'),summary=$('#makeupDeltaSummary');
    let filter='selected',showAll=false,removalArmed=false,overbookArmed=false,overbookArmedAt=0;
    const setFilter=next=>{filter=next;$$('.class-picker-tab',form).forEach(x=>x.classList.toggle('active',x.dataset.makeupFilter===filter))};
    const getDelta=()=>{const selected=$$('input[name="makeupStudent"]:checked',form).map(x=>String(x.value)),added=selected.filter(id=>!current.has(id)),removed=currentIds.filter(id=>!selected.includes(String(id))),kept=selected.filter(id=>current.has(id));return {selected,added,removed,kept}};
    const capacityForSelection=(selectedIds=[])=>{const fixedCount=effectiveFixedStudentIds(day,time,date).length,trialCount=trialsFor(date,day,time).length,makeupCount=selectedIds.filter(id=>{const st=state.students.find(x=>String(x.id)===String(id));return st&&st.active!==false&&!studentPauseAt(st,date)&&!plannedAbsenceFor(id,date)}).length;return {fixedCount,trialCount,makeupCount,finalOccupancy:fixedCount+trialCount+makeupCount}};
    const update=()=>{const {selected,added,removed,kept}=getDelta(),q=(search.value||'').trim().toLowerCase(),changeCount=added.length+removed.length,noCreditAdded=added.filter(id=>{const row=$(`.makeup-picker-student input[value="${id}"]`,form)?.closest('.makeup-picker-student');return Number(row?.dataset.credits||0)<=0});$('#makeupPickerSelectedBadge').textContent=String(selected.length);$('#makeupExistingCount').textContent=String(kept.length);$('#makeupNewCount').textContent=String(added.length);$('#makeupRemoveCount').textContent=String(removed.length);summary.classList.toggle('hidden',changeCount===0);$('#makeupStep1').classList.toggle('active',changeCount===0);$('#makeupStep2').classList.toggle('active',changeCount>0);$$('.makeup-picker-student',list).forEach(row=>{const input=$('input[name="makeupStudent"]',row),isSelected=input.checked,isExisting=row.dataset.existing==='1',matches=(row.dataset.studentName||'').includes(q);row.classList.toggle('selected',isSelected);row.classList.toggle('existing-booking',isExisting&&isSelected);let visible=filter==='selected'?isSelected:(matches&&(q.length>0||showAll));row.classList.toggle('hidden',!visible)});const hasVisible=$$('.makeup-picker-student:not(.hidden)',list).length>0;empty.classList.toggle('hidden',hasVisible);if(!hasVisible){if(filter==='selected')empty.innerHTML='<strong>Nenhuma reposição nesta aula</strong>Busque um aluno disponível para adicionar.';else if(q)empty.innerHTML='<strong>Nenhum aluno disponível encontrado</strong>Confira o nome pesquisado.';else empty.innerHTML='<strong>Lista recolhida</strong>Digite um nome ou toque em “Ver todos”.';}confirmBtn.disabled=changeCount===0;confirmBtn.innerHTML=changeCount?`${icon('check')} Confirmar alterações`:`${icon('check')} Nenhuma alteração`;$('#makeupChangeHint').textContent=changeCount?`${pluralCount(added.length,'nova reposição','novas reposições')} • ${pluralCount(removed.length,'remoção','remoções')}.`:'Nenhuma alteração pendente.';const manualHint=$('#makeupNoCreditHint');if(manualHint){manualHint.classList.toggle('hidden',noCreditAdded.length===0);manualHint.textContent=noCreditAdded.length?`${pluralCount(noCreditAdded.length,'agendamento sem crédito será incluído','agendamentos sem crédito serão incluídos')} manualmente.`:'';}const capacityAlert=$('#makeupCapacityAlert'),capacity=capacityForSelection(selected),overCapacity=added.length>0&&capacity.finalOccupancy>4;if(capacityAlert){capacityAlert.classList.toggle('hidden',!overCapacity);capacityAlert.innerHTML=overCapacity?`<strong>Aula lotada — confirmação extra obrigatória</strong><span>Ocupação prevista: <b>${capacity.finalOccupancy}/4</b>. A alteração ainda não foi gravada.</span>`:'';}if(!removalArmed&&!overbookArmed)confirmBtn.classList.remove('confirm-warning');showAllBtn.textContent=showAll?'Ocultar lista':'Ver todos';};
    const resetGuards=()=>{removalArmed=false;overbookArmed=false;overbookArmedAt=0;confirmBtn.classList.remove('confirm-warning');};
    search.addEventListener('input',()=>{resetGuards();if(search.value.trim()){showAll=false;setFilter('all')}update()});showAllBtn.addEventListener('click',()=>{showAll=!showAll;setFilter('all');if(showAll)search.value='';update()});$$('.class-picker-tab',form).forEach(btn=>btn.addEventListener('click',()=>{setFilter(btn.dataset.makeupFilter);if(filter==='selected'){search.value='';showAll=false}update()}));form.addEventListener('change',e=>{if(e.target.name==='makeupStudent'){resetGuards();update()}});
    form.addEventListener('submit',e=>{e.preventDefault();const {selected,added,removed}=getDelta();if(!added.length&&!removed.length)return;if(removed.length&&!removalArmed){removalArmed=true;summary.classList.remove('hidden');$('#makeupChangeHint').innerHTML=`<strong>Confirma remover ${pluralCount(removed.length,'reposição','reposições')}?</strong> O crédito agendado voltará a ficar disponível quando aplicável. Toque novamente em “Confirmar alterações”.`;confirmBtn.classList.add('confirm-warning');return;}const {finalOccupancy}=capacityForSelection(selected);if(added.length&&finalOccupancy>4&&!overbookArmed){overbookArmed=true;overbookArmedAt=Date.now();summary.classList.remove('hidden');$('#makeupChangeHint').innerHTML=`<strong>Aula lotada — confirmação necessária.</strong> Capacidade padrão: <strong>4</strong>. Ocupação após a alteração: <strong>${finalOccupancy}/4</strong>. O agendamento manual continua permitido, mas exige uma confirmação consciente.`;const capacityAlert=$('#makeupCapacityAlert');if(capacityAlert){capacityAlert.classList.remove('hidden');capacityAlert.innerHTML=`<strong>Exceção de capacidade preparada</strong><span>Ocupação final: <b>${finalOccupancy}/4</b>. Toque novamente no botão abaixo para autorizar.</span>`;}confirmBtn.classList.add('confirm-warning');confirmBtn.disabled=true;confirmBtn.innerHTML=`${icon('check')} Confirmar exceção ${finalOccupancy}/4`;setTimeout(()=>{if(confirmBtn.isConnected&&overbookArmed){confirmBtn.disabled=false}},700);return;}if(added.length&&finalOccupancy>4&&overbookArmed&&Date.now()-overbookArmedAt<650)return;const manualIds=added.filter(id=>makeupCreditBalance(id).available<=0),result=setMakeupStudents(date,day,time,selected,manualIds),parts=[];if(result.added.length)parts.push(`+${result.added.length}`);if(result.removed.length)parts.push(`-${result.removed.length}`);const manualNames=manualIds.map(id=>state.students.find(st=>String(st.id)===String(id))?.name||'Aluno'),overbookNote=finalOccupancy>4?` • capacidade excedida: ${finalOccupancy}/4 • confirmação explícita`:'';addAudit('Reposições atualizadas',`${fmtDate(date)} ${time}${overbookNote} • ${result.added.length?`adicionadas: ${result.added.map(id=>state.students.find(st=>String(st.id)===String(id))?.name||'Aluno').join(', ')}`:''}${manualNames.length?` • sem crédito/manual: ${manualNames.join(', ')}`:''}${result.added.length&&result.removed.length?' • ':''}${result.removed.length?`removidas: ${result.removed.map(id=>state.students.find(st=>String(st.id)===String(id))?.name||'Aluno').join(', ')}`:''}`);saveState();closeModal();renderSchedule();if(result.added.length)openMakeupConfirmationShare(result.added);else openScheduleSlot(day,time);toast(result.added.length&&result.removed.length?'Reposições atualizadas e saldos recalculados.':result.added.length?`${pluralCount(result.added.length,'nova reposição adicionada','novas reposições adicionadas')}.`:`${pluralCount(result.removed.length,'reposição removida','reposições removidas')}.`);});
    update();setTimeout(()=>search.focus({preventScroll:true}),50);
  }

  async function enableBirthdayNotifications(){
    if(!('Notification' in window)) return toast('Este navegador não oferece notificações.');
    const permission=await Notification.requestPermission();
    state.birthdayNotifications=state.birthdayNotifications||{};
    state.birthdayNotifications.enabled=permission==='granted';
    saveState();
    if(permission==='granted'){
      toast('Notificações de aniversário ativadas.');
      checkBirthdayNotification(true);
    }else{
      toast('Permissão de notificações não concedida.');
    }
  }

  function checkBirthdayNotification(force=false){
    if(!('Notification' in window) || Notification.permission!=='granted' || !state.birthdayNotifications?.enabled) return;
    const today=isoToday();
    if(!force && state.birthdayNotifications.lastCheck===today) return;
    const todayBirthdays=birthdayStudents(0);
    if(todayBirthdays.length){
      const names=todayBirthdays.map(x=>x.s.name).join(', ');
      try{new Notification('🎂 Aniversário no Studio',{body:`Hoje: ${names}`});}catch{}
    }
    state.birthdayNotifications.lastCheck=today;saveState();
  }

  function renderSettings() {
    const m=metrics();
    viewEl.innerHTML=`
      <section class="logo-feature"><img src="assets/logo-interna.jpg" alt="Márcio Bueno Personal Trainer" /></section>
      <div class="section-head"><div><h3>Aplicativo</h3><p>Uso privado no seu dispositivo</p></div></div>
      <section class="card">
        <div class="settings-row"><div><strong>Versão instalada</strong><span>MB Gestor Luxury Pro • versão ${APP_VERSION}</span></div><span class="pill">Etapa 3A</span></div>
        <div class="settings-row"><div><strong>Instalar na tela inicial</strong><span>Abre como aplicativo com o seu ícone.</span></div><button class="btn btn-primary btn-small" id="installSettings">Instalar</button></div>
        <div class="settings-row"><div><strong>Dias para aviso de vencimento</strong><span>Hoje: ${state.settings.chargeDaysBefore} dia(s) antes.</span></div><button class="btn btn-secondary btn-small" id="changeDays">Alterar</button></div>
        <div class="settings-row"><div><strong>Notificações de aniversário</strong><span>Avisa quando houver aniversariante do dia enquanto o app estiver ativo.</span></div><button class="btn btn-secondary btn-small" id="birthdayNotify">${state.birthdayNotifications?.enabled?'Ativadas':'Ativar'}</button></div>
        <div class="settings-row"><div><strong>Feriados e recesso</strong><span>${(state.studioClosures||[]).length} período${(state.studioClosures||[]).length===1?'':'s'} cadastrado${(state.studioClosures||[]).length===1?'':'s'}</span></div><button class="btn btn-secondary btn-small" id="manageClosuresSettings">Gerenciar</button></div><div class="settings-row"><div><strong>Relatório anual</strong><span>Financeiro, presenças, faltas e reposições por mês.</span></div><button class="btn btn-secondary btn-small" id="annualReportSettings">Abrir</button></div><div class="settings-row"><div><strong>Dados cadastrados</strong><span>${state.students.length} alunos • ${state.payments.length} receitas • ${state.expenses.length} gastos</span></div><span class="pill">Local</span></div>
      </section>
      <div class="section-head"><div><h3>Segurança</h3><p>Proteção extra para dados financeiros</p></div></div>
      <section class="card">
        <div class="settings-row"><div><strong>PIN do Financeiro</strong><span>${financeLockEnabled()?'Ativado • solicitado ao abrir Financeiro e Cobranças':'Desativado • configure um PIN de 4 a 6 números'}</span></div><button class="btn ${financeLockEnabled()?'btn-secondary':'btn-primary'} btn-small" id="configureFinancePin">${financeLockEnabled()?'Alterar':'Ativar'}</button></div>
        ${financeLockEnabled()?`<div class="settings-row"><div><strong>Bloquear agora</strong><span>Encerra o acesso financeiro liberado nesta sessão.</span></div><button class="btn btn-secondary btn-small" id="lockFinanceNow">${icon('lock')} Bloquear</button></div><div class="settings-row"><div><strong>Remover PIN</strong><span>O Financeiro volta a abrir sem senha.</span></div><button class="btn btn-danger btn-small" id="removeFinancePin">Desativar</button></div>`:''}
      </section>
      <div class="section-head"><div><h3>Backup</h3><p>Proteja seus dados • ${state.settings.lastBackupAt?`último backup em ${new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(state.settings.lastBackupAt))}`:'nenhum backup registrado neste aparelho'}</p></div></div>
      <section class="card backup-premium">
        <div class="backup-health"><span class="backup-health-icon">${icon('download')}</span><div><strong>${state.settings.lastBackupAt?'Backup registrado':'Faça seu primeiro backup'}</strong><span>${state.settings.lastBackupSummary?`${state.settings.lastBackupSummary.students} alunos • ${state.settings.lastBackupSummary.payments} receitas • ${state.settings.lastBackupSummary.attendanceRecords} registros de aula`:`${state.students.length} alunos • ${state.payments.length} receitas • ${Object.keys(state.attendance||{}).length} registros de aula atuais`}</span>${state.settings.lastBackupAt?`<small>Snapshot V${escapeHTML(state.settings.lastBackupVersion||APP_VERSION)} • ${formatDateTimeBR(state.settings.lastBackupExportedAt||state.settings.lastBackupAt)}</small>`:''}</div></div>
        <div class="settings-row"><div><strong>Exportar backup completo</strong><span>Salva alunos, agenda, presenças, reposições, financeiro e preferências em um único arquivo.</span></div><button class="btn btn-primary btn-small" id="exportBackup">${icon('download')} Fazer backup</button></div>
        <div class="settings-row"><div><strong>Importar / restaurar</strong><span>Valida o arquivo antes de substituir os dados atuais.</span></div><button class="btn btn-secondary btn-small" id="importBackup">${icon('upload')} Restaurar</button><input id="backupFile" type="file" accept="application/json" class="hidden" /></div>
      </section>
      <div class="section-head"><div><h3>Proteção e histórico</h3><p>Recuperação e rastreabilidade do sistema</p></div></div>
      <section class="card system-maintenance-card"><div class="settings-row"><div><strong>Lixeira protegida</strong><span>${(state.trash||[]).length} item${(state.trash||[]).length===1?'':'s'} disponível${(state.trash||[]).length===1?'':'is'} para recuperação.</span></div><button class="btn btn-secondary btn-small" id="openTrash">Abrir</button></div><div class="settings-row"><div><strong>Histórico de alterações</strong><span>${(state.auditLog||[]).length} evento${(state.auditLog||[]).length===1?'':'s'} registrado${(state.auditLog||[]).length===1?'':'s'}.</span></div><button class="btn btn-secondary btn-small" id="openAudit">Ver histórico</button></div><div class="settings-row"><div><strong>Fechamento mensal</strong><span>Preserve os indicadores do mês e compare a evolução.</span></div><button class="btn btn-secondary btn-small" id="settingsMonthClose">Abrir</button></div></section>
      <div class="section-head"><div><h3>Sobre o MB Gestor</h3><p>Informações do produto e preparação comercial</p></div></div>
      <section class="card"><div class="settings-row"><div><strong>MB Gestor Luxury Pro</strong><span>Versão ${APP_VERSION} • Faixa Ativa Premium</span></div><span class="pill">Local</span></div><div class="settings-row"><div><strong>Privacidade e dados</strong><span>Dados permanecem neste dispositivo enquanto o app estiver em modo local.</span></div><span class="pill">Privado</span></div><div class="settings-row"><div><strong>Estrutura comercial futura</strong><span>Preparado para evolução com autenticação, sincronização, suporte e licenciamento.</span></div><span class="pill">Planejado</span></div></section>
      <div class="section-head"><div><h3>Resumo atual</h3></div></div>
      <section class="metrics">${metricCard('users',m.activeStudents,'Alunos ativos')}${metricCard('wallet',privateMoney(m.expected),'Receita prevista')}${metricCard('chart',privateMoney(m.received),'Recebido no mês','good')}${metricCard('receipt',privateMoney(m.expenses),'Gastos no mês',m.expenses?'danger':'')}</section>
    `;
    $('#installSettings').addEventListener('click',installApp);
    $('#changeDays').addEventListener('click',changeChargeDays);
    $('#birthdayNotify')?.addEventListener('click',enableBirthdayNotifications);
    $('#manageClosuresSettings')?.addEventListener('click',openClosuresManager);
    $('#annualReportSettings')?.addEventListener('click',()=>openModal('Relatório anual',annualReportHTML()));
    $('#configureFinancePin')?.addEventListener('click',configureFinancePin);
    $('#lockFinanceNow')?.addEventListener('click',()=>{financeUnlockedThisSession=false;toast('Financeiro bloqueado.');renderSettings();});
    $('#removeFinancePin')?.addEventListener('click',removeFinancePin);
    $('#exportBackup').addEventListener('click',exportBackup);
    $('#importBackup').addEventListener('click',()=>$('#backupFile').click());
    $('#openTrash')?.addEventListener('click',openTrash);
    $('#openAudit')?.addEventListener('click',openAuditHistory);
    $('#settingsMonthClose')?.addEventListener('click',openMonthlyClose);
    $('#backupFile').addEventListener('change',importBackup);
  }

  function configureFinancePin(){
    openModal(financeLockEnabled()?'Alterar PIN':'Ativar PIN',`<form id="pinForm" class="form-grid"><div class="notice">Use de 4 a 6 números. Este PIN fica salvo somente neste aparelho e protege as telas Financeiro e Cobranças.</div><div class="field"><label>Novo PIN</label><input name="pin" type="password" inputmode="numeric" pattern="[0-9]{4,6}" minlength="4" maxlength="6" placeholder="4 a 6 números" required /></div><div class="field"><label>Confirmar PIN</label><input name="confirm" type="password" inputmode="numeric" pattern="[0-9]{4,6}" minlength="4" maxlength="6" placeholder="Repita o PIN" required /></div><div class="modal-actions"><button type="button" class="btn btn-secondary" data-close-modal>Cancelar</button><button class="btn btn-primary" type="submit">${icon('check')} Salvar PIN</button></div></form>`);
    $('#pinForm').addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(e.currentTarget),pin=String(fd.get('pin')||''),confirm=String(fd.get('confirm')||'');if(!/^\d{4,6}$/.test(pin))return toast('Use um PIN de 4 a 6 números.');if(pin!==confirm)return toast('Os PINs não conferem.');state.settings.financePinHash=await hashPin(pin);state.settings.financePinEnabled=true;financeUnlockedThisSession=false;saveState();closeModal();toast('PIN financeiro ativado.');renderSettings();});
  }

  function removeFinancePin(){
    openModal('Desativar PIN',`<div class="notice">A área financeira voltará a abrir sem pedir PIN neste aparelho.</div><div class="modal-actions"><button class="btn btn-secondary" data-close-modal>Cancelar</button><button class="btn btn-danger" id="confirmRemovePin">Desativar PIN</button></div>`);
    $('#confirmRemovePin').addEventListener('click',()=>{state.settings.financePinHash='';state.settings.financePinEnabled=false;financeUnlockedThisSession=false;saveState();closeModal();toast('PIN desativado.');renderSettings();});
  }

  function changeChargeDays(){openModal('Aviso de vencimento',`<form id="daysForm"><div class="field"><label>Quantos dias antes deseja destacar a mensalidade?</label><input name="days" type="number" min="0" max="30" value="${Number(state.settings.chargeDaysBefore||3)}" required /></div><div class="modal-actions"><button type="button" class="btn btn-secondary" data-close-modal>Cancelar</button><button class="btn btn-primary" type="submit">Salvar</button></div></form>`);$('#daysForm').addEventListener('submit',e=>{e.preventDefault();state.settings.chargeDaysBefore=Math.max(0,Math.min(30,Number(new FormData(e.currentTarget).get('days'))||0));saveState();closeModal();render();toast('Preferência atualizada.');});}

  function backupSummaryFor(sourceState=state){
    const attendanceRecords=Object.keys(sourceState.attendance||{}).length;let present=0,absent=0,makeups=0;
    Object.entries(sourceState.attendance||{}).forEach(([k,map])=>Object.entries(map||{}).forEach(([id,status])=>{if(status==='present'){present++;const raw=sourceState.makeups?.[k];const ids=Array.isArray(raw)?raw:[raw].filter(Boolean);if(ids.map(String).includes(String(id)))makeups++;}if(status==='absent')absent++;}));
    return {students:(sourceState.students||[]).length,payments:(sourceState.payments||[]).length,expenses:(sourceState.expenses||[]).length,attendanceRecords,present,absent,makeups};
  }

  function exportBackup(){
    const now=new Date(),summary=backupSummaryFor(state);
    state.settings.lastBackupAt=now.toISOString();state.settings.lastBackupExportedAt=now.toISOString();state.settings.lastBackupVersion=APP_VERSION;state.settings.lastBackupSummary=summary;
    addAudit('Backup gerado',`V${APP_VERSION} • ${summary.students} alunos • ${summary.payments} receitas • ${summary.attendanceRecords} registros de aula`);
    saveState();
    const payload={app:'MB Gestor Luxury Pro',appVersion:APP_VERSION,exportedAt:now.toISOString(),summary,state};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`MB_Gestor_Backup_V${APP_VERSION.replaceAll('.','_')}_${isoToday()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast(`Backup completo V${APP_VERSION} gerado.`);renderSettings();
  }

  async function importBackup(e){
    const file=e.target.files?.[0];if(!file)return;
    try{
      const data=JSON.parse(await file.text()),incoming=data.state||data;if(!Array.isArray(incoming.students)||!Array.isArray(incoming.expenses)||!Array.isArray(incoming.payments))throw new Error('Formato inválido');
      const sm=data.summary||backupSummaryFor(incoming),version=data.appVersion||incoming?.settings?.lastBackupVersion||'não informada',exportedAt=data.exportedAt||incoming?.settings?.lastBackupExportedAt||incoming?.settings?.lastBackupAt||null;
      openModal('Restaurar backup',`<div class="backup-restore-summary"><div><span>Versão</span><strong>V${escapeHTML(version)}</strong></div><div><span>Criado em</span><strong>${exportedAt?formatDateTimeBR(exportedAt):'Não informado'}</strong></div><div><span>Alunos</span><strong>${sm.students??incoming.students.length}</strong></div><div><span>Receitas</span><strong>${sm.payments??incoming.payments.length}</strong></div><div><span>Gastos</span><strong>${sm.expenses??incoming.expenses.length}</strong></div><div><span>Registros de aula</span><strong>${sm.attendanceRecords??Object.keys(incoming.attendance||{}).length}</strong></div><div><span>Presenças / faltas</span><strong>${sm.present??'—'} / ${sm.absent??'—'}</strong></div><div><span>Reposições realizadas</span><strong>${sm.makeups??'—'}</strong></div></div><div class="notice">Ao continuar, os dados atuais serão substituídos. Faça um backup antes desta restauração.</div><div class="modal-actions"><button class="btn btn-secondary" data-close-modal>Cancelar</button><button class="btn btn-primary" id="confirmImport">Restaurar</button></div>`);
      $('#confirmImport').addEventListener('click',()=>{state={...structuredClone(DEFAULT_STATE),...incoming,schedule:(incoming.schedule&&typeof incoming.schedule==='object')?incoming.schedule:{},attendance:(incoming.attendance&&typeof incoming.attendance==='object')?incoming.attendance:{},makeups:(incoming.makeups&&typeof incoming.makeups==='object')?incoming.makeups:{},reminderDrafts:Array.isArray(incoming.reminderDrafts)?incoming.reminderDrafts:[],birthdayNotifications:(incoming.birthdayNotifications&&typeof incoming.birthdayNotifications==='object')?incoming.birthdayNotifications:{},studioClosures:Array.isArray(incoming.studioClosures)?incoming.studioClosures:[],plannedAbsences:Array.isArray(incoming.plannedAbsences)?incoming.plannedAbsences:[],waitlist:Array.isArray(incoming.waitlist)?incoming.waitlist:[],prospects:Array.isArray(incoming.prospects)?incoming.prospects:[],trials:Array.isArray(incoming.trials)?incoming.trials:[],monthClosures:Array.isArray(incoming.monthClosures)?incoming.monthClosures:[],physicalAssessments:Array.isArray(incoming.physicalAssessments)?incoming.physicalAssessments:[],auditLog:Array.isArray(incoming.auditLog)?incoming.auditLog:[],trash:Array.isArray(incoming.trash)?incoming.trash:[],settings:{...DEFAULT_STATE.settings,...(incoming.settings||{})}};Object.keys(state.makeups||{}).forEach(k=>{const raw=state.makeups[k];state.makeups[k]=Array.isArray(raw)?[...new Set(raw.filter(Boolean).map(String))]:(raw?[String(raw)]:[]);if(!state.makeups[k].length)delete state.makeups[k]});addAudit('Backup restaurado',`V${version} • ${sm.students??incoming.students.length} alunos • ${sm.payments??incoming.payments.length} receitas`);saveState();closeModal();render();toast('Backup restaurado.');});
    }catch(err){console.error(err);toast('Não foi possível importar esse arquivo.');}finally{e.target.value='';}
  }

  function enhanceDateInputs(root){
    $$('input[type="date"]',root).forEach(input=>{
      if(input.dataset.monthNavEnhanced==='1')return;input.dataset.monthNavEnhanced='1';
      const nav=document.createElement('div');nav.className='date-month-nav';nav.innerHTML='<span>Mês / ano</span><input type="month" aria-label="Escolher mês e ano" />';
      const monthInput=nav.querySelector('input');monthInput.value=(input.value||isoToday()).slice(0,7);
      monthInput.addEventListener('change',()=>{if(!monthInput.value)return;const [y,m]=monthInput.value.split('-').map(Number),current=parseLocalDate(input.value),day=current?current.getDate():1,last=new Date(y,m,0).getDate();input.value=`${y}-${String(m).padStart(2,'0')}-${String(Math.min(day,last)).padStart(2,'0')}`;input.dispatchEvent(new Event('change',{bubbles:true}));});
      input.addEventListener('change',()=>{if(input.value)monthInput.value=input.value.slice(0,7)});
      input.insertAdjacentElement('afterend',nav);
    });
  }

  function openPremiumConfirm({title='Confirmar ação',message='',confirmLabel='Confirmar',cancelLabel='Cancelar',tone='gold',onConfirm=null}={}) {
    const existing=$('.modal-confirm-layer',modalRoot);if(existing)existing.remove();
    const layer=document.createElement('div');layer.className='modal-confirm-layer';layer.innerHTML=`<div class="modal-confirm-card ${tone==='danger'?'danger':''}" role="alertdialog" aria-modal="true" aria-label="${escapeHTML(title)}"><div class="modal-confirm-icon">${icon(tone==='danger'?'alert':'calendar')}</div><div class="modal-confirm-copy"><span class="section-overline">CONFIRMAÇÃO</span><strong>${escapeHTML(title)}</strong><p>${escapeHTML(message)}</p></div><div class="modal-confirm-actions"><button type="button" class="btn btn-secondary" data-premium-cancel>${escapeHTML(cancelLabel)}</button><button type="button" class="btn ${tone==='danger'?'btn-danger':'btn-primary'}" data-premium-confirm>${escapeHTML(confirmLabel)}</button></div></div>`;
    modalRoot.appendChild(layer);
    const close=()=>layer.remove();
    $('[data-premium-cancel]',layer)?.addEventListener('click',close);
    $('[data-premium-confirm]',layer)?.addEventListener('click',()=>{close();if(typeof onConfirm==='function')onConfirm();});
    layer.addEventListener('click',e=>{if(e.target===layer)close()});
  }

  function openModal(title, bodyHTML) {
    const openedAt=Date.now();
    modalRoot.innerHTML=`<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true" aria-label="${escapeHTML(title)}"><div class="modal-head"><h3>${escapeHTML(title)}</h3><button class="mini-icon" data-close-modal>${icon('x')}</button></div><div class="modal-body">${bodyHTML}</div></div></div>`;
    $$('[data-close-modal]',modalRoot).forEach(b=>b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();closeModal();}));
    enhanceDateInputs(modalRoot);
    $('.modal-backdrop',modalRoot).addEventListener('click',e=>{if(Date.now()-openedAt<400)return;if(e.target.classList.contains('modal-backdrop'))closeModal();});
  }
  function closeModal(){modalRoot.innerHTML='';}
  function toast(msg){const t=document.createElement('div');t.className='toast';t.textContent=msg;toastRoot.appendChild(t);setTimeout(()=>t.remove(),3200);}

  async function installApp(){
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      try { await deferredInstallPrompt.userChoice; } catch {}
      deferredInstallPrompt=null; updateInstallButtons(); return;
    }
    openModal('Instalar aplicativo',`<div class="notice">Se o botão automático de instalação não aparecer, abra este endereço no Chrome, toque no menu ⋮ e escolha <strong>“Adicionar à tela inicial”</strong> ou <strong>“Instalar app”</strong>. Para instalação completa, o aplicativo precisa estar publicado em um endereço HTTPS.</div><div class="modal-actions"><button class="btn btn-primary" data-close-modal>Entendi</button></div>`);
  }
  function updateInstallButtons(){const can=Boolean(deferredInstallPrompt);$('#installBtnTop')?.classList.toggle('hidden',!can);$('#installBtnSide')?.classList.toggle('hidden',!can);}

  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e;updateInstallButtons();});
  window.addEventListener('appinstalled',()=>{deferredInstallPrompt=null;updateInstallButtons();toast('Aplicativo instalado.');});
  $('#installBtnTop')?.addEventListener('click',installApp);
  $('#installBtnSide')?.addEventListener('click',installApp);

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(err=>console.warn('Service worker não registrado',err)));
  }

  window.addEventListener('storage',e=>{if(e.key===STORAGE_KEY){refreshStateFromStorage();render();}});

  renderNav();
  render();
  setTimeout(()=>checkBirthdayNotification(false),1200);
})();
