const {getLanguageById,submitBatch,submitToken} = require("../utils/ProblemUtility");
const Problem = require("../models/problem")
const User = require("../models/user");
const Submission = require("../models/submission");

const createProblem = async (req,res)=>{

    const {title,description,difficulty,tags,
        visibleTestCases,hiddenTestCases,startCode,
        referenceSolution, problemCreator
    } = req.body;


    try{
       
      for(const {language,completeCode} of referenceSolution){
         

        // source_code:
        // language_id:
        // stdin: 
        // expectedOutput:

        const languageId = getLanguageById(language);
          
        // I am creating Batch submission
        const submissions = visibleTestCases.map((testcase)=>({
            source_code:completeCode,
            language_id: languageId,
            stdin: testcase.input,
            expected_output: testcase.output
        }));


        const submitResult = await submitBatch(submissions);
        // console.log(submitResult);

        const resultToken = submitResult.map((value)=> value.token);

        // ["db54881d-bcf5-4c7b-a2e3-d33fe7e25de7","ecc52a9b-ea80-4a00-ad50-4ab6cc3bb2a1","1b35ec3b-5776-48ef-b646-d5522bdeb2cc"]
        
       const testResult = await submitToken(resultToken);

      //  console.log(testResult);

       for(const test of testResult){
        if(test.status_id!=3){
         return res.status(400).send("Error Occured");
        }
       }

      }


      // We can store it in our DB

    const userProblem =  await Problem.create({
        ...req.body,
        problemCreator: req.result._id
      });

      res.status(201).send("Problem Saved Successfully");
    }
    catch(err){
        res.status(400).send("Error: "+err);
    }
}

const updateProblem = async (req,res)=>{
    const {id} = req.params;
    const {title,description,difficulty,tags,
        visibleTestCases,hiddenTestCases,startCode,
        referenceSolution, problemCreator
    } = req.body;

try{
    if(!id){
        return res.status(400).send("Problem ID is required");
    }

    const DSAproblem = await Problem.findById(id); 
    if(!DSAproblem){
        return res.status(400).send("Problem not found");
    }

      for(const {language,completeCode} of referenceSolution){
         

        const languageId = getLanguageById(language);
          
        // I am creating Batch submission
        const submissions = visibleTestCases.map((testcase)=>({
            source_code:completeCode,
            language_id: languageId,
            stdin: testcase.input,
            expected_output: testcase.output
        }));


        const submitResult = await submitBatch(submissions);
        // console.log(submitResult);

        const resultToken = submitResult.map((value)=> value.token);

        // ["db54881d-bcf5-4c7b-a2e3-d33fe7e25de7","ecc52a9b-ea80-4a00-ad50-4ab6cc3bb2a1","1b35ec3b-5776-48ef-b646-d5522bdeb2cc"]
        
       const testResult = await submitToken(resultToken);

      //  console.log(testResult);

       for(const test of testResult){
        if(test.status_id!=3){
         return res.status(400).send("Error Occured");
        }
       }

      }

      const newProblem = await Problem.findByIdAndUpdate(id,{...req.body},{runValidators:true,new:true});
      if(!newProblem){
        return res.status(400).send("Problem not found");
      }
      res.status(200).send("Problem updated successfully");
    }
    catch(err){
        res.status(400).send("Error: "+err);
    }




}       

const getProblemById = async (req,res)=>{
    const {id} = req.params;
    try{
    if(!id){
        return res.status(400).send("Problem ID is required");
    }   
    const getProblem = await Problem.findById(id).select('_id title description difficulty tags visibleTestCases startCode referenceSolution');
    if(!getProblem){
        return res.status(400).send("Problem not found");
    }
    res.status(200).send(getProblem);
}catch(err){
    res.status(400).send("Error: "+err);
}
}

const getAllProblem = async (req,res)=>{
    try{
        const allProblems = await Problem.find({}).select('_id title difficulty tags') ;

        if(allProblems.length===0){
            return res.status(400).send("No Problem found");
        }

        res.status(200).send(allProblems);
    }
    catch(err){
        res.status(400).send("Error: "+err);
    }
}
// const getAllProblem = async (req,res) => {
//     try {
//         const allProblems = await Problem.find({})
//             .skip(10)
//             .limit(10);

//         if (allProblems.length === 0) {
//             return res.status(400).send("No Problem found");
//         }

//         res.status(200).send(allProblems);
//     }

//     catch(err) {
//         res.status(400).send("Error: " + err);
//     }
// }

const solvedAllProblembyUser = async (req,res)=>{
    try{
       const userId=req.result._id;
       const user=await User.findById(userId).populate({
        path:'problemsolved',
        select:'_id title difficulty tags'
       });
       res.status(200).send(user.problemsolved);
    }catch(err){
        res.status(400).send("Error: "+err);
    } 
}

const submittedProblem = async (req,res)=>{ 
    try{
        const userId=req.result._id;
        const problemId=req.params.id;

        const ans=await Submission.find({userId,problemId});
        if(ans.length===0){
            return res.status(400).send("No submission found");
        }   
        res.status(200).send(ans);
    }catch(err){
            res.status(400).send("Error: "+err);
        }       

    }





module.exports = {createProblem,updateProblem,getProblemById,getAllProblem,solvedAllProblembyUser,submittedProblem};


// const submissions = [
//     {
//       "language_id": 46,
//       "source_code": "echo hello from Bash",
//       stdin:23,
//       expected_output:43,
//     },
//     {
//       "language_id": 123456789,
//       "source_code": "print(\"hello from Python\")"
//     },
//     {
//       "language_id": 72,
//       "source_code": ""
//     }
//   ]