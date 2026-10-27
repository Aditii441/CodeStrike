const validator=require("validator");

const validate= (data)=>{

    const mandatoryField=['firstName','emailId','password'];
    const IsAllowed=mandatoryField.every((k)=>Object.keys(data).includes(k));

    if(!IsAllowed){
        throw new Error("some field is missing");
    }

    if(!validator.isEmail(data.emailId)){
        throw new Error("Inavlid email")
    }
    if(!validator.isStrongPassword(data.password)){
        throw new Error("Weak password");
    }
}

module.exports=validate