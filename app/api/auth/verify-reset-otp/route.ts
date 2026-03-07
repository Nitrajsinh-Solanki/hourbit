// app/api/auth/verify-reset-otp/route.ts

import { NextResponse } from "next/server";
import { connectDB } from "@/app/lib/mongodb";
import User from "@/app/models/User";

export async function POST(req:Request){

 const {email,otp} = await req.json();

 await connectDB();

 const user = await User.findOne({email});

 if(!user || user.otp !== otp){
  return NextResponse.json({
   success:false,
   message:"Invalid OTP"
  });
 }

 if(!user.otpExpiry || user.otpExpiry < new Date()){
  return NextResponse.json({
   success:false,
   message:"OTP expired"
  });
 }

 return NextResponse.json({
  success:true
 });

}


