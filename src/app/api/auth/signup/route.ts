import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebaseConfig";
import { NextResponse } from "next/server";

export async function POST(req:Request) {
    try {
      const { email, password } = await req.json();
      const createuser = await createUserWithEmailAndPassword(auth, email, password);
      console.log("成功");
      return NextResponse.json({ user: createuser.user });
    } catch(err) {
      console.log("認証できませんでした", err);
      return NextResponse.json({ error: "認証に失敗しました" }, { status: 400 });
    }
  }