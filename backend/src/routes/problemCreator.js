const express=require("express");
const problemRouter=express.Router();
const adminMiddleware=require("../middleware/adminMiddleware");
const {getAdminProblem,getSolutions,createProblem,updateProblem,deleteProblem,getProblemById,getAllProblem,solvedAllProblembyUser,submittedProblem}=require("../controllers/UserProblem")
const userMiddleware=require("../middleware/userMiddleware");

problemRouter.get("/admin/:id",adminMiddleware,getAdminProblem);
problemRouter.get("/solutions/:id",userMiddleware,getSolutions);
problemRouter.post("/create",adminMiddleware,createProblem);
problemRouter.put("/update/:id",adminMiddleware,updateProblem);
problemRouter.delete("/delete/:id",adminMiddleware,deleteProblem);



problemRouter.get("/problembyID/:id",userMiddleware,getProblemById);
problemRouter.get("/getAllProblem",userMiddleware,getAllProblem);
problemRouter.get("/problemSolvedByUser",userMiddleware,solvedAllProblembyUser);
problemRouter.get("/submittedProblem/:id",userMiddleware,submittedProblem);

module.exports=problemRouter;