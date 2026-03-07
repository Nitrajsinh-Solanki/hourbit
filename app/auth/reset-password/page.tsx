// app/auth/reset-password/page.tsx

"use client";

import { useState } from "react";
import { useRouter,useSearchParams } from "next/navigation";
import toast from "react-hot-toast";

export default function ResetPasswordPage(){

 const router = useRouter();
 const params = useSearchParams();

 const email = params.get("email");

 const [password,setPassword]=useState("");
 const [confirmPassword,setConfirmPassword]=useState("");

 const handleReset = async()=>{

  if(password !== confirmPassword){
    toast.error("Passwords do not match");
    return;
  }

  const res = await fetch("/api/auth/reset-password",{
    method:"POST",
    body:JSON.stringify({email,password})
  });

  const data = await res.json();

  if(!data.success){
    toast.error(data.message);
    return;
  }

  toast.success("Password updated");

  router.push("/auth/login");

 };


 return(

  <div className="flex items-center justify-center min-h-screen">

    <div className="bg-white p-8 shadow-xl rounded-xl w-full max-w-md space-y-4">

      <h1 className="text-xl font-bold text-center">
        Reset Password
      </h1>

      <input
        type="password"
        placeholder="New Password"
        className="w-full border px-3 py-2 rounded-lg"
        value={password}
        onChange={(e)=>setPassword(e.target.value)}
      />

      <input
        type="password"
        placeholder="Confirm Password"
        className="w-full border px-3 py-2 rounded-lg"
        value={confirmPassword}
        onChange={(e)=>setConfirmPassword(e.target.value)}
      />

      <button
        onClick={handleReset}
        className="w-full bg-indigo-600 text-white py-2 rounded-lg"
      >
        Reset Password
      </button>

    </div>

  </div>

 );

}