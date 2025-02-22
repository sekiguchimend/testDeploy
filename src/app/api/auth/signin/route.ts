console.log("ログインAPIに接続しています")
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebaseConfig";
import { NextResponse } from "next/server";
export async function POST(req:Request){
    try{
       const {email,password} = await req.json()
       const createduser = await signInWithEmailAndPassword(auth,email,password)
       return NextResponse.json({user:createduser.user})
    }catch(err){

    }
}