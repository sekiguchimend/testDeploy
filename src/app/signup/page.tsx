"use client";
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import styles from "../signup/signup.module.css"
import Link from "next/link";
export default function Signin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("無し");
  const [submiting,setsubmiting] = useState(false)
  const router = useRouter()
  const submitFunction = async (event: FormEvent) => {
    event.preventDefault(); // フォームのデフォルト動作を防ぐ
    setMessage("送信中...");
    setsubmiting(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      setMessage("サインイン成功！");
      setsubmiting(false);
      console.log("ユーザー作成成功:", data.user);
    } catch (error: any) {
      setMessage("エラー: " + error.message);
      console.error("サインアップエラー:", error);
    }
  };
  const nextPage = () =>{
    router.push("./Home")
  }

  return (
    <div className={styles.signup_container}>
      <form onSubmit={submitFunction}className={styles.signup_form}>
        <label htmlFor="email"className={styles.signup_label}>Email</label>
        <input
          id="email"
          value={email}
          type="email"
          placeholder="E-メール"
          onChange={(e) => setEmail(e.target.value)}
          required
          className={styles.signup_input}
        />
        <label htmlFor="password"className={styles.signup_label}>Password</label>
        <input
          id="password"
          value={password}
          type="password"
          placeholder="パスワード"
          onChange={(e) => setPassword(e.target.value)}
          required
          className={styles.signup_input}
        />
        {submiting ? (
        <button type="button"className={styles.signup_button} disabled>送信中...</button>
      ) : message === "サインイン成功！" ? (
        <button type="button" onClick={nextPage}className={styles.signup_button}>登録完了！ホーム画面へ</button>
      ) : (
        <button type="submit"className={styles.signup_button}>新規登録</button>
      )}
      <p className={styles.signup_p}>アカウントを作成済みの方は</p>
        <Link href="./signin"className={styles.signup_Link}>ログイン</Link>
        
      </form>
    </div>
  );
}
