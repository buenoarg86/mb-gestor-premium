(() => {
  'use strict';
  // MB Gestor Luxury Pro V9.6.1 — Stable Refinement

  const APP_VERSION = '9.6.1';
  const STORAGE_KEY = 'mb_gestor_premium_v1';
  const DEFAULT_STATE = {
    version: 1,
    students: [],
    expenses: [],
    payments: [],
    schedule: {},
    attendance: {},
    makeups: {},
    reminderDrafts: [],
    birthdayNotifications: {},
    studioClosures: [],
    plannedAbsences: [],
    waitlist: [],
    prospects: [],
    trials: [],
    monthClosures: [],
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
      lastBackupAt: null
    }
  };

  const NAV = [
    {id:'dashboard', label:'Início', icon:'home', title:'Visão geral'},
    {id:'students', label:'Alunos', icon:'users', title:'Alunos'},
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
        reminderDrafts: Array.isArray(parsed.reminderDrafts) ? parsed.reminderDrafts : [],
        birthdayNotifications: (parsed.birthdayNotifications && typeof parsed.birthdayNotifications === 'object') ? parsed.birthdayNotifications : {},
        studioClosures: Array.isArray(parsed.studioClosures) ? parsed.studioClosures : [],
        plannedAbsences: Array.isArray(parsed.plannedAbsences) ? parsed.plannedAbsences : [],
        waitlist: Array.isArray(parsed.waitlist) ? parsed.waitlist : [],
        prospects: Array.isArray(parsed.prospects) ? parsed.prospects : [],
        trials: Array.isArray(parsed.trials) ? parsed.trials : [],
        monthClosures: Array.isArray(parsed.monthClosures) ? parsed.monthClosures : [],
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
  state.auditLog=state.auditLog.slice(0,300);
}
function waitlistFor(day,time){return (state.waitlist||[]).filter(w=>w.day===day&&w.time===time)}
function trialsFor(date,day,time){return (state.trials||[]).filter(t=>t.date===date&&t.day===day&&t.time===time&&t.status!=='cancelled')}
function prospectsOpen(){return (state.prospects||[]).filter(p=>!['matriculado','perdido'].includes(p.status||'novo'))}
function snapshotMonth(mk=monthKey()){
  const [y,m]=mk.split('-').map(Number), students=activeStudents();
  const received=state.payments.filter(p=>monthKey(p.date)===mk).reduce((a,p)=>a+(Number(p.amount)||0),0);
  const expenses=state.expenses.filter(e=>monthKey(e.date)===mk).reduce((a,e)=>a+(Number(e.amount)||0),0);
  let present=0,absent=0,makeups=0;
  Object.entries(state.attendance||{}).forEach(([k,map])=>{if(!k.startsWith(mk))return;Object.entries(map||{}).forEach(([id,v])=>{if(v==='present'){present++;if(isMakeupStudentAtKey(k,id))makeups++}if(v==='absent')absent++})});
  const occ=occupancyStats();
  return {mk,label:monthLabel(mk),closedAt:new Date().toISOString(),students:students.length,expected:students.reduce((a,s)=>a+(Number(s.monthlyFee)||0),0),received,expenses,net:received-expenses,present,absent,makeups,occupancy:occ.percent};
}
function closedMonth(mk){return (state.monthClosures||[]).find(x=>x.mk===mk)||null}
function previousMonthKey(mk=monthKey()){const [y,m]=mk.split('-').map(Number),d=new Date(y,m-2,1,12);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}
function deltaText(current,previous,suffix=''){if(previous==null)return 'Sem comparação';const d=current-previous;if(d===0)return 'Sem alteração';return `${d>0?'+':''}${d}${suffix}`}
function formatDateTimeBR(v){try{return new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(v))}catch{return '—'}}

function openOccupationMap(){
  const o=occupancyStats();
  const rows=SCHEDULE_DAYS.map(d=>`<div class="occupancy-day"><strong>${d.label}</strong><div class="occupancy-slots">${scheduleHours(d.id).map(time=>{const n=slotStudents(d.id,time).length,p=Math.round(n/4*100),cls=n>=4?'full':n>=3?'high':n>=2?'mid':n?'low':'empty';return `<button class="occupancy-chip ${cls}" data-occ-day="${d.id}" data-occ-time="${time}"><span>${time}</span><strong>${n}/4</strong><small>${p}%</small></button>`}).join('')}</div></div>`).join('');
  openModal('Mapa de ocupação',`<div class="luxury-modal-hero"><span class="luxury-orb">◈</span><div><strong>Ocupação semanal</strong><small>${o.used}/${o.totalCapacity} vagas fixas • ${o.percent}% de ocupação</small></div></div><div class="occupancy-map">${rows}</div><div class="notice compact">Toque em um horário para abrir a Agenda exatamente naquela turma.</div>`);
  $$('[data-occ-day]',modalRoot).forEach(b=>b.addEventListener('click',()=>{selectedScheduleDay=b.dataset.occDay;scheduleViewMode='day';closeModal();navigate('schedule');setTimeout(()=>document.querySelector(`[data-day="${b.dataset.occDay}"][data-time="${b.dataset.occTime}"]`)?.scrollIntoView({behavior:'smooth',block:'center'}),120)}));
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
  openModal(`Lista de espera • ${dayLabel} ${time}`,`<form id="waitlistForm" class="form-grid"><div class="notice">Cadastre alunos interessados neste horário. Quando surgir vaga, o nome ficará pronto para contato.</div><div class="field"><label>Aluno</label><select name="studentId" required><option value="">Selecione</option>${students.map(s=>`<option value="${s.id}">${escapeHTML(s.name)}</option>`).join('')}</select></div><div class="field"><label>Observação</label><input name="note" placeholder="Ex.: prefere terça, aceita reposição" /></div><div class="modal-actions"><button type="button" class="btn btn-secondary" data-close-modal>Cancelar</button><button class="btn btn-primary" type="submit">Adicionar à espera</button></div></form><div class="history-list">${rows.length?rows.map(w=>{const s=state.students.find(x=>x.id===w.studentId);return `<div class="history-row"><div><strong>${escapeHTML(s?.name||'Aluno')}</strong><span>${escapeHTML(w.note||'Aguardando vaga')}</span></div><div class="inline-actions"><button class="mini-icon js-wait-whatsapp" data-id="${w.id}">${icon('message')}</button><button class="mini-icon js-wait-remove" data-id="${w.id}">${icon('x')}</button></div></div>`}).join(''):emptyState('Lista vazia','Nenhum aluno aguardando este horário.')}</div>`);
  $('#waitlistForm').addEventListener('submit',e=>{e.preventDefault();const fd=new FormData(e.currentTarget),studentId=String(fd.get('studentId'));if(rows.some(x=>String(x.studentId)===studentId))return toast('Este aluno já está na lista.');state.waitlist.push({id:uid('wait'),studentId,day,time,note:String(fd.get('note')||'').trim(),createdAt:new Date().toISOString()});const s=state.students.find(x=>x.id===studentId);addAudit('Lista de espera',`${s?.name||'Aluno'} • ${dayLabel} ${time}`);saveState();closeModal();openWaitlistManager(day,time)});
  $$('.js-wait-remove',modalRoot).forEach(b=>b.addEventListener('click',()=>{state.waitlist=state.waitlist.filter(x=>x.id!==b.dataset.id);saveState();closeModal();openWaitlistManager(day,time)}));
  $$('.js-wait-whatsapp',modalRoot).forEach(b=>b.addEventListener('click',()=>{const w=state.waitlist.find(x=>x.id===b.dataset.id),s=state.students.find(x=>x.id===w?.studentId),phone=cleanPhone(s?.whatsapp);if(!phone)return toast('Aluno sem WhatsApp cadastrado.');window.open(`https://wa.me/${phone}?text=${encodeURIComponent(`Olá, ${(s.name||'').split(' ')[0]}! Surgiu uma possibilidade de vaga no horário de ${time} no Studio Márcio Bueno. Tem interesse?`)}`,'_blank','noopener,noreferrer')}));
}

function openMonthlyClose(){
  const mk=monthKey(),snap=closedMonth(mk),prev=closedMonth(previousMonthKey(mk)),live=snapshotMonth(mk),base=snap||live;
  openModal('Fechamento mensal',`<div class="luxury-modal-hero"><span class="luxury-orb">◆</span><div><strong>${escapeHTML(monthLabel(mk))}</strong><small>${snap?'Mês fechado e preservado':'Prévia atual • ainda aberto'}</small></div></div><section class="metrics close-metrics">${metricCard('users',base.students,'Alunos')}${metricCard('wallet',privateMoney(base.received),'Recebido')}${metricCard('check',base.present,'Presenças')}${metricCard('users',`${base.occupancy}%`,'Ocupação')}</section>${prev?`<div class="compare-grid"><div><span>Receita</span><strong>${deltaText(base.received,prev.received,'')}</strong><small>vs. ${prev.label}</small></div><div><span>Alunos</span><strong>${deltaText(base.students,prev.students)}</strong><small>vs. ${prev.label}</small></div><div><span>Presenças</span><strong>${deltaText(base.present,prev.present)}</strong><small>vs. ${prev.label}</small></div><div><span>Ocupação</span><strong>${deltaText(base.occupancy,prev.occupancy,' p.p.')}</strong><small>vs. ${prev.label}</small></div></div>`:'<div class="notice compact">O comparativo aparecerá depois que houver pelo menos dois meses fechados.</div>'}<div class="modal-actions"><button class="btn btn-secondary" data-close-modal>Fechar</button>${snap?'':`<button class="btn btn-primary" id="confirmMonthClose">Fechar ${escapeHTML(monthLabel(mk))}</button>`}</div>`);
  $('#confirmMonthClose')?.addEventListener('click',()=>{state.monthClosures.push(snapshotMonth(mk));addAudit('Fechamento mensal realizado',monthLabel(mk));saveState();closeModal();toast('Mês fechado e preservado.');});
}

function openHolidayQuick(){
  openModal('Marcar feriado',`<form id="holidayQuickForm" class="form-grid"><div class="notice">O dia ficará destacado no calendário e as aulas serão canceladas sem gerar faltas.</div><div class="field"><label>Data</label><input name="date" type="date" required /></div><div class="field"><label>Nome do feriado</label><input name="label" placeholder="Ex.: Dia da Independência" required /></div><div class="modal-actions"><button class="btn btn-secondary" type="button" data-close-modal>Cancelar</button><button class="btn btn-primary" type="submit">Marcar feriado</button></div></form>`);
  $('#holidayQuickForm').addEventListener('submit',e=>{e.preventDefault();const fd=new FormData(e.currentTarget),date=String(fd.get('date')),label=String(fd.get('label')||'Feriado').trim();state.studioClosures.push({id:uid('close'),startDate:date,endDate:date,type:'Feriado',label});addAudit('Feriado marcado',`${label} • ${fmtDate(date)}`);saveState();closeModal();toast('Feriado marcado no calendário.');if(currentView==='schedule')renderSchedule();});
}

function openAuditHistory(){const rows=(state.auditLog||[]).slice(0,120);openModal('Histórico do sistema',`<div class="history-list audit-history">${rows.length?rows.map(x=>{const a=String(x.action||'').toLowerCase(),tone=a.includes('presença')?'ok':a.includes('falta')?'danger':a.includes('pagamento')||a.includes('receita')?'money':'neutral';return `<div class="history-row audit-row audit-${tone}"><span class="audit-dot" aria-hidden="true"></span><div><strong>${escapeHTML(x.action)}</strong><span>${escapeHTML(x.detail||'')} • ${formatDateTimeBR(x.at)}</span></div></div>`}).join(''):emptyState('Sem alterações registradas','As próximas ações importantes aparecerão aqui.')}</div>`)}
function openTrash(){const rows=state.trash||[];openModal('Lixeira protegida',`<div class="notice">Itens removidos ficam aqui para evitar perda por toque acidental.</div><div class="history-list">${rows.length?rows.map(x=>`<div class="history-row"><div><strong>${escapeHTML(x.data?.name||x.type||'Item')}</strong><span>${escapeHTML(x.type)} • removido em ${formatDateTimeBR(x.deletedAt)}</span></div>${x.type==='student'?`<button class="btn btn-secondary btn-small js-restore-trash" data-id="${x.id}">Restaurar</button>`:''}</div>`).join(''):emptyState('Lixeira vazia','Nenhum item removido recentemente.')}</div>`);$$('.js-restore-trash',modalRoot).forEach(b=>b.addEventListener('click',()=>{const item=state.trash.find(x=>x.id===b.dataset.id);if(!item)return;state.students.push(item.data);state.trash=state.trash.filter(x=>x.id!==item.id);addAudit('Aluno restaurado',item.data?.name||'');saveState();closeModal();toast('Aluno restaurado.');render()}))}

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
    return activeStudents().map(s=>({s,info:birthdayInfo(s)}))
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
  function inactivityInfo(s){const last=lastPresenceDate(s.id)||s.startDate;const days=daysSinceISO(last);return {last,days,attention:Number.isFinite(days)&&days>=10}}
  function inactiveAttentionStudents(){return activeStudents().map(s=>({s,info:inactivityInfo(s)})).filter(x=>x.info.attention&&!studentPauseAt(x.s)).sort((a,b)=>b.info.days-a.info.days)}
  function studentStatusBadge(s,date=isoToday()){const pause=studentPauseAt(s,date);if(pause)return `<span class="status pause">Pausado até ${fmtDate(pause.endDate)}</span>`;const inactivity=inactivityInfo(s);if(inactivity.attention)return `<span class="status warn">Sem treino há ${inactivity.days} dias</span>`;return ''}
  function effectiveFixedStudentIds(day,time,date){return slotStudents(day,time).filter(id=>{const s=state.students.find(x=>String(x.id)===String(id));return s&&!studentPauseAt(s,date)&&!plannedAbsenceFor(id,date)})}
  function sendBirthdayWhatsApp(id){const s=state.students.find(x=>x.id===id);if(!s)return;const phone=cleanPhone(s.whatsapp);if(!phone)return toast('Cadastre um WhatsApp válido para este aluno.');const first=(s.name||'').split(' ')[0]||s.name;const text=`Parabéns, ${first}! 🎉 Que seu novo ciclo venha com muita saúde, energia e conquistas. Um grande abraço do Studio Márcio Bueno!`;window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`,'_blank','noopener,noreferrer')}
  function currentYear(){return todayNoon().getFullYear()}
  function annualReportRows(year=currentYear()){
    const out=[];for(let m=0;m<12;m++){const mk=`${year}-${String(m+1).padStart(2,'0')}`;const received=state.payments.filter(p=>monthKey(p.date)===mk).reduce((a,p)=>a+(Number(p.amount)||0),0);const expenses=state.expenses.filter(e=>monthKey(e.date)===mk).reduce((a,e)=>a+(Number(e.amount)||0),0);let present=0,absent=0,makeups=0;Object.entries(state.attendance||{}).forEach(([k,map])=>{if(!k.startsWith(mk))return;Object.entries(map||{}).forEach(([id,v])=>{if(v==='present'){present++;if(isMakeupStudentAtKey(k,id))makeups++}if(v==='absent')absent++})});out.push({mk,label:new Intl.DateTimeFormat('pt-BR',{month:'short'}).format(new Date(year,m,1,12)).replace('.',''),received,expenses,net:received-expenses,present,absent,makeups})}return out;
  }
  function annualReportHTML(year=currentYear()){
    const rows=annualReportRows(year),sum=k=>rows.reduce((a,r)=>a+(Number(r[k])||0),0),max=Math.max(1,...rows.map(r=>r.received));
    return `<section class="annual-report-hero"><div><span class="section-overline">RELATÓRIO ANUAL</span><h3>${year}</h3><p>Dados reais registrados no MB Gestor.</p></div><span class="annual-crown">✦</span></section><section class="metrics annual-metrics">${metricCard('wallet',privateMoney(sum('received')),'Recebido no ano','good')}${metricCard('chart',privateMoney(sum('net')),'Saldo anual',sum('net')>=0?'good':'danger')}${metricCard('check',sum('present'),'Presenças','good')}${metricCard('x',sum('absent'),'Faltas',sum('absent')?'danger':'')}${metricCard('users',sum('makeups'),'Reposições')}</section><div class="annual-bars">${rows.map(r=>`<div class="annual-bar-col"><div class="annual-bar-track"><span style="height:${Math.max(3,Math.round(r.received/max*100))}%"></span></div><strong>${escapeHTML(r.label)}</strong><small>${r.present} treinos</small></div>`).join('')}</div><div class="history-list annual-table">${rows.map(r=>`<div class="history-row"><div><strong>${monthLabel(r.mk)}</strong><span>${r.present} presenças • ${r.absent} faltas • ${r.makeups} reposições</span></div><strong class="money-positive">${privateMoney(r.received)}</strong></div>`).join('')}</div>`;
  }

  const SCHEDULE_DAYS=[
    {id:'mon',label:'Segunda'},{id:'tue',label:'Terça'},{id:'wed',label:'Quarta'},
    {id:'thu',label:'Quinta'},{id:'fri',label:'Sexta'}
  ];
  const WEEK_HOURS=['06:00','07:00','08:00','09:00','16:00','17:00','18:00','19:00'];
  const FRIDAY_HOURS=['06:00','07:00','08:00','09:00','10:00'];
  function scheduleHours(day){return day==='fri'?FRIDAY_HOURS:WEEK_HOURS}
  function slotKey(day,time){return `${day}_${time}`}
  function slotStudents(day,time){return Array.isArray(state.schedule?.[slotKey(day,time)])?state.schedule[slotKey(day,time)]:[]}

  function isoDate(d){const p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`}
  function addDays(date,days){const d=new Date(date.getFullYear(),date.getMonth(),date.getDate(),12);d.setDate(d.getDate()+days);return d}
  function mondayOf(date=todayNoon()){const d=new Date(date.getFullYear(),date.getMonth(),date.getDate(),12);const wd=d.getDay()||7;d.setDate(d.getDate()-wd+1);return d}
  let scheduleWeekStart=mondayOf();
  function scheduleDateForDay(day){const idx=SCHEDULE_DAYS.findIndex(d=>d.id===day);return isoDate(addDays(scheduleWeekStart,Math.max(0,idx)))}
  function attendanceKey(date,day,time){return `${date}__${slotKey(day,time)}`}
  function attendanceMap(date,day,time){return state.attendance?.[attendanceKey(date,day,time)]||{}}
  function attendanceStatus(date,day,time,studentId){return attendanceMap(date,day,time)[studentId]||''}
  function setAttendance(date,day,time,studentId,status){state.attendance=state.attendance||{};const k=attendanceKey(date,day,time);state.attendance[k]=state.attendance[k]||{};if(status)state.attendance[k][studentId]=status;else delete state.attendance[k][studentId];saveState()}

  // V9: uma aula pode receber várias reposições. Dados antigos (1 ID em string)
  // são convertidos de forma compatível para uma lista de IDs.
  function makeupStudentIds(date,day,time){
    const raw=state.makeups?.[attendanceKey(date,day,time)];
    if(Array.isArray(raw)) return [...new Set(raw.filter(Boolean).map(String))];
    return raw ? [String(raw)] : [];
  }
  function isMakeupStudentAtKey(key,studentId){
    const raw=state.makeups?.[key];
    return Array.isArray(raw) ? raw.map(String).includes(String(studentId)) : String(raw||'')===String(studentId);
  }
  function makeupCreditBalance(studentId){
    let absences=0,completed=0,scheduled=0;
    const today=isoToday();
    Object.entries(state.attendance||{}).forEach(([k,map])=>{if(map?.[studentId]==='absent')absences++;});
    Object.entries(state.makeups||{}).forEach(([k,raw])=>{
      const ids=Array.isArray(raw)?raw:[raw].filter(Boolean);
      if(!ids.map(String).includes(String(studentId))) return;
      if(state.attendance?.[k]?.[studentId]==='present') completed++;
      else if(k.slice(0,10)>=today) scheduled++;
    });
    return {absences,completed,scheduled,available:Math.max(0,absences-completed-scheduled)};
  }
  function monthLabel(key){if(!/^\d{4}-\d{2}$/.test(key))return key;const [y,m]=key.split('-').map(Number);return new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(new Date(y,m-1,1,12))}
  function monthlyAttendanceCount(studentId,mk=monthKey()){let count=0;Object.entries(state.attendance||{}).forEach(([k,map])=>{const date=k.slice(0,10);if(date.startsWith(mk)&&map&&map[studentId]==='present')count++});return count}

  function monthlyAttendanceStats(studentId,mk=monthKey()){
    let present=0, absent=0, makeups=0;
    Object.entries(state.attendance||{}).forEach(([k,map])=>{
      const date=k.slice(0,10); if(!date.startsWith(mk)||!map) return;
      if(map[studentId]==='present') present++;
      if(map[studentId]==='absent') absent++;
      if(isMakeupStudentAtKey(k,studentId) && map[studentId]==='present') makeups++;
    });
    return {present,absent,makeups};
  }

  function attendanceHistory(studentId){
    const rows=[];
    Object.entries(state.attendance||{}).forEach(([k,map])=>{
      if(!map || !map[studentId]) return;
      const date=k.slice(0,10), parts=k.split('__'), slot=(parts[1]||'').split('_');
      rows.push({date,status:map[studentId],isMakeup:isMakeupStudentAtKey(k,studentId),time:slot.slice(1).join('_').replace('-',':')||''});
    });
    return rows.sort((a,b)=>b.date.localeCompare(a.date));
  }

  function birthdaysThisMonth(){
    const m=todayNoon().getMonth();
    return state.students.filter(s=>{const b=parseLocalDate(s.birthDate);return b&&b.getMonth()===m;}).sort((a,b)=>parseLocalDate(a.birthDate).getDate()-parseLocalDate(b.birthDate).getDate());
  }

  function occupancyStats(){
    const slots=[];SCHEDULE_DAYS.forEach(d=>scheduleHours(d.id).forEach(time=>{const ids=slotStudents(d.id,time);slots.push({day:d.id,label:d.label,time,count:ids.length});}));
    const totalCapacity=slots.length*4,used=slots.reduce((a,x)=>a+x.count,0),full=slots.filter(x=>x.count>=4).length,empty=slots.filter(x=>x.count===0).length,percent=totalCapacity?Math.round(used/totalCapacity*100):0;
    return {slots,totalCapacity,used,full,empty,percent,busiest:[...slots].sort((a,b)=>b.count-a.count||a.time.localeCompare(b.time)).slice(0,5)};
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

  function activeStudents() {
    return state.students.filter(s => s.active !== false);
  }

  function monthKey(dateValue) {
    const d = dateValue ? parseLocalDate(dateValue) : todayNoon();
    if (!d) return '';
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  }

  function metrics() {
    const students = activeStudents();
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
    return {students:students.length, expected, received, pix, cash, potentialPix, potentialCash, remainingPix, remainingCash, remainingTotal, expenses, net:received-expenses, overdue, overdueValue, soon, makeups};
  }

  const MOBILE_NAV_IDS=['dashboard','schedule','students','finance'];
  const MORE_NAV_IDS=['charges','reminders','consent','settings'];

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
      finance: renderFinance,
      charges: renderCharges,
      reminders: renderReminders,
      consent: renderConsent,
      schedule: renderSchedule,
      settings: renderSettings
    }[currentView] || renderDashboard;
    renderer();
  }

  function metricCard(iconName, value, label, cls='') {
    return `<article class="metric ${cls}"><div class="metric-icon">${icon(iconName)}</div><div class="value">${value}</div><div class="label">${label}</div></article>`;
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
        const fixed=slotStudents(dayId,time);
        const k=attendanceKey(date,dayId,time);
        const makeupIds=makeupStudentIds(date,dayId,time);
        if(fixed.length||makeupIds.length) classes++;
        fixedStudents+=fixed.length;
        makeups+=makeupIds.length;
        const map=state.attendance?.[k]||{};
        present+=Object.values(map).filter(v=>v==='present').length;
        absent+=Object.values(map).filter(v=>v==='absent').length;
      });
    }
    const attention=activeStudents().filter(s=>dueInfo(s).days<=Number(state.settings.chargeDaysBefore||3)).length;
    return {dayId,classes,fixedStudents,makeups,present,absent,attention};
  }

  function renderDashboard() {
    const m=metrics(), today=todayStudioSummary(), occ=occupancyStats(), mk=monthKey();
    const monthPresence=Object.entries(state.attendance||{}).filter(([k])=>k.startsWith(mk)).reduce((n,[,map])=>n+Object.values(map||{}).filter(v=>v==='present').length,0);
    const upcoming=activeStudents().map(s=>({s,info:dueInfo(s)})).filter(x=>x.info.days<=7).sort((a,b)=>a.info.days-b.info.days).slice(0,6);
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

      ${(today.attention||today.makeups||bday7.length||todayPlanned||inactiveAlerts||todayClosure)?`<section class="attention-hub attention-hub-v93"><div class="attention-hub-head"><span>${icon('bell')}</span><div><strong>Central Hoje</strong><small>Agenda inteligente • prioridades e oportunidades</small></div></div><div class="attention-hub-items">${todayClosure?`<button data-nav="schedule" class="hub-closure"><strong>FERIADO</strong><span>${escapeHTML(todayClosure.label||todayClosure.type||'Studio fechado')}</span></button>`:''}${todayPlanned?`<button data-nav="schedule"><strong>${todayPlanned}</strong><span>ausência${todayPlanned===1?'':'s'} programada${todayPlanned===1?'':'s'} hoje</span></button>`:''}${today.attention?`<button data-nav="charges"><strong>${today.attention}</strong><span>mensalidade${today.attention===1?'':'s'} para acompanhar</span></button>`:''}${today.makeups?`<button data-nav="schedule"><strong>${today.makeups}</strong><span>${today.makeups===1?'reposição':'reposições'} hoje</span></button>`:''}${bday7.length?`<button data-nav="students"><strong>${bday7.length}</strong><span>aniversário${bday7.length===1?'':'s'} em até 7 dias</span></button>`:''}${inactiveAlerts?`<button data-student-attention="1"><strong>${inactiveAlerts}</strong><span>aluno${inactiveAlerts===1?'':'s'} sem treinar há 10+ dias</span></button>`:''}</div></section>`:''}

      <section class="metrics luxury-metrics management-cockpit">
        ${metricCard('users',m.students,'Alunos ativos')}
        ${metricCard('wallet',privateMoney(m.expected),'Receita prevista')}
        ${metricCard('chart',privateMoney(m.received),'Recebido no mês','good')}
        ${metricCard('calendar',monthPresence,'Presenças no mês','good')}
        ${metricCard('users',`${occ.percent}%`,'Ocupação da grade',occ.percent>=75?'good':'')}
        ${metricCard('bell',m.overdue,'Mensalidades vencidas',m.overdue?'danger':'good')}
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
    $$('.js-charge-whatsapp',viewEl).forEach(b=>b.addEventListener('click',()=>sendChargeWhatsApp(b.dataset.id)));
  }

  function emptyState(title, text) {
    return `<div class="empty"><strong>${escapeHTML(title)}</strong>${escapeHTML(text)}</div>`;
  }

  function chargeMiniRow(student, info) {
    return `<article class="card"><div class="list-row"><div class="list-main"><strong>${escapeHTML(student.name)}</strong><span>${info.text} • ${fmtMoney(student.monthlyFee)}</span></div><button class="mini-icon js-charge-whatsapp" data-id="${student.id}" title="Enviar cobrança">${icon('message')}</button></div></article>`;
  }

  function renderStudents() {
    const students=[...state.students].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
    const activeCount=students.filter(s=>s.active!==false).length,inactiveCount=students.length-activeCount,monthBirthdays=birthdaysThisMonth(),pausedCount=students.filter(s=>studentPauseAt(s)).length,attentionCount=inactiveAttentionStudents().length;
    viewEl.innerHTML=`
      <div class="section-head"><div><h3>Cadastro de alunos</h3><p>${activeCount} ativo${activeCount===1?'':'s'} • ${inactiveCount} inativo${inactiveCount===1?'':'s'}</p></div><button class="btn btn-primary" id="addStudent">${icon('plus')} Novo aluno</button></div>
      <div class="student-toolbar"><div class="search-wrap">${icon('search')}<input id="studentSearch" type="search" placeholder="Buscar por nome, WhatsApp ou e-mail" autocomplete="off" /></div><div class="tabs student-filter-tabs"><button class="tab ${studentFilter==='all'?'active':''}" data-student-filter="all">Todos (${students.length})</button><button class="tab ${studentFilter==='active'?'active':''}" data-student-filter="active">Ativos (${activeCount})</button><button class="tab ${studentFilter==='inactive'?'active':''}" data-student-filter="inactive">Inativos (${inactiveCount})</button><button class="tab ${studentFilter==='paused'?'active':''}" data-student-filter="paused">Pausados (${pausedCount})</button><button class="tab ${studentFilter==='attention'?'active':''}" data-student-filter="attention">Atenção (${attentionCount})</button></div></div>
      ${monthBirthdays.length?`<div class="birthday-month-strip"><strong>🎂 Aniversariantes do mês</strong><span>${monthBirthdays.map(s=>`${escapeHTML(s.name)} • ${String(parseLocalDate(s.birthDate).getDate()).padStart(2,'0')}/${String(parseLocalDate(s.birthDate).getMonth()+1).padStart(2,'0')}`).join(' &nbsp; • &nbsp; ')}</span></div>`:''}
      <section id="studentsList" class="cards"></section>`;
    const list=$('#studentsList');
    const draw=()=>{const q=($('#studentSearch')?.value||'').trim().toLowerCase();const filtered=students.filter(s=>{const text=[s.name,s.whatsapp,s.email].some(v=>String(v||'').toLowerCase().includes(q));const status=studentFilter==='all'||(studentFilter==='active'&&s.active!==false)||(studentFilter==='inactive'&&s.active===false)||(studentFilter==='paused'&&Boolean(studentPauseAt(s)))||(studentFilter==='attention'&&inactivityInfo(s).attention&&!studentPauseAt(s));return text&&status;});list.innerHTML=filtered.length?filtered.map(studentCard).join(''):emptyState('Nenhum aluno encontrado',q?'Tente outro termo de busca.':'Nenhum aluno neste filtro.');bindStudentActions();};
    draw();$('#studentSearch').addEventListener('input',draw);$$('[data-student-filter]',viewEl).forEach(b=>b.addEventListener('click',()=>{studentFilter=b.dataset.studentFilter;$$('[data-student-filter]',viewEl).forEach(x=>x.classList.toggle('active',x.dataset.studentFilter===studentFilter));draw();}));$('#addStudent').addEventListener('click',()=>openStudentModal());
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
        <div class="student-meta"><span>Início: <strong>${fmtDate(s.startDate)}</strong></span><span>No Studio: <strong>${studioTime(s.startDate)}</strong></span><span>Vencimento: <strong>${fmtDate(s.dueDate)}</strong></span><span><strong>${fmtMoney(s.monthlyFee)}</strong></span></div>
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
    const phone=cleanPhone(s.whatsapp),pause=studentPauseAt(s),planned=(state.plannedAbsences||[]).filter(a=>String(a.studentId)===String(id)&&a.date>=isoToday()).sort((a,b)=>a.date.localeCompare(b.date));
    openModal(`Ficha Premium • ${s.name}`,`<section class="student-premium-summary"><div class="student-photo premium-profile-photo">${s.photoData?`<img src="${s.photoData}" alt="" />`:`<span>${escapeHTML((s.name||'?').charAt(0).toUpperCase())}</span>`}</div><div><h4>${escapeHTML(s.name)}</h4><p>${ageFromBirth(s.birthDate)??'—'} anos • no Studio há ${studioTime(s.startDate)}</p><div class="profile-pills"><span>${s.paymentMethod==='cash'?'Dinheiro':'PIX'}</span><span class="${paidThisMonth?'profile-paid':'profile-pending'}">${paidThisMonth?'Mensalidade registrada':'Pagamento pendente no mês'}</span><span>${s.active===false?'Inativo':'Aluno ativo'}</span></div></div></section>
      <section class="metrics history-metrics">${metricCard('check',monthStats.present,'Treinos no mês','good')}${metricCard('x',monthStats.absent,'Faltas no mês',monthStats.absent?'danger':'')}${metricCard('calendar',credits.available,'Créditos disponíveis',credits.available?'warn':'')}${metricCard('users',credits.scheduled,'Reposições agendadas')}</section>
      <div class="profile-detail-grid"><div><span>WhatsApp</span><strong>${escapeHTML(s.whatsapp||'—')}</strong></div><div><span>Vencimento</span><strong>${fmtDate(s.dueDate)}</strong></div><div><span>Mensalidade</span><strong>${privateMoney(s.monthlyFee)}</strong></div><div><span>Total de reposições feitas</span><strong>${makeups}</strong></div></div>${pause?`<div class="student-pause-banner"><strong>⏸ Aluno em pausa</strong><span>${fmtDate(pause.startDate)} a ${fmtDate(pause.endDate)} • ${escapeHTML(pause.reason)}</span></div>`:''}${planned.length?`<div class="planned-absence-strip"><strong>Ausências programadas</strong><span>${planned.slice(0,3).map(a=>`${fmtDate(a.date)}${a.reason?` • ${escapeHTML(a.reason)}`:''}`).join(' &nbsp; | &nbsp; ')}</span></div>`:''}${s.privateNotes?`<div class="private-notes-card"><span class="section-overline">PRIVADO</span><strong>Observações internas</strong><p>${escapeHTML(s.privateNotes)}</p></div>`:''}
      <div class="student-quick-actions">${phone?`<button class="btn btn-primary btn-small" id="historyWhatsapp">${icon('message')} WhatsApp</button>`:''}<button class="btn btn-secondary btn-small" id="historyMonthly">${icon('calendar')} Resumo do mês</button><button class="btn btn-secondary btn-small" id="historyAbsence">${icon('calendar')} Programar ausência</button><button class="btn btn-secondary btn-small" id="historyEdit">${icon('edit')} Editar cadastro</button></div>
      <div class="section-head compact-head"><div><h3>Evolução • 6 meses</h3><p>Treinos realizados por mês</p></div></div><div class="student-trend">${trend.map(x=>`<div class="student-trend-col"><div class="student-trend-bar"><span style="height:${Math.max(5,Math.round(x.present/maxTrend*100))}%"></span></div><strong>${x.present}</strong><small>${escapeHTML(x.label)}</small></div>`).join('')}</div>
      <div class="section-head compact-head"><div><h3>Pagamentos</h3><p>Últimos registros deste aluno</p></div></div><div class="history-list payment-history-list">${payments.length?payments.map(p=>`<div class="history-row"><div><strong>${fmtDate(p.date)}</strong><span>${escapeHTML((p.method||s.paymentMethod||'pix').toUpperCase())}</span></div><strong class="money-positive">${privateMoney(p.amount)}</strong></div>`).join(''):emptyState('Sem pagamentos','Nenhum pagamento individual registrado para este aluno.')}</div>
      <div class="section-head compact-head"><div><h3>Histórico de frequência</h3><p>${present} presenças • ${absent} faltas</p></div></div><div class="history-list">${rows.length?rows.map(r=>`<div class="history-row"><div><strong>${fmtDate(r.date)}</strong><span>${r.isMakeup?'Reposição • ':''}${escapeHTML(r.time||'')}</span></div><span class="status ${r.status==='present'?'ok':'danger'}">${r.status==='present'?'Presente':'Falta'}</span></div>`).join(''):emptyState('Sem histórico','Ainda não há presenças ou faltas registradas para este aluno.')}</div>`);
    $('#historyWhatsapp')?.addEventListener('click',()=>window.open(`https://wa.me/${phone}?text=${encodeURIComponent(`Olá, ${(s.name||'').split(' ')[0]}! Tudo bem?`)}`,'_blank','noopener,noreferrer'));
    $('#historyMonthly')?.addEventListener('click',()=>sendMonthlyAttendanceWhatsApp(id,mk));
    $('#historyAbsence')?.addEventListener('click',()=>{closeModal();openPlannedAbsenceModal(id)});
    $('#historyEdit')?.addEventListener('click',()=>{closeModal();openStudentModal(id)});
  }

  function openStudentModal(id=null) {
    const s = id ? state.students.find(x=>x.id===id) : null;
    const title = s ? 'Editar aluno' : 'Novo aluno';
    openModal(title, `
      <form id="studentForm" class="form-grid two">
        <div class="field" style="grid-column:1/-1"><label>Foto do aluno</label><div class="photo-picker luxury-photo-picker"><div id="photoPreview" class="photo-preview">${s?.photoData?`<img src="${s.photoData}" alt="Foto do aluno" />`:`<span>${escapeHTML((s?.name||'?').trim().charAt(0).toUpperCase())}</span>`}</div><div class="photo-picker-controls"><input id="studentPhoto" class="photo-file-input" type="file" accept="image/*" /><label for="studentPhoto" class="btn btn-secondary btn-small photo-file-button">${icon('upload')} <span id="photoFileLabel">${s?.photoData?'Alterar foto':'Adicionar foto'}</span></label><small>Opcional. A foto será reduzida e salva somente no app.</small><button id="removePhoto" type="button" class="btn btn-secondary btn-small ${s?.photoData?'':'hidden'}">Remover foto</button></div></div></div>
        <div class="field" style="grid-column:1/-1"><label>Nome completo *</label><input name="name" required value="${escapeHTML(s?.name||'')}" placeholder="Nome do aluno" /></div>
        <div class="field"><label>Data de nascimento *</label><input name="birthDate" type="date" required value="${escapeHTML(s?.birthDate||'')}" /></div>
        <div class="field"><label>Idade</label><input id="agePreview" disabled value="${s?.birthDate ? `${ageFromBirth(s.birthDate)} anos` : 'Calculada automaticamente'}" /></div>
        <div class="field"><label>WhatsApp *</label><input name="whatsapp" inputmode="tel" required value="${escapeHTML(s?.whatsapp||'')}" placeholder="(31) 99999-9999" /></div>
        <div class="field"><label>E-mail</label><input name="email" type="email" value="${escapeHTML(s?.email||'')}" placeholder="aluno@email.com" /></div>
        <div class="field"><label>Data de início dos treinos *</label><input name="startDate" type="date" required value="${escapeHTML(s?.startDate||isoToday())}" /></div>
        <div class="field"><label>Vencimento da mensalidade *</label><input name="dueDate" type="date" required value="${escapeHTML(s?.dueDate||isoToday())}" /></div>
        <div class="field"><label>Valor da mensalidade *</label><input name="monthlyFee" type="number" min="0" step="0.01" required value="${escapeHTML(s?.monthlyFee ?? '')}" placeholder="0,00" /></div>
        <div class="field"><label>Forma de pagamento preferencial</label><select name="paymentMethod"><option value="pix" ${s?.paymentMethod!=='cash'?'selected':''}>PIX</option><option value="cash" ${s?.paymentMethod==='cash'?'selected':''}>Dinheiro</option></select></div>
        <div class="field"><label>Situação</label><select name="active"><option value="true" ${s?.active!==false?'selected':''}>Ativo</option><option value="false" ${s?.active===false?'selected':''}>Inativo</option></select></div>
        <div class="field"><label>Pausa / férias do aluno • início</label><input name="pauseStart" type="date" value="${escapeHTML(s?.pauseStart||'')}" /></div>
        <div class="field"><label>Pausa / férias do aluno • fim</label><input name="pauseEnd" type="date" value="${escapeHTML(s?.pauseEnd||'')}" /></div>
        <div class="field" style="grid-column:1/-1"><label>Motivo da pausa</label><input name="pauseReason" value="${escapeHTML(s?.pauseReason||'')}" placeholder="Ex.: férias, viagem, afastamento" /></div>
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
    removePhoto.addEventListener('click',()=>{photoData='';photoInput.value='';const initial=(form.elements.name.value||'?').trim().charAt(0).toUpperCase()||'?';photoPreview.innerHTML=`<span>${escapeHTML(initial)}</span>`;removePhoto.classList.add('hidden');if(photoFileLabel)photoFileLabel.textContent='Adicionar foto'});
    form.birthDate.addEventListener('change',()=>{$('#agePreview').value = form.birthDate.value ? `${ageFromBirth(form.birthDate.value)} anos` : 'Calculada automaticamente';});
    form.addEventListener('submit', e=>{
      e.preventDefault();
      const fd = new FormData(form);
      const record = {
        id: s?.id || uid('stu'),
        name: String(fd.get('name')).trim(),
        birthDate: String(fd.get('birthDate')),
        whatsapp: String(fd.get('whatsapp')).trim(),
        email: String(fd.get('email')).trim(),
        startDate: String(fd.get('startDate')),
        dueDate: String(fd.get('dueDate')),
        monthlyFee: Number(fd.get('monthlyFee')) || 0,
        paymentMethod: String(fd.get('paymentMethod')||'pix'),
        active: String(fd.get('active')) === 'true',
        pauseStart: String(fd.get('pauseStart')||''),
        pauseEnd: String(fd.get('pauseEnd')||''),
        pauseReason: String(fd.get('pauseReason')||'').trim(),
        privateNotes: String(fd.get('privateNotes')||'').trim(),
        photoData,
        consent: s?.consent || {sentAt:null,acceptedAt:null},
        createdAt: s?.createdAt || new Date().toISOString()
      };
      if (s) state.students = state.students.map(x=>x.id===s.id?record:x); else state.students.push(record);
      addAudit(s?'Aluno atualizado':'Aluno criado',record.name); saveState(); closeModal(); toast(s?'Aluno atualizado.':'Aluno criado com sucesso.'); render();
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
    const form=$('#closureForm');form.startDate.addEventListener('change',()=>{if(!form.endDate.value||form.endDate.value<form.startDate.value)form.endDate.value=form.startDate.value});form.addEventListener('submit',e=>{e.preventDefault();const fd=new FormData(form),startDate=String(fd.get('startDate')),endDate=String(fd.get('endDate'));if(endDate<startDate)return toast('A data final deve ser igual ou posterior à inicial.');state.studioClosures=state.studioClosures||[];state.studioClosures.push({id:uid('close'),startDate,endDate,type:String(fd.get('type')),label:String(fd.get('label')||fd.get('type')).trim()});addAudit('Calendário bloqueado',`${String(fd.get('type'))} • ${fmtDate(startDate)}${endDate!==startDate?' a '+fmtDate(endDate):''}`);saveState();closeModal();toast('Período bloqueado na agenda.');renderSchedule();});$$('.js-remove-closure').forEach(b=>b.addEventListener('click',()=>{state.studioClosures=state.studioClosures.filter(c=>c.id!==b.dataset.id);saveState();closeModal();openClosuresManager();toast('Bloqueio removido.')}));
  }

  function confirmDeleteStudent(id) {
    const s = state.students.find(x=>x.id===id); if (!s) return;
    openModal('Excluir aluno', `<div class="notice"><strong>${escapeHTML(s.name)}</strong> será removido da lista de alunos e enviado para a <strong>Lixeira</strong>, de onde poderá ser restaurado.</div><div class="modal-actions"><button class="btn btn-secondary" data-close-modal>Cancelar</button><button class="btn btn-danger" id="confirmDelete">${icon('trash')} Mover para lixeira</button></div>`);
    $('#confirmDelete').addEventListener('click',()=>{state.trash=state.trash||[];state.trash.unshift({id:uid('trash'),type:'student',deletedAt:new Date().toISOString(),data:structuredClone(s)});state.students=state.students.filter(x=>x.id!==id);addAudit('Aluno enviado à lixeira',s.name);saveState(); closeModal(); toast('Aluno movido para a lixeira.'); render();});
  }

  function financeTrend(months=6){
    const out=[],now=todayNoon();
    for(let i=months-1;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1,12),mk=monthKey(isoDate(d)),received=state.payments.filter(p=>monthKey(p.date)===mk).reduce((a,p)=>a+(Number(p.amount)||0),0),expenses=state.expenses.filter(e=>monthKey(e.date)===mk).reduce((a,e)=>a+(Number(e.amount)||0),0);out.push({mk,label:new Intl.DateTimeFormat('pt-BR',{month:'short'}).format(d).replace('.',''),received,expenses,net:received-expenses})}return out;
  }
  function financeTrendHTML(){const rows=financeTrend(6),max=Math.max(1,...rows.map(x=>Math.max(x.received,x.expenses)));return `<article class="card finance-trend-card"><div class="premium-card-title"><span>Últimos 6 meses</span>${icon('chart')}</div><div class="finance-bars">${rows.map(x=>`<div class="finance-bar-col"><div class="finance-bars-stack"><span class="finance-bar received" style="height:${Math.max(3,Math.round(x.received/max*100))}%" title="Recebido: ${fmtMoney(x.received)}"></span><span class="finance-bar expense" style="height:${Math.max(3,Math.round(x.expenses/max*100))}%" title="Gastos: ${fmtMoney(x.expenses)}"></span></div><strong>${escapeHTML(x.label)}</strong><small>${privateMoney(x.net)}</small></div>`).join('')}</div><div class="finance-legend"><span>▮ Recebido</span><span>▮ Gastos</span><span>Saldo abaixo de cada mês</span></div></article>`}

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
        <section class="cards grid2"><article class="card"><div class="list-row"><div class="list-main"><strong>Alunos ativos</strong><span>Base de mensalidades</span></div><strong>${m.students}</strong></div><div class="list-row"><div class="list-main"><strong>Ticket médio</strong><span>Média por aluno ativo</span></div><strong>${privateMoney(m.students?m.expected/m.students:0)}</strong></div><div class="list-row"><div class="list-main"><strong>Em atraso</strong><span>${m.overdue} aluno${m.overdue===1?'':'s'} • valor pendente</span></div><strong>${privateMoney(m.overdueValue)}</strong></div></article><article class="card"><div class="notice">A receita prevista é a soma das mensalidades cadastradas. A receita recebida só aumenta quando você registra um pagamento na aba Cobranças ou Receitas.</div></article></section>`;
    } else if (financeTab==='payments') renderPayments(c);
    else renderExpenses(c);
  }

  function renderPayments(c) {
    const groups = paymentsByMonth();
    const current = monthKey();
    const students = activeStudents();
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
            const matchesText = !q || [st?.name,p.description,p.type].some(v => String(v||'').toLowerCase().includes(q));
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
                    <span>${fmtDate(p.date)} • ${escapeHTML(p.type||'Mensalidade')} • ${pm==='cash'?'Dinheiro':'PIX'}</span>
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
    const students = activeStudents();
    if (!students.length) return toast('Cadastre um aluno antes de registrar uma mensalidade.');
    openModal('Registrar receita', `<form id="paymentForm" class="form-grid"><div class="field"><label>Aluno *</label><select name="studentId" required>${students.map(s=>`<option value="${s.id}" ${s.id===preselectedId?'selected':''}>${escapeHTML(s.name)}</option>`).join('')}</select></div><div class="form-grid two"><div class="field"><label>Data *</label><input type="date" name="date" required value="${isoToday()}" /></div><div class="field"><label>Valor *</label><input type="number" name="amount" step="0.01" min="0" required /></div></div><div class="field"><label>Forma de pagamento *</label><select name="paymentMethod" required><option value="pix">PIX</option><option value="cash">Dinheiro</option></select></div><div class="field"><label>Referência</label><input name="reference" value="Mensalidade" /></div><div class="field"><label><input id="advanceDue" type="checkbox" checked style="width:auto;margin-right:8px" /> Avançar vencimento do aluno em 1 mês</label></div><div class="modal-actions"><button type="button" class="btn btn-secondary" data-close-modal>Cancelar</button><button class="btn btn-primary" type="submit">${icon('check')} Registrar</button></div></form>`);
    const form=$('#paymentForm');
    const syncAmount=()=>{const s=state.students.find(x=>x.id===form.studentId.value); if(s) form.amount.value=Number(s.monthlyFee||0).toFixed(2);};
    const syncPaymentMethod=()=>{const s=state.students.find(x=>x.id===form.studentId.value); if(s) form.paymentMethod.value=s.paymentMethod||'pix';};
    form.studentId.addEventListener('change',()=>{syncAmount();syncPaymentMethod();}); syncAmount(); syncPaymentMethod();
    form.addEventListener('submit',e=>{e.preventDefault(); const fd=new FormData(form); const sid=String(fd.get('studentId')); const s=state.students.find(x=>x.id===sid); const payment={id:uid('pay'),studentId:sid,studentName:s?.name||'',date:String(fd.get('date')),amount:Number(fd.get('amount'))||0,paymentMethod:String(fd.get('paymentMethod')||'pix'),reference:String(fd.get('reference')).trim(),createdAt:new Date().toISOString()}; state.payments.push(payment); if($('#advanceDue').checked && s){s.dueDate=addMonthsISO(s.dueDate||isoToday(),1);} saveState(); closeModal(); toast('Receita registrada.'); render();});
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
    const p=state.payments.find(x=>x.id===id);if(!p)return;
    openModal('Editar receita',`<form id="editPaymentForm" class="form-grid"><div class="field"><label>Data</label><input name="date" type="date" required value="${escapeHTML(p.date||isoToday())}" /></div><div class="field"><label>Valor</label><input name="amount" type="number" min="0" step="0.01" required value="${Number(p.amount)||0}" /></div><div class="field"><label>Forma de pagamento</label><select name="paymentMethod"><option value="pix" ${(p.paymentMethod||'pix')==='pix'?'selected':''}>PIX</option><option value="cash" ${p.paymentMethod==='cash'?'selected':''}>Dinheiro</option></select></div><div class="modal-actions"><button type="button" class="btn btn-secondary" data-close-modal>Cancelar</button><button class="btn btn-primary" type="submit">Salvar</button></div></form>`);
    $('#editPaymentForm').addEventListener('submit',e=>{e.preventDefault();const fd=new FormData(e.currentTarget);p.date=String(fd.get('date'));p.amount=Number(fd.get('amount'))||0;p.paymentMethod=String(fd.get('paymentMethod')||'pix');saveState();closeModal();renderFinance();toast('Receita atualizada.');});
  }

  function renderExpenses(c) {
    const expenses=[...state.expenses].sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    c.innerHTML=`<div class="section-head"><div><h3>Gastos</h3><p>Despesas do studio</p></div><button class="btn btn-primary" id="addExpense">${icon('plus')} Novo gasto</button></div><section class="cards">${expenses.length?expenses.map(e=>`<article class="card"><div class="list-row"><div class="list-main"><strong>${escapeHTML(e.description)}</strong><span>${fmtDate(e.date)} • ${escapeHTML(e.category||'Outros')}${e.recurring?' • Recorrente':''}</span></div><div class="finance-row-actions"><strong class="money-negative">${privateMoney(e.amount)}</strong><button class="mini-icon js-edit-expense" data-id="${e.id}" title="Editar">${icon('edit')}</button><button class="mini-icon danger js-del-expense" data-id="${e.id}" title="Excluir">${icon('trash')}</button></div></div></article>`).join(''):emptyState('Nenhum gasto cadastrado','Cadastre equipamentos, manutenção, impostos, serviços e outras despesas.')}</section>`;
    $('#addExpense').addEventListener('click',()=>openExpenseModal());
    $$('.js-edit-expense',c).forEach(b=>b.addEventListener('click',()=>openExpenseModal(b.dataset.id)));
    $$('.js-del-expense',c).forEach(b=>b.addEventListener('click',()=>{const e=state.expenses.find(x=>x.id===b.dataset.id);openModal('Excluir gasto',`<div class="notice">Confirma excluir <strong>${escapeHTML(e?.description||'este gasto')}</strong>? O saldo do mês será recalculado.</div><div class="modal-actions"><button class="btn btn-secondary" data-close-modal>Cancelar</button><button class="btn btn-danger" id="confirmDeleteExpense">Excluir</button></div>`);$('#confirmDeleteExpense').addEventListener('click',()=>{state.expenses=state.expenses.filter(x=>x.id!==b.dataset.id);saveState();closeModal();renderFinance();toast('Gasto excluído.');});}));
  }

  function openExpenseModal(id=null) {
    const existing=id?state.expenses.find(x=>x.id===id):null;
    openModal(existing?'Editar gasto':'Novo gasto',`<form id="expenseForm" class="form-grid"><div class="field"><label>Descrição *</label><input name="description" required value="${escapeHTML(existing?.description||'')}" placeholder="Ex.: Manutenção de equipamento" /></div><div class="form-grid two"><div class="field"><label>Categoria</label><select name="category">${['Equipamentos','Manutenção','Impostos','Serviços','Materiais','Estrutura','Energia','Água','Marketing','Outros'].map(x=>`<option ${existing?.category===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Data *</label><input type="date" name="date" required value="${escapeHTML(existing?.date||isoToday())}" /></div></div><div class="field"><label>Valor *</label><input type="number" name="amount" min="0" step="0.01" required value="${existing?.amount??''}" /></div><label class="toggle-row"><input type="checkbox" name="recurring" ${existing?.recurring?'checked':''}><span>Gasto recorrente mensal</span></label><div class="modal-actions"><button type="button" class="btn btn-secondary" data-close-modal>Cancelar</button><button class="btn btn-primary" type="submit">${icon('check')} ${existing?'Salvar alterações':'Salvar gasto'}</button></div></form>`);
    $('#expenseForm').addEventListener('submit',e=>{e.preventDefault();const fd=new FormData(e.currentTarget),record={id:existing?.id||uid('exp'),description:String(fd.get('description')).trim(),category:String(fd.get('category')||'Outros'),date:String(fd.get('date')),amount:Number(fd.get('amount'))||0,recurring:fd.get('recurring')==='on',createdAt:existing?.createdAt||new Date().toISOString()};if(existing)state.expenses=state.expenses.map(x=>x.id===existing.id?record:x);else state.expenses.push(record);saveState();closeModal();renderFinance();toast(existing?'Gasto atualizado.':'Gasto registrado.');});
  }

  function renderCharges() {
    const students=activeStudents().map(s=>({s,info:dueInfo(s)})).sort((a,b)=>a.info.days-b.info.days);
    const tabs=[['all','Todos'],['overdue','Vencidos'],['soon','Vencendo']];
    const filtered=students.filter(x=>chargeTab==='all'||(chargeTab==='overdue'?x.info.key==='overdue':['today','soon'].includes(x.info.key)));
    viewEl.innerHTML=`<div class="tabs">${tabs.map(([id,l])=>`<button class="tab ${chargeTab===id?'active':''}" data-charge-tab="${id}">${l}</button>`).join('')}</div><div class="notice">O botão de WhatsApp abre uma mensagem pronta. O envio só acontece quando você confirma no WhatsApp.</div><div class="section-head"><div><h3>Lembretes de mensalidade</h3><p>Vencimentos e cobranças</p></div></div><section class="cards">${filtered.length?filtered.map(({s,info})=>`<article class="card"><div class="student-card"><div><div class="student-name">${escapeHTML(s.name)}</div><div class="student-meta"><span>Vencimento: <strong>${fmtDate(s.dueDate)}</strong></span><span><strong>${fmtMoney(s.monthlyFee)}</strong></span></div><div style="margin-top:9px"><span class="status ${info.cls}">${info.text}</span></div></div><div class="student-actions"><button class="mini-icon js-charge-whatsapp" data-id="${s.id}" title="WhatsApp">${icon('message')}</button><button class="mini-icon js-mark-paid" data-id="${s.id}" title="Registrar pagamento">${icon('check')}</button></div></div></article>`).join(''):emptyState('Nenhum aluno nessa situação','As cobranças aparecerão aqui conforme as datas de vencimento.')}</section>`;
    $$('[data-charge-tab]').forEach(b=>b.addEventListener('click',()=>{chargeTab=b.dataset.chargeTab;renderCharges();}));
    $$('.js-charge-whatsapp').forEach(b=>b.addEventListener('click',()=>sendChargeWhatsApp(b.dataset.id)));
    $$('.js-mark-paid').forEach(b=>b.addEventListener('click',()=>openPaymentModal(b.dataset.id)));
  }

  function cleanPhone(value) {
    const digits=String(value||'').replace(/\D/g,'');
    if (!digits) return '';
    return digits.startsWith('55') ? digits : `55${digits}`;
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
    const digits=String(value||'').replace(/\D/g,'');
    let n=digits.startsWith('55')?digits.slice(2):digits;
    if(n.length===11) return `+55 (${n.slice(0,2)}) ${n.slice(2,7)}-${n.slice(7)}`;
    if(n.length===10) return `+55 (${n.slice(0,2)}) ${n.slice(2,6)}-${n.slice(6)}`;
    return value||'Sem WhatsApp';
  }

  function reminderTemplate(type){
    const templates={
      frequency:'Olá, [nome]! Seu resumo de [mes] no Studio Márcio Bueno: você realizou [treinos] treino(s), teve [faltas] falta(s) e [reposicoes] reposição(ões). Continue firme! 💪',
      charge:'Olá, [nome]! Tudo bem? Passando para lembrar sobre sua mensalidade do Studio Márcio Bueno. Quando puder, me confirme o pagamento. Obrigado!',
      birthday:'Olá, [nome]! 🎉 Passando para desejar um feliz aniversário! Que seu novo ciclo seja cheio de saúde, conquistas e bons momentos. Um abraço do Studio Márcio Bueno!',
      absence:'Olá, [nome]! Tudo bem? Sentimos sua falta nos últimos treinos. Quando puder, me avise para organizarmos sua rotina e mantermos a frequência. 💪',
      confirmation:'Olá, [nome]! Tudo bem? Passando para confirmar seu horário de treino no Studio Márcio Bueno. Se precisar ajustar, me avise por aqui. 👍',
      makeup:'Olá, [nome]! Tudo bem? Surgiu uma possibilidade de reposição no Studio Márcio Bueno. Se tiver interesse, me responda por aqui para combinarmos o melhor horário.',
      general:'Olá, [nome]! Tudo bem? Passando para deixar um lembrete do Studio Márcio Bueno.'
    };
    return templates[type]||templates.general;
  }

  function personalizeReminder(template, student, mk=monthKey()){
    const st=monthlyAttendanceStats(student.id,mk);
    const first=(student.name||'').trim().split(/\s+/)[0]||student.name||'aluno';
    return String(template||'')
      .replaceAll('[nome]',first)
      .replaceAll('[treinos]',String(st.present))
      .replaceAll('[faltas]',String(st.absent))
      .replaceAll('[reposicoes]',String(st.makeups))
      .replaceAll('[mes]',monthLabel(mk));
  }

  function renderReminders(){
    const students=[...activeStudents()].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')),mk=monthKey();
    const overdueIds=new Set(students.filter(s=>dueInfo(s).key==='overdue').map(s=>String(s.id)));
    const birthdayIds=new Set(birthdayStudents(7).map(x=>String(x.s.id)));
    const absentIds=new Set(students.filter(s=>monthlyAttendanceStats(s.id,mk).absent>0).map(s=>String(s.id)));
    const frequencySets={
      zero:new Set(students.filter(s=>monthlyAttendanceStats(s.id,mk).present===0).map(s=>String(s.id))),
      low:new Set(students.filter(s=>{const n=monthlyAttendanceStats(s.id,mk).present;return n>=1&&n<=4}).map(s=>String(s.id))),
      mid:new Set(students.filter(s=>{const n=monthlyAttendanceStats(s.id,mk).present;return n>=5&&n<=8}).map(s=>String(s.id))),
      high:new Set(students.filter(s=>monthlyAttendanceStats(s.id,mk).present>=9).map(s=>String(s.id)))
    };
    let activeFilter='none',frequencyFilter='all',sendMode='group',searchQuery='';
    const selectedIds=new Set();
    const filterIds=()=>{
      let base=activeFilter==='overdue'?overdueIds:activeFilter==='birthday'?birthdayIds:activeFilter==='absent'?absentIds:new Set(students.map(s=>String(s.id)));
      if(frequencyFilter!=='all')base=new Set([...base].filter(id=>frequencySets[frequencyFilter].has(id)));
      return base;
    };
    const visibleStudents=()=>activeFilter==='none'&&!searchQuery?[]:students.filter(s=>filterIds().has(String(s.id))&&(!searchQuery||[s.name,s.whatsapp,s.email].some(v=>String(v||'').toLowerCase().includes(searchQuery))));
    viewEl.innerHTML=`<div class="notice reminder-intro">${icon('message')}<div><strong>Central de comunicação</strong><span>Fluxo simples: escolha a mensagem, selecione os destinatários e revise antes de abrir o WhatsApp.</span></div></div>
      <section class="reminder-steps"><span class="active">1 <b>Mensagem</b></span><span>2 <b>Destinatários</b></span><span>3 <b>Revisar</b></span></section>
      <section class="card reminder-card">
        <div class="reminder-mode-switch"><button type="button" class="reminder-mode" data-mode="individual">${icon('users')} Individual</button><button type="button" class="reminder-mode active" data-mode="group">${icon('message')} Grupo de alunos</button></div>
        <div class="field"><label>Mensagem</label><textarea id="reminderMessage" class="auto-message" placeholder="Escolha um modelo ou escreva sua mensagem."></textarea><small>Campos automáticos: <strong>[nome]</strong>, <strong>[treinos]</strong>, <strong>[faltas]</strong>, <strong>[reposicoes]</strong> e <strong>[mes]</strong>.</small></div>
        <div class="reminder-template-head"><strong>Mensagens prontas</strong><span>Personalizadas automaticamente</span></div>
        <div class="reminder-templates">${[['frequency','calendar','Frequência do mês'],['charge','bell','Cobrança'],['birthday','calendar','Aniversário'],['absence','users','Retorno'],['confirmation','check','Confirmar horário'],['makeup','calendar','Reposição disponível'],['general','message','Geral']].map(([k,i,l],idx)=>`<button type="button" class="btn ${idx===0?'btn-primary':'btn-secondary'} btn-small js-template" data-template="${k}">${icon(i)} ${l}</button>`).join('')}</div>
        <div class="reminder-stage-title"><span class="stage-number">2</span><div><strong>Selecionar destinatários</strong><small>Use busca ou filtro; a lista só aparece quando necessária.</small></div></div>
        <div class="search-wrap">${icon('search')}<input id="reminderSearch" type="search" placeholder="Buscar aluno pelo nome, WhatsApp ou e-mail" /></div>
        <div class="recipient-filters">
          <button class="recipient-filter" data-filter="all">Todos <b>${students.length}</b></button>
          <button class="recipient-filter" data-filter="overdue">Vencidos <b>${overdueIds.size}</b></button>
          <button class="recipient-filter" data-filter="birthday">Aniversários <b>${birthdayIds.size}</b></button>
          <button class="recipient-filter" data-filter="absent">Com faltas <b>${absentIds.size}</b></button>
          <select id="frequencyFilter"><option value="all">Frequência: todas</option><option value="zero">0 treinos (${frequencySets.zero.size})</option><option value="low">1–4 treinos (${frequencySets.low.size})</option><option value="mid">5–8 treinos (${frequencySets.mid.size})</option><option value="high">9+ treinos (${frequencySets.high.size})</option></select>
        </div>
        <div class="recipient-result-bar"><span id="recipientResultLabel">Escolha um filtro ou pesquise um aluno.</span><div><button type="button" class="link-btn" id="selectVisible">Selecionar exibidos</button><button type="button" class="link-btn" id="clearReminder">Limpar</button></div></div>
        <div id="reminderStudents" class="reminder-students collapsed-list"></div>
        <div class="reminder-footer sticky-reminder-footer"><div class="reminder-selection-summary" id="reminderSelectionSummary">Nenhum aluno selecionado</div><button type="button" class="btn btn-primary" id="prepareReminder" disabled>Revisar mensagens</button></div>
      </section><section id="reminderQueue" class="cards reminder-review" style="margin-top:12px"></section>`;
    const updateSummary=()=>{const n=selectedIds.size;$('#reminderSelectionSummary').innerHTML=n?`<strong>${n} aluno${n===1?'':'s'} selecionado${n===1?'':'s'}</strong> <button class="link-btn" id="reviewSelectedInline">Ver seleção</button>`:'Nenhum aluno selecionado';$('#prepareReminder').disabled=!n;};
    const draw=()=>{const list=visibleStudents(),root=$('#reminderStudents');$('#recipientResultLabel').textContent=list.length?`${list.length} aluno${list.length===1?'':'s'} encontrado${list.length===1?'':'s'} • ${selectedIds.size} selecionado${selectedIds.size===1?'':'s'}`:'Nenhum aluno exibido';root.innerHTML=list.length?list.map(s=>{const sid=String(s.id),checked=selectedIds.has(sid),info=dueInfo(s),st=monthlyAttendanceStats(s.id,mk);const tags=[`<span class="status neutral">${st.present} treino${st.present===1?'':'s'}</span>`];if(info.key==='overdue')tags.push('<span class="status danger">Vencido</span>');if(st.absent)tags.push(`<span class="status neutral">${st.absent} falta${st.absent===1?'':'s'}</span>`);return `<label class="reminder-student recipient-card ${checked?'selected':''}"><input type="${sendMode==='individual'?'radio':'checkbox'}" name="reminderStudent" value="${sid}" ${checked?'checked':''}><span class="student-photo tiny-photo">${s.photoData?`<img src="${s.photoData}" alt="" />`:`<span>${escapeHTML((s.name||'?').charAt(0).toUpperCase())}</span>`}</span><span class="reminder-student-info"><strong>${escapeHTML(s.name)}</strong><small>${escapeHTML(formatPhoneBR(s.whatsapp))}</small><span class="reminder-tags">${tags.join('')}</span></span><span class="recipient-check">${icon('check')}</span></label>`}).join(''):emptyState('Lista recolhida','Escolha um filtro ou pesquise para mostrar apenas os alunos necessários.');
      $$('input[name="reminderStudent"]',root).forEach(x=>x.addEventListener('change',()=>{if(sendMode==='individual'){selectedIds.clear();if(x.checked)selectedIds.add(String(x.value));draw();return;}x.checked?selectedIds.add(String(x.value)):selectedIds.delete(String(x.value));draw();}));updateSummary();};
    const applyFilter=k=>{activeFilter=k;$$('.recipient-filter',viewEl).forEach(b=>b.classList.toggle('active',b.dataset.filter===k));draw();};
    $$('.reminder-mode',viewEl).forEach(b=>b.addEventListener('click',()=>{sendMode=b.dataset.mode;selectedIds.clear();$$('.reminder-mode',viewEl).forEach(x=>x.classList.toggle('active',x===b));draw();$('#reminderQueue').innerHTML='';}));
    $$('.recipient-filter',viewEl).forEach(b=>b.addEventListener('click',()=>applyFilter(b.dataset.filter)));
    $('#frequencyFilter').addEventListener('change',e=>{frequencyFilter=e.target.value;if(activeFilter==='none')activeFilter='all';draw();});
    $('#reminderSearch').addEventListener('input',e=>{searchQuery=e.target.value.trim().toLowerCase();if(searchQuery&&activeFilter==='none')activeFilter='all';draw();});
    $$('.js-template',viewEl).forEach(b=>b.addEventListener('click',()=>{$('#reminderMessage').value=reminderTemplate(b.dataset.template);$$('.js-template',viewEl).forEach(x=>{x.classList.toggle('btn-primary',x===b);x.classList.toggle('btn-secondary',x!==b)});}));
    $('#selectVisible').addEventListener('click',()=>{const list=visibleStudents();if(sendMode==='individual'){selectedIds.clear();if(list[0])selectedIds.add(String(list[0].id));}else list.forEach(s=>selectedIds.add(String(s.id)));draw();});
    $('#clearReminder').addEventListener('click',()=>{selectedIds.clear();draw();$('#reminderQueue').innerHTML='';});
    $('#prepareReminder').addEventListener('click',()=>{const msg=$('#reminderMessage').value.trim();if(!msg)return toast('Escreva ou escolha uma mensagem primeiro.');const selected=[...selectedIds].map(id=>state.students.find(s=>String(s.id)===id)).filter(Boolean).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));if(!selected.length)return toast('Selecione pelo menos um aluno.');$('#reminderQueue').innerHTML=`<div class="section-head"><div><h3>3. Revisar e enviar</h3><p>${selected.length} conversa${selected.length===1?'':'s'} preparada${selected.length===1?'':'s'} • confira antes de abrir o WhatsApp</p></div></div>`+selected.map(s=>{const phone=cleanPhone(s.whatsapp),msgFinal=personalizeReminder(msg,s,mk);return `<article class="card reminder-ready"><div class="list-row"><div class="list-main"><strong>${escapeHTML(s.name)}</strong><span>${phone?escapeHTML(formatPhoneBR(s.whatsapp)):'WhatsApp não cadastrado'}</span><small>${escapeHTML(msgFinal)}</small></div>${phone?`<button class="btn btn-primary btn-small js-open-reminder" data-url="https://wa.me/${phone}?text=${encodeURIComponent(msgFinal)}">${icon('message')} Abrir WhatsApp</button>`:'<span class="status danger">Sem número</span>'}</div></article>`}).join('');$$('.js-open-reminder',viewEl).forEach(b=>b.addEventListener('click',()=>window.open(b.dataset.url,'_blank','noopener,noreferrer')));$('#reminderQueue').scrollIntoView({behavior:'smooth',block:'start'});});
    $('#reminderMessage').value=reminderTemplate('frequency');draw();
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
    openModal('Termo de consentimento',`<div class="consent-version">Versão do termo: <strong>${version}</strong></div><div class="consent-box" id="consentText">${escapeHTML(text)}</div><div class="consent-how"><strong>Como aceitar</strong><span>Após o aluno responder “LI E ACEITO”, confirme o aceite abaixo para registrar no sistema.</span></div><div class="modal-actions"><button class="btn btn-secondary" id="copyConsent">Copiar termo</button><button class="btn btn-primary" id="sendConsent">${icon('message')} WhatsApp</button></div><div class="modal-actions"><button class="btn btn-secondary" data-close-modal>Fechar</button><button class="btn ${c.sentAt&&!c.acceptedAt?'btn-success':'btn-secondary'}" id="acceptConsent" ${c.acceptedAt?'disabled':''}>${icon('check')} ${c.acceptedAt?'Aceito em '+fmtDate(c.acceptedAt.slice(0,10)):'Registrar aceite'}</button></div>`);
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

  function dayIdFromDate(d){return {1:'mon',2:'tue',3:'wed',4:'thu',5:'fri'}[d.getDay()]||''}
  function weeklyScheduleOverviewHTML(){
    return `<div class="schedule-week-overview">${SCHEDULE_DAYS.map(d=>{
      const date=scheduleDateForDay(d.id),closure=closureForDate(date);
      if(closure)return `<article class="card week-overview-day is-closed"><div class="premium-card-title"><span>${d.label}</span><strong>${fmtDate(date).slice(0,5)}</strong></div><div class="week-closure"><strong>${escapeHTML(closure.type)} — aulas canceladas</strong><span>${escapeHTML(closure.label||'Studio fechado')} • ninguém recebe falta</span></div></article>`;
      const activeSlots=scheduleHours(d.id).filter(t=>slotStudents(d.id,t).length||makeupStudentIds(date,d.id,t).length);
      const fixed=activeSlots.reduce((n,t)=>n+slotStudents(d.id,t).length,0),reps=activeSlots.reduce((n,t)=>n+makeupStudentIds(date,d.id,t).length,0);
      return `<article class="card week-overview-day"><div class="premium-card-title"><span>${d.label}</span><strong>${fmtDate(date).slice(0,5)}</strong></div><p>${activeSlots.length} aula${activeSlots.length===1?'':'s'} • ${fixed} fixo${fixed===1?'':'s'} • ${reps} reposição${reps===1?'':'ões'}</p><div class="week-overview-times">${activeSlots.length?activeSlots.map(t=>`<button type="button" class="week-slot-chip" data-week-day="${d.id}" data-week-time="${t}">${t} <span>${slotStudents(d.id,t).length}+${makeupStudentIds(date,d.id,t).length}R</span></button>`).join(''):'<span class="muted-inline">Sem alunos neste dia</span>'}</div></article>`
    }).join('')}</div>`;
  }
  function monthlyScheduleOverviewHTML(){
    const anchor=new Date(scheduleWeekStart.getFullYear(),scheduleWeekStart.getMonth(),1,12),y=anchor.getFullYear(),m=anchor.getMonth(),last=new Date(y,m+1,0).getDate(),firstDow=(new Date(y,m,1,12).getDay()+6)%7;
    const cells=[];for(let i=0;i<firstDow;i++)cells.push('<div class="month-day blank"></div>');
    for(let n=1;n<=last;n++){const d=new Date(y,m,n,12),dayId=dayIdFromDate(d),date=isoDate(d),closure=closureForDate(date);if(!dayId){cells.push(`<div class="month-day weekend"><strong>${n}</strong></div>`);continue;}const slots=scheduleHours(dayId),classes=slots.filter(t=>slotStudents(dayId,t).length||makeupStudentIds(date,dayId,t).length).length,reps=slots.reduce((a,t)=>a+makeupStudentIds(date,dayId,t).length,0),planned=plannedAbsencesOn(date).length,vacancies=slots.filter(t=>slotStudents(dayId,t).length||makeupStudentIds(date,dayId,t).length).reduce((a,t)=>{const fixed=effectiveFixedStudentIds(dayId,t,date).length;return a+Math.max(0,4-fixed)},0),mapCount=Object.entries(state.attendance||{}).filter(([k])=>k.startsWith(date+'__')).reduce((a,[,map])=>a+Object.values(map||{}).filter(v=>v==='present').length,0);cells.push(`<button type="button" class="month-day ${date===isoToday()?'today':''} ${closure?'is-closed':''}" data-month-date="${date}"><strong>${n}</strong>${closure?`<span class="month-closed">${escapeHTML(closure.type)}</span>`:`<span>${classes} aula${classes===1?'':'s'}</span>${reps?`<em>${reps}R</em>`:''}${planned?`<em class="month-absence">${planned}A</em>`:''}${vacancies?`<small>${vacancies} vaga${vacancies===1?'':'s'}</small>`:''}${mapCount?`<small>✓ ${mapCount}</small>`:''}`}</button>`)}
    return `<section class="month-overview"><div class="month-weekdays"><span>SEG</span><span>TER</span><span>QUA</span><span>QUI</span><span>SEX</span><span>SÁB</span><span>DOM</span></div><div class="month-grid">${cells.join('')}</div></section>`;
  }

  function renderSchedule(){
    const weekEnd=addDays(scheduleWeekStart,4),mk=monthKey(),students=[...activeStudents()].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')),occ=occupancyStats();
    const day=SCHEDULE_DAYS.find(d=>d.id===selectedScheduleDay)||SCHEDULE_DAYS[0];
    const date=scheduleDateForDay(day.id);
    const slots=scheduleHours(day.id),dayClosure=closureForDate(date),dayPlanned=plannedAbsencesOn(date).length;
    const dayStats=slots.reduce((acc,time)=>{
      const ids=slotStudents(day.id,time),makeupIds=makeupStudentIds(date,day.id,time),map=attendanceMap(date,day.id,time);
      if(ids.length||makeupIds.length)acc.classes++;
      acc.fixed+=ids.length;
      acc.makeups+=makeupIds.length;
      [...ids,...makeupIds].forEach(id=>{if(map[id]==='present')acc.present++;if(map[id]==='absent')acc.absent++;});
      return acc;
    },{classes:0,fixed:0,makeups:0,present:0,absent:0});

    viewEl.innerHTML=`
      <section class="schedule-pro-head">
        <div><span class="section-overline">AGENDA PREMIUM</span><h3>${scheduleViewMode==='day'?'Agenda diária':scheduleViewMode==='week'?'Agenda semanal':'Agenda mensal'}</h3><p>Personal • até 4 alunos fixos • múltiplas reposições por horário</p></div>
        <div class="schedule-head-actions"><button class="btn btn-primary btn-small holiday-3d-btn" id="quickHoliday">★ Marcar feriado</button><button class="btn btn-secondary btn-small" id="manageClosures">Feriados / recesso</button><span class="schedule-pro-badge">${icon('calendar')} ${escapeHTML(monthLabel(mk))}</span></div>
      </section>

      <div class="week-nav schedule-week-nav"><button class="mini-icon" id="prevWeek" title="Semana anterior">‹</button><div class="week-label"><strong>${fmtDate(isoDate(scheduleWeekStart))} — ${fmtDate(isoDate(weekEnd))}</strong><button class="link-btn" id="currentWeek">Semana atual</button></div><button class="mini-icon" id="nextWeek" title="Próxima semana">›</button></div>

      <div class="schedule-view-tabs" role="tablist"><button type="button" class="tab ${scheduleViewMode==='day'?'active':''}" data-schedule-view="day">Dia</button><button type="button" class="tab ${scheduleViewMode==='week'?'active':''}" data-schedule-view="week">Semana</button><button type="button" class="tab ${scheduleViewMode==='month'?'active':''}" data-schedule-view="month">Mês</button></div>

      <div class="schedule-day-tabs ${scheduleViewMode==='month'?'hidden':''}" role="tablist">${SCHEDULE_DAYS.map(d=>{
        const dte=parseLocalDate(scheduleDateForDay(d.id));
        const short=d.label.slice(0,3).toUpperCase();
        const active=d.id===day.id;
        return `<button type="button" class="schedule-day-tab ${active?'active':''}" data-schedule-day="${d.id}" role="tab" aria-selected="${active}"><small>${short}</small><strong>${String(dte.getDate()).padStart(2,'0')}</strong></button>`;
      }).join('')}</div>

      <section class="schedule-day-summary">
        <div><span class="section-overline">${day.label.toUpperCase()}</span><h3>${day.label}, ${fmtDate(date)}</h3><p>${dayClosure?`<strong>${escapeHTML(dayClosure.type)} • ${escapeHTML(dayClosure.label||'Studio fechado')}</strong>`:`${dayStats.classes} aula${dayStats.classes===1?'':'s'} • ${dayStats.fixed} aluno${dayStats.fixed===1?'':'s'} fixo${dayStats.fixed===1?'':'s'} • ${dayStats.makeups} ${dayStats.makeups===1?'reposição':'reposições'}${dayPlanned?` • ${dayPlanned} ausência${dayPlanned===1?'':'s'} programada${dayPlanned===1?'':'s'}`:''}`}</p></div>
        ${dayClosure?`<div class="schedule-day-mini closed-mini"><span>Aulas canceladas</span></div>`:`<div class="schedule-day-mini"><span>✓ ${dayStats.present}</span><span>✕ ${dayStats.absent}</span></div>`}
      </section>

      ${scheduleViewMode==='day'?(dayClosure?`<section class="closed-day-card"><span>✦</span><div><strong>${escapeHTML(dayClosure.type)} — aulas canceladas</strong><p>${escapeHTML(dayClosure.label||'Studio fechado')} • Nenhum aluno recebe falta neste dia.</p></div></section>`:`<div class="schedule-pro-list">${slots.map(t=>scheduleSlotHTML(day.id,t)).join('')}</div>`):scheduleViewMode==='week'?weeklyScheduleOverviewHTML():monthlyScheduleOverviewHTML()}

      <section class="schedule-insights">
        <article class="card"><div class="premium-card-title"><span>Ocupação geral</span>${icon('chart')}</div><div class="schedule-kpi">${occ.percent}%</div><small>${occ.used}/${occ.totalCapacity} vagas fixas ocupadas</small></article>
        <article class="card"><div class="premium-card-title"><span>Reposições</span>${icon('users')}</div><div class="schedule-kpi">${makeupSummary().scheduledNext7}</div><small>agendadas nos próximos 7 dias</small></article>
      </section>

      <div class="section-head"><div><h3>Resumo mensal de treinos</h3><p>${monthLabel(mk)} • presenças registradas, incluindo reposições</p></div></div>
      <section class="cards">${students.length?students.map(s=>monthlyReportRow(s,mk)).join(''):emptyState('Nenhum aluno ativo','Cadastre alunos para gerar o resumo mensal.')}</section>`;

    $$('.schedule-slot',viewEl).forEach(b=>b.addEventListener('click',()=>openScheduleSlot(b.dataset.day,b.dataset.time)));
    $('#manageClosures')?.addEventListener('click',openClosuresManager);
    $('#quickHoliday')?.addEventListener('click',openHolidayQuick);
    $$('[data-schedule-view]',viewEl).forEach(b=>b.addEventListener('click',()=>{scheduleViewMode=b.dataset.scheduleView;renderSchedule()}));
    $$('[data-week-day]',viewEl).forEach(b=>b.addEventListener('click',()=>openScheduleSlot(b.dataset.weekDay,b.dataset.weekTime)));
    $$('[data-month-date]',viewEl).forEach(b=>b.addEventListener('click',()=>{const d=parseLocalDate(b.dataset.monthDate),dayId=dayIdFromDate(d);if(!dayId)return;scheduleWeekStart=mondayOf(d);selectedScheduleDay=dayId;scheduleViewMode='day';renderSchedule()}));
    $$('.schedule-day-tab',viewEl).forEach(b=>b.addEventListener('click',()=>{selectedScheduleDay=b.dataset.scheduleDay;renderSchedule()}));
    $('#prevWeek').addEventListener('click',()=>{scheduleWeekStart=addDays(scheduleWeekStart,-7);renderSchedule()});
    $('#nextWeek').addEventListener('click',()=>{scheduleWeekStart=addDays(scheduleWeekStart,7);renderSchedule()});
    $('#currentWeek').addEventListener('click',()=>{scheduleWeekStart=mondayOf();selectedScheduleDay=({1:'mon',2:'tue',3:'wed',4:'thu',5:'fri'}[new Date().getDay()]||'mon');renderSchedule()});
    $$('.js-month-whatsapp',viewEl).forEach(b=>b.addEventListener('click',()=>sendMonthlyAttendanceWhatsApp(b.dataset.id,mk)));
  }

  function monthlyReportRow(s,mk){
    const st=monthlyAttendanceStats(s.id,mk);
    const makeupText=st.makeups===1?'sendo 1 reposição':`sendo ${st.makeups} reposições`;
    const credits=makeupCreditBalance(s.id);
    return `<article class="card monthly-report-card"><div class="list-row"><div class="student-profile"><div class="student-photo tiny-photo">${s.photoData?`<img src="${s.photoData}" alt="" />`:`<span>${escapeHTML((s.name||'?').charAt(0).toUpperCase())}</span>`}</div><div class="list-main"><strong>${escapeHTML(s.name)}</strong><span><strong>${st.present} treino${st.present===1?'':'s'} realizado${st.present===1?'':'s'}</strong> • ${st.absent} falta${st.absent===1?'':'s'} • ${makeupText}</span><small>${monthLabel(mk)} • ${credits.available} crédito${credits.available===1?'':'s'} de reposição disponível${credits.available===1?'':'is'}</small></div></div><button class="mini-icon js-month-whatsapp" data-id="${s.id}" title="Enviar resumo mensal pelo WhatsApp">${icon('message')}</button></div></article>`;
  }

  function sendMonthlyAttendanceWhatsApp(id,mk){
    const s=state.students.find(x=>x.id===id);if(!s)return;const phone=cleanPhone(s.whatsapp);if(!phone)return toast('Cadastre um WhatsApp válido para este aluno.');
    const st=monthlyAttendanceStats(id,mk);const first=(s.name||'').split(' ')[0]||s.name;
    const makeupText=st.makeups===1?'sendo 1 reposição':`sendo ${st.makeups} reposições`;
    const text=`Olá, ${first}! Seu resumo de ${monthLabel(mk)} no Studio Márcio Bueno: ${st.present} treino${st.present===1?'':'s'} realizado${st.present===1?'':'s'}, ${st.absent} falta${st.absent===1?'':'s'}, ${makeupText}. 💪`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`,'_blank','noopener,noreferrer');
  }

  function scheduleSlotHTML(day,time){
    const ids=slotStudents(day,time),date=scheduleDateForDay(day),map=attendanceMap(date,day,time);
    const enrolled=ids.map(id=>state.students.find(s=>s.id===id)).filter(Boolean);
    const makeupIds=makeupStudentIds(date,day,time), makeups=makeupIds.map(id=>state.students.find(s=>s.id===id)).filter(Boolean);
    const allIds=[...new Set([...ids,...makeupIds])];
    const present=allIds.filter(id=>map[id]==='present').length, absent=allIds.filter(id=>map[id]==='absent').length;
    const effectiveIds=effectiveFixedStudentIds(day,time,date),plannedIds=ids.filter(id=>plannedAbsenceFor(id,date)),pausedIds=ids.filter(id=>{const st=state.students.find(x=>String(x.id)===String(id));return Boolean(studentPauseAt(st,date))}),vacancies=Math.max(0,4-effectiveIds.length),waiters=waitlistFor(day,time),trials=trialsFor(date,day,time);
    const countClass=ids.length>=4?'full':ids.length>=3?'busy':ids.length?'active':'empty';
    return `<button type="button" class="schedule-slot schedule-slot-pro ${countClass} ${makeups.length?'has-makeup':''}" data-day="${day}" data-time="${time}">
      <span class="schedule-time-rail"><strong>${time}</strong><small>PERSONAL</small></span>
      <span class="schedule-slot-body">
        <span class="schedule-slot-top"><strong>Personal</strong><span class="schedule-pills"><span class="schedule-capacity">${ids.length}/4${makeups.length?` + ${makeups.length}R`:''}</span><span class="schedule-vacancy">${vacancies} vaga${vacancies===1?'':'s'}</span></span></span>
        <span class="schedule-people">${enrolled.length?enrolled.map(s=>{const st=attendanceStatus(date,day,time,s.id);const planned=plannedAbsenceFor(s.id,date),paused=studentPauseAt(s,date);return `<span class="schedule-person ${planned?'is-planned-absence':''} ${paused?'is-paused-student':''}"><span class="schedule-initial ${st==='present'?'is-present':st==='absent'?'is-absent':''}" style="${st==='present'?'background:#2e9b63;border-color:#49bd7d;color:#fff;box-shadow:0 0 0 1px rgba(73,189,125,.18),0 4px 14px rgba(46,155,99,.22);':st==='absent'?'background:#c94b55;border-color:#e46a73;color:#fff;box-shadow:0 0 0 1px rgba(228,106,115,.16),0 4px 14px rgba(201,75,85,.20);':''}">${escapeHTML((s.name||'?').charAt(0).toUpperCase())}</span><span>${escapeHTML(s.name)}${planned?'<small>Ausência avisada</small>':paused?'<small>Pausado</small>':''}</span></span>`}).join(''):`<span class="schedule-empty-line">${icon('users')} Vagas disponíveis</span>`}</span>
        ${(plannedIds.length||pausedIds.length)?`<span class="schedule-availability-note">${plannedIds.length?`${plannedIds.length} ausência${plannedIds.length===1?'':'s'} avisada${plannedIds.length===1?'':'s'}`:''}${plannedIds.length&&pausedIds.length?' • ':''}${pausedIds.length?`${pausedIds.length} em pausa`:''} • vaga liberada</span>`:''}${makeups.length?`<span class="schedule-makeup-group">${makeups.map(m=>`<span class="schedule-makeup-line"><span class="makeup-square">R</span><strong>${escapeHTML(m.name)}</strong><em>Reposição</em></span>`).join('')}</span>`:''}
        ${trials.length?`<span class="trial-lines">${trials.map(t=>`<span class="trial-line"><span class="trial-cube">E</span><strong>${escapeHTML(t.name)}</strong><em>Experimental</em></span>`).join('')}</span>`:''}${waiters.length?`<span class="waitlist-badge">${waiters.length} na lista de espera</span>`:''}${(present||absent)?`<span class="attendance-mini"><span>✓ ${present} presença${present===1?'':'s'}</span><span>✕ ${absent} falta${absent===1?'':'s'}</span></span>`:''}
      </span>
      <span class="schedule-chevron">›</span>
    </button>`;
  }

  function setMakeupStudents(date,day,time,studentIds){
    state.makeups=state.makeups||{};
    const k=attendanceKey(date,day,time),old=makeupStudentIds(date,day,time),next=[...new Set((studentIds||[]).filter(Boolean).map(String))];
    old.filter(id=>!next.includes(id)).forEach(id=>setAttendance(date,day,time,id,''));
    if(next.length){state.makeups[k]=next;next.forEach(id=>{if(!attendanceStatus(date,day,time,id))setAttendance(date,day,time,id,'present')});}
    else delete state.makeups[k];
    saveState();
  }
  function removeMakeupStudent(date,day,time,studentId){
    const next=makeupStudentIds(date,day,time).filter(id=>String(id)!==String(studentId));
    setMakeupStudents(date,day,time,next);
  }

  function attendanceStudentCard(s,date,day,time,isMakeup=false){
    const st=attendanceStatus(date,day,time,s.id);
    const planned=plannedAbsenceFor(s.id,date),paused=studentPauseAt(s,date);return `<div class="daily-attendance-card ${isMakeup?'makeup-card':''} ${planned?'planned-absence-card':''} ${paused?'paused-card':''}">
      <div class="daily-student"><span class="student-photo tiny-photo">${s.photoData?`<img src="${s.photoData}" alt="" />`:`<span>${escapeHTML((s.name||'?').charAt(0).toUpperCase())}</span>`}</span>
      <div><strong>${escapeHTML(s.name)}</strong>${isMakeup?'<small>REPOSIÇÃO</small>':planned?'<small>AUSÊNCIA PROGRAMADA • VAGA LIBERADA</small>':paused?'<small>ALUNO EM PAUSA</small>':''}</div></div>
      ${(planned||paused)?`<div class="attendance-hold-note">${planned?'Ausência avisada — não gera falta':'Pausa ativa — frequência suspensa'}</div>`:`<div class="attendance-actions">
        <button type="button" class="attendance-btn present ${st==='present'?'active':''}" data-att="present" data-id="${s.id}">✓ Presente</button>
        <button type="button" class="attendance-btn absent ${st==='absent'?'active':''}" data-att="absent" data-id="${s.id}">✕ Falta</button>
      </div>`}
      ${isMakeup?`<button type="button" class="remove-makeup" data-remove-makeup="${s.id}">Remover reposição</button>`:''}
    </div>`;
  }

  function bindAttendanceButtons(root,date,day,time){
    $$('.attendance-btn',root).forEach(b=>b.addEventListener('click',()=>{
      const id=b.dataset.id,status=b.dataset.att;
      setAttendance(date,day,time,id,status); const stAudit=state.students.find(s=>s.id===id); addAudit(status==='present'?'Presença registrada':'Falta registrada',`${stAudit?.name||'Aluno'} • ${fmtDate(date)} ${time}`); saveState();

      // Atualiza imediatamente os controles do modal.
      $$(`.attendance-btn[data-id="${id}"]`,root).forEach(x=>x.classList.toggle('active',x.dataset.att===status));

      // Atualiza imediatamente a Agenda que está atrás do modal, incluindo
      // a cor da inicial, os totais de presença/falta e os indicadores do dia.
      // Assim não é necessário sair e entrar novamente na Agenda.
      if(currentView==='schedule') renderSchedule();

      toast(status==='present'?'Presença registrada.':'Falta registrada.');
    }));
  }

  function openScheduleSlot(day,time){
    const dateCheck=scheduleDateForDay(day),closure=closureForDate(dateCheck);if(closure){toast(`${closure.type}: aulas canceladas neste dia.`);return;}
    const dayLabel=SCHEDULE_DAYS.find(d=>d.id===day)?.label||day,date=scheduleDateForDay(day);
    const ids=slotStudents(day,time).slice(0,4);
    const enrolled=ids.map(id=>state.students.find(s=>s.id===id)).filter(Boolean);
    const makeupIds=makeupStudentIds(date,day,time),makeups=makeupIds.map(id=>state.students.find(s=>s.id===id)).filter(Boolean),waiters=waitlistFor(day,time),trials=trialsFor(date,day,time);
    openModal(`${dayLabel} • ${fmtDate(date)} • ${time}`,`
      <div class="notice">Marque Presente ou Falta para os alunos desta aula. Agora este horário aceita <strong>mais de uma reposição</strong>.</div>
      <div class="daily-attendance-list">${enrolled.length?enrolled.map(s=>attendanceStudentCard(s,date,day,time)).join(''):'<div class="empty compact"><strong>Nenhum aluno fixo</strong>Use “Editar alunos da turma” para montar este horário.</div>'}</div>
      ${enrolled.length?`<div class="notice compact">Turma ativa com ${enrolled.length}/4 aluno${enrolled.length===1?'':'s'} fixo${enrolled.length===1?'':'s'}. A frequência funciona mesmo com turma incompleta.</div>`:''}
      ${makeups.length?`<div class="makeup-title">Reposições nesta aula <span>${makeups.length}</span></div><div class="daily-attendance-list">${makeups.map(m=>attendanceStudentCard(m,date,day,time,true)).join('')}</div>`:''}
      ${trials.length?`<div class="trial-modal-list">${trials.map(t=>`<div class="trial-modal-row"><span class="trial-cube">E</span><div><strong>${escapeHTML(t.name)}</strong><small>Aula experimental</small></div></div>`).join('')}</div>`:''}
      <div class="lesson-tools modal-actions-wrap">
        <button type="button" class="btn btn-secondary" id="editClassStudents">Editar alunos da turma</button>
        <button type="button" class="btn btn-makeup" id="addMakeup">${makeups.length?'Gerenciar reposições':'+ Adicionar reposição'}</button>
        <button type="button" class="btn btn-secondary" id="manageWaitlist">Lista de espera${waiters.length?` (${waiters.length})`:''}</button>
      </div>`);
    const modal=$('.modal');
    bindAttendanceButtons(modal,date,day,time);
    $('#editClassStudents',modal)?.addEventListener('click',()=>openClassEditor(day,time));
    $('#addMakeup',modal)?.addEventListener('click',()=>openMakeupPicker(day,time));
    $('#manageWaitlist',modal)?.addEventListener('click',()=>openWaitlistManager(day,time));
    $$('[data-remove-makeup]',modal).forEach(b=>b.addEventListener('click',()=>{removeMakeupStudent(date,day,time,b.dataset.removeMakeup);openScheduleSlot(day,time);toast('Reposição removida.');renderSchedule()}));
  }

  function openClassEditor(day,time){
    const dayLabel=SCHEDULE_DAYS.find(d=>d.id===day)?.label||day,date=scheduleDateForDay(day),selected=new Set(slotStudents(day,time));
    const students=[...activeStudents()].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
    const studentRow=s=>`<label class="class-picker-student ${selected.has(s.id)?'selected':''}" data-student-name="${escapeHTML((s.name||'').toLowerCase())}" data-student-selected="${selected.has(s.id)?'1':'0'}">
      <span class="student-photo tiny-photo class-picker-avatar">${s.photoData?`<img src="${s.photoData}" alt="" />`:`<span>${escapeHTML((s.name||'?').charAt(0).toUpperCase())}</span>`}</span>
      <span class="class-picker-name">${escapeHTML(s.name)}</span>
      <input class="class-picker-checkbox" type="checkbox" name="student" value="${s.id}" ${selected.has(s.id)?'checked':''} aria-label="Selecionar ${escapeHTML(s.name)}">
      <span class="class-picker-check" aria-hidden="true">${icon('check')}</span>
    </label>`;
    openModal(`Editar turma • ${dayLabel} • ${time}`,`
      <form id="slotForm" class="class-picker-form">
        <div class="class-picker-head">
          <div><strong id="classPickerCount">${selected.size} de 4 alunos selecionados</strong><span>Escolha os alunos fixos deste horário.</span></div>
          <span class="class-picker-capacity">Máx. 4</span>
        </div>
        <div class="search-wrap class-picker-search">${icon('search')}<input id="classPickerSearch" type="search" placeholder="Buscar aluno pelo nome" autocomplete="off" /></div>
        <div class="class-picker-tabs" role="tablist">
          <button type="button" class="class-picker-tab active" data-class-filter="all">Todos <span>${students.length}</span></button>
          <button type="button" class="class-picker-tab" data-class-filter="selected">Selecionados <span id="classPickerSelectedBadge">${selected.size}</span></button>
        </div>
        <div id="classPickerList" class="class-picker-list">${students.map(studentRow).join('')}</div>
        <div id="classPickerEmpty" class="empty compact hidden"><strong>Nenhum aluno encontrado</strong>Tente outro nome ou altere o filtro.</div>
        <div class="class-picker-actions"><button type="button" class="btn btn-secondary" data-close-modal>Cancelar</button><button type="submit" class="btn btn-primary">${icon('check')} Salvar turma</button></div>
      </form>`);
    const form=$('#slotForm'),search=$('#classPickerSearch'),list=$('#classPickerList'),empty=$('#classPickerEmpty');
    let filter='all';
    const update=()=>{
      const checked=$$('input[name="student"]:checked',form),count=checked.length,q=(search.value||'').trim().toLowerCase();
      $('#classPickerCount').textContent=`${count} de 4 alunos selecionados`;
      $('#classPickerSelectedBadge').textContent=String(count);
      $$('.class-picker-student',list).forEach(row=>{
        const input=$('input[name="student"]',row),isSelected=input.checked;
        row.classList.toggle('selected',isSelected);
        row.dataset.studentSelected=isSelected?'1':'0';
        input.disabled=!isSelected && count>=4;
        row.classList.toggle('disabled',input.disabled);
        const matchesName=(row.dataset.studentName||'').includes(q);
        const matchesFilter=filter==='all'||isSelected;
        row.classList.toggle('hidden',!(matchesName&&matchesFilter));
      });
      empty.classList.toggle('hidden',$$('.class-picker-student:not(.hidden)',list).length>0);
    };
    search.addEventListener('input',update);
    $$('.class-picker-tab',form).forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.classFilter;$$('.class-picker-tab',form).forEach(x=>x.classList.toggle('active',x===b));update()}));
    form.addEventListener('change',e=>{if(e.target.name==='student')update()});
    form.addEventListener('submit',e=>{e.preventDefault();const newIds=$$('input[name="student"]:checked',form).map(x=>x.value);state.schedule=state.schedule||{};state.schedule[slotKey(day,time)]=newIds;saveState();closeModal();toast('Turma atualizada.');renderSchedule()});
    update();
    setTimeout(()=>search.focus({preventScroll:true}),50);
  }

  function openMakeupPicker(day,time){
    const date=scheduleDateForDay(day),fixed=new Set(slotStudents(day,time)),current=new Set(makeupStudentIds(date,day,time));
    const students=[...activeStudents()].filter(s=>!fixed.has(s.id)).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
    const studentRow=s=>{const credits=makeupCreditBalance(s.id),selected=current.has(s.id);return `<label class="class-picker-student makeup-picker-student ${selected?'selected':''}" data-student-name="${escapeHTML((s.name||'').toLowerCase())}">
      <span class="student-photo tiny-photo class-picker-avatar">${s.photoData?`<img src="${s.photoData}" alt="" />`:`<span>${escapeHTML((s.name||'?').charAt(0).toUpperCase())}</span>`}</span>
      <span class="class-picker-name">${escapeHTML(s.name)}<small>${credits.available} crédito${credits.available===1?'':'s'} disponível${credits.available===1?'':'is'}</small></span>
      <input class="class-picker-checkbox" type="checkbox" name="makeupStudent" value="${s.id}" ${selected?'checked':''} aria-label="Selecionar ${escapeHTML(s.name)} para reposição">
      <span class="class-picker-check" aria-hidden="true">${icon('check')}</span>
    </label>`};
    openModal(`Gerenciar reposições • ${fmtDate(date)} • ${time}`,`
      <form id="makeupPickerForm" class="class-picker-form">
        <div class="notice makeup-notice">Selecione <strong>um ou vários alunos</strong>. Reposições não alteram a turma fixa e são contabilizadas como presença ao confirmar.</div>
        <div class="search-wrap class-picker-search">${icon('search')}<input id="makeupPickerSearch" type="search" placeholder="Buscar aluno pelo nome" autocomplete="off" /></div>
        <div class="class-picker-tabs" role="tablist">
          <button type="button" class="class-picker-tab active" data-makeup-filter="all">Todos <span>${students.length}</span></button>
          <button type="button" class="class-picker-tab" data-makeup-filter="selected">Selecionados <span id="makeupPickerSelectedBadge">${current.size}</span></button>
        </div>
        <div id="makeupPickerList" class="class-picker-list">${students.length?students.map(studentRow).join(''):''}</div>
        <div id="makeupPickerEmpty" class="empty compact ${students.length?'hidden':''}"><strong>Nenhum aluno encontrado</strong>Tente outro nome ou altere o filtro.</div>
        <div class="class-picker-actions"><button type="button" class="btn btn-secondary" data-close-modal>Cancelar</button><button type="submit" class="btn btn-primary" id="confirmMakeup">${icon('check')} Salvar reposições</button></div>
      </form>`);
    const form=$('#makeupPickerForm'),search=$('#makeupPickerSearch'),list=$('#makeupPickerList'),empty=$('#makeupPickerEmpty');
    let filter='all';
    const update=()=>{
      const checked=$$('input[name="makeupStudent"]:checked',form),q=(search.value||'').trim().toLowerCase();
      $('#makeupPickerSelectedBadge').textContent=String(checked.length);
      $$('.makeup-picker-student',list).forEach(row=>{
        const input=$('input[name="makeupStudent"]',row),isSelected=input.checked;
        row.classList.toggle('selected',isSelected);
        const matchesName=(row.dataset.studentName||'').includes(q),matchesFilter=filter==='all'||isSelected;
        row.classList.toggle('hidden',!(matchesName&&matchesFilter));
      });
      empty.classList.toggle('hidden',$$('.makeup-picker-student:not(.hidden)',list).length>0);
    };
    search.addEventListener('input',update);
    $$('.class-picker-tab',form).forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.makeupFilter;$$('.class-picker-tab',form).forEach(x=>x.classList.toggle('active',x===b));update()}));
    form.addEventListener('change',e=>{if(e.target.name==='makeupStudent')update()});
    form.addEventListener('submit',e=>{e.preventDefault();const selected=$$('input[name="makeupStudent"]:checked',form).map(x=>x.value);setMakeupStudents(date,day,time,selected);closeModal();toast(`${selected.length} reposição${selected.length===1?'':'ões'} salva${selected.length===1?'':'s'}.`);renderSchedule()});
    update();setTimeout(()=>search.focus({preventScroll:true}),50);
  }

  async function enableBirthdayNotifications(){
    if(!('Notification' in window)) return toast('Este navegador não oferece notificações.');
    const p=await Notification.requestPermission();
    state.birthdayNotifications=state.birthdayNotifications||{};
    state.birthdayNotifications.enabled=p==='granted';saveState();
    if(p==='granted'){toast('Notificações de aniversário ativadas.');checkBirthdayNotification(true);}
    else toast('Permissão de notificações não concedida.');
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
        <div class="settings-row"><div><strong>Versão instalada</strong><span>MB Gestor Luxury Pro • versão ${APP_VERSION}</span></div><span class="pill">Estável</span></div>
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
        <div class="backup-health"><span class="backup-health-icon">${icon('download')}</span><div><strong>${state.settings.lastBackupAt?'Backup registrado':'Faça seu primeiro backup'}</strong><span>${state.students.length} alunos • ${state.payments.length} receitas • ${Object.keys(state.attendance||{}).length} registros de aula</span></div></div>
        <div class="settings-row"><div><strong>Exportar backup completo</strong><span>Salva alunos, agenda, presenças, reposições, financeiro e preferências em um único arquivo.</span></div><button class="btn btn-primary btn-small" id="exportBackup">${icon('download')} Fazer backup</button></div>
        <div class="settings-row"><div><strong>Importar / restaurar</strong><span>Valida o arquivo antes de substituir os dados atuais.</span></div><button class="btn btn-secondary btn-small" id="importBackup">${icon('upload')} Restaurar</button><input id="backupFile" type="file" accept="application/json" class="hidden" /></div>
      </section>
      <div class="section-head"><div><h3>Proteção e histórico</h3><p>Recuperação e rastreabilidade do sistema</p></div></div>
      <section class="card system-maintenance-card"><div class="settings-row"><div><strong>Lixeira protegida</strong><span>${(state.trash||[]).length} item${(state.trash||[]).length===1?'':'s'} disponível${(state.trash||[]).length===1?'':'is'} para recuperação.</span></div><button class="btn btn-secondary btn-small" id="openTrash">Abrir</button></div><div class="settings-row"><div><strong>Histórico de alterações</strong><span>${(state.auditLog||[]).length} evento${(state.auditLog||[]).length===1?'':'s'} registrado${(state.auditLog||[]).length===1?'':'s'}.</span></div><button class="btn btn-secondary btn-small" id="openAudit">Ver histórico</button></div><div class="settings-row"><div><strong>Fechamento mensal</strong><span>Preserve os indicadores do mês e compare a evolução.</span></div><button class="btn btn-secondary btn-small" id="settingsMonthClose">Abrir</button></div></section>
      <div class="section-head"><div><h3>Sobre o MB Gestor</h3><p>Informações do produto e preparação comercial</p></div></div>
      <section class="card"><div class="settings-row"><div><strong>MB Gestor Luxury Pro</strong><span>Versão ${APP_VERSION} • Stable Refinement</span></div><span class="pill">Local</span></div><div class="settings-row"><div><strong>Privacidade e dados</strong><span>Dados permanecem neste dispositivo enquanto o app estiver em modo local.</span></div><span class="pill">Privado</span></div><div class="settings-row"><div><strong>Estrutura comercial futura</strong><span>Preparado para evolução com autenticação, sincronização, suporte e licenciamento.</span></div><span class="pill">Planejado</span></div></section>
      <div class="section-head"><div><h3>Resumo atual</h3></div></div>
      <section class="metrics">${metricCard('users',m.students,'Alunos ativos')}${metricCard('wallet',fmtMoney(m.expected),'Receita prevista')}${metricCard('chart',fmtMoney(m.received),'Recebido no mês','good')}${metricCard('receipt',fmtMoney(m.expenses),'Gastos no mês',m.expenses?'danger':'')}</section>
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

  function exportBackup(){const now=new Date();state.settings.lastBackupAt=now.toISOString();saveState();const payload={app:'MB Gestor Luxury Pro',appVersion:APP_VERSION,exportedAt:now.toISOString(),summary:{students:state.students.length,payments:state.payments.length,expenses:state.expenses.length},state};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`MB_Gestor_Backup_V9_6_1_${isoToday()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast('Backup completo V9.6.1 gerado.');renderSettings();}

  async function importBackup(e){const file=e.target.files?.[0];if(!file)return;try{const data=JSON.parse(await file.text());const incoming=data.state||data;if(!Array.isArray(incoming.students)||!Array.isArray(incoming.expenses)||!Array.isArray(incoming.payments))throw new Error('Formato inválido');openModal('Restaurar backup',`<div class="notice">O backup contém ${incoming.students.length} aluno(s), ${incoming.payments.length} receita(s) e ${incoming.expenses.length} gasto(s). Ao continuar, os dados atuais serão substituídos. Faça um backup antes desta restauração.</div><div class="modal-actions"><button class="btn btn-secondary" data-close-modal>Cancelar</button><button class="btn btn-primary" id="confirmImport">Restaurar</button></div>`);$('#confirmImport').addEventListener('click',()=>{state={...structuredClone(DEFAULT_STATE),...incoming,schedule:(incoming.schedule&&typeof incoming.schedule==='object')?incoming.schedule:{},attendance:(incoming.attendance&&typeof incoming.attendance==='object')?incoming.attendance:{},makeups:(incoming.makeups&&typeof incoming.makeups==='object')?incoming.makeups:{},reminderDrafts:Array.isArray(incoming.reminderDrafts)?incoming.reminderDrafts:[],birthdayNotifications:(incoming.birthdayNotifications&&typeof incoming.birthdayNotifications==='object')?incoming.birthdayNotifications:{},studioClosures:Array.isArray(incoming.studioClosures)?incoming.studioClosures:[],plannedAbsences:Array.isArray(incoming.plannedAbsences)?incoming.plannedAbsences:[],waitlist:Array.isArray(incoming.waitlist)?incoming.waitlist:[],prospects:Array.isArray(incoming.prospects)?incoming.prospects:[],trials:Array.isArray(incoming.trials)?incoming.trials:[],monthClosures:Array.isArray(incoming.monthClosures)?incoming.monthClosures:[],auditLog:Array.isArray(incoming.auditLog)?incoming.auditLog:[],trash:Array.isArray(incoming.trash)?incoming.trash:[],settings:{...DEFAULT_STATE.settings,...(incoming.settings||{})}};Object.keys(state.makeups||{}).forEach(k=>{const raw=state.makeups[k];state.makeups[k]=Array.isArray(raw)?[...new Set(raw.filter(Boolean).map(String))]:(raw?[String(raw)]:[]);if(!state.makeups[k].length)delete state.makeups[k]});saveState();closeModal();render();toast('Backup restaurado.');});}catch(err){toast('Não foi possível importar esse arquivo.');}finally{e.target.value='';}}

  function openModal(title, bodyHTML) {
    modalRoot.innerHTML=`<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true" aria-label="${escapeHTML(title)}"><div class="modal-head"><h3>${escapeHTML(title)}</h3><button class="mini-icon" data-close-modal>${icon('x')}</button></div><div class="modal-body">${bodyHTML}</div></div></div>`;
    $$('[data-close-modal]',modalRoot).forEach(b=>b.addEventListener('click',closeModal));
    $('.modal-backdrop',modalRoot).addEventListener('click',e=>{if(e.target.classList.contains('modal-backdrop'))closeModal();});
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

  renderNav();
  render();
  setTimeout(()=>checkBirthdayNotification(false),1200);
})();
