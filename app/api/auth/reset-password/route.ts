// app/api/auth/reset-password/route.ts

import { NextResponse } from "next/server";
import { connectDB } from "@/app/lib/mongodb";
import User from "@/app/models/User";

export async function POST(req:Request){

 const {email,password} = await req.json();

 await connectDB();

 const user = await User.findOne({email});

 if(!user){
  return NextResponse.json({
    success:false,
    message:"User not found"
  });
 }

 user.password = password;

 user.otp=null;
 user.otpExpiry=null;

 await user.save();

 return NextResponse.json({
  success:true,
  message:"Password updated"
 });

}


