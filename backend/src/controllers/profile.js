const User=require('../models/user');
const Problem=require('../models/problem');
const Submission=require('../models/submission');
const {summarize}=require('../utils/profileStats');
const {recommend}=require('../utils/recommendations');
async function getRecommendations(req,res){try{const [problems,groups]=await Promise.all([Problem.find({archivedAt:null}).select('title difficulty tags').lean(),Submission.aggregate([{$match:{userId:req.result._id,status:{$in:['accepted','rejected']}}},{$group:{_id:{problemId:'$problemId',status:'$status'},count:{$sum:1}}}])]);res.json(recommend(problems,groups));}catch{res.status(500).send('Unable to load recommendations');}}
const publicProfile=u=>({firstName:u.firstName,lastName:u.lastName||'',emailId:u.emailId,createdAt:u.createdAt});
async function getProfile(req,res){
 try{
  const match={userId:req.result._id,status:{$in:['accepted','rejected','error']}};
  const [problems,groups,activity,recent]=await Promise.all([
   Problem.find({archivedAt:null}).select('title difficulty tags').lean(),
   Submission.aggregate([{$match:match},{$group:{_id:{problemId:'$problemId',status:'$status',language:'$language'},count:{$sum:1}}}]),
   Submission.aggregate([{$match:{...match,status:{$in:['accepted','rejected']}}},{$group:{_id:{$dateToString:{format:'%Y-%m-%d',date:'$createdAt',timezone:'Asia/Kolkata'}},count:{$sum:1}}}]),
   Submission.find(match).select('problemId language status createdAt errorMessage').sort({createdAt:-1,_id:-1}).limit(10).populate('problemId','title archivedAt').lean()
  ]);
  res.json({profile:publicProfile(req.result),...summarize(problems,groups,activity,recent.map(s=>({id:s._id,problemId:s.problemId&&!s.problemId.archivedAt?s.problemId._id:null,title:s.problemId?.title||'Removed problem',language:s.language,status:s.status,createdAt:s.createdAt}))) });
 }catch(e){console.error('Profile analytics failed:',e.name);res.status(500).send('Unable to load profile');}
}
async function updateProfile(req,res){
 const {firstName,lastName=''}=req.body||{};
 if(typeof firstName!=='string'||typeof lastName!=='string'||firstName.trim().length<3||firstName.trim().length>20||(lastName.trim()&&(lastName.trim().length<3||lastName.trim().length>20)))return res.status(400).send('Names must contain 3–20 characters; last name is optional');
 try{const user=await User.findByIdAndUpdate(req.result._id,lastName.trim()?{$set:{firstName:firstName.trim(),lastName:lastName.trim()}}:{$set:{firstName:firstName.trim()},$unset:{lastName:1}},{new:true,runValidators:true}).select('-password');if(!user)return res.status(404).send('User not found');res.json(publicProfile(user));}catch{res.status(500).send('Unable to update profile');}
}
module.exports={getProfile,updateProfile,getRecommendations};
