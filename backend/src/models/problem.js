const mongoose=require("mongoose");
const {Schema}=mongoose;

const problemSchema=new Schema({
    title:{
        type:String,
        required:true
    },
    description:{
         type:String,
        required:true
    },
    difficulty:{
        type:String,
        enum:['easy','medium','hard'],
        required:true
    },
    tags:{
        type:String,
        required:true,
        enum:['array','linkedList','graph','dp','stacks','queues','math','string','hashing','binarySearch','sorting','tree','greedy','recursion','backtracking','twoPointers','slidingWindow','bitManipulation','linked list']
    },
    visibleTestCases:[
       { input:{
        type:String,
        required:true
        },
        output:{
        type:String,
        required:true
        },
        explaination: String,
        explanation: {
            type: String,
            required: function () { return !this.explaination; }
        } 
    }
    ],
    hiddenTestCases:[
       { input:{
        type:String,
        required:true
        },
        output:{
        type:String,
        required:true
        }
    }
    ],
    startCode:[
        {
            language:{
            type:String,
            required:true  
            },
            initialCode:{
                type:String,
               required:true
            }
        }
    ],
    referenceSolution:[
        {
            language:{
            type:String,
            required:true  
            },
            completeCode:{
                type:String,
               required:true
            }
        }
    ],
    driverCode: [{ language: String, template: String }],
    editorial: {type: String, default: ""},
    archivedAt: Date,
    problemCreator:{
        type:Schema.Types.ObjectId,
        ref:'user',
        required:true
    }
})

const Problem=mongoose.model("problem",problemSchema);
module.exports=Problem; 