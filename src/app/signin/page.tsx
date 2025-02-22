"use client"
import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../signin/signin.module.css"
import Link from "next/link";

export default function Login (){
    const [email,setEmail] = useState("")
    const [password,setpassword] = useState("")
    const [submitting, setsubmiting] = useState(false)
    const [message, setmessage] = useState("")
    const router = useRouter()
  const submitFunction = async(e:Event)=>{
    e.preventDefault()
    setsubmiting(true)
    try{
     const res = await fetch("/api/auth/signin",{
        method:"POST",
        headers:{ "Content-Type": "application/json" },
        body: JSON.stringify({
            email,
            password
        })
     })
     const data = await res.json()
     console.log( setmessage("succes"))
    
     setsubmiting(false)
    }catch(err){
     console.log("失敗です")
    }
  }
  const nextPage = () =>{
    router.push("./home")
  }
    return(
        <div className={styles.signin_container}>
        <form onSubmit={submitFunction}className={styles.signin_form}>
          <label htmlFor="email"className={styles.signin_labell}>Email</label>
          <input
            id="email"
            value={email}
            type="email"
            placeholder="E-メール"
            onChange={(e) => setEmail(e.target.value)}
            required
            className={styles.signin_input}
          />
          <label htmlFor="password"className={styles.signin_label}>Password</label>
          <input
            id="password"
            value={password}
            type="password"
            placeholder="パスワード"
            onChange={(e) => setpassword(e.target.value)}
            required
            className={styles.signin_input}
          />
          {submitting ? (
          <button type="button" disabled className={styles.signin_button}>送信中...</button>
        ) : message === "succes" ? (
          <button type="button" onClick={nextPage}className={styles.signin_button}>ログイン完了！ホームページへ</button>
        ) : (
          <button type="submit"className={styles.signin_button}>ログイン</button>
        )}
          <p className={styles.signin_p}>アカウントを新規作成の方は</p>
          <Link href="./signup"className={styles.signin_Link}>新規作成</Link>
          
        </form>

      </div>
    )
}