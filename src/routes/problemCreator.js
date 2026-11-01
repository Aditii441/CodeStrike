const express=require("express");
const problemRouter=express.Router();
const adminMiddleware=require("../middleware/adminMiddleware");
const {createProblem,updateProblem,getProblemById,getAllProblem,solvedAllProblembyUser,submittedProblem}=require("../controllers/UserProblem")
const userMiddleware=require("../middleware/userMiddleware");

problemRouter.post("/create",adminMiddleware,createProblem);
problemRouter.patch("/update/:id",adminMiddleware,updateProblem);
// problemRouter.delete("/delete/:id",adminMiddleware,deleteProblem);



problemRouter.get("/problembyID/:id",userMiddleware,getProblemById);
problemRouter.get("/getAllProblem",userMiddleware,getAllProblem);
problemRouter.get("/problemSolvedByUser",userMiddleware,solvedAllProblembyUser);
problemRouter.get("/submittedProblem/:id",userMiddleware,submittedProblem);

module.exports=problemRouter;