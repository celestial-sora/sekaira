import {db,transaction} from './database';

export type FriendEntry={id:string;name:string;picture:string|null;email:string|null;status:'pending'|'accepted';direction:'incoming'|'outgoing'|'accepted'};
export class FriendError extends Error {constructor(message:string,public status=400){super(message);}}

function pair(a:string,b:string):[string,string]{return a<b?[a,b]:[b,a];}

export async function listFriends(userId:string):Promise<FriendEntry[]>{
 const rows=await db().prepare(
  'SELECT f.status,f.requested_by,u.id,u.name,u.picture,u.email FROM friendships f JOIN users u ON u.id=CASE WHEN f.user_a=? THEN f.user_b ELSE f.user_a END WHERE f.user_a=? OR f.user_b=? ORDER BY f.updated_at DESC',
 ).all(userId,userId,userId);
 return rows.map(row=>({
  id:row.id as string,name:row.name as string,picture:(row.picture as string|null)??null,email:(row.email as string|null)??null,
  status:row.status as FriendEntry['status'],
  direction:row.status==='accepted'?'accepted':row.requested_by===userId?'outgoing':'incoming',
 }));
}

export async function requestFriend(userId:string,email:string):Promise<void>{
 const requester=await db().prepare('SELECT guest FROM users WHERE id=?').get(userId);
 if(!requester||requester.guest)throw new FriendError('Sign in with an account to add friends.',403);
 const target=await db().prepare('SELECT id,guest FROM users WHERE LOWER(email)=LOWER(?)').get(email.trim());
 if(!target||target.guest)throw new FriendError('No account found with that email.',404);
 const targetId=target.id as string;
 if(targetId===userId)throw new FriendError('You cannot add yourself.');
 const [userA,userB]=pair(userId,targetId);
 const existing=await db().prepare('SELECT status,requested_by FROM friendships WHERE user_a=? AND user_b=?').get(userA,userB);
 if(existing)throw new FriendError(existing.status==='accepted'?'You are already friends.':existing.requested_by===userId?'Friend request already sent.':'This person has already sent you a request.');
 const stamp=new Date().toISOString();
 await db().prepare('INSERT INTO friendships (user_a,user_b,requested_by,status,created_at,updated_at) VALUES (?,?,?,?,?,?)').run(userA,userB,userId,'pending',stamp,stamp);
}

export async function acceptFriend(userId:string,otherId:string):Promise<void>{
 const [userA,userB]=pair(userId,otherId);
 const result=await db().prepare("UPDATE friendships SET status='accepted',updated_at=? WHERE user_a=? AND user_b=? AND status='pending' AND requested_by<>?").run(new Date().toISOString(),userA,userB,userId);
 if(result.changes!==1)throw new FriendError('Incoming friend request not found.',404);
}

export async function removeFriend(userId:string,otherId:string):Promise<void>{
 const [userA,userB]=pair(userId,otherId);
 await transaction(async()=>{
  const result=await db().prepare('DELETE FROM friendships WHERE user_a=? AND user_b=?').run(userA,userB);
  if(result.changes!==1)throw new FriendError('Friendship or request not found.',404);
  await db().prepare('DELETE FROM character_shares WHERE (user_id=? AND character_id IN (SELECT id FROM characters WHERE owner_id=?)) OR (user_id=? AND character_id IN (SELECT id FROM characters WHERE owner_id=?))').run(userId,otherId,otherId,userId);
 });
}
