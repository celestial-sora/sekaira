export type ResponseLanguage='Thai'|'English'|'Chinese';

const thai=/\p{Script=Thai}/u;
const han=/\p{Script=Han}/u;
const latin=/[A-Za-z]/;

export function responseLanguage(latest:string,previous:string[]):ResponseLanguage{
  if(thai.test(latest))return 'Thai';
  if(han.test(latest))return 'Chinese';
  const context=previous.slice(-3).join(' ');
  if(latest.trim().length<12&&thai.test(context))return 'Thai';
  if(latin.test(latest))return 'English';
  if(thai.test(context))return 'Thai';
  if(han.test(context))return 'Chinese';
  return 'English';
}

export function responseLanguageRule(language:ResponseLanguage):string{
  if(language==='Thai')return 'Write all narration and character dialogue in natural Thai. Keep names and established loanwords as needed. Do not switch to Chinese, Japanese, or English prose because a character profile, earlier AI message, or source material used another language.';
  if(language==='English')return 'Write all narration and character dialogue in natural English. Keep names and established loanwords as needed. Do not switch to Chinese or Japanese prose because a character profile, earlier AI message, or source material used another language.';
  return 'Write all narration and character dialogue in natural Chinese, matching the user’s variety. Keep names and established loanwords as needed.';
}

export function hasUnexpectedLanguage(value:string,language:ResponseLanguage):boolean{
  return language!=='Chinese'&&han.test(value);
}
