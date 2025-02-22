import { db } from "@/lib/firebaseConfig";
import { collection,addDoc,Timestamp, getDocs } from "firebase/firestore";
import { NextResponse } from "next/server";

//投稿を追加するAPI
export async function POST (req:Request){
    const { money,prefecture,city,time,howMany,content} = await req.json()
    const createData = await addDoc(collection(db,"posts"),{
        money,
        content,
        prefecture,
        city,
        time,
        howMany,
        createAt: Timestamp.now()
    })
    return NextResponse.json(createData)
}

//投稿を表示するAPI

export async function GET() {
    const createdData = await getDocs(collection(db,"posts"))
    const posts = await createdData.docs.map((doc)=>({
        
     id:doc.id,
     ...doc.data()
    }))
    return NextResponse.json(posts);
}