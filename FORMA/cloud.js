/* FORMA 2.2 — camada de autenticação e sincronização com Supabase.
   Nunca inserir service_role/secret neste arquivo ou no navegador. */
'use strict';

const formaAuthState = window.formaAuthState = {
  mode:'login', pending:true, error:'', info:'', setupError:''
};
let formaClient=null;
let formaAuthUser=null;
let formaAuthVersion=0;
let formaCloudUpdatedAt='';
let formaSaving=null;
let formaLastSaveOk=true;
let formaSaveTimer=null;
let formaRevision=0;
let formaDirty=false;
let formaSignoutInProgress=false;
window.formaSyncText='Conectando...';
window.formaUserEmail='';

function formaSetStatus(text,failed=false){
  window.formaSyncText=text;
  const header=document.getElementById('cloud-status');
  const details=document.getElementById('cloud-details');
  if(header){header.textContent=text;header.classList.toggle('cloud-error',failed);}
  if(details){details.textContent=text;details.classList.toggle('cloud-error',failed);}
}
function formaSetAuthMode(mode){
  if(!['login','signup','forgot'].includes(mode))return;
  formaAuthState.mode=mode;formaAuthState.error='';formaAuthState.info='';formaAuthState.pending=false;
  render();
}
window.formaSetAuthMode=formaSetAuthMode;
function formaFriendlyError(error){
  const message=String(error?.message||error||'Falha de comunicação com o servidor.');
  if(/invalid login credentials/i.test(message))return 'E-mail ou senha incorretos.';
  if(/email not confirmed/i.test(message))return 'Confirme seu e-mail antes de entrar.';
  if(/password should be at least/i.test(message))return 'A senha não atende aos requisitos definidos no Supabase.';
  if(/rate limit/i.test(message))return 'Muitas tentativas. Aguarde e tente novamente.';
  if(/failed to fetch|network/i.test(message))return 'Não foi possível se conectar. Verifique sua internet.';
  return message;
}
function formaAuthMessage(error,info=''){
  formaAuthState.pending=false;
  formaAuthState.error=error?formaFriendlyError(error):'';
  formaAuthState.info=info;
  render();
}
function formaBaseUrl(){return window.location.origin+window.location.pathname;}
async function formaAuthSubmit(form){
  if(!formaClient){formaAuthMessage('O Supabase ainda não foi configurado.');return;}
  if(formaAuthState.pending)return;
  const mode=formaAuthState.mode;
  const f=new FormData(form),email=String(f.get('email')||'').trim().toLowerCase();
  const password=String(f.get('password')||'');
  const confirm=String(f.get('confirm')||'');
  if(['signup','newPassword'].includes(mode)&&password!==confirm){formaAuthMessage('As senhas informadas são diferentes.');return;}
  if(['signup','newPassword','login'].includes(mode)&&password.length<8){formaAuthMessage('Use pelo menos oito caracteres na senha.');return;}
  formaAuthState.pending=true;formaAuthState.error='';formaAuthState.info='';render();
  try{
    if(mode==='signup'){
      const name=String(f.get('name')||'').trim();
      if(name.length<2){formaAuthMessage('Informe seu nome.');return;}
      const {data,error}=await formaClient.auth.signUp({email,password,options:{data:{full_name:name},emailRedirectTo:formaBaseUrl()}});
      if(error)throw error;
      if(!data?.session){formaAuthState.mode='login';formaAuthMessage(null,'Cadastro solicitado! Confira seu e-mail para confirmar a conta e depois faça login.');}
      else {formaAuthState.pending=false;formaSetStatus('Carregando sua conta...');}
    }else if(mode==='forgot'){
      const {error}=await formaClient.auth.resetPasswordForEmail(email,{redirectTo:formaBaseUrl()});
      if(error)throw error;
      formaAuthState.mode='login';
      formaAuthMessage(null,'Se o e-mail estiver cadastrado, você receberá um link para redefinir sua senha. Confira também o spam.');
    }else if(mode==='newPassword'){
      const {error}=await formaClient.auth.updateUser({password});
      if(error)throw error;
      await formaClient.auth.signOut({scope:'local'});
      formaAuthState.mode='login';
      formaAuthMessage(null,'Senha alterada! Entre novamente com a nova senha.');
    }else {
      const {error}=await formaClient.auth.signInWithPassword({email,password});
      if(error)throw error;
      // onAuthStateChange irá carregar os dados antes de mostrar o painel.
      formaAuthState.pending=true;render();
    }
  }catch(error){formaAuthMessage(error);}
}
window.formaAuthSubmit=formaAuthSubmit;

function formaClearData(){
  current=null;db.profiles={};formaAuthUser=null;window.formaUserEmail='';
  formaCloudUpdatedAt='';formaDirty=false;formaRevision=0;
  if(formaSaveTimer){clearTimeout(formaSaveTimer);formaSaveTimer=null;}
  state.page='dashboard';state.modal=null;state.dayDraft=null;
}
async function formaLoadUser(user){
  const id=user.id;
  if(current===id&&db.profiles[id]){formaAuthState.pending=false;return;}
  const version=++formaAuthVersion;
  formaAuthState.pending=true;formaAuthState.error='';
  formaSetStatus('Carregando dados...');
  render();
  try{
    const {data,error}=await formaClient.from('forma_profiles').select('profile_data,updated_at').eq('user_id',id).maybeSingle();
    if(error)throw error;
    if(version!==formaAuthVersion)return;
    let personal=data?.profile_data;
    if(!personal||typeof personal!=='object'||!personal.routines){
      const name=String(user.user_metadata?.full_name||user.email?.split('@')[0]||'Atleta').slice(0,70);
      personal=makeProfile(name);
      const {error:createError}=await formaClient.from('forma_profiles').upsert({user_id:id,profile_data:personal,updated_at:new Date().toISOString()},{onConflict:'user_id'});
      if(createError)throw createError;
      if(version!==formaAuthVersion)return;
    }
    formaClearData();
    db.profiles[id]=personal;
    current=id;
    formaAuthUser=user;
    window.formaUserEmail=user.email||'';
    formaCloudUpdatedAt=data?.updated_at||new Date().toISOString();
    formaAuthState.pending=false;
    formaSetStatus('Salvo na nuvem');
    state.page='dashboard';render();
  }catch(error){
    if(version!==formaAuthVersion)return;
    formaClearData();
    formaAuthState.mode='login';formaAuthState.pending=false;
    formaAuthState.error='Falha ao carregar os dados: '+formaFriendlyError(error)+' Verifique se executou o SQL do projeto.';
    formaSetStatus('Falha de conexão',true);
    render();
  }
}
window.formaRetryLoad=async()=>{
  if(!formaClient)return;
  const {data,error}=await formaClient.auth.getUser();
  if(error||!data?.user){formaAuthMessage('Entre novamente para carregar seu perfil.');return;}
  return formaLoadUser(data.user);
};
function formaPersist(){
  if(!current||!db.profiles[current]||!formaClient)return false;
  formaRevision++;formaDirty=true;
  formaSetStatus('Alterações pendentes...');
  if(formaSaveTimer)clearTimeout(formaSaveTimer);
  formaSaveTimer=setTimeout(()=>{formaSaveTimer=null;formaFlush();},650);
  return true;
}
window.formaPersist=formaPersist;
async function formaFlush(){
  if(formaSaveTimer){clearTimeout(formaSaveTimer);formaSaveTimer=null;}
  if(formaSaving){await formaSaving;if(!formaLastSaveOk)return false;if(formaDirty)return formaFlush();return true;}
  if(!formaDirty)return true;
  if(!current||!formaClient||!db.profiles[current])return false;
  const id=current,snapshot=clone(profile());
  const rev=formaRevision;
  formaDirty=false;
  formaSetStatus('Salvando na nuvem...');
  let succeeded=false;
  formaLastSaveOk=true;
  formaSaving=(async()=>{
    try{
      const updated_at=new Date().toISOString();
      const {error}=await formaClient.from('forma_profiles').upsert({user_id:id,profile_data:snapshot,updated_at},{onConflict:'user_id'});
      if(error)throw error;
      succeeded=true;
      if(current===id)formaCloudUpdatedAt=updated_at;
    }catch(error){
      formaDirty=true;formaLastSaveOk=false;
      formaSetStatus('Erro ao salvar — tente sincronizar',true);
      console.error('FORMA: falha ao sincronizar',error);
    }
  })();
  await formaSaving;
  formaSaving=null;
  if(current!==id)return false;
  if(formaRevision!==rev)formaDirty=true;
  if(succeeded&&formaDirty){
    formaSaveTimer=setTimeout(()=>{formaSaveTimer=null;formaFlush();},250);
    return true;
  }
  if(succeeded)formaSetStatus('Salvo na nuvem');
  return succeeded;
}
window.formaForceSave=async()=>{
  const ok=await formaFlush();
  if(!ok){toast('Não foi possível sincronizar. Verifique a internet.',true);return;}
  if(!formaDirty)await formaReloadIfNewer(true);
};
async function formaReloadIfNewer(showToast=false){
  if(!current||formaDirty||formaSaving||!formaClient||formaSignoutInProgress)return;
  const id=current;
  try{
    const {data,error}=await formaClient.from('forma_profiles').select('profile_data,updated_at').eq('user_id',id).maybeSingle();
    if(error)throw error;
    if(current!==id||formaDirty)return;
    if(data?.updated_at&&data.updated_at>formaCloudUpdatedAt){
      db.profiles[id]=data.profile_data;formaCloudUpdatedAt=data.updated_at;
      state.modal=null;render();
      if(showToast)toast('Dados atualizados com o Supabase.');
    }else if(showToast)toast('Tudo sincronizado!');
    formaSetStatus('Salvo na nuvem');
  }catch(error){
    formaSetStatus('Não foi possível conferir a nuvem',true);
    if(showToast)toast(formaFriendlyError(error),true);
  }
}
window.formaLogout=async()=>{
  if(formaSignoutInProgress)return;
  formaSignoutInProgress=true;
  if(formaDirty||formaSaving){
    const success=await formaFlush();
    if(!success&&!window.confirm('Há registros ainda não salvos na nuvem. Sair mesmo assim?')){formaSignoutInProgress=false;return;}
  }
  try{
    const {error}=await formaClient.auth.signOut({scope:'local'});
    if(error)throw error;
    formaAuthVersion++;formaClearData();formaAuthState.mode='login';formaAuthState.pending=false;
    formaAuthState.error='';formaAuthState.info='Você saiu da sua conta.';
    formaSetStatus('Desconectado');render();
  }catch(error){toast('Não foi possível sair: '+formaFriendlyError(error),true);}
  finally{formaSignoutInProgress=false;}
};
window.formaChangePassword=async form=>{
  const f=new FormData(form),password=String(f.get('password')||''),confirm=String(f.get('confirm')||'');
  if(password.length<8||password!==confirm){toast('As senhas precisam ser iguais e ter ao menos 8 caracteres.',true);return;}
  const {error}=await formaClient.auth.updateUser({password});
  if(error){toast('Erro: '+formaFriendlyError(error),true);return;}
  form.reset();toast('Senha atualizada no Supabase.');
};
window.formaChangeName=async form=>{
  const name=String(new FormData(form).get('name')||'').trim();
  if(name.length<2)return toast('Informe pelo menos 2 caracteres.',true);
  const {error}=await formaClient.auth.updateUser({data:{full_name:name}});
  if(error){toast(formaFriendlyError(error),true);return;}
  profile().name=name;formaPersist();render();toast('Nome atualizado!');
};
function formaAuthEvent(event,session){
  if(event==='PASSWORD_RECOVERY'){
    formaAuthVersion++;formaClearData();
    formaAuthState.mode='newPassword';formaAuthState.pending=false;formaAuthState.error='';formaAuthState.info='';
    render();return;
  }
  if(event==='SIGNED_OUT'){
    formaAuthVersion++;formaClearData();
    formaAuthState.mode='login';formaAuthState.pending=false;
    render();return;
  }
  if(!session?.user){
    if(event==='INITIAL_SESSION'){
      formaAuthState.pending=false;
      formaSetStatus('Entre para continuar');render();
    }
    return;
  }
  if(formaAuthState.mode==='newPassword')return;
  if(['INITIAL_SESSION','SIGNED_IN'].includes(event)){
    // O callback de auth não deve aguardar uma chamada à API de dados.
    Promise.resolve().then(()=>formaLoadUser(session.user));
  }
}
function formaBoot(){
  const cfg=window.FORMA_SUPABASE;
  const url=String(cfg?.url||'');
  const key=String(cfg?.publishableKey||cfg?.anonKey||'');
  const configured=/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url)&&!!key&&!key.startsWith('COLE_');
  if(!configured){
    formaAuthState.setupError='Configure o arquivo supabase-config.js com a URL e a chave PUBLISHABLE (ou ANON) do seu projeto. Execute também o banco.sql no Supabase.';
    formaAuthState.pending=false;render();return;
  }
  if(!window.supabase?.createClient){
    formaAuthState.setupError='A biblioteca de autenticação não carregou. Verifique sua internet e recarregue a página.';
    formaAuthState.pending=false;render();return;
  }
  try{
    formaClient=window.supabase.createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    formaClient.auth.onAuthStateChange(formaAuthEvent);
    // A sessão inicial será recebida pelo evento INITIAL_SESSION.
    formaSetStatus('Verificando sessão...');render();
  }catch(error){formaAuthState.setupError='Erro ao iniciar Supabase: '+formaFriendlyError(error);formaAuthState.pending=false;render();}
}
window.addEventListener('online',()=>{if(current&&formaDirty)formaFlush();else formaReloadIfNewer();});
window.addEventListener('focus',()=>{if(current&&!formaDirty)formaReloadIfNewer();});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&formaDirty)formaFlush();});
window.addEventListener('beforeunload',event=>{if(formaDirty){event.preventDefault();event.returnValue='';}});
formaBoot();
