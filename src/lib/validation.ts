import {z} from 'zod';
const text=z.string().max(6000).default('');
const optionalId=z.string().min(1).max(100).nullable().default(null);
const name=z.string().trim().min(1,'Please enter a name.').max(100);
export const avatar=z.string().max(2_800_000).refine(v=>/^[0-4]$/.test(v)||/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v),'Choose an avatar or upload a PNG, JPEG or WebP.').default('0');
export const characterSchema=z.object({name,description:text,avatar,personality:text,backstory:text,speaking_style:text,likes:text,dislikes:text,relationship_behavior:text,greeting:text,example_dialogue:text,lore:text,world_id:optionalId,scenario_id:optionalId,faction:text,tags:z.array(z.string().max(30)).max(8).default(['Original']),avatar_id:optionalId});
export const worldSchema=z.object({name,description:text,lore:text,rules:text,locations:text,factions:text,power_system:text,timeline:text,world_state:text,genre:z.enum(['Fantasy','Isekai','School','Romance','Mystery','Historical','Action','Sci-fi','Original']).default('Original'),cover:z.enum(['sky','forest','night','city','sunset']).default('sky')});
export const personaSchema=z.object({name,description:text,world_id:optionalId,species:text,role:text,rank:text,faction:text,abilities:text,appearance:text,backstory:text,personality:text,public_facts:text,secret_facts:text});
export const conversationSchema=z.object({world_id:optionalId,persona_id:optionalId,scenario_id:optionalId,character_ids:z.array(z.string().min(1).max(100)).min(1).max(5).refine(v=>new Set(v).size===v.length,'Each character can only join once.')}).superRefine((v,ctx)=>{if(!v.world_id&&(v.persona_id||v.scenario_id||v.character_ids.length!==1))ctx.addIssue({code:'custom',message:'Standalone chat has one character and no required persona or scenario.'});if(v.world_id&&!v.persona_id)ctx.addIssue({code:'custom',message:'Choose a persona for this world.'});});
export const turnSchema=z.object({content:z.string().trim().min(1).max(4000),character_ids:z.array(z.string().max(100)).max(5).optional()});
export const emotion=z.enum(['idle','talking','happy','shy','angry','sad','surprised']);
export const replySchema=z.object({dialogue:z.string().min(1).max(8000),emotion:emotion.default('idle'),trust_delta:z.number().int().min(-3).max(3).default(0),relationship_note:z.string().max(300).default('')});
export const directorSchema=z.object({narration:z.string().max(3000),state_summary:z.string().max(4000),event:z.string().max(500).default(''),active_character_ids:z.array(z.string()).max(3)});
export const extractedSchema=z.object({memories:z.array(z.object({content:z.string().min(1).max(1000),type:z.enum(['fact','promise','relationship','event','discovery']),importance:z.number().min(0).max(1),confidence:z.number().min(0).max(1)})).max(4)});
export const characterGenerationRequestSchema=z.object({prompt:z.string().trim().min(12,'Describe the character you want in a little more detail.').max(2000)});
export const characterIntentSchema=z.object({
 core_concept:z.string().trim().min(1).max(500),
 must_keep:z.array(z.string().trim().min(1).max(300)).max(12),
 archetypes:z.array(z.string().trim().min(1).max(80)).max(6),
 intensity:z.enum(['subtle','moderate','strong','extreme']),
 relationship_dynamic:z.string().trim().max(500),
 voice:z.string().trim().max(500),
 setting:z.string().trim().max(500),
 mood:z.string().trim().max(300),
 triggers:z.array(z.string().trim().min(1).max(240)).max(8),
 boundaries:z.array(z.string().trim().min(1).max(240)).max(8),
 contradictions:z.array(z.string().trim().min(1).max(240)).max(8),
});
export const characterGenerationSchema=z.object({
 name:z.string().trim().min(1).max(100),
 tags:z.array(z.string().trim().min(1).max(30)).min(2).max(5),
 description:z.string().trim().min(1).max(1000),
 personality:z.string().trim().min(1).max(1500),
 backstory:z.string().trim().max(2000),
 speaking_style:z.string().trim().min(1).max(600),
 relationship_behavior:z.string().trim().min(1).max(600),
 likes:z.string().trim().max(600),
 dislikes:z.string().trim().max(600),
 greeting:z.string().trim().min(1).max(1200),
 example_dialogue:z.string().trim().min(1).max(1600),
});
