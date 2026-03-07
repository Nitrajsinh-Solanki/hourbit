// hourbit\app\api\auth\forgot-password\route.ts




import { NextResponse } from "next/server";
import { connectDB } from "@/app/lib/mongodb";
import User from "@/app/models/User";
import { sendOTPEmail } from "@/app/lib/mailer";

export async function POST(req:Request){

 const {email} = await req.json();

 await connectDB();

 const user = await User.findOne({email});

 if(!user){
  return NextResponse.json({
    success:false,
    message:"Email does not exist"
  });
 }

 const otp = Math.floor(100000 + Math.random()*900000).toString();

 user.otp=otp;
 user.otpExpiry=new Date(Date.now()+10*60*1000);

 await user.save();

 await sendOTPEmail(email,otp);

 return NextResponse.json({
  success:true,
  message:"OTP sent"
 });

}