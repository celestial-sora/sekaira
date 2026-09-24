import type {z} from 'zod';
import {characterIntentSchema,characterGenerationSchema} from './validation';
import {AppError} from './engine';

type CharacterIntent=z.infer<typeof characterIntentSchema>;
type GeneratedCharacter=z.infer<typeof characterGenerationSchema>;

export type CharacterReference={name:string;work:string};

// A title separated by a pipe is an explicit identity request, not a loose mood reference.
export function explicitCharacterReference(prompt:string):CharacterReference|null{
 const separator=prompt.indexOf('|');
 if(separator<0)return null;
 const left=prompt.slice(0,separator).trim();
 const work=prompt.slice(separator+1).trim();
 const name=left.replace(/^(?:อยากให้สร้าง|ช่วยสร้าง|สร้าง|create|make|generate)(?:ตัวละคร|character)?\s*/i,'').trim();
 if(!name||!work||name.length>100||work.length>200)return null;
 return {name,work};
}

export function characterReference(prompt:string,intent:CharacterIntent):CharacterReference|null{
 const explicit=explicitCharacterReference(prompt);
 if(explicit)return explicit;
 if(!intent.reference_name)return null;
 return {name:intent.reference_name,work:intent.reference_work};
}

const normalizedName=(value:string)=>value.normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu,'');

export function matchesRequestedName(draft:GeneratedCharacter,reference:CharacterReference){
 return normalizedName(draft.name)===normalizedName(reference.name);
}

type Review={faithful:boolean;issues:string[]};

export async function ensureFaithfulReferenceDraft(
 draft:GeneratedCharacter,
 reference:CharacterReference,
 synthesize:(feedback:string[])=>Promise<GeneratedCharacter>,
 review:(draft:GeneratedCharacter)=>Promise<Review>,
):Promise<GeneratedCharacter>{
 let result=await review(draft);
 if(matchesRequestedName(draft,reference)&&result.faithful)return draft;
 const issues=[
  ...result.issues,
  ...(!matchesRequestedName(draft,reference)?[`Name must be exactly ${reference.name} from ${reference.work}.`]:[]),
 ];
 const retry=await synthesize(issues);
 result=await review(retry);
 if(matchesRequestedName(retry,reference)&&result.faithful)return retry;
 throw new AppError('The AI could not make a faithful draft of that character. Add a few defining details or try again.',502);
}
