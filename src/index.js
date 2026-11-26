const dns = require("dns");
dns.setServers([
  "8.8.8.8",
  "8.8.4.4",
]);

dns.setDefaultResultOrder("ipv4first");

const express=require("express");
const app=express();
require("dotenv").config();
const main=require("./config/db");
var cookieParser=require("cookie-parser");
const authRouter=require("./routes/userAuth");
const RedisClient = require("./config/redis");
const problemRouter=require("./routes/problemCreator")
const submitRouter=require("./routes/submit")
const cors = require('cors')

app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true 
}))

app.use(express.json());        //json to javascript object
app.use(cookieParser());        //cookie to javascript object


app.use("/user",authRouter);   
app.use("/problem",problemRouter);
app.use("/submission",submitRouter);
  const InitializeConnection=async ()=>{
     try{
      await Promise.all([main(),RedisClient.connect()]);
      console.log("rdb connected");

       app.listen(process.env.PORT,()=>{
       console.log("Server listening at port:"+ process.env.PORT);
     })
  }
  catch(err){
  console.log("Error:"+err);
}
  }


InitializeConnection();
