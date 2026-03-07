
// app/auth/forgot-password/page.tsx


"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

export default function ForgotPasswordPage() {

  const router = useRouter();

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["","","","","",""]);
  const [otpSent, setOtpSent] = useState(false);

  const [timer,setTimer] = useState(0);
  const [loading,setLoading] = useState(false);

  useEffect(()=>{

    let interval:any;

    if(timer>0){
      interval=setInterval(()=>{
        setTimer(prev=>prev-1);
      },1000);
    }

    return ()=>clearInterval(interval);

  },[timer]);


  const sendOTP = async ()=>{

    if(!email){
      toast.error("Enter email");
      return;
    }

    try{

      setLoading(true);

      const res = await fetch("/api/auth/forgot-password",{
        method:"POST",
        body:JSON.stringify({email})
      });

      const data = await res.json();

      if(!data.success){
        toast.error(data.message);
        return;
      }

      toast.success("OTP sent to email");

      setOtpSent(true);
      setTimer(60);

    }catch{
      toast.error("Something went wrong");
    }finally{
      setLoading(false);
    }

  };


  const verifyOTP = async ()=>{

    const code = otp.join("");

    if(code.length !==6){
      toast.error("Enter valid OTP");
      return;
    }

    try{

      setLoading(true);

      const res = await fetch("/api/auth/verify-reset-otp",{
        method:"POST",
        body:JSON.stringify({email,otp:code})
      });

      const data = await res.json();

      if(!data.success){
        toast.error(data.message);
        return;
      }

      toast.success("OTP verified");

      router.push(`/auth/reset-password?email=${email}`);

    }catch{
      toast.error("Verification failed");
    }finally{
      setLoading(false);
    }

  };


  const handleOtpChange=(value:string,index:number)=>{

    if(!/^\d*$/.test(value)) return;

    const newOtp=[...otp];
    newOtp[index]=value;

    setOtp(newOtp);

    if(value && index<5){
      const next=document.getElementById(`otp-${index+1}`);
      next?.focus();
    }

  };



  return (

    <div className="flex items-center justify-center min-h-screen px-4">

      <div className="bg-white shadow-xl rounded-xl p-8 w-full max-w-md space-y-6">

        <h1 className="text-2xl font-bold text-center">
          Forgot Password
        </h1>

        <input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e)=>setEmail(e.target.value)}
          className="w-full border px-3 py-2 rounded-lg"
        />

        {!otpSent && (

          <button
            onClick={sendOTP}
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-2 rounded-lg"
          >
            {loading ? "Sending..." : "Send OTP"}
          </button>

        )}

        {otpSent && (

          <>
            <div className="flex gap-2 justify-between">

              {otp.map((d,i)=>(
                <input
                  key={i}
                  id={`otp-${i}`}
                  maxLength={1}
                  value={d}
                  onChange={(e)=>handleOtpChange(e.target.value,i)}
                  className="w-12 h-12 text-center border rounded-lg"
                />
              ))}

            </div>

            <button
              onClick={verifyOTP}
              className="w-full bg-green-600 text-white py-2 rounded-lg"
            >
              Verify OTP
            </button>

            <button
              disabled={timer>0}
              onClick={sendOTP}
              className="text-blue-600 text-sm"
            >
              {timer>0 ? `Resend in ${timer}s` : "Resend OTP"}
            </button>
          </>
        )}

      </div>

    </div>

  );
}