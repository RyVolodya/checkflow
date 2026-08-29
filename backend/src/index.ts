import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "path";
import fs from "fs";
import {
  PrismaClient, Role, ItemStatus, ChecklistStatus, Recurrence, WorkType, PostponeStatus
} from "@prisma/client";
import { z } from "zod";

const prisma = new PrismaClient();
const app = express();
const port = Number(process.env.PORT || 4000);
const secret = process.env.JWT_SECRET || "dev-secret";
const telegramToken = process.env.TELEGRAM_BOT_TOKEN?.trim() || "";
const uploadDir = process.env.UPLOAD_DIR || path.resolve("uploads");
fs.mkdirSync(uploadDir, { recursive: true });

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use("/uploads", express.static(uploadDir));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`)
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith("image/"))
});

type TokenUser = { id: string; role: Role; username: string };
declare global { namespace Express { interface Request { user?: TokenUser } } }

async function auth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    const decoded = jwt.verify(token, secret) as TokenUser;
    const current = await prisma.user.findFirst({where:{id:decoded.id,active:true,deletedAt:null},select:{id:true,role:true,username:true}});
    if(!current||!current.username)return res.status(401).json({error:"Обліковий запис заблоковано або видалено"});
    req.user={id:current.id,role:current.role,username:current.username}; next();
  } catch { return res.status(401).json({ error: "Invalid token" }); }
}

function routeParam(value: string | string[] | undefined): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  throw new Error("Missing route parameter");
}

function allow(...roles: Role[]) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: "Forbidden" });
    next();
  };
}

const userSelect = { id:true, name:true, username:true, position:true, role:true, active:true, mustChangePassword:true, deletedAt:true, telegramChatId:true } as const;
const listInclude = {
  assignee:{ select:{ id:true,name:true,username:true,position:true,role:true } },
  createdBy:{ select:{ id:true,name:true,position:true,role:true } },
  assignments:{ include:{ user:{ select:{ id:true,name:true,username:true,position:true,role:true } } }, orderBy:{assignedAt:"asc" as const} },
  items:{ include:{ attachments:true }, orderBy:{ sortOrder:"asc" as const } },
  postponeRequests:{ where:{ status:PostponeStatus.PENDING }, include:{ requester:{select:{id:true,name:true,position:true}} }, orderBy:{createdAt:"desc" as const} }
};
const detailInclude = {
  assignee:{select:{id:true,name:true,username:true,position:true,role:true}},
  assignments:{include:{user:{select:{id:true,name:true,username:true,position:true,role:true}}},orderBy:{assignedAt:"asc" as const}},
  createdBy:{select:{id:true,name:true}},
  items:{include:{attachments:true},orderBy:{sortOrder:"asc" as const}},
  comments:{include:{author:{select:{id:true,name:true}}},orderBy:{createdAt:"asc" as const}},
  postponeRequests:{include:{requester:{select:{id:true,name:true,position:true}},decidedBy:{select:{id:true,name:true}}},orderBy:{createdAt:"desc" as const}}
};

function formatUaDate(date: Date) {
  return new Intl.DateTimeFormat("uk-UA",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:false,timeZone:"Europe/Kyiv"}).format(date);
}

async function sendTelegram(chatId: string | null | undefined, text: string) {
  if (!telegramToken || !chatId) return false;
  try {
    const response = await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
      method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({chat_id:chatId,text})
    });
    if(!response.ok){console.error("Telegram sendMessage failed", response.status, await response.text());return false;}
    return true;
  } catch (error) { console.error("Telegram notification error", error); return false; }
}

async function notifyUsers(userIds: string[], text: string) {
  if(!telegramToken || !userIds.length) return;
  const users=await prisma.user.findMany({where:{id:{in:[...new Set(userIds)]},active:true,deletedAt:null,telegramChatId:{not:null}},select:{id:true,telegramChatId:true}});
  await Promise.all(users.map(u=>sendTelegram(u.telegramChatId,text)));
}

async function runDeadlineNotifications(){
  if(!telegramToken)return;
  const now=new Date(); const soon=new Date(now.getTime()+24*60*60*1000);
  const rows=await prisma.checklist.findMany({
    where:{dueDate:{gt:now,lte:soon},status:{notIn:[ChecklistStatus.COMPLETED,ChecklistStatus.OVERDUE]}},
    include:{assignee:{select:{id:true,telegramChatId:true,active:true}},assignments:{include:{user:{select:{id:true,telegramChatId:true,active:true}}}}}
  });
  for(const work of rows){
    const users=work.assignments.length?work.assignments.map(a=>a.user):[work.assignee];
    for(const u of users){
      if(!u.active||!u.telegramChatId)continue;
      const key=`due24:${work.id}:${u.id}:${work.dueDate.toISOString()}`;
      if(await prisma.notificationLog.findUnique({where:{key}}))continue;
      const ok=await sendTelegram(u.telegramChatId,`⏰ CheckFlow: скоро завершується ${work.type===WorkType.TASK?"завдання":"чекліст"} «${work.title}». Термін: ${formatUaDate(work.dueDate)}.`);
      if(ok)await prisma.notificationLog.create({data:{key}}).catch(()=>undefined);
    }
  }
}

function nextDueDate(date: Date, recurrence: Recurrence) {
  const next = new Date(date);
  if (recurrence === Recurrence.WEEKLY) next.setDate(next.getDate() + 7);
  if (recurrence === Recurrence.MONTHLY) next.setMonth(next.getMonth() + 1);
  return next;
}

async function createNextOccurrence(checklistId: string) {
  const c = await prisma.checklist.findUnique({ where: { id: checklistId }, include: { items: true, assignments:true } });
  if (!c || c.recurrence === Recurrence.NONE) return;
  const next = nextDueDate(c.dueDate, c.recurrence);
  const exists = await prisma.checklist.findFirst({ where: { title:c.title, type:c.type, assigneeId:c.assigneeId, dueDate:next } });
  if (exists) return;
  const assignmentIds = c.assignments.length ? c.assignments.map(a=>a.userId) : [c.assigneeId];
  await prisma.checklist.create({ data: {
    type:c.type, title:c.title, description:c.description, startDate:nextDueDate(c.startDate, c.recurrence), dueDate:next, recurrence:c.recurrence, status:nextDueDate(c.startDate,c.recurrence)>new Date()?ChecklistStatus.SCHEDULED:ChecklistStatus.OPEN,
    assigneeId:assignmentIds[0] || c.assigneeId, createdById:c.createdById,
    assignments:{create:assignmentIds.map(userId=>({userId}))},
    items: c.type === WorkType.CHECKLIST ? { create:c.items.map(i=>({title:i.title,description:i.description,requiresPhoto:i.requiresPhoto,sortOrder:i.sortOrder})) } : undefined
  }});
}

async function refreshOneStatus(checklistId: string) {
  const c = await prisma.checklist.findUnique({ where:{id:checklistId}, include:{items:true} });
  if (!c) return;
  const now = new Date();
  if (c.status === ChecklistStatus.COMPLETED) return;
  let status: ChecklistStatus = c.status;
  let completedAt: Date | null = c.completedAt;
  if (c.startDate > now) {
    status = ChecklistStatus.SCHEDULED;
  } else if (c.type === WorkType.CHECKLIST) {
    if (c.items.length && c.items.every(i=>i.status===ItemStatus.DONE)) {
      status = ChecklistStatus.COMPLETED;
      completedAt = completedAt || now;
    } else if (c.dueDate < now) status = ChecklistStatus.OVERDUE;
    else if (c.items.some(i=>i.status!==ItemStatus.PENDING)) status = ChecklistStatus.IN_PROGRESS;
    else status = ChecklistStatus.OPEN;
  } else {
    if (c.dueDate < now) status = ChecklistStatus.OVERDUE;
    else if (status === ChecklistStatus.OVERDUE) status = ChecklistStatus.OPEN;
  }
  if (status !== c.status || completedAt !== c.completedAt) {
    await prisma.checklist.update({ where:{id:c.id}, data:{status,completedAt} });
  }
  if (status === ChecklistStatus.COMPLETED) await createNextOccurrence(c.id);
}

async function refreshStatuses(user?: TokenUser) {
  const where = user && user.role === Role.EMPLOYEE ? { OR:[{assigneeId:user.id},{assignments:{some:{userId:user.id}}}] } : {};
  const rows = await prisma.checklist.findMany({ where, select:{id:true,status:true,startDate:true,dueDate:true} });
  await Promise.all(rows.filter(r=>r.status!==ChecklistStatus.COMPLETED).map(r=>refreshOneStatus(r.id)));
}

async function userCanAccessChecklist(checklistId:string,user:TokenUser){
  if(user.role!==Role.EMPLOYEE)return true;
  const c=await prisma.checklist.findFirst({where:{id:checklistId,OR:[{assigneeId:user.id},{assignments:{some:{userId:user.id}}}]},select:{id:true}});
  return !!c;
}

async function ensureAssignments(){
  const rows=await prisma.checklist.findMany({select:{id:true,assigneeId:true,assignments:{select:{userId:true}}}});
  for(const row of rows){
    if(!row.assignments.some(a=>a.userId===row.assigneeId)){
      await prisma.checklistAssignment.upsert({where:{checklistId_userId:{checklistId:row.id,userId:row.assigneeId}},update:{},create:{checklistId:row.id,userId:row.assigneeId}});
    }
  }
}

async function ensurePostponeAuditComments(){
  const rows=await prisma.postponeRequest.findMany({where:{status:PostponeStatus.APPROVED,newDueDate:{not:null},decidedById:{not:null}},select:{checklistId:true,newDueDate:true,decisionNote:true,decidedById:true}});
  for(const row of rows){
    if(!row.newDueDate||!row.decidedById)continue;
    const formatted=new Intl.DateTimeFormat("uk-UA",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",timeZone:"Europe/Kyiv"}).format(row.newDueDate);
    const text=`Було відтерміновано до ${formatted}${row.decisionNote?`. Коментар: ${row.decisionNote}`:""}`;
    const exists=await prisma.comment.findFirst({where:{checklistId:row.checklistId,text}});
    if(!exists)await prisma.comment.create({data:{checklistId:row.checklistId,authorId:row.decidedById,text}});
  }
}

async function ensureBootstrapUser() {
  const username = process.env.BOOTSTRAP_USERNAME || "Manager";
  const password = process.env.BOOTSTRAP_PASSWORD || "manager";
  const existingByUsername = await prisma.user.findFirst({ where:{username:{equals:username,mode:"insensitive"}} });
  if (existingByUsername) return;
  const legacyAdmin = await prisma.user.findFirst({ where:{OR:[{email:"admin@local"},{role:Role.ADMIN}]}, orderBy:{createdAt:"asc"} });
  const passwordHash = await bcrypt.hash(password, 12);
  if (legacyAdmin) {
    await prisma.user.update({ where:{id:legacyAdmin.id}, data:{username,name:"Manager",passwordHash,position:"Administrator",role:Role.ADMIN,active:true,mustChangePassword:true} });
    return;
  }
  await prisma.user.create({ data:{username,name:"Manager",passwordHash,position:"Administrator",role:Role.ADMIN,mustChangePassword:true} });
}

app.get("/api/health", (_req,res)=>res.json({ok:true,version:"0.5.0",telegramConfigured:!!telegramToken}));

app.post("/api/auth/login", async (req,res)=>{
  const parsed=z.object({username:z.string().trim().min(1),password:z.string().min(1)}).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:"Вкажіть ім’я користувача та пароль"});
  const user=await prisma.user.findFirst({where:{username:{equals:parsed.data.username,mode:"insensitive"},deletedAt:null}});
  if(!user||!user.username||!user.active||!(await bcrypt.compare(parsed.data.password,user.passwordHash)))return res.status(401).json({error:"Невірне ім’я користувача або пароль"});
  const token=jwt.sign({id:user.id,role:user.role,username:user.username},secret,{expiresIn:"12h"});
  res.json({token,user:{id:user.id,name:user.name,username:user.username,role:user.role,position:user.position,mustChangePassword:user.mustChangePassword,telegramChatId:user.telegramChatId}});
});

app.post("/api/auth/change-password",auth,async(req,res)=>{
  const parsed=z.object({currentPassword:z.string().min(1),newPassword:z.string().min(8).max(128)}).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:"Новий пароль повинен містити щонайменше 8 символів"});
  const user=await prisma.user.findUnique({where:{id:req.user!.id}});
  if(!user||!(await bcrypt.compare(parsed.data.currentPassword,user.passwordHash)))return res.status(400).json({error:"Поточний пароль вказано невірно"});
  if(await bcrypt.compare(parsed.data.newPassword,user.passwordHash))return res.status(400).json({error:"Новий пароль має відрізнятися від поточного"});
  const updated=await prisma.user.update({where:{id:user.id},data:{passwordHash:await bcrypt.hash(parsed.data.newPassword,12),mustChangePassword:false},select:userSelect});
  res.json({user:updated});
});

app.get("/api/users",auth,allow(Role.ADMIN,Role.MANAGER),async(_req,res)=>res.json(await prisma.user.findMany({where:{deletedAt:null},select:{...userSelect,createdAt:true},orderBy:{name:"asc"}})));
app.post("/api/users",auth,allow(Role.ADMIN),async(req,res)=>{
  const parsed=z.object({name:z.string().trim().min(2),username:z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9._-]+$/),password:z.string().min(8).max(128),position:z.string().trim().min(2),role:z.nativeEnum(Role),telegramChatId:z.string().trim().max(64).optional().or(z.literal(""))}).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:"Некоректні дані користувача",details:parsed.error.flatten()});
  if(await prisma.user.findFirst({where:{username:{equals:parsed.data.username,mode:"insensitive"}}}))return res.status(409).json({error:"Таке ім’я користувача вже існує"});
  const {password,...data}=parsed.data;
  res.status(201).json(await prisma.user.create({data:{...data,telegramChatId:data.telegramChatId||null,passwordHash:await bcrypt.hash(password,12),mustChangePassword:true},select:userSelect}));
});
app.patch("/api/users/:id",auth,allow(Role.ADMIN),async(req,res)=>{
  const id=routeParam(req.params.id);
  const parsed=z.object({name:z.string().trim().min(2).optional(),username:z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9._-]+$/).optional(),position:z.string().trim().min(2).optional(),role:z.nativeEnum(Role).optional(),active:z.boolean().optional(),password:z.string().min(8).max(128).optional(),telegramChatId:z.string().trim().max(64).optional().or(z.literal(""))}).safeParse(req.body);
  if(!parsed.success)return res.status(400).json({error:"Некоректні дані користувача",details:parsed.error.flatten()});
  const target=await prisma.user.findFirst({where:{id,deletedAt:null}}); if(!target)return res.status(404).json({error:"Користувача не знайдено"});
  if(parsed.data.username){const duplicate=await prisma.user.findFirst({where:{id:{not:id},username:{equals:parsed.data.username,mode:"insensitive"}}});if(duplicate)return res.status(409).json({error:"Таке ім’я користувача вже існує"});}
  if(id===req.user!.id&&parsed.data.active===false)return res.status(400).json({error:"Не можна заблокувати власний обліковий запис"});
  const {password,...data}=parsed.data;
  res.json(await prisma.user.update({where:{id},data:{...data,telegramChatId:data.telegramChatId===undefined?undefined:(data.telegramChatId||null),passwordHash:password?await bcrypt.hash(password,12):undefined,mustChangePassword:password?true:undefined},select:userSelect}));
});
app.delete("/api/users/:id",auth,allow(Role.ADMIN),async(req,res)=>{
  const id=routeParam(req.params.id); if(id===req.user!.id)return res.status(400).json({error:"Не можна видалити власний обліковий запис"});
  const target=await prisma.user.findFirst({where:{id,deletedAt:null}}); if(!target)return res.status(404).json({error:"Користувача не знайдено"});
  await prisma.user.update({where:{id},data:{active:false,deletedAt:new Date()}}); res.json({ok:true});
});

app.get("/api/checklists",auth,async(req,res)=>{
  await refreshStatuses(req.user);
  const cutoff=new Date(); cutoff.setMonth(cutoff.getMonth()-1);
  const base=req.user!.role===Role.EMPLOYEE?{OR:[{assigneeId:req.user!.id},{assignments:{some:{userId:req.user!.id}}}]}:{};
  const rows=await prisma.checklist.findMany({where:{...base,NOT:{OR:[{status:ChecklistStatus.COMPLETED,completedAt:{lte:cutoff}},{status:ChecklistStatus.OVERDUE,dueDate:{lte:cutoff}}]}},include:listInclude,orderBy:[{dueDate:"asc"}]});
  res.json(rows);
});

app.get("/api/history",auth,async(req,res)=>{
  await refreshStatuses(req.user);
  const cutoff=new Date(); cutoff.setMonth(cutoff.getMonth()-1);
  const base=req.user!.role===Role.EMPLOYEE?{OR:[{assigneeId:req.user!.id},{assignments:{some:{userId:req.user!.id}}}]}:{};
  const rows=await prisma.checklist.findMany({where:{...base,OR:[{status:ChecklistStatus.COMPLETED,completedAt:{lte:cutoff}},{status:ChecklistStatus.OVERDUE,dueDate:{lte:cutoff}}]},include:listInclude,orderBy:[{dueDate:"desc"}]});
  res.json(rows);
});

app.get("/api/checklists/:id",auth,async(req,res)=>{
  const id=routeParam(req.params.id); await refreshOneStatus(id);
  const c=await prisma.checklist.findUnique({where:{id},include:detailInclude});
  if(!c)return res.status(404).json({error:"Не знайдено"});
  if(!(await userCanAccessChecklist(id,req.user!)))return res.status(403).json({error:"Forbidden"});
  res.json(c);
});

const workSchema=z.object({
  type:z.nativeEnum(WorkType).default(WorkType.CHECKLIST),title:z.string().trim().min(3),description:z.string().optional(),startDate:z.string().datetime(),dueDate:z.string().datetime(),assigneeIds:z.array(z.string().min(1)).min(1).max(50),recurrence:z.nativeEnum(Recurrence).default(Recurrence.NONE),
  items:z.array(z.object({id:z.string().optional(),title:z.string().trim().min(1),description:z.string().optional(),requiresPhoto:z.boolean().default(false)})).optional().default([])
});

app.post("/api/checklists",auth,allow(Role.ADMIN,Role.MANAGER),async(req,res)=>{
  const parsed=workSchema.safeParse(req.body); if(!parsed.success)return res.status(400).json({error:"Некоректні дані",details:parsed.error.flatten()});
  if(parsed.data.type===WorkType.CHECKLIST&&parsed.data.items.length<1)return res.status(400).json({error:"Чекліст повинен містити хоча б один пункт"});
  if(new Date(parsed.data.dueDate)<=new Date(parsed.data.startDate))return res.status(400).json({error:"Термін виконання має бути пізніше дати початку"});
  const {items,assigneeIds,...data}=parsed.data;
  const uniqueAssigneeIds=[...new Set(assigneeIds)];
  const row=await prisma.checklist.create({data:{...data,startDate:new Date(data.startDate),dueDate:new Date(data.dueDate),status:new Date(data.startDate)>new Date()?ChecklistStatus.SCHEDULED:ChecklistStatus.OPEN,assigneeId:uniqueAssigneeIds[0],createdById:req.user!.id,assignments:{create:uniqueAssigneeIds.map(userId=>({userId}))},items:data.type===WorkType.CHECKLIST?{create:items.map((i,idx)=>({title:i.title,description:i.description,requiresPhoto:i.requiresPhoto,sortOrder:idx}))}:undefined},include:listInclude});
  void notifyUsers(uniqueAssigneeIds,`📌 CheckFlow: вам призначено ${row.type===WorkType.TASK?"завдання":"чекліст"} «${row.title}». Термін: ${formatUaDate(row.dueDate)}.`);
  res.status(201).json(row);
});

app.patch("/api/checklists/:id",auth,allow(Role.ADMIN,Role.MANAGER),async(req,res)=>{
  const id=routeParam(req.params.id); const existing=await prisma.checklist.findUnique({where:{id},include:{items:true}}); if(!existing)return res.status(404).json({error:"Не знайдено"});
  const parsed=workSchema.partial().safeParse(req.body); if(!parsed.success)return res.status(400).json({error:"Некоректні дані",details:parsed.error.flatten()});
  const data=parsed.data; const type=data.type??existing.type;
  if(type===WorkType.CHECKLIST&&data.items&&data.items.length<1)return res.status(400).json({error:"Чекліст повинен містити хоча б один пункт"});
  const effectiveStart=data.startDate?new Date(data.startDate):existing.startDate; const effectiveDue=data.dueDate?new Date(data.dueDate):existing.dueDate;
  if(effectiveDue<=effectiveStart)return res.status(400).json({error:"Термін виконання має бути пізніше дати початку"});
  const result=await prisma.$transaction(async tx=>{
    if(data.assigneeIds){
      const unique=[...new Set(data.assigneeIds)];
      await tx.checklistAssignment.deleteMany({where:{checklistId:id}});
      await tx.checklistAssignment.createMany({data:unique.map(userId=>({checklistId:id,userId})),skipDuplicates:true});
    }
    if(data.items){
      const keepIds=data.items.map(i=>i.id).filter((x):x is string=>!!x);
      await tx.checklistItem.deleteMany({where:{checklistId:id,id:{notIn:keepIds}}});
      for(let idx=0;idx<data.items.length;idx++){
        const i=data.items[idx];
        if(i.id) await tx.checklistItem.update({where:{id:i.id},data:{title:i.title,description:i.description,requiresPhoto:i.requiresPhoto,sortOrder:idx}});
        else await tx.checklistItem.create({data:{checklistId:id,title:i.title,description:i.description,requiresPhoto:i.requiresPhoto,sortOrder:idx}});
      }
    }
    if(type===WorkType.TASK&&existing.items.length) await tx.checklistItem.deleteMany({where:{checklistId:id}});
    const {items,assigneeIds,...meta}=data;
    const primaryAssigneeId=assigneeIds?.[0];
    return tx.checklist.update({where:{id},data:{...meta,assigneeId:primaryAssigneeId,startDate:meta.startDate?new Date(meta.startDate):undefined,dueDate:meta.dueDate?new Date(meta.dueDate):undefined},include:detailInclude});
  });
  await refreshOneStatus(id); res.json(result);
});

app.patch("/api/items/:id",auth,async(req,res)=>{
  const parsed=z.object({status:z.nativeEnum(ItemStatus),blockedReason:z.string().optional()}).safeParse(req.body); if(!parsed.success)return res.status(400).json({error:"Некоректний статус"});
  if(parsed.data.status===ItemStatus.BLOCKED&&!parsed.data.blockedReason?.trim())return res.status(400).json({error:"Для невиконаного пункту потрібно вказати причину"});
  const id=routeParam(req.params.id); const item=await prisma.checklistItem.findUnique({where:{id},include:{checklist:true,attachments:true}}); if(!item)return res.status(404).json({error:"Не знайдено"});
  if(!(await userCanAccessChecklist(item.checklistId,req.user!)))return res.status(403).json({error:"Forbidden"});
  if(parsed.data.status===ItemStatus.DONE&&item.requiresPhoto&&item.attachments.length===0)return res.status(400).json({error:"Для цього пункту потрібно додати фото перед завершенням"});
  const updated=await prisma.checklistItem.update({where:{id},data:{status:parsed.data.status,blockedReason:parsed.data.status===ItemStatus.BLOCKED?parsed.data.blockedReason:null,completedAt:parsed.data.status===ItemStatus.DONE?new Date():null,updatedById:req.user!.id}});
  await refreshOneStatus(item.checklistId); res.json(updated);
});

app.post("/api/items/:id/photo",auth,upload.single("photo"),async(req,res)=>{
  if(!req.file)return res.status(400).json({error:"Потрібно вибрати фото"});
  const id=routeParam(req.params.id); const item=await prisma.checklistItem.findUnique({where:{id},include:{checklist:true}}); if(!item)return res.status(404).json({error:"Не знайдено"});
  if(!(await userCanAccessChecklist(item.checklistId,req.user!)))return res.status(403).json({error:"Forbidden"});
  res.status(201).json(await prisma.attachment.create({data:{itemId:item.id,fileName:req.file.originalname,filePath:`/uploads/${req.file.filename}`,mimeType:req.file.mimetype}}));
});

app.post("/api/checklists/:id/task-state",auth,async(req,res)=>{
  const parsed=z.object({status:z.enum(["DONE","BLOCKED"]),comment:z.string().max(3000).optional()}).safeParse(req.body); if(!parsed.success)return res.status(400).json({error:"Некоректні дані"});
  const id=routeParam(req.params.id); const c=await prisma.checklist.findUnique({where:{id}}); if(!c||c.type!==WorkType.TASK)return res.status(404).json({error:"Завдання не знайдено"});
  if(!(await userCanAccessChecklist(id,req.user!)))return res.status(403).json({error:"Forbidden"});
  if(parsed.data.status==="BLOCKED"&&!parsed.data.comment?.trim())return res.status(400).json({error:"Вкажіть причину, чому завдання неможливо виконати"});
  const completed=parsed.data.status==="DONE";
  const updated=await prisma.checklist.update({where:{id},data:{status:completed?ChecklistStatus.COMPLETED:ChecklistStatus.BLOCKED,completedAt:completed?new Date():null,taskComment:completed?(parsed.data.comment?.trim()||null):null,taskBlockedReason:completed?null:parsed.data.comment!.trim()}});
  if(completed)await createNextOccurrence(id); res.json(updated);
});

app.post("/api/checklists/:id/comments",auth,async(req,res)=>{
  const parsed=z.object({text:z.string().trim().min(1).max(2000)}).safeParse(req.body); if(!parsed.success)return res.status(400).json({error:"Коментар порожній"});
  const id=routeParam(req.params.id); const c=await prisma.checklist.findUnique({where:{id}}); if(!c)return res.status(404).json({error:"Не знайдено"});
  if(!(await userCanAccessChecklist(id,req.user!)))return res.status(403).json({error:"Forbidden"});
  res.status(201).json(await prisma.comment.create({data:{checklistId:id,authorId:req.user!.id,text:parsed.data.text},include:{author:{select:{id:true,name:true}}}}));
});

app.post("/api/checklists/:id/postpone",auth,async(req,res)=>{
  const parsed=z.object({reason:z.string().trim().min(3).max(2000),newDueDate:z.string().datetime().optional()}).safeParse(req.body); if(!parsed.success)return res.status(400).json({error:"Вкажіть причину відтермінування"});
  const id=routeParam(req.params.id); const c=await prisma.checklist.findUnique({where:{id},include:{assignments:{select:{userId:true}}}}); if(!c)return res.status(404).json({error:"Не знайдено"});
  if(!(await userCanAccessChecklist(id,req.user!)))return res.status(403).json({error:"Forbidden"});
  const creatorCanDirect=req.user!.role!==Role.EMPLOYEE&&c.createdById===req.user!.id;
  if(creatorCanDirect){
    if(!parsed.data.newDueDate)return res.status(400).json({error:"Вкажіть нову дату і час"});
    const newDate=new Date(parsed.data.newDueDate); if(newDate<=c.dueDate)return res.status(400).json({error:"Новий термін має бути пізніше поточного терміну"});
    const result=await prisma.$transaction(async tx=>{
      const request=await tx.postponeRequest.create({data:{checklistId:id,requesterId:req.user!.id,reason:parsed.data.reason,status:PostponeStatus.APPROVED,newDueDate:newDate,decisionNote:parsed.data.reason,decidedById:req.user!.id,decidedAt:new Date()}});
      await tx.checklist.update({where:{id},data:{dueDate:newDate,status:c.startDate>new Date()?ChecklistStatus.SCHEDULED:ChecklistStatus.OPEN}});
      await tx.comment.create({data:{checklistId:id,authorId:req.user!.id,text:`Було відтерміновано до ${formatUaDate(newDate)}. Коментар: ${parsed.data.reason}`}});
      return request;
    });
    const ids=c.assignments.length?c.assignments.map(a=>a.userId):[c.assigneeId];
    void notifyUsers(ids,`📅 CheckFlow: термін «${c.title}» змінено до ${formatUaDate(newDate)}. Коментар: ${parsed.data.reason}`);
    await refreshOneStatus(id); return res.status(201).json({direct:true,request:result});
  }
  if(await prisma.postponeRequest.findFirst({where:{checklistId:id,status:PostponeStatus.PENDING}}))return res.status(409).json({error:"Запит на відтермінування вже очікує рішення"});
  res.status(201).json({direct:false,request:await prisma.postponeRequest.create({data:{checklistId:id,requesterId:req.user!.id,reason:parsed.data.reason}})});
});

app.get("/api/postpone-requests",auth,allow(Role.ADMIN,Role.MANAGER),async(_req,res)=>{
  res.json(await prisma.postponeRequest.findMany({where:{status:PostponeStatus.PENDING},include:{checklist:{include:{assignee:{select:{id:true,name:true,position:true}},assignments:{include:{user:{select:{id:true,name:true,position:true,username:true,role:true}}}}}},requester:{select:{id:true,name:true,position:true}}},orderBy:{createdAt:"asc"}}));
});

app.post("/api/postpone-requests/:id/decision",auth,allow(Role.ADMIN,Role.MANAGER),async(req,res)=>{
  const parsed=z.object({decision:z.enum(["APPROVED","REJECTED"]),newDueDate:z.string().datetime().optional(),note:z.string().max(2000).optional()}).safeParse(req.body); if(!parsed.success)return res.status(400).json({error:"Некоректні дані рішення"});
  if(parsed.data.decision==="APPROVED"&&!parsed.data.newDueDate)return res.status(400).json({error:"Для погодження потрібно вказати нову дату і час"});
  const id=routeParam(req.params.id); const request=await prisma.postponeRequest.findUnique({where:{id}}); if(!request||request.status!==PostponeStatus.PENDING)return res.status(404).json({error:"Активний запит не знайдено"});
  const approved=parsed.data.decision==="APPROVED";
  const result=await prisma.$transaction(async tx=>{
    const updated=await tx.postponeRequest.update({where:{id},data:{status:approved?PostponeStatus.APPROVED:PostponeStatus.REJECTED,newDueDate:approved?new Date(parsed.data.newDueDate!):null,decisionNote:parsed.data.note?.trim()||null,decidedById:req.user!.id,decidedAt:new Date()}});
    if(approved){
      const newDate=new Date(parsed.data.newDueDate!);
      const current=await tx.checklist.findUnique({where:{id:request.checklistId},select:{startDate:true}});
      await tx.checklist.update({where:{id:request.checklistId},data:{dueDate:newDate,status:current&&current.startDate>new Date()?ChecklistStatus.SCHEDULED:ChecklistStatus.OPEN}});
      const formatted=new Intl.DateTimeFormat("uk-UA",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",timeZone:"Europe/Kyiv"}).format(newDate);
      const note=parsed.data.note?.trim();
      await tx.comment.create({data:{checklistId:request.checklistId,authorId:req.user!.id,text:`Було відтерміновано до ${formatted}${note?`. Коментар: ${note}`:""}`}});
    }
    return updated;
  });
  const work=await prisma.checklist.findUnique({where:{id:request.checklistId},select:{title:true,dueDate:true}});
  const requester=await prisma.user.findUnique({where:{id:request.requesterId},select:{telegramChatId:true}});
  if(work&&requester?.telegramChatId){
    const text=approved?`✅ CheckFlow: відтермінування «${work.title}» погоджено. Новий термін: ${formatUaDate(work.dueDate)}${parsed.data.note?.trim()?`. Коментар: ${parsed.data.note.trim()}`:""}`:`❌ CheckFlow: відтермінування «${work.title}» не погоджено. Термін лишився ${formatUaDate(work.dueDate)}${parsed.data.note?.trim()?`. Коментар: ${parsed.data.note.trim()}`:""}`;
    void sendTelegram(requester.telegramChatId,text);
  }
  await refreshOneStatus(request.checklistId); res.json(result);
});

app.use((err:any,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{console.error(err);res.status(500).json({error:"Internal server error"});});
ensureBootstrapUser().then(ensureAssignments).then(ensurePostponeAuditComments).then(()=>{app.listen(port,"0.0.0.0",()=>console.log(`CheckFlow API v0.5.0 on :${port}`));void runDeadlineNotifications();setInterval(()=>void runDeadlineNotifications(),60*60*1000)}).catch(e=>{console.error(e);process.exit(1)});
